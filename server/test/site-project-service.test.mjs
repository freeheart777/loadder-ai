import assert from "node:assert/strict";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

test("site projects persist content/assets and publish state per workspace", () => {
  const db = createSiteTestDb();
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) }, now: () => new Date("2026-08-28T00:00:00.000Z") });
  const project = runWithWorkspace("ws-1", () => service.create({ name: "My Store", siteType: "STORE", content: { hero: "Hello" } }));
  const otherProject = runWithWorkspace("ws-1", () => service.create({ name: "Other Store", siteType: "STORE", content: { hero: "Other" } }));

  assert.equal(project.content.hero, "Hello");
  assert.equal(project.content.websitePlatform.schemaVersion, 1);
  assert.equal(project.content.websitePlatform.archetype, "store");
  assert.equal(project.content.websitePlatform.brandContext.businessName, "My Store");
  assert.ok(project.content.websitePlatform.capabilities.includes("landing"));
  assert.ok(project.content.websitePlatform.capabilities.includes("analytics"));
  assert.ok(project.content.websitePlatform.capabilities.includes("ads"));

  runWithWorkspace("ws-1", () => {
    assert.equal(service.list().length, 2);
    const asset = service.addAsset(project.id, { kind: "product", name: "shoe.jpg", url: "https://cdn.example.test/shoe.jpg" });
    const otherAsset = service.addAsset(otherProject.id, { kind: "product", name: "other.jpg", url: "https://cdn.example.test/other.jpg" });
    assert.equal(service.assets(project.id)[0].id, asset.id);
    assert.equal(service.publish(project.id).status, "PUBLISHED");
    assert.throws(() => service.addAsset(project.id, { kind: "script", name: "x.js", url: "https://cdn.example.test/x.js" }), (error) => error.code === "SITE_ASSET_KIND_INVALID");
    assert.throws(() => service.addAsset(project.id, { kind: "hero", name: "x.png", url: "javascript:alert(1)" }), (error) => error.code === "SITE_ASSET_URL_INVALID");
    assert.throws(() => service.removeAsset(project.id, otherAsset.id), (error) => error.code === "SITE_ASSET_NOT_FOUND");
    assert.equal(service.assets(otherProject.id)[0].id, otherAsset.id);
    assert.equal(service.removeAsset(project.id, asset.id), true);
    assert.equal(service.assets(project.id).length, 0);
  });

  runWithWorkspace("ws-2", () => {
    assert.equal(service.list().length, 0);
    assert.throws(() => service.get(project.id), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
    assert.throws(() => service.removeAsset(project.id, otherProject.id), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
  });
  db.close();
});

test("site project content updates lazily add website platform without deleting legacy builder state", () => {
  const db = createSiteTestDb();
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) } });
  const project = runWithWorkspace("ws-1", () => service.create({ name: "Clinic", siteType: "MEDICAL", content: { legacy: true } }));

  const updated = runWithWorkspace("ws-1", () => service.update(project.id, {
    content: { legacy: true, storeBuilderV16: { version: 16 } },
  }));

  assert.equal(updated.content.legacy, true);
  assert.deepEqual(updated.content.storeBuilderV16, { version: 16 });
  assert.equal(updated.content.websitePlatform.archetype, "doctor");
  assert.ok(updated.content.websitePlatform.capabilities.includes("booking"));
  assert.ok(updated.content.websitePlatform.capabilities.includes("landing"));
  db.close();
});

test("site project service preserves an existing website platform definition", () => {
  const db = createSiteTestDb();
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) } });
  const websitePlatform = {
    schemaVersion: 1,
    archetype: "catalog",
    capabilities: ["catalog", "landing"],
    pages: [{ id: "landing-1", slug: "campaign", title: "Campaign", kind: "landing", enabled: true }],
    integrations: { analytics: [], ads: [] },
    conversionGoals: [],
  };
  const project = runWithWorkspace("ws-1", () => service.create({ name: "Catalog", siteType: "BUSINESS", content: { websitePlatform } }));
  assert.deepEqual(project.content.websitePlatform, websitePlatform);
  db.close();
});

test("site project service rejects a repository record owned by another workspace", () => {
  const foreignProject = { id: "project-a", workspaceId: "ws-a", content: { hero: "x" } };
  let updated = false;
  let published = false;
  const service = createSiteProjectService({
    repository: {
      get: () => foreignProject,
      update: () => { updated = true; return foreignProject; },
      publish: () => { published = true; return foreignProject; },
    },
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx" }, isStale: false }) },
  });

  runWithWorkspace("ws-b", () => {
    for (const operation of [
      () => service.get(foreignProject.id),
      () => service.update(foreignProject.id, { name: "stolen" }),
      () => service.publish(foreignProject.id),
    ]) {
      assert.throws(operation, (error) => error.code === "SITE_PROJECT_NOT_FOUND" && error.status === 404);
    }
  });
  assert.equal(updated, false);
  assert.equal(published, false);
});
