import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteProjectsRouter } from "../app/routes/site-projects.mjs";
import { translateInstruction, InstructionTranslatorError } from "../app/services/v16-instruction-translator.mjs";
import { OUTCOME } from "../app/services/v16-patch-engine.mjs";
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

const section = (id, type, title, extra = {}) => ({
  id, type, enabled: true, title, subtitle: "", backgroundColor: "#ffffff", textColor: "#0f172a",
  spacingTop: 32, spacingBottom: 32, ...extra,
});

const doc = () => ({
  storeBuilderV16: {
    version: 16,
    header: { storeName: "فروشگاه" },
    hero: { enabled: true, title: "عنوان خانه", subtitle: "زیرعنوان" },
    nav: { enabled: true, ctaLabel: "تماس", ctaHref: "/contact" },
    footer: { enabled: true, text: "©" },
    seo: { title: "سایت", description: "توضیح" },
    pages: [
      {
        id: "h", title: "خانه", slug: "", showInNav: true, seo: { title: "خانه", description: "د" },
        sections: [
          section("p1", "products", "محصولات منتخب"),
          section("a1", "about", "درباره ما"),
        ],
      },
    ],
  },
});

const seeded = (service) => service.create({ name: "فروشگاه", siteType: "STORE", content: doc() });
const builderOf = (document) => document.storeBuilderV16;
const sectionOf = (project, id) => builderOf(project.content).pages[0].sections.find((s) => s.id === id);
const outcomes = (results) => results.map((r) => r.outcome);

const ASK_HAPPY = "این بخش را خلوت‌تر کن، فقط ۳ محصول نشان بده و تصاویر را بزرگ‌تر کن.";
const ASK_MALICIOUS = "عکس‌ها را بزرگ‌تر کن و قیمت همه محصولات را ۱۰۰۰ تومان کن";

// ------------------------------------------------------------- translator

test("the translator resolves only the selected section and stays within the presentation contract", () => {
  const document = doc();
  const { operations, matches, warnings } = translateInstruction({ document, target: "section:p1", instruction: ASK_HAPPY });

  assert.ok(operations.every((operation) => operation.target === "section:p1"), "every operation targets the selected section only");
  assert.deepEqual(new Set(matches), new Set(["density", "productCount", "imageSize"]));
  assert.deepEqual(warnings, []);
  assert.deepEqual(operations.map((o) => o.path).sort(), ["productImageSize", "spacingBottom", "spacingTop", "visibleProductCount"]);
  assert.equal(operations.find((o) => o.path === "visibleProductCount").value, 3);
  assert.equal(operations.find((o) => o.path === "productImageSize").value, "large");
});

test("a price-mutating instruction is still translated, so the policy guard — not the translator — is the thing that rejects it", () => {
  const document = doc();
  const { operations, warnings } = translateInstruction({ document, target: "section:p1", instruction: ASK_MALICIOUS });
  assert.ok(operations.some((o) => o.path === "productImageSize"));
  assert.ok(operations.some((o) => o.path === "price"), "the attempt is real, not silently dropped by the translator");
  assert.ok(warnings.some((w) => w.includes("قیمت")));
});

test("the translator refuses to resolve anything but a section target", () => {
  const document = doc();
  assert.throws(
    () => translateInstruction({ document, target: "hero", instruction: ASK_HAPPY }),
    (error) => error instanceof InstructionTranslatorError && error.code === "TRANSLATOR_TARGET_MUST_BE_SECTION",
  );
});

test("product-count and image-size intents are no-ops with a warning on a non-products section", () => {
  const document = doc();
  const { operations, warnings } = translateInstruction({ document, target: "section:a1", instruction: ASK_HAPPY });
  assert.deepEqual(operations.map((o) => o.path), ["spacingTop", "spacingBottom"]);
  assert.equal(warnings.length, 2);
});

// -------------------------------------------------------- end-to-end flow

test("Ask Loadder happy path: preview mutates nothing, apply creates exactly one revision, presentation lands, commerce truth stays untouched", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const contentBefore = repository.get(p.id).content;
    assert.equal(service.documentRevisions(p.id).length, 0, "a fresh project has no revision history yet");

    const { operations } = service.translateAskLoadderInstruction(p.id, { target: "section:p1", instruction: ASK_HAPPY });

    // Proposing a patch for a legacy/no-history project also records its
    // baseline revision (documented Gate 02 behaviour) — that happens here,
    // before preview, and is what "revisionsBeforeApply" already accounts for.
    const proposed = service.proposePatch(p.id, { operations, idempotencyKey: "ask-1" });
    assert.deepEqual(outcomes(proposed.evaluation.results), operations.map(() => OUTCOME.ACCEPTED));
    assert.deepEqual(repository.get(p.id).content, contentBefore, "proposing does not mutate the draft");
    const revisionsBeforeApply = service.documentRevisions(p.id).length;

    // Preview causes zero persistent mutation.
    const preview = service.previewPatch(p.id, proposed.patch.id);
    assert.deepEqual(repository.get(p.id).content, contentBefore, "preview left the draft untouched");
    assert.equal(service.documentRevisions(p.id).length, revisionsBeforeApply, "preview appended no revision");
    const previewedSection = sectionOf({ content: preview.proposed }, "p1");
    assert.equal(previewedSection.visibleProductCount, 3, "the preview shows the pending change");

    // Explicit confirm → apply.
    const applied = service.applyPatch(p.id, { patchId: proposed.patch.id });
    assert.equal(applied.applied, true);
    assert.equal(applied.status, "APPLIED");
    assert.equal(service.documentRevisions(p.id).length, revisionsBeforeApply + 1, "exactly one revision beyond what propose already recorded");

    const after = sectionOf(service.get(p.id), "p1");
    assert.equal(after.visibleProductCount, 3, "product count is 3");
    assert.equal(after.productImageSize, "large", "image presentation is larger");
    assert.equal(after.spacingTop, 56, "the section is calmer");
    assert.ok(!("price" in after) && !("priceMinor" in after), "no price truth was written");
    assert.equal(sectionOf(service.get(p.id), "a1").title, "درباره ما", "only the selected section changed");

    // Retry with the same idempotency key is idempotent: no second revision.
    const retryProposed = service.proposePatch(p.id, { operations, idempotencyKey: "ask-1" });
    assert.equal(retryProposed.created, false);
    const retryApplied = service.applyPatch(p.id, { patchId: retryProposed.patch.id });
    assert.deepEqual([retryApplied.applied, retryApplied.superseded], [false, false]);
    assert.equal(service.documentRevisions(p.id).length, revisionsBeforeApply + 1, "retry appended nothing");
  });
  db.close();
});

test("Ask Loadder malicious price attempt: presentation change lands, Commerce Truth guard rejects the price mutation", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const { operations } = service.translateAskLoadderInstruction(p.id, { target: "section:p1", instruction: ASK_MALICIOUS });

    const proposed = service.proposePatch(p.id, { operations, idempotencyKey: "ask-evil" });
    assert.deepEqual(outcomes(proposed.evaluation.results), [OUTCOME.ACCEPTED, OUTCOME.REJECTED_PROTECTED_PROPERTY]);

    const applied = service.applyPatch(p.id, { patchId: proposed.patch.id });
    assert.equal(applied.status, "PARTIALLY_APPLIED");
    assert.equal(applied.applied, true, "the accepted presentation change still lands");

    const after = sectionOf(service.get(p.id), "p1");
    assert.equal(after.productImageSize, "large");
    assert.ok(!("price" in after), "the price mutation never reached the document");
  });
  db.close();
});

test("a patch composed on a stale revision fails closed", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const { operations } = service.translateAskLoadderInstruction(p.id, { target: "section:p1", instruction: ASK_HAPPY });
    const proposed = service.proposePatch(p.id, { operations, idempotencyKey: "stale-1" });

    // Someone else advances the draft first.
    service.saveDraft(p.id, { content: doc(), idempotencyKey: "other" });
    const revisionsBefore = service.documentRevisions(p.id).length;

    const result = service.applyPatch(p.id, { patchId: proposed.patch.id });
    assert.equal(result.conflict, true);
    assert.equal(result.applied, false);
    assert.equal(service.documentRevisions(p.id).length, revisionsBefore, "the stale patch appended nothing");
    assert.equal(sectionOf(service.get(p.id), "p1").visibleProductCount, undefined, "nothing landed");
  });
  db.close();
});

// -------------------------------------------------------------------- undo

test("Undo restores through the revision system as a forward replay, never a history rewrite", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const p = seeded(service);
    const baseline = service.saveDraft(p.id, { content: doc(), idempotencyKey: "baseline-write" });
    const beforeRevision = baseline.revision.revision;
    const beforeContent = repository.get(p.id).content;

    const { operations } = service.translateAskLoadderInstruction(p.id, { target: "section:p1", instruction: ASK_HAPPY });
    const proposed = service.proposePatch(p.id, { operations, idempotencyKey: "undo-1" });
    const applied = service.applyPatch(p.id, { patchId: proposed.patch.id });
    assert.equal(applied.applied, true);
    assert.equal(sectionOf(service.get(p.id), "p1").visibleProductCount, 3);

    const historyBeforeUndo = service.documentRevisions(p.id).map((r) => r.revision);

    const undone = service.restoreDraftRevision(p.id, { revision: beforeRevision, idempotencyKey: "undo-click-1" });
    assert.equal(undone.applied, true);
    assert.equal(undone.restoredFrom, beforeRevision);
    assert.ok(undone.revision.revision > historyBeforeUndo[historyBeforeUndo.length - 1], "undo is a NEW, later revision");
    assert.deepEqual(repository.get(p.id).content, beforeContent, "the draft content is restored");
    assert.equal(sectionOf(service.get(p.id), "p1").visibleProductCount, undefined, "the AI change is undone");

    // History itself is untouched: every prior revision is still there, unchanged.
    const historyAfterUndo = service.documentRevisions(p.id).map((r) => r.revision);
    assert.deepEqual(historyAfterUndo.slice(0, historyBeforeUndo.length), historyBeforeUndo, "no revision was rewritten or removed");
    assert.equal(historyAfterUndo.length, historyBeforeUndo.length + 1, "undo APPENDED, it did not replace");

    // Undo itself is idempotent.
    const revisionsAfterFirstUndo = service.documentRevisions(p.id).length;
    const replay = service.restoreDraftRevision(p.id, { revision: beforeRevision, idempotencyKey: "undo-click-1" });
    assert.deepEqual([replay.applied, replay.superseded], [false, false]);
    assert.equal(service.documentRevisions(p.id).length, revisionsAfterFirstUndo, "the replay appended nothing");
  });
  db.close();
});

// --------------------------------------------------------------------- HTTP

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

test("the HTTP Ask Loadder surface: translate, propose, preview, apply and undo, end to end", async () => {
  const { repository, service, call, ws, close } = await httpFixture();
  try {
    const project = ws(() => seeded(service));

    const translated = await call("POST", `/site-projects/${project.id}/ask-loadder/translate`, { target: "section:p1", instruction: ASK_HAPPY });
    assert.equal(translated.status, 200);
    assert.ok(translated.body.operations.length >= 3);
    assert.ok(translated.body.operations.every((o) => o.target === "section:p1"));

    const proposed = await call("POST", `/site-projects/${project.id}/document-patches`, { operations: translated.body.operations, idempotencyKey: "http-ask-1" });
    assert.equal(proposed.status, 201);

    // Proposing already recorded this legacy project's baseline revision.
    const revisionsAfterPropose = ws(() => service.documentRevisions(project.id)).length;
    assert.equal(revisionsAfterPropose, 1, "the baseline was recorded when the patch was proposed");

    const preview = await call("POST", `/site-projects/${project.id}/document-patches/${proposed.body.patch.id}/preview`);
    assert.equal(preview.status, 200);
    assert.equal(ws(() => service.documentRevisions(project.id)).length, revisionsAfterPropose, "preview over HTTP mutates nothing");

    const applied = await call("POST", `/site-projects/${project.id}/document-patches/${proposed.body.patch.id}/apply`);
    assert.equal(applied.status, 200);
    assert.equal(applied.body.applied, true);
    const afterRevision = applied.body.revision;
    assert.equal(ws(() => service.documentRevisions(project.id)).length, revisionsAfterPropose + 1, "exactly one revision beyond the baseline");

    // Undo over HTTP: restore to the revision immediately before the apply.
    const priorRevision = afterRevision - 1;
    const undo = await call("POST", `/site-projects/${project.id}/document-revisions/${priorRevision}/restore`, { idempotencyKey: "http-undo-1" });
    assert.equal(undo.status, 200);
    assert.equal(undo.body.applied, true);
    assert.ok(undo.body.revision > afterRevision, "undo appended a forward revision");

    // A malicious instruction: presentation accepted, price rejected by the guard.
    const evilTranslated = await call("POST", `/site-projects/${project.id}/ask-loadder/translate`, { target: "section:p1", instruction: ASK_MALICIOUS });
    const evilProposed = await call("POST", `/site-projects/${project.id}/document-patches`, { operations: evilTranslated.body.operations, idempotencyKey: "http-evil-1" });
    const evilApplied = await call("POST", `/site-projects/${project.id}/document-patches/${evilProposed.body.patch.id}/apply`);
    assert.equal(evilApplied.status, 200);
    assert.deepEqual(evilApplied.body.results.map((r) => r.outcome), ["ACCEPTED", "REJECTED_PROTECTED_PROPERTY"]);
    assert.ok(!("price" in ws(() => repository.get(project.id)).content.storeBuilderV16.pages[0].sections[0]));

    // An instruction that tries to address something other than a section.
    const invalidTarget = await call("POST", `/site-projects/${project.id}/ask-loadder/translate`, { target: "hero", instruction: ASK_HAPPY });
    assert.equal(invalidTarget.status, 400);
    assert.equal(invalidTarget.body.code, "TRANSLATOR_TARGET_MUST_BE_SECTION");
  } finally { await close(); }
});
