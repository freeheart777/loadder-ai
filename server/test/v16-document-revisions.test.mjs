import assert from "node:assert/strict";
import test from "node:test";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration090SiteDocumentRevisions } from "../db/migrations/090_site_document_revisions.mjs";
import { canonicalDocumentString, documentHash } from "../app/services/site-document-revision-service.mjs";
import { readPages, hasPages } from "../app/services/site-page-model.mjs";
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
const doc = (heroTitle) => ({ storeBuilderV16: { version: 16, header: { storeName: "شرکت" }, hero: { enabled: true, title: heroTitle }, sections: [section("a", "about", "درباره")] } });
const project = (service, name = "شرکت") => service.create({ name, siteType: "BUSINESS", content: doc("A") });

// ------------------------------------------------------------- 1-7 migration

test("migration 090 is registered exactly once with no collision", () => {
  const versions = migrations.map((m) => m.version);
  assert.equal(versions.filter((v) => v === 90).length, 1);
  assert.equal(versions.length, new Set(versions).size, "no duplicate migration numbers");
  assert.ok(!versions.includes(88), "088 stays reserved for the open inventory PR");
});

test("fresh migration, rerun and integrity all succeed", () => {
  const db = createSiteTestDb();
  assert.doesNotThrow(() => migration090SiteDocumentRevisions.up(db), "rerunning 090 is safe");
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  const columns = db.prepare("PRAGMA table_info(site_document_revisions)").all().map((r) => r.name);
  assert.deepEqual(columns.sort(), ["actor_user_id", "created_at", "document_hash", "document_json", "id", "idempotency_key", "parent_revision_id", "revision", "site_project_id", "workspace_id"]);
  db.close();
});

test("upgrading a database that already has sites and publish versions leaves them untouched", () => {
  // The same schema subset the site test helper builds, but stopped just short
  // of this gate so the upgrade is real.
  const upgrade = createSiteTestDb({ maxVersion: 89 });
  const repository = createSiteProjectRepository(upgrade);
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) } });

  const before = runWithWorkspace("ws-1", () => {
    const created = project(service);
    service.publish(created.id);
    return { project: repository.get(created.id), version: repository.getLatestPublishVersion(created.id) };
  });

  runMigrations(upgrade, [migration090SiteDocumentRevisions]);

  runWithWorkspace("ws-1", () => {
    assert.deepEqual(repository.get(before.project.id), before.project, "an existing site row survives unchanged");
    assert.deepEqual(repository.getLatestPublishVersion(before.project.id), before.version, "an existing publish version survives unchanged");
    assert.equal(repository.listDocumentRevisions(before.project.id).length, 0, "no history is backfilled");
  });
  assert.equal(upgrade.pragma("integrity_check", { simple: true }), "ok");
  assert.deepEqual(upgrade.pragma("foreign_key_check"), []);
  upgrade.close();
});

// --------------------------------------------------------- 8-11 revisions

test("tracked saves append revisions after the baseline and never rewrite an earlier one", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    const storedAtCreation = repository.get(created.id).content;

    // The first tracked write on a site with no history records the document
    // exactly as it is already stored as revision 1, so the save becomes 2.
    const first = service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1", actorUserId: "user-1" });
    assert.equal(first.bootstrapped, true);
    assert.equal(first.revision.revision, 2);
    assert.equal(first.revision.actorUserId, "user-1");

    const baseline = service.documentRevision(created.id, 1);
    assert.equal(baseline.parentRevisionId, null);
    assert.deepEqual(baseline.document, storedAtCreation, "the baseline is the document as it was stored");
    assert.equal(first.revision.parentRevisionId, baseline.id, "revision 2 points at the baseline");

    const second = service.saveDraft(created.id, { content: doc("B"), idempotencyKey: "k2" });
    assert.equal(second.bootstrapped, false, "bootstrapping happens once");
    assert.equal(second.revision.revision, 3);
    assert.equal(second.revision.parentRevisionId, first.revision.id, "revision 3 points at revision 2");

    assert.deepEqual(service.documentRevision(created.id, 2), first.revision, "revision 2 is unchanged");
    assert.equal(service.currentDocumentRevision(created.id).revision, 3);
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3]);
  });
  db.close();
});

test("revision numbering is scoped per site and per workspace", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const a = project(service, "شرکت الف");
    const b = project(service, "شرکت ب");
    service.saveDraft(a.id, { content: doc("A1"), idempotencyKey: "a1" });
    service.saveDraft(a.id, { content: doc("A2"), idempotencyKey: "a2" });
    service.saveDraft(b.id, { content: doc("B1"), idempotencyKey: "b1" });
    assert.deepEqual(service.documentRevisions(a.id).map((r) => r.revision), [1, 2, 3], "baseline plus two saves");
    assert.deepEqual(service.documentRevisions(b.id).map((r) => r.revision), [1, 2], "a second site starts at its own baseline");
  });
  runWithWorkspace("ws-2", () => {
    const c = project(service, "شرکت ج");
    service.saveDraft(c.id, { content: doc("C1"), idempotencyKey: "a1" });
    assert.deepEqual(service.documentRevisions(c.id).map((r) => r.revision), [1, 2], "another workspace starts at 1 and reuses keys freely");
  });
  db.close();
});

// ------------------------------------------------------------ 12-13 append only

test("history is append-only at the database boundary", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    const saved = service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    const id = saved.revision.id;
    assert.throws(() => db.prepare("UPDATE site_document_revisions SET document_hash='x' WHERE id=?").run(id), /append-only/);
    assert.throws(() => db.prepare("UPDATE site_document_revisions SET revision=99 WHERE id=?").run(id), /append-only/);
    assert.throws(() => db.prepare("DELETE FROM site_document_revisions WHERE id=?").run(id), /cannot be deleted/);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM site_document_revisions").get().n, 2, "the baseline and the save");
  });
  db.close();
});

// ----------------------------------------------------------- 14-15 atomicity

test("a tracked save commits the draft and its revision together", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    service.saveDraft(created.id, { content: doc("B"), idempotencyKey: "k1" });
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "B");
    assert.equal(service.currentDocumentRevision(created.id).document.storeBuilderV16.hero.title, "B");
  });
  db.close();
});

test("a failure inside the save transaction rolls back BOTH the draft and the revision", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    const contentBefore = repository.get(created.id).content;
    const countBefore = service.documentRevisions(created.id).length;

    // A document that cannot be serialised fails after the project is loaded
    // and while the transaction is open.
    const circular = { storeBuilderV16: { version: 16 } };
    circular.self = circular;
    assert.throws(() => service.saveDraft(created.id, { content: circular, idempotencyKey: "k2" }));

    assert.deepEqual(repository.get(created.id).content, contentBefore, "the draft is unchanged");
    assert.equal(service.documentRevisions(created.id).length, countBefore, "no orphan revision was left behind");
  });
  db.close();
});

// -------------------------------------------------------- 16-18 idempotency

test("the same key with the same document converges; with a different document it conflicts", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    const first = service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    assert.equal(first.created, true);

    const retry = service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    assert.equal(retry.created, false, "a retry does not create a revision");
    assert.equal(retry.revision.id, first.revision.id, "it converges on the existing revision");
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2], "no duplicate revision");

    assert.throws(
      () => service.saveDraft(created.id, { content: doc("DIFFERENT"), idempotencyKey: "k1" }),
      (error) => error.code === "SITE_REVISION_IDEMPOTENCY_CONFLICT"
    );
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2], "a conflict appends nothing");
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "A", "and never overwrites the draft");

    assert.throws(() => service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "  " }), (error) => error.code === "SITE_REVISION_IDEMPOTENCY_KEY_REQUIRED");
  });
  db.close();
});

// ------------------------------------------------------------ 19-22 tenancy

test("a foreign workspace can neither read, write nor restore another tenant's revisions", () => {
  const { db, service } = fixture();
  const owned = runWithWorkspace("ws-1", () => {
    const created = project(service);
    service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    service.saveDraft(created.id, { content: doc("B"), idempotencyKey: "k2" });
    return created;
  });

  runWithWorkspace("ws-2", () => {
    assert.throws(() => service.documentRevisions(owned.id), (error) => error.status === 404, "cannot read");
    assert.throws(() => service.saveDraft(owned.id, { content: doc("X"), idempotencyKey: "x" }), (error) => error.status === 404, "cannot write");
    assert.throws(() => service.restoreDraftRevision(owned.id, { revision: 1, idempotencyKey: "x" }), (error) => error.status === 404, "cannot restore");
  });

  runWithWorkspace("ws-1", () => {
    assert.deepEqual(service.documentRevisions(owned.id).map((r) => r.revision), [1, 2, 3], "the owner's history is untouched");
  });
  db.close();
});

test("cross-workspace references are rejected at the database boundary", () => {
  const { db, service } = fixture();
  const a = runWithWorkspace("ws-1", () => {
    const created = project(service);
    service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    return created;
  });
  const b = runWithWorkspace("ws-2", () => project(service, "شرکت ب"));
  const parentId = runWithWorkspace("ws-1", () => service.documentRevision(a.id, 1).id);
  const at = "2026-09-17T10:00:00.000Z";
  const insert = (workspaceId, siteProjectId, parent) => db.prepare(`
    INSERT INTO site_document_revisions(id,workspace_id,site_project_id,revision,parent_revision_id,document_json,document_hash,actor_user_id,idempotency_key,created_at)
    VALUES(?,?,?,?,?,?,?,NULL,?,?)
  `).run(`rev-${Math.random()}`, workspaceId, siteProjectId, 9, parent, "{}", "a".repeat(64), `key-${Math.random()}`, at);

  assert.throws(() => insert("ws-2", a.id, null), /project workspace mismatch/, "cannot claim another workspace's site project");
  assert.throws(() => insert("ws-2", b.id, parentId), /parent workspace mismatch/, "cannot reference another workspace's parent revision");
  db.close();
});

// --------------------------------------------------------------- 23-25 hash

test("the canonical hash ignores key order, and reacts to content and array order", () => {
  const a = { storeBuilderV16: { version: 16, hero: { title: "A", enabled: true }, sections: [{ id: "1" }, { id: "2" }] } };
  const keyReordered = { storeBuilderV16: { sections: [{ id: "1" }, { id: "2" }], hero: { enabled: true, title: "A" }, version: 16 } };
  assert.equal(documentHash(a), documentHash(keyReordered), "key insertion order does not change the hash");
  assert.equal(canonicalDocumentString(a), canonicalDocumentString(keyReordered));

  const changed = { storeBuilderV16: { version: 16, hero: { title: "B", enabled: true }, sections: [{ id: "1" }, { id: "2" }] } };
  assert.notEqual(documentHash(a), documentHash(changed), "a meaningful change changes the hash");

  const arrayReordered = { storeBuilderV16: { version: 16, hero: { title: "A", enabled: true }, sections: [{ id: "2" }, { id: "1" }] } };
  assert.notEqual(documentHash(a), documentHash(arrayReordered), "array order is meaningful");

  assert.match(documentHash(a), /^[0-9a-f]{64}$/);
  // The input is never mutated by canonicalisation.
  const source = { b: 1, a: 2 };
  canonicalDocumentString(source);
  assert.deepEqual(Object.keys(source), ["b", "a"]);
});

// ------------------------------------------------------------ 26-32 restore

test("restore replays a historical revision forward, leaving all history intact", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    // Revision 1 is the baseline, so these saves are revisions 2 and 3.
    const r2 = service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    const r3 = service.saveDraft(created.id, { content: doc("B"), idempotencyKey: "k2" });
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "B");

    const restored = service.restoreDraftRevision(created.id, { revision: 2, idempotencyKey: "restore-1" });
    assert.equal(restored.revision.revision, 4, "restore appends a new revision");
    assert.equal(restored.restoredFrom, 2);
    assert.equal(restored.revision.documentHash, r2.revision.documentHash, "revision 4 is exactly revision 2");
    assert.deepEqual(restored.revision.document, r2.revision.document);
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "A", "the current draft is the restored document");

    // Nothing was removed or rewritten.
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3, 4]);
    assert.deepEqual(service.documentRevision(created.id, 2), r2.revision);
    assert.deepEqual(service.documentRevision(created.id, 3), r3.revision);
    assert.equal(service.documentRevision(created.id, 3).documentHash, r3.revision.documentHash);

    // A retried restore converges rather than appending revision 5.
    const retry = service.restoreDraftRevision(created.id, { revision: 2, idempotencyKey: "restore-1" });
    assert.equal(retry.created, false);
    assert.equal(retry.revision.id, restored.revision.id);
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3, 4], "no revision 5");

    assert.throws(() => service.restoreDraftRevision(created.id, { revision: 99, idempotencyKey: "nope" }), (error) => error.code === "SITE_REVISION_NOT_FOUND");
  });
  db.close();
});

// ------------------------------------------------------------ 33-37 regression

test("publish and publish rollback keep their existing forward-only semantics", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" });
    service.publish(created.id);
    const v1 = repository.getLatestPublishVersion(created.id);
    assert.equal(v1.version, 1);

    service.saveDraft(created.id, { content: doc("B"), idempotencyKey: "k2" });
    assert.equal(repository.getPublishedPublic(created.id).version.content.storeBuilderV16.hero.title, "A", "a tracked draft save does not touch live");

    service.publish(created.id);
    assert.equal(repository.getLatestPublishVersion(created.id).version, 2);
    service.rollbackPublishVersion(created.id, v1.id);
    const after = repository.getLatestPublishVersion(created.id);
    assert.equal(after.version, 3, "rollback appends forward");
    assert.equal(after.content.storeBuilderV16.hero.title, "A");
    assert.equal(repository.listPublishVersions(created.id).length, 3, "no publish version was removed");
  });
  db.close();
});

test("reading a legacy document does not give it pages[], and STORE keeps empty sections", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const legacy = service.create({ name: "قدیمی", siteType: "BUSINESS", content: doc("L") });
    const stored = repository.get(legacy.id).content.storeBuilderV16;
    assert.equal(hasPages(stored), false);
    readPages(stored);
    projectPublicStorePresentation(repository.get(legacy.id).content, { preserveSectionIds: true });
    assert.equal(hasPages(repository.get(legacy.id).content.storeBuilderV16), false, "reading never adds a page collection");

    // A tracked save records exactly what was given; it does not normalise a
    // legacy document into a paged one.
    service.saveDraft(legacy.id, { content: doc("L2"), idempotencyKey: "k1" });
    assert.equal(hasPages(repository.get(legacy.id).content.storeBuilderV16), false);

    const store = service.create({ name: "فروشگاه", siteType: "STORE", content: { storeBuilderV16: { version: 16, sections: [] } } });
    service.saveDraft(store.id, { content: { storeBuilderV16: { version: 16, sections: [] } }, idempotencyKey: "s1" });
    assert.deepEqual(repository.get(store.id).content.storeBuilderV16.sections, [], "an intentionally empty store stays empty");
    assert.equal(projectPublicStorePresentation(repository.get(store.id).content).storeBuilderV16.pages, undefined, "a store still publishes no page collection");
  });
  db.close();
});

test("a tracked save preserves the multi-page document exactly", () => {
  const { db, repository, service } = fixture();
  const multi = {
    storeBuilderV16: {
      version: 16,
      pages: [
        { id: "h", title: "خانه", slug: "", showInNav: true, seo: { title: "خانه", description: "" }, sections: [section("a", "about", "درباره")] },
        { id: "t", title: "تیم", slug: "team", showInNav: true, seo: { title: "تیم", description: "" }, sections: [section("b", "team", "تیم")] },
      ],
    },
  };
  runWithWorkspace("ws-1", () => {
    const created = service.create({ name: "چندصفحه", siteType: "BUSINESS", content: multi });
    const saved = service.saveDraft(created.id, { content: multi, idempotencyKey: "k1" });
    const pages = repository.get(created.id).content.storeBuilderV16.pages;
    assert.deepEqual(pages.map((p) => p.slug), ["", "team"]);
    assert.deepEqual(saved.revision.document.storeBuilderV16.pages.map((p) => p.slug), ["", "team"], "the revision holds the whole page collection");
    assert.equal(saved.revision.documentHash, documentHash(repository.get(created.id).content), "the recorded hash matches the stored draft");
  });
  db.close();
});

test("restore replay is truthful: converged while current, superseded once the draft moves on", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "k1" }); // rev 1 = baseline, rev 2 = A
    service.saveDraft(created.id, { content: doc("B"), idempotencyKey: "k2" }); // rev 3 = B

    // 1. A real restore applies and appends.
    const first = service.restoreDraftRevision(created.id, { revision: 2, idempotencyKey: "R" });
    assert.deepEqual([first.created, first.applied, first.superseded, first.restoredFrom, first.revision.revision], [true, true, false, 2, 4]);
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "A");

    // 2. Immediate replay while the restored state is still current: converged,
    //    not superseded, nothing appended.
    const immediate = service.restoreDraftRevision(created.id, { revision: 2, idempotencyKey: "R" });
    assert.deepEqual([immediate.created, immediate.applied, immediate.superseded, immediate.restoredFrom], [false, false, false, 2]);
    assert.equal(immediate.revision.revision, 4);
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3, 4], "no revision 5");
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "A", "current is unchanged");

    // 3. The draft moves on.
    service.saveDraft(created.id, { content: doc("C"), idempotencyKey: "k4" }); // rev 5 = C

    // 4. Replaying the OLD restore key must not claim revision 2 was restored now.
    const stale = service.restoreDraftRevision(created.id, { revision: 2, idempotencyKey: "R" });
    assert.deepEqual([stale.created, stale.applied, stale.superseded], [false, false, true]);
    assert.equal(stale.restoredFrom, null, "a stale replay never claims a restore happened now");
    assert.equal(stale.revision.revision, 4, "it points at the historical revision it converged on");
    assert.equal(stale.project.content.storeBuilderV16.hero.title, "C", "the returned project is the true current draft");
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "C", "content_json is not rewritten");
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3, 4, 5], "no revision 6");

    // 5. A genuinely new restore request still applies forward.
    const fresh = service.restoreDraftRevision(created.id, { revision: 2, idempotencyKey: "R2" });
    assert.deepEqual([fresh.created, fresh.applied, fresh.superseded, fresh.restoredFrom, fresh.revision.revision], [true, true, false, 2, 6]);
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "A");
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3, 4, 5, 6], "history is intact");

    // 6. Same key, different target stays a deterministic conflict.
    assert.throws(
      () => service.restoreDraftRevision(created.id, { revision: 3, idempotencyKey: "R2" }),
      (error) => error.code === "SITE_REVISION_IDEMPOTENCY_CONFLICT"
    );
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3, 4, 5, 6]);
  });
  db.close();
});

test("a replayed save converges without appending and hands back the true current draft", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const created = project(service);
    const k1 = service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "K1" });
    service.saveDraft(created.id, { content: doc("B"), idempotencyKey: "K2" });

    const replay = service.saveDraft(created.id, { content: doc("A"), idempotencyKey: "K1" });
    assert.equal(replay.created, false, "no new revision");
    assert.equal(replay.revision.id, k1.revision.id, "it converges on the revision the key already made");
    assert.deepEqual(service.documentRevisions(created.id).map((r) => r.revision), [1, 2, 3]);
    // The caller is handed the CURRENT draft, not the document it replayed.
    assert.equal(replay.project.content.storeBuilderV16.hero.title, "B");
    assert.equal(repository.get(created.id).content.storeBuilderV16.hero.title, "B", "content_json is not rewound");
  });
  db.close();
});
