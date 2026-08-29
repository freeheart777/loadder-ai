import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { mountSiteBuilderControlPlane } from "../app/site-builder-control-plane.mjs";

test("site builder control plane composes project and media services on a router-relative mount", () => {
  const db = new Database(":memory:");
  runMigrations(db, migrations);
  const context = { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) };
  const app = express();
  const mounted = mountSiteBuilderControlPlane({ app, db, businessContextService: context, basePath: "/" });

  assert.equal(typeof mounted.projectService.get, "function");
  assert.equal(typeof mounted.mediaService.createUpload, "function");

  runWithWorkspace("ws-1", () => {
    const project = mounted.projectService.create({ name: "Runtime Store", siteType: "STORE", content: { hero: "ready" } });
    assert.equal(mounted.projectService.get(project.id).workspaceId, "ws-1");
  });

  db.close();
});
