import assert from "node:assert/strict";
import test from "node:test";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { renderPublishedSite } from "../app/routes/public-sites.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { MANIFEST_VERSION, buildCapabilityManifest, readCapabilityManifest } from "../app/site-platform/publish-manifest.mjs";

function fixture() {
  const db = createSiteTestDb();
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({
    repository,
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  return { db, repository, service };
}

const section = (id, type, title, extra = {}) => ({ id, type, enabled: true, title, subtitle: "", backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra });

const storeDoc = () => ({ storeBuilderV16: { version: 16, sections: [section("p", "products", "محصولات"), section("b", "banner", "بنر"), section("t", "trust", "ضمانت")] } });

const corporateDoc = (homeTitle = "خانه") => ({
  storeBuilderV16: {
    version: 16,
    header: { storeName: "شرکت" },
    hero: { enabled: true, title: homeTitle, subtitle: "" },
    pages: [
      { id: "home", title: "خانه", slug: "", sections: [section("a", "about", homeTitle)] },
      { id: "team", title: "تیم", slug: "team", sections: [section("m", "team", "تیم"), section("c", "contact", "تماس")] },
    ],
  },
});

// --- manifest builder (pure) --------------------------------------------------

test("builder: STORE yields commerce capabilities and namespaced section types", () => {
  assert.deepEqual(buildCapabilityManifest({ siteType: "STORE" }, storeDoc()), {
    manifestVersion: MANIFEST_VERSION,
    capabilities: ["core", "commerce", "payments", "forms"],
    unregisteredCapabilities: [],
    sectionTypes: ["commerce.productShelf", "core.bannerGroup", "core.trust"],
    unknownSectionTypes: [],
  });
});

test("builder: multi-page sections are collected; disabled sections are skipped", () => {
  const doc = corporateDoc();
  doc.storeBuilderV16.pages[1].sections.push(section("x", "portfolio", "پنهان", { enabled: false }));
  assert.deepEqual(buildCapabilityManifest({ siteType: "BUSINESS" }, doc).sectionTypes, ["core.about", "core.contact", "people.profileGrid"]);
});

test("builder: unknown capabilities and section types are reported, never thrown", () => {
  const content = {
    websitePlatform: { capabilities: ["teleport", "booking", "courses", "lead"] },
    storeBuilderV16: { sections: [section("h", "hologram", "?"), section("a", "about", "a"), { type: 7 }, null, "text"] },
  };
  const manifest = buildCapabilityManifest({ siteType: "MEDICAL" }, content);
  assert.deepEqual(manifest.capabilities, ["core", "forms"]);
  assert.deepEqual(manifest.unregisteredCapabilities, ["booking", "courses"]);
  assert.deepEqual(manifest.sectionTypes, ["core.about"]);
  assert.deepEqual(manifest.unknownSectionTypes, ["hologram"]);
});

test("builder: legacy and malformed content produce an empty section list", () => {
  for (const content of [undefined, null, {}, { headline: "x" }, { storeBuilderV16: "bad" }, { storeBuilderV16: { sections: "bad", pages: {} } }]) {
    const manifest = buildCapabilityManifest({ siteType: "BUSINESS" }, content);
    assert.deepEqual(manifest.sectionTypes, []);
    assert.equal(manifest.manifestVersion, MANIFEST_VERSION);
  }
});

test("builder: never mutates the content document", () => {
  const content = corporateDoc();
  const before = structuredClone(content);
  buildCapabilityManifest({ siteType: "BUSINESS" }, content);
  assert.deepEqual(content, before);
});

test("reader: uses stored v2 metadata; derives it for older manifests", () => {
  const stored = { manifest: { manifestVersion: 2, capabilities: ["core"], sectionTypes: ["core.about"] }, content: storeDoc() };
  assert.deepEqual(readCapabilityManifest(stored, { siteType: "STORE" }), { capabilities: ["core"], sectionTypes: ["core.about"], source: "manifest" });
  for (const manifest of [{}, { siteType: "STORE" }, { manifestVersion: 1 }, null, { manifestVersion: 2, capabilities: "x" }]) {
    const read = readCapabilityManifest({ manifest, content: storeDoc() }, { siteType: "STORE" });
    assert.equal(read.source, "derived");
    assert.deepEqual(read.capabilities, ["core", "commerce", "payments", "forms"]);
    assert.deepEqual(read.sectionTypes, ["commerce.productShelf", "core.bannerGroup", "core.trust"]);
  }
  assert.deepEqual(readCapabilityManifest({ manifest: { siteType: "STORE" }, content: {} }).capabilities, ["core", "commerce", "payments", "forms"], "falls back to the manifest's siteType");
  assert.deepEqual(readCapabilityManifest(null).sectionTypes, []);
});

// --- publish flow (repository) --------------------------------------------------

test("publish: new versions carry capabilities and sectionTypes next to the existing fields", () => {
  const { repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const store = service.create({ name: "فروشگاه", siteType: "STORE", content: storeDoc() });
    service.publish(store.id);
    const { manifest, content } = repository.getPublishedPublic(store.id).version;
    assert.equal(manifest.manifestVersion, 2);
    assert.deepEqual(manifest.capabilities, ["core", "commerce", "payments", "forms"]);
    assert.deepEqual(manifest.sectionTypes, ["commerce.productShelf", "core.bannerGroup", "core.trust"]);
    for (const key of ["projectId", "slug", "siteType", "contextVersionId", "publishedAt", "assetIds"]) assert.ok(key in manifest, `existing field ${key} kept`);
    assert.equal(content.storeBuilderV16.sections[0].type, "products", "stored content keeps legacy types; never rewritten");

    const corp = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc() });
    service.publish(corp.id);
    const corpManifest = repository.getPublishedPublic(corp.id).version.manifest;
    assert.deepEqual(corpManifest.capabilities, ["core", "forms", "blog", "people"]);
    assert.ok(!corpManifest.capabilities.includes("commerce"));
    assert.deepEqual(corpManifest.sectionTypes, ["core.about", "core.contact", "people.profileGrid"]);
  });
});

test("publish: unknown capabilities do not break publishing", () => {
  const { repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const content = {
      ...corporateDoc(),
      websitePlatform: { schemaVersion: 1, pages: [{ id: "home", slug: "" }], capabilities: ["teleport", "booking", "team"] },
    };
    const project = service.create({ name: "مطب", siteType: "MEDICAL", content });
    service.publish(project.id);
    const { manifest } = repository.getPublishedPublic(project.id).version;
    assert.deepEqual(manifest.capabilities, ["core", "people"]);
    assert.deepEqual(manifest.unregisteredCapabilities, ["booking"]);
  });
});

test("rollback: the new version keeps metadata, recomputed from the restored snapshot", () => {
  const { repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc("نسخه یک") });
    service.publish(project.id);
    const first = repository.getPublishedPublic(project.id).version;
    const edited = corporateDoc("نسخه دو");
    edited.storeBuilderV16.pages = edited.storeBuilderV16.pages.slice(0, 1);
    service.update(project.id, { content: edited });
    service.publish(project.id);
    assert.deepEqual(repository.getPublishedPublic(project.id).version.manifest.sectionTypes, ["core.about"]);

    service.rollbackPublishVersion(project.id, first.id);
    const rolled = repository.getPublishedPublic(project.id).version;
    assert.equal(rolled.manifest.rollbackOfVersionId, first.id);
    assert.equal(rolled.manifest.manifestVersion, 2);
    assert.deepEqual(rolled.manifest.capabilities, first.manifest.capabilities);
    assert.deepEqual(rolled.manifest.sectionTypes, first.manifest.sectionTypes);
  });
});

test("old snapshots without metadata still render, read by fallback, and roll back into v2", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc() });
    service.publish(project.id);
    const live = repository.getPublishedPublic(project.id);
    const baselineHtml = renderPublishedSite(live.project, live.version, live.assets);

    // Simulate a version published before PR 2.
    const legacyManifest = { projectId: project.id, slug: live.project.slug, siteType: "BUSINESS", publishedAt: live.version.publishedAt, assetIds: [] };
    db.prepare("UPDATE site_publish_versions SET manifest_json=? WHERE id=?").run(JSON.stringify(legacyManifest), live.version.id);
    const old = repository.getPublishedPublic(project.id);
    assert.equal(old.version.manifest.manifestVersion, undefined);
    assert.equal(renderPublishedSite(old.project, old.version, old.assets), baselineHtml, "rendering ignores the manifest");
    assert.deepEqual(readCapabilityManifest(old.version, old.project), {
      capabilities: ["core", "forms", "blog", "people"], sectionTypes: ["core.about", "core.contact", "people.profileGrid"], source: "derived",
    });
    assert.deepEqual(JSON.parse(db.prepare("SELECT manifest_json FROM site_publish_versions WHERE id=?").get(old.version.id).manifest_json), legacyManifest, "reading never migrates the stored row");

    service.rollbackPublishVersion(project.id, old.version.id);
    const rolled = repository.getPublishedPublic(project.id).version.manifest;
    assert.equal(rolled.manifestVersion, 2, "rolling back an old snapshot publishes a v2 manifest");
    assert.deepEqual(rolled.sectionTypes, ["core.about", "core.contact", "people.profileGrid"]);
  });
});
