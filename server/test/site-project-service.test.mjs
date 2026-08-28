import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

const createFixture = (getCurrent = () => ({ activeContext: { id: "ctx-1" }, isStale: false })) => {
  const db = new Database(":memory:");
  runMigrations(db, migrations);
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent }, now: () => new Date("2026-08-28T00:00:00.000Z") });
  return { db, service };
};

test("site projects can be created standalone without Business Context", () => {
  const { db, service } = createFixture(() => ({ activeContext: null, isStale: false }));
  const project = runWithWorkspace("ws-manual", () => service.create({ name: "Manual News", siteType: "NEWS", content: { headline: "Hello" } }));
  assert.equal(project.contextVersionId, null);
  assert.equal(project.content.generatedFrom, "MANUAL");
  assert.equal(project.content.headline, "Hello");
  assert.equal(project.status, "DRAFT");
  assert.equal(runWithWorkspace("ws-manual", () => service.publish(project.id).status), "PUBLISHED");
  db.close();
});

test("site projects use active Business Context when available", () => {
  const { db, service } = createFixture();
  const project = runWithWorkspace("ws-context", () => service.create({ name: "Context Store", siteType: "STORE", content: { hero: "Hello" } }));
  assert.equal(project.contextVersionId, "ctx-1");
  assert.equal(project.content.generatedFrom, "BUSINESS_CONTEXT");
  assert.equal(project.content.contextVersionId, "ctx-1");
  db.close();
});

test("site projects reject stale Business Context", () => {
  const { db, service } = createFixture(() => ({ activeContext: { id: "ctx-1" }, isStale: true }));
  assert.throws(() => runWithWorkspace("ws-stale", () => service.create({ name: "Blocked", siteType: "BUSINESS", content: { headline: "x" } })), (error) => error.code === "BUSINESS_CONTEXT_STALE");
  db.close();
});

test("site projects persist content/assets and publish state per workspace", () => {
  const { db, service } = createFixture();
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
