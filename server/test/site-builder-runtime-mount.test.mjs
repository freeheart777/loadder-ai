import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { mountSiteBuilderControlPlane } from "../app/site-builder-control-plane.mjs";

test("site builder control plane composes tenant-safe project and media services", () => {
  const db = new Database(":memory:");
  runMigrations(db, migrations);
  const context = { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) };
  const mounted = mountSiteBuilderControlPlane({ app: express(), db, businessContextService: context, basePath: "/" });

  assert.equal(typeof mounted.projectService.get, "function");
  assert.equal(typeof mounted.mediaService.createUpload, "function");

  const project = runWithWorkspace("ws-1", () =>
    mounted.projectService.create({ name: "Runtime Store", siteType: "STORE", content: { hero: "ready" } })
  );
  runWithWorkspace("ws-1", () => assert.equal(mounted.projectService.get(project.id).workspaceId, "ws-1"));
  runWithWorkspace("ws-2", () => assert.throws(
    () => mounted.projectService.get(project.id),
    (error) => error.code === "SITE_PROJECT_NOT_FOUND" && error.status === 404
  ));

  db.close();
});
