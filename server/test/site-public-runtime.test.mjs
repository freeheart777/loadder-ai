import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { createSitePublicRuntimeService } from "../app/services/site-public-runtime-service.mjs";
import { createSitePublicRuntimeRouter } from "../app/routes/site-public-runtime.mjs";

test("public site runtime exposes published project content and assets only", async () => {
  const db = new Database(":memory:");
  runMigrations(db, migrations);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("draft-1", "ws-1", "Draft", "STORE", "draft-site", "DRAFT", JSON.stringify({ headline: "private" }), "2026-08-28T00:00:00Z", "2026-08-28T00:00:00Z", null);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("pub-1", "ws-1", "Published Store", "STORE", "published-store", "PUBLISHED", JSON.stringify({ headline: "hello" }), "2026-08-28T00:00:00Z", "2026-08-28T00:00:00Z", "2026-08-28T00:01:00Z");
  db.prepare("INSERT INTO site_assets(id,workspace_id,site_project_id,kind,name,url,alt_text,created_at) VALUES(?,?,?,?,?,?,?,?)").run("asset-1", "ws-1", "pub-1", "hero", "hero.png", "https://cdn.example.test/hero.png", "Hero", "2026-08-28T00:01:00Z");

  const app = express();
  app.use(createSitePublicRuntimeRouter({ service: createSitePublicRuntimeService(db) }));
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  let response = await fetch(`${base}/sites/published-store`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.project.status, "PUBLISHED");
  assert.equal(data.project.content.headline, "hello");
  assert.equal(data.assets[0].kind, "hero");
  assert.match(response.headers.get("cache-control"), /stale-while-revalidate/);

  response = await fetch(`${base}/sites/draft-site`);
  assert.equal(response.status, 404);
  response = await fetch(`${base}/sites/does-not-exist`);
  assert.equal(response.status, 404);

  await new Promise((resolve) => server.close(resolve));
  db.close();
});
