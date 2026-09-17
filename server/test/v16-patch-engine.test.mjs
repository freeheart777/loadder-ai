import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteProjectsRouter } from "../app/routes/site-projects.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { documentHash } from "../app/services/site-document-revision-service.mjs";
import { evaluatePatch, OUTCOME } from "../app/services/v16-patch-engine.mjs";
import { LIMITS } from "../app/services/v16-patch-policy.mjs";
import { projectPublicStorePresentation } from "../app/services/store-public-presentation.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

function fixture() {
  const db = createSiteTestDb();
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({
    repository,
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  return { db, repository, service };
}

const section = (id, type, title) => ({ id, type, enabled: true, title, subtitle: "", backgroundColor: "#ffffff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32 });

const multiPage = () => ({
  storeBuilderV16: {
    version: 16,
    header: { storeName: "شرکت" },
    hero: { enabled: true, title: "عنوان خانه", subtitle: "زیرعنوان" },
    nav: { enabled: true, ctaLabel: "تماس", ctaHref: "/contact" },
    footer: { enabled: true, text: "©" },
    seo: { title: "سایت", description: "توضیح" },
    pages: [
      { id: "h", title: "خانه", slug: "", showInNav: true, seo: { title: "خانه", description: "د" }, sections: [section("s1", "about", "درباره"), section("s2", "services", "خدمات")] },
      { id: "t", title: "تیم", slug: "team", showInNav: true, seo: { title: "تیم", description: "د" }, sections: [section("s3", "team", "تیم")] },
    ],
  },
});

const seeded = (service, content = multiPage()) => service.create({ name: "شرکت", siteType: "BUSINESS", content });
const op = (type, extra) => ({ type, ...extra });
const builderOf = (doc) => doc.storeBuilderV16;
const outcomes = (results) => results.map((r) => r.outcome);

/** Propose + apply in one step, the way a caller would. */
function patch(service, id, operations, key = `k-${Math.random()}`) {
  const proposed = service.proposePatch(id, { operations, idempotencyKey: key });
  return service.applyPatch(id, { patchId: proposed.patch.id });
}

// ------------------------------------------------------ 1-6 valid operations

test("every supported operation applies deterministically", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);

    // SET / UNSET
    patch(service, p.id, [op("SET", { target: "hero", path: "title", value: "عنوان تازه" })]);
    assert.equal(service.get(p.id).content.storeBuilderV16.hero.title, "عنوان تازه");
    patch(service, p.id, [op("UNSET", { target: "hero", path: "subtitle" })]);
    assert.ok(!("subtitle" in service.get(p.id).content.storeBuilderV16.hero));

    // INSERT / REMOVE
    patch(service, p.id, [op("INSERT", { target: "page:team", value: section("s4", "about", "افزوده"), index: 0 })]);
    assert.deepEqual(builderOf(service.get(p.id).content).pages[1].sections.map((s) => s.id), ["s4", "s3"]);
    patch(service, p.id, [op("REMOVE", { target: "section:s4" })]);
    assert.deepEqual(builderOf(service.get(p.id).content).pages[1].sections.map((s) => s.id), ["s3"]);

    // MOVE across pages
    patch(service, p.id, [op("MOVE", { target: "section:s2", toTarget: "page:team", index: 0 })]);
    const afterMove = builderOf(service.get(p.id).content);
    assert.deepEqual(afterMove.pages[0].sections.map((s) => s.id), ["s1"]);
    assert.deepEqual(afterMove.pages[1].sections.map((s) => s.id), ["s2", "s3"]);

    // REORDER
    patch(service, p.id, [op("REORDER", { target: "page:team", order: ["s3", "s2"] })]);
    assert.deepEqual(builderOf(service.get(p.id).content).pages[1].sections.map((s) => s.id), ["s3", "s2"]);
  });
  db.close();
});

// ---------------------------------------------------- 7-13 validation limits

test("malformed targets, paths, values and payloads are each rejected on their own terms", () => {
  const doc = multiPage();
  const check = (operation, expected) => assert.equal(evaluatePatch(doc, [operation]).results[0].outcome, expected, JSON.stringify(operation).slice(0, 80));

  check(op("SET", { target: "nope", path: "title", value: "x" }), OUTCOME.REJECTED_INVALID_TARGET);
  check(op("SET", { target: "page:missing", path: "title", value: "x" }), OUTCOME.REJECTED_INVALID_TARGET);
  check(op("SET", { target: "section:missing", path: "title", value: "x" }), OUTCOME.REJECTED_INVALID_TARGET);
  check(op("SET", { target: "hero", path: "notAProperty", value: "x" }), OUTCOME.REJECTED_INVALID_PATH);
  check(op("SET", { target: "hero", path: "title", value: { fn: undefined } }), OUTCOME.REJECTED_INVALID_VALUE); // undefined is not a JSON value
  check(op("SET", { target: "hero", path: "title", value: "x".repeat(LIMITS.maxStringValue + 1) }), OUTCOME.REJECTED_INVALID_VALUE);

  // Prototype pollution at any depth.
  for (const path of ["__proto__", "constructor", "prototype", "a.__proto__", "a.b.constructor"]) {
    check(op("SET", { target: "hero", path, value: "x" }), OUTCOME.REJECTED_INVALID_PATH);
  }
  check(op("SET", { target: "hero", path: "a.b.c.d", value: "x" }), OUTCOME.REJECTED_INVALID_PATH); // depth
  check(op("SET", { target: "hero", path: "enabled", value: { __proto__: 1 } }), OUTCOME.ACCEPTED);

  // Operation count.
  const many = Array.from({ length: LIMITS.maxOperations + 1 }, () => op("SET", { target: "hero", path: "title", value: "x" }));
  const tooMany = evaluatePatch(doc, many);
  assert.equal(tooMany.tooMany, true);
  assert.equal(tooMany.accepted, 0);
  assert.deepEqual(tooMany.proposed, doc, "an over-long patch changes nothing");
});

test("a prototype-polluting value cannot reach the document", () => {
  const doc = multiPage();
  // JSON.parse makes __proto__ an OWN property, so the value carries it as data.
  const result = evaluatePatch(doc, [op("SET", { target: "hero", path: "enabled", value: JSON.parse('{"__proto__":{"polluted":true}}') })]);
  assert.equal(result.results[0].outcome, OUTCOME.REJECTED_INVALID_VALUE);
  assert.equal({}.polluted, undefined, "Object.prototype is untouched");
  assert.equal(result.accepted, 0);
  assert.deepEqual(result.proposed, doc, "nothing reached the document");

  // A path segment naming a prototype vector is refused before any value check.
  const viaPath = evaluatePatch(doc, [op("SET", { target: "hero", path: "__proto__", value: { polluted: true } })]);
  assert.equal(viaPath.results[0].outcome, OUTCOME.REJECTED_INVALID_PATH);
  assert.equal({}.polluted, undefined);
});

// ------------------------------------------ 14-17 partial rejection + commerce

test("a protected Commerce property is rejected while the independent presentation change still applies", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const result = patch(service, p.id, [
      op("SET", { target: "section:s1", path: "spacingTop", value: 64 }),          // presentation
      op("SET", { target: "section:s1", path: "priceMinor", value: 1 }),           // protected
    ]);
    assert.deepEqual(outcomes(result.results), [OUTCOME.ACCEPTED, OUTCOME.REJECTED_PROTECTED_PROPERTY]);
    assert.equal(result.status, "PARTIALLY_APPLIED");
    assert.equal(result.applied, true, "the accepted operation still applies");

    const s1 = builderOf(service.get(p.id).content).pages[0].sections[0];
    assert.equal(s1.spacingTop, 64, "the presentation change landed");
    assert.ok(!("priceMinor" in s1), "the protected property never reached the document");
  });
  db.close();
});

test("every canonical Commerce truth name is refused at any depth", () => {
  const doc = multiPage();
  const protectedPaths = ["price", "priceMinor", "basePriceMinor", "sku", "inventory", "inventoryQuantity", "stock",
    "tax", "payment", "paymentStatus", "orderStatus", "customerId", "providerTransactionId", "productSettings", "productOverrides"];
  for (const path of protectedPaths) {
    assert.equal(evaluatePatch(doc, [op("SET", { target: "section:s1", path, value: 1 })]).results[0].outcome,
      OUTCOME.REJECTED_PROTECTED_PROPERTY, path);
  }
  // Nested too.
  assert.equal(evaluatePatch(doc, [op("SET", { target: "section:s1", path: "items.price", value: 1 })]).results[0].outcome, OUTCOME.REJECTED_PROTECTED_PROPERTY);
  // And a protected key smuggled inside an accepted value.
  assert.equal(evaluatePatch(doc, [op("SET", { target: "section:s1", path: "title", value: { priceMinor: 9 } })]).results[0].outcome, OUTCOME.REJECTED_INVALID_VALUE);
});

// ------------------------------------------------------------- 18-22 preview

test("preview proposes without touching the draft, history, or publish state", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    service.publish(p.id);
    const liveBefore = repository.getPublishedPublic(p.id).version.content.storeBuilderV16.hero.title;
    const contentBefore = repository.get(p.id).content;

    // Proposing records the patch and (for a legacy site) the baseline revision;
    // it does not touch the document itself.
    const proposed = service.proposePatch(p.id, { operations: [op("SET", { target: "hero", path: "title", value: "پیشنهاد" })], idempotencyKey: "pv" });
    assert.deepEqual(repository.get(p.id).content, contentBefore, "proposing does not mutate the draft");
    const revisionsBefore = service.documentRevisions(p.id).length;

    const first = service.previewPatch(p.id, proposed.patch.id);

    assert.equal(first.proposed.storeBuilderV16.hero.title, "پیشنهاد", "the proposal shows the change");
    assert.deepEqual(repository.get(p.id).content, contentBefore, "content_json is untouched");
    assert.equal(service.documentRevisions(p.id).length, revisionsBefore, "no revision appended");
    assert.equal(repository.getPublishedPublic(p.id).version.content.storeBuilderV16.hero.title, liveBefore, "live is untouched");

    // Repeated preview is deterministic.
    const second = service.previewPatch(p.id, proposed.patch.id);
    assert.equal(second.proposedHash, first.proposedHash);
    assert.equal(first.proposedHash, documentHash(first.proposed));
  });
  db.close();
});

// ----------------------------------------------------------------- 23-26 CAS

test("a patch composed on a stale revision conflicts and changes nothing", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const proposed = service.proposePatch(p.id, { operations: [op("SET", { target: "hero", path: "title", value: "از نسخه قدیمی" })], idempotencyKey: "cas" });

    // Someone else advances the draft first.
    service.saveDraft(p.id, { content: multiPage(), idempotencyKey: "other" });
    const contentBefore = repository.get(p.id).content;
    const revisionsBefore = service.documentRevisions(p.id).length;

    const result = service.applyPatch(p.id, { patchId: proposed.patch.id });
    assert.equal(result.conflict, true);
    assert.equal(result.applied, false);
    assert.equal(result.patch.status, "CONFLICTED");
    assert.deepEqual(repository.get(p.id).content, contentBefore, "no draft mutation");
    assert.equal(service.documentRevisions(p.id).length, revisionsBefore, "no revision appended");

    // A patch composed on the CURRENT revision applies.
    const fresh = service.proposePatch(p.id, { operations: [op("SET", { target: "hero", path: "title", value: "تازه" })], idempotencyKey: "cas2" });
    const ok = service.applyPatch(p.id, { patchId: fresh.patch.id });
    assert.equal(ok.applied, true);
    assert.equal(repository.get(p.id).content.storeBuilderV16.hero.title, "تازه");
  });
  db.close();
});

// --------------------------------------------------------- 27-34 apply/atomic

test("apply commits patch state, revision and content_json together", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const before = service.documentRevisions(p.id).length;
    const result = patch(service, p.id, [op("SET", { target: "hero", path: "title", value: "اتمی" })]);

    assert.equal(result.status, "APPLIED");
    assert.equal(service.documentRevisions(p.id).length, before + 2, "baseline + the applied revision");
    assert.equal(result.patch.appliedRevisionId, result.revision.id);
    assert.equal(documentHash(repository.get(p.id).content), result.revision.documentHash, "content_json matches the revision hash");
  });
  db.close();
});

test("a failure inside apply rolls back patch state, revision and content_json", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    service.saveDraft(p.id, { content: multiPage(), idempotencyKey: "seed" });
    const contentBefore = repository.get(p.id).content;
    const revisionsBefore = service.documentRevisions(p.id).length;

    // An INSERT whose section makes the page collection invalid fails when the
    // document is written, after the revision has been prepared.
    const proposed = service.proposePatch(p.id, {
      operations: [op("SET", { target: "page:team", path: "title", value: "تیم" }), op("SET", { target: "page:team", path: "showInNav", value: false })],
      idempotencyKey: "boom",
    });
    const patchId = proposed.patch.id;
    // Fail the content write itself, inside the apply transaction and after the
    // revision has been prepared, so the rollback is the real one.
    db.exec("CREATE TRIGGER tmp_forced_failure BEFORE UPDATE OF content_json ON site_projects BEGIN SELECT RAISE(ABORT,'forced failure'); END;");
    try {
      assert.throws(() => service.applyPatch(p.id, { patchId }), /forced failure/);
    } finally {
      db.exec("DROP TRIGGER tmp_forced_failure");
    }

    assert.deepEqual(repository.get(p.id).content, contentBefore, "content_json rolled back");
    assert.equal(service.documentRevisions(p.id).length, revisionsBefore, "revision rolled back");
    assert.equal(service.documentPatch(p.id, patchId).status, "VALIDATED", "patch state rolled back");
  });
  db.close();
});

// ------------------------------------------------------- 35-38 idempotency

test("patch proposal and apply are idempotent, and a superseded replay is truthful", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const operations = [op("SET", { target: "hero", path: "title", value: "یک‌بار" })];

    const first = service.proposePatch(p.id, { operations, idempotencyKey: "P" });
    const again = service.proposePatch(p.id, { operations, idempotencyKey: "P" });
    assert.equal(again.created, false);
    assert.equal(again.patch.id, first.patch.id, "same key + same patch converges");
    assert.throws(
      () => service.proposePatch(p.id, { operations: [op("SET", { target: "hero", path: "title", value: "متفاوت" })], idempotencyKey: "P" }),
      (error) => error.code === "SITE_PATCH_IDEMPOTENCY_CONFLICT"
    );

    const applied = service.applyPatch(p.id, { patchId: first.patch.id });
    assert.equal(applied.applied, true);
    const revisionsAfter = service.documentRevisions(p.id).length;

    // Replay while still current: converged, nothing appended.
    const replay = service.applyPatch(p.id, { patchId: first.patch.id });
    assert.deepEqual([replay.applied, replay.superseded], [false, false]);
    assert.equal(service.documentRevisions(p.id).length, revisionsAfter, "no second revision");

    // The draft moves on; the old apply must not pretend it changed it again.
    service.saveDraft(p.id, { content: multiPage(), idempotencyKey: "later" });
    const stale = service.applyPatch(p.id, { patchId: first.patch.id });
    assert.deepEqual([stale.applied, stale.superseded], [false, true], "truthful historical convergence");
    assert.equal(repository.get(p.id).content.storeBuilderV16.hero.title, "عنوان خانه", "the current draft is untouched");
  });
  db.close();
});

// ------------------------------------------------------------- 39-41 tenancy

test("patches are tenant isolated at the service and database boundary", () => {
  const { db, service } = fixture();
  const owned = runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const proposed = service.proposePatch(p.id, { operations: [op("SET", { target: "hero", path: "title", value: "مال من" })], idempotencyKey: "own" });
    return { project: p, patchId: proposed.patch.id };
  });

  runWithWorkspace("ws-2", () => {
    assert.throws(() => service.documentPatches(owned.project.id), (error) => error.status === 404, "cannot read");
    assert.throws(() => service.proposePatch(owned.project.id, { operations: [op("SET", { target: "hero", path: "title", value: "x" })], idempotencyKey: "x" }), (error) => error.status === 404);
    assert.throws(() => service.applyPatch(owned.project.id, { patchId: owned.patchId }), (error) => error.status === 404, "cannot apply");
  });

  // A cross-workspace patch row is refused by the database itself.
  const foreign = runWithWorkspace("ws-2", () => seeded(service, multiPage()));
  assert.throws(() => db.prepare(`
    INSERT INTO site_document_patches(id,workspace_id,site_project_id,base_revision,idempotency_key,patch_hash,operations_json,validation_json,status,created_at,updated_at)
    VALUES('x','ws-2',?,1,'k',?,'[]','[]','PROPOSED','t','t')
  `).run(owned.project.id, "a".repeat(64)), /project workspace mismatch/);
  assert.ok(foreign.id);

  // Patch history is append-only: an existing row cannot be deleted.
  assert.throws(() => db.prepare("DELETE FROM site_document_patches WHERE id=?").run(owned.patchId), /cannot be deleted/);
  db.close();
});

// ----------------------------------------------------------- 42-44 bootstrap

test("a site with no revision history bootstraps its baseline without rewriting the document", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    service.publish(p.id);
    const storedBefore = repository.get(p.id).content;
    const liveBefore = repository.getPublishedPublic(p.id).version.content;
    assert.equal(service.documentRevisions(p.id).length, 0, "Gate 01 left legacy sites unbackfilled");

    const saved = service.saveDraft(p.id, { content: multiPage(), idempotencyKey: "first" });

    const history = service.documentRevisions(p.id);
    assert.deepEqual(history.map((r) => r.revision), [1, 2], "baseline 1, then the save as 2");
    assert.deepEqual(history[0].document, storedBefore, "baseline is the document exactly as it was stored");
    assert.equal(history[0].documentHash, documentHash(storedBefore));
    assert.equal(saved.bootstrapped, true);
    assert.deepEqual(repository.getPublishedPublic(p.id).version.content, liveBefore, "bootstrap does not change live");

    // Bootstrapping happens once.
    service.saveDraft(p.id, { content: multiPage(), idempotencyKey: "second" });
    assert.deepEqual(service.documentRevisions(p.id).map((r) => r.revision), [1, 2, 3]);
  });
  db.close();
});

// ------------------------------------------------- 45-48 production writer

test("the production save path is revision-authoritative and refuses stale overwrites", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const first = service.saveDraft(p.id, { content: multiPage(), idempotencyKey: "s1" });
    assert.equal(first.applied, true);
    const at = first.revision.revision;

    // A retry of the same logical save converges; no duplicate revision.
    const retry = service.saveDraft(p.id, { content: multiPage(), idempotencyKey: "s1" });
    assert.equal(retry.created, false);
    assert.deepEqual(service.documentRevisions(p.id).map((r) => r.revision), [1, 2]);

    // Someone else saves.
    const edited = multiPage();
    edited.storeBuilderV16.hero.title = "از کاربر دیگر";
    service.saveDraft(p.id, { content: edited, idempotencyKey: "s2", expectedRevision: at });
    assert.equal(repository.get(p.id).content.storeBuilderV16.hero.title, "از کاربر دیگر");

    // A stale save composed on the older revision must not overwrite it.
    const stale = multiPage();
    stale.storeBuilderV16.hero.title = "کهنه";
    const conflict = service.saveDraft(p.id, { content: stale, idempotencyKey: "s3", expectedRevision: at });
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.applied, false);
    assert.equal(repository.get(p.id).content.storeBuilderV16.hero.title, "از کاربر دیگر", "newer work survives");
    assert.deepEqual(service.documentRevisions(p.id).map((r) => r.revision), [1, 2, 3], "the conflict appended nothing");
  });
  db.close();
});

// ------------------------------------------------------------ 49-55 regression

test("a draft patch never publishes, and explicit publish exposes it", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    service.publish(p.id);
    patch(service, p.id, [op("SET", { target: "hero", path: "title", value: "فقط پیش‌نویس" })]);

    assert.equal(repository.getPublishedPublic(p.id).version.content.storeBuilderV16.hero.title, "عنوان خانه", "live unchanged after a draft patch");
    service.publish(p.id);
    assert.equal(repository.getPublishedPublic(p.id).version.content.storeBuilderV16.hero.title, "فقط پیش‌نویس", "publish exposes it");

    // Publish rollback stays forward-only, and the draft it replaces is tracked.
    const versions = repository.listPublishVersions(p.id);
    const v1 = versions.find((v) => v.version === 1);
    const revisionsBefore = service.documentRevisions(p.id).length;
    const rolled = service.rollbackPublishVersion(p.id, v1.id);
    assert.equal(repository.getLatestPublishVersion(p.id).version, 3);
    assert.equal(repository.listPublishVersions(p.id).length, 3, "no publish version removed");

    // The rollback overwrote content_json, so it is a tracked draft write too:
    // no V16 draft mutation escapes revision history after this gate.
    assert.equal(service.documentRevisions(p.id).length, revisionsBefore + 1, "the rollback appended a revision");
    assert.equal(documentHash(repository.get(p.id).content), rolled.revision.documentHash);
    assert.equal(service.currentDocumentRevision(p.id).id, rolled.revision.id);
    assert.equal(repository.get(p.id).content.storeBuilderV16.hero.title, "عنوان خانه", "the draft is the rolled-back content");
  });
  db.close();
});

test("STORE and Corporate documents survive the tracked path unchanged", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    // STORE with intentionally empty sections.
    const store = service.create({ name: "فروشگاه", siteType: "STORE", content: { storeBuilderV16: { version: 16, sections: [] } } });
    service.saveDraft(store.id, { content: { storeBuilderV16: { version: 16, sections: [] } }, idempotencyKey: "st" });
    assert.deepEqual(repository.get(store.id).content.storeBuilderV16.sections, [], "empty stays empty");
    assert.equal(projectPublicStorePresentation(repository.get(store.id).content).storeBuilderV16.pages, undefined);

    // Corporate multi-page preserved through a patch.
    const corp = seeded(service);
    patch(service, corp.id, [op("SET", { target: "page:team", path: "navLabel", value: "تیم ما" })]);
    const pages = builderOf(repository.get(corp.id).content).pages;
    assert.deepEqual(pages.map((p) => p.slug), ["", "team"]);
    assert.equal(pages[1].navLabel, "تیم ما");
    assert.deepEqual(pages[0].sections.map((s) => s.id), ["s1", "s2"], "the other page is untouched");
  });
  db.close();
});

test("migration 091 is registered exactly once with no collision", () => {
  const versions = migrations.map((m) => m.version);
  assert.equal(versions.filter((v) => v === 91).length, 1);
  assert.equal(versions.length, new Set(versions).size);
  assert.equal(Math.max(...versions), 91);
  assert.ok(!versions.includes(88), "088 stays reserved for the open inventory PR");

  const db = createSiteTestDb();
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  const columns = db.prepare("PRAGMA table_info(site_document_patches)").all().map((r) => r.name);
  for (const column of ["base_revision", "idempotency_key", "operations_json", "validation_json", "preview_hash", "status", "applied_revision_id"]) {
    assert.ok(columns.includes(column), column);
  }
  const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='site_document_patches'").all().map((r) => r.name);
  for (const trigger of ["trg_site_document_patch_project_workspace", "trg_site_document_patch_identity_immutable",
    "trg_site_document_patch_terminal_immutable", "trg_site_document_patch_no_delete"]) {
    assert.ok(triggers.includes(trigger), trigger);
  }
  db.close();
});

// --------------------------------------------------- HTTP mutation boundary

/** Mount the real router with a fixed workspace, the way the app does. */
async function httpFixture() {
  const { db, repository, service } = fixture();
  const ws = (fn) => runWithWorkspace("ws-1", fn);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => ws(() => next()));
  app.use("/api", createSiteProjectsRouter({ service }));
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { db, repository, service, call, ws, close: async () => { await new Promise((resolve) => server.close(resolve)); db.close(); } };
}

test("the HTTP draft mutation surface is tracked, CAS-guarded and idempotent", async () => {
  const { repository, service, call, ws, close } = await httpFixture();
  try {
    const project = ws(() => seeded(service));

    // A metadata-only PATCH keeps the ordinary update path and touches nothing.
    const renamed = await call("PATCH", `/site-projects/${project.id}`, { name: "نام تازه" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.project.name, "نام تازه");
    assert.equal(ws(() => service.documentRevisions(project.id)).length, 0, "metadata is not document truth");

    // A content PATCH is tracked.
    const document = multiPage();
    document.storeBuilderV16.hero.title = "از HTTP";
    const saved = await call("PATCH", `/site-projects/${project.id}`, { content: document, idempotencyKey: "http-1" });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.applied, true);
    assert.equal(saved.body.revision, 2, "baseline 1, then the save as 2");

    const listed = await call("GET", `/site-projects/${project.id}/document-revisions`);
    assert.equal(listed.body.current, 2);
    assert.deepEqual(listed.body.revisions.map((r) => r.revision), [1, 2]);
    assert.ok(listed.body.revisions.every((r) => r.document === undefined), "the list stays a summary");

    const detail = await call("GET", `/site-projects/${project.id}`);
    assert.equal(detail.body.draftRevision, 2, "the editor loads a base revision");

    // A stale save is refused rather than overwriting newer work.
    const stale = await call("PATCH", `/site-projects/${project.id}`, { content: multiPage(), idempotencyKey: "http-2", expectedRevision: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "SITE_REVISION_CONFLICT");
    assert.equal(stale.body.currentRevision, 2);
    assert.equal(ws(() => repository.get(project.id)).content.storeBuilderV16.hero.title, "از HTTP");

    // A retried save converges without appending a second revision.
    const retry = await call("PATCH", `/site-projects/${project.id}`, { content: document, idempotencyKey: "http-1" });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.applied, false);
    assert.deepEqual(ws(() => service.documentRevisions(project.id)).map((r) => r.revision), [1, 2]);
  } finally { await close(); }
});

test("the HTTP patch surface previews without mutating and applies exactly once", async () => {
  const { repository, service, call, ws, close } = await httpFixture();
  try {
    const project = ws(() => seeded(service));
    const operations = [
      op("SET", { target: "section:s1", path: "title", value: "درباره تازه" }),
      op("SET", { target: "section:s1", path: "priceMinor", value: 999 }),
    ];

    const proposed = await call("POST", `/site-projects/${project.id}/document-patches`, { operations, idempotencyKey: "pk-1" });
    assert.equal(proposed.status, 201);
    assert.equal(proposed.body.patch.status, "VALIDATED");
    const patchId = proposed.body.patch.id;

    // A replayed proposal converges on the same patch.
    const replay = await call("POST", `/site-projects/${project.id}/document-patches`, { operations, idempotencyKey: "pk-1" });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.created, false);
    assert.equal(replay.body.patch.id, patchId);

    // The same key with a different body is a client error, not a silent swap.
    const reused = await call("POST", `/site-projects/${project.id}/document-patches`, {
      operations: [op("SET", { target: "hero", path: "title", value: "دیگر" })], idempotencyKey: "pk-1",
    });
    assert.equal(reused.status, 409);
    assert.equal(reused.body.code, "SITE_PATCH_IDEMPOTENCY_CONFLICT");

    const contentBefore = ws(() => repository.get(project.id)).content;
    const preview = await call("POST", `/site-projects/${project.id}/document-patches/${patchId}/preview`);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.proposed.storeBuilderV16.pages[0].sections[0].title, "درباره تازه");
    assert.deepEqual(outcomes(preview.body.results), [OUTCOME.ACCEPTED, OUTCOME.REJECTED_PROTECTED_PROPERTY]);
    assert.deepEqual(ws(() => repository.get(project.id)).content, contentBefore, "preview mutates nothing");

    const applied = await call("POST", `/site-projects/${project.id}/document-patches/${patchId}/apply`);
    assert.equal(applied.status, 200);
    assert.equal(applied.body.applied, true);
    assert.equal(applied.body.patch.status, "PARTIALLY_APPLIED");
    const section1 = builderOf(ws(() => repository.get(project.id)).content).pages[0].sections[0];
    assert.equal(section1.title, "درباره تازه");
    assert.ok(!("priceMinor" in section1), "the protected property never reached the document");

    // Replaying the apply neither duplicates the revision nor lies about it.
    const revisionsAfter = ws(() => service.documentRevisions(project.id)).length;
    const again = await call("POST", `/site-projects/${project.id}/document-patches/${patchId}/apply`);
    assert.equal(again.body.applied, false);
    assert.equal(again.body.superseded, false);
    assert.equal(ws(() => service.documentRevisions(project.id)).length, revisionsAfter);

    // A patch composed on the superseded revision conflicts instead of applying.
    const late = await call("POST", `/site-projects/${project.id}/document-patches`, {
      operations: [op("SET", { target: "hero", path: "title", value: "دیر" })], idempotencyKey: "pk-2",
    });
    await call("PATCH", `/site-projects/${project.id}`, { content: multiPage(), idempotencyKey: "moved-on" });
    const conflicted = await call("POST", `/site-projects/${project.id}/document-patches/${late.body.patch.id}/apply`);
    assert.equal(conflicted.status, 409);
    assert.equal(conflicted.body.code, "SITE_REVISION_CONFLICT");
    assert.equal(conflicted.body.patch.status, "CONFLICTED");
  } finally { await close(); }
});
