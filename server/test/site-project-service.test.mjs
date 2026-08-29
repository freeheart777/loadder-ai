import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

test("site projects persist content/assets and publish state per workspace", () => {
  const db = new Database(":memory:");
  runMigrations(db, migrations);
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) }, now: () => new Date("2026-08-28T00:00:00.000Z") });
  const project = runWithWorkspace("ws-1", () => service.create({ name: "My Store", siteType: "STORE", content: { hero: "Hello" } }));
  const otherProject = runWithWorkspace("ws-1", () => service.create({ name: "Other Store", siteType: "STORE", content: { hero: "Other" } }));

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

test("site project service rejects a repository record owned by another workspace", () => {
  let updated = false;
  let published = false;
  const repository = {
    get: () => ({ id: "site-foreign", workspaceId: "ws-2", content: { hero: "Secret" } }),
    update: () => { updated = true; },
    publish: () => { published = true; },
  };
  const service = createSiteProjectService({
    repository,
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });

  runWithWorkspace("ws-1", () => {
    assert.throws(() => service.get("site-foreign"), (error) => error.code === "SITE_PROJECT_NOT_FOUND" && error.status === 404);
    assert.throws(() => service.update("site-foreign", { name: "Hijack" }), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
    assert.throws(() => service.publish("site-foreign"), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
  });

  assert.equal(updated, false);
  assert.equal(published, false);
});
