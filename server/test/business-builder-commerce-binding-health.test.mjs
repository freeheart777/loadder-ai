import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBusinessBuilderAdminHealth } from "../app/business-builder/admin-health.mjs";

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE site_projects(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      site_type TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE business_builder_commerce_bindings(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      site_project_id TEXT NOT NULL,
      business_builder_project_id TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);
  return db;
}

test("published storefront binding health is tenant scoped and fail-closed", async () => {
  const db = setup();
  db.prepare("INSERT INTO site_projects VALUES(?,?,?,?)").run("store-a","w1","STORE","PUBLISHED");
  db.prepare("INSERT INTO site_projects VALUES(?,?,?,?)").run("store-b","w1","STORE","PUBLISHED");
  db.prepare("INSERT INTO site_projects VALUES(?,?,?,?)").run("store-draft","w1","STORE","DRAFT");
  db.prepare("INSERT INTO site_projects VALUES(?,?,?,?)").run("other-store","w2","STORE","PUBLISHED");
  db.prepare("INSERT INTO business_builder_commerce_bindings VALUES(?,?,?,?,?)").run("binding-b","w1","store-b","app-b","disabled");
  db.prepare("INSERT INTO business_builder_commerce_bindings VALUES(?,?,?,?,?)").run("binding-other","w2","other-store","app-other","active");

  const health = createBusinessBuilderAdminHealth(db);
  const result = await runWithWorkspace("w1", () => health.summary());

  assert.equal(result.counters.commerceBindingsActive, 0);
  assert.equal(result.counters.commerceBindingsDisabled, 1);
  assert.equal(result.counters.commercePublishedStoresUnbound, 2);
  assert.equal(result.counters.commercePublishedStoresDisabled, 1);
  assert.equal(result.status, "degraded");
  assert.deepEqual(result.incidents.filter((item) => item.code.startsWith("COMMERCE_STOREFRONT")), [
    { code: "COMMERCE_STOREFRONT_UNBOUND", severity: "high", count: 2 },
    { code: "COMMERCE_STOREFRONT_BINDING_DISABLED", severity: "medium", count: 1 },
  ]);
  db.close();
});

test("active binding makes a published storefront healthy from the commerce binding perspective", async () => {
  const db = setup();
  db.prepare("INSERT INTO site_projects VALUES(?,?,?,?)").run("store-a","w1","STORE","PUBLISHED");
  db.prepare("INSERT INTO business_builder_commerce_bindings VALUES(?,?,?,?,?)").run("binding-a","w1","store-a","app-a","active");

  const result = await runWithWorkspace("w1", () => createBusinessBuilderAdminHealth(db).summary());
  assert.equal(result.counters.commerceBindingsActive, 1);
  assert.equal(result.counters.commercePublishedStoresUnbound, 0);
  assert.equal(result.counters.commercePublishedStoresDisabled, 0);
  assert.equal(result.incidents.some((item) => item.code.startsWith("COMMERCE_STOREFRONT")), false);
  db.close();
});
