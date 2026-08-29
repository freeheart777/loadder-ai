import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { mountSiteBuilderControlPlane } from "../app/site-builder-control-plane.mjs";

test("site builder control plane mounts project and media routes without a duplicate api prefix", () => {
  const db = new Database(":memory:");
  runMigrations(db, migrations);
  const app = express();
  const context = { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) };
  mountSiteBuilderControlPlane({ app, db, businessContextService: context, basePath: "/" });

  const paths = app.router.stack
    .filter((layer) => layer.name === "router")
    .flatMap((layer) => layer.handle.stack)
    .map((layer) => layer.route?.path)
    .filter(Boolean);

  assert.ok(paths.includes("/site-projects"));
  assert.ok(paths.includes("/site-projects/:id/media"));
  assert.ok(paths.includes("/site-projects/:id/media/upload-url"));
  assert.equal(paths.some((path) => String(path).startsWith("/api/")), false);

  runWithWorkspace("ws-1", () => {
    const mounted = mountSiteBuilderControlPlane({ app: express(), db, businessContextService: context, basePath: "/" });
    const project = mounted.projectService.create({ name: "Runtime Store", siteType: "STORE", content: { hero: "ready" } });
    assert.equal(mounted.projectService.get(project.id).workspaceId, "ws-1");
  });
  db.close();
});
