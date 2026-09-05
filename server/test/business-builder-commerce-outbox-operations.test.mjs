import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceOutboxOperations } from "../app/business-builder/commerce-outbox-operations.mjs";
import { createBusinessBuilderAdminHealth } from "../app/business-builder/admin-health.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration042SiteBuilderControlPlane } from "../db/migrations/042_site_builder_control_plane.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration068BusinessBuilderCommerceEventReceipts } from "../db/migrations/068_business_builder_commerce_event_receipts.mjs";
import { migration070BusinessBuilderCommerceOutbox } from "../db/migrations/070_business_builder_commerce_outbox.mjs";

function setup() {
  const db = new Database(":memory:");
  [migration001Identity, migration042SiteBuilderControlPlane, migration050BusinessBuilderProjects, migration068BusinessBuilderCommerceEventReceipts, migration070BusinessBuilderCommerceOutbox].forEach((migration) => migration.up(db));
  const t = "2026-09-05T00:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?),(?,?,?,?,?,?)").run("w1","W1","w1","active",t,t,"w2","W2","w2","active",t,t);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?)").run("s1","w1","S1","STORE","s1","PUBLISHED","{}",t,t,"s2","w2","S2","STORE","s2","PUBLISHED","{}",t,t);
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?)").run("p1","w1","P1","commerce","en-US","draft",t,t,"p2","w2","P2","commerce","en-US","draft",t,t);
  const payload1 = JSON.stringify({ id:"evt1", type:"commerce.payment.captured", workspaceId:"w1", projectId:"p1", orderId:"o1" });
  const payload2 = JSON.stringify({ id:"evt2", type:"commerce.order.created", workspaceId:"w2", projectId:"p2", orderId:"o2" });
  db.prepare("INSERT INTO business_builder_commerce_outbox(id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,last_error,available_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("ob1","w1","s1","p1","evt1","commerce.payment.captured","o1",payload1,"pending",2,"crm timeout","2099-01-01T00:00:00.000Z",t,"ob2","w2","s2","p2","evt2","commerce.order.created","o2",payload2,"pending",0,null,t,t);
  db.prepare("INSERT INTO business_builder_commerce_event_receipts(id,workspace_id,project_id,event_id,consumer,event_type,order_id,status,details_json,processed_at) VALUES(?,?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?,?)").run("r1","w1","p1","evt1","inventory","commerce.payment.captured","o1","processed","{}",t,"r2","w1","p1","evt1","accounting","commerce.payment.captured","o1","processed","{}",t);
  return db;
}

test("commerce outbox operations are workspace scoped and reconcile consumer receipts", () => {
  const db = setup();
  runWithWorkspace("w1", () => {
    const operations = new CommerceOutboxOperations(db);
    const rows = operations.list({ state:"retrying" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "ob1");
    assert.equal(rows[0].operational_state, "retrying");
    const reconciliation = operations.reconcile("ob1");
    assert.equal(reconciliation.processed, 2);
    assert.deepEqual(reconciliation.missing, ["crm", "analytics"]);
    assert.equal(reconciliation.complete, false);
    assert.equal(operations.get("ob2"), null);
  });
  runWithWorkspace("w2", () => assert.equal(new CommerceOutboxOperations(db).get("ob1"), null));
  db.close();
});

test("manual retry only re-arms an undelivered event without changing immutable identity", () => {
  const db = setup();
  runWithWorkspace("w1", () => {
    const operations = new CommerceOutboxOperations(db);
    const before = operations.get("ob1");
    const result = operations.retry("ob1");
    const after = operations.get("ob1");
    assert.equal(result.ok, true);
    assert.equal(after.event_id, before.event_id);
    assert.equal(after.payload_json, before.payload_json);
    assert.equal(after.attempts, 2);
    assert.equal(after.last_error, "crm timeout");
    assert.ok(after.available_at < "2099-01-01T00:00:00.000Z");
    db.prepare("UPDATE business_builder_commerce_outbox SET status='delivered',delivered_at=? WHERE id='ob1'").run("2026-09-05T01:00:00.000Z");
    assert.equal(operations.retry("ob1").code, "COMMERCE_OUTBOX_ALREADY_DELIVERED");
  });
  db.close();
});

test("admin health surfaces commerce retry failures while older schemas stay safe", () => {
  const db = setup();
  runWithWorkspace("w1", () => {
    const health = createBusinessBuilderAdminHealth(db).summary();
    assert.equal(health.counters.commerceOutboxRetrying, 1);
    assert.equal(health.status, "degraded");
    assert.ok(health.incidents.some((incident) => incident.code === "COMMERCE_OUTBOX_RETRYING"));
  });
  db.close();
});
