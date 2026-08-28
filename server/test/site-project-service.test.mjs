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
  runWithWorkspace("ws-1", () => {
    assert.equal(service.list().length, 1);
    const asset = service.addAsset(project.id, { kind: "product", name: "shoe.jpg", url: "https://cdn.example.test/shoe.jpg" });
    assert.equal(service.assets(project.id)[0].id, asset.id);
    assert.equal(service.publish(project.id).status, "PUBLISHED");
  });
  runWithWorkspace("ws-2", () => {
    assert.equal(service.list().length, 0);
    assert.throws(() => service.get(project.id), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
  });
  db.close();
});
