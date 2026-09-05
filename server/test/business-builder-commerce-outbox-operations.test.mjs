import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceOutboxOperations } from "../app/business-builder/commerce-outbox-operations.mjs";
import { CommerceOutboxStore } from "../app/business-builder/commerce-runtime-bridge.mjs";
import { createBusinessBuilderAdminHealth } from "../app/business-builder/admin-health.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration042SiteBuilderControlPlane } from "../db/migrations/042_site_builder_control_plane.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration068BusinessBuilderCommerceEventReceipts } from "../db/migrations/068_business_builder_commerce_event_receipts.mjs";
import { migration070BusinessBuilderCommerceOutbox } from "../db/migrations/070_business_builder_commerce_outbox.mjs";
import { migration074CommerceOutboxDeadLetter } from "../db/migrations/074_commerce_outbox_dead_letter.mjs";
import { migration075CommerceOutboxClaimLease } from "../db/migrations/075_commerce_outbox_claim_lease.mjs";

function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=OFF");
  [migration001Identity, migration042SiteBuilderControlPlane, migration050BusinessBuilderProjects, migration068BusinessBuilderCommerceEventReceipts, migration070BusinessBuilderCommerceOutbox, migration074CommerceOutboxDeadLetter, migration075CommerceOutboxClaimLease].forEach((migration) => migration.up(db));
  db.exec("CREATE TABLE IF NOT EXISTS business_context_versions(id TEXT PRIMARY KEY);");
  db.pragma("foreign_keys=ON");
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

test("poison events dead-letter at the retry ceiling and require explicit admin requeue", () => {
  const db = setup();
  runWithWorkspace("w1", () => {
    db.prepare("UPDATE business_builder_commerce_outbox SET attempts=4,last_error=NULL,available_at=? WHERE id='ob1'").run("2020-01-01T00:00:00.000Z");
    const store = new CommerceOutboxStore(db, { maxAttempts:5 });
    const claimed = store.claim(1);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].id, "ob1");
    const failed = store.failed("ob1", new Error("permanent accounting rejection"), claimed[0].claim_token);
    assert.equal(failed.attempts, 5);
    assert.ok(failed.dead_lettered_at);
    assert.equal(failed.dead_letter_reason, "permanent accounting rejection");
    assert.equal(store.claim().some((row) => row.id === "ob1"), false);

    const operations = new CommerceOutboxOperations(db);
    assert.equal(operations.list({ state:"dead_letter" }).length, 1);
    assert.equal(operations.retry("ob1").code, "COMMERCE_OUTBOX_DEAD_LETTERED");
    const requeued = operations.requeue("ob1");
    assert.equal(requeued.ok, true);
    assert.equal(requeued.event.dead_lettered_at, null);
    assert.equal(requeued.event.dead_letter_reason, null);
    assert.equal(requeued.event.attempts, 0);
    assert.equal(requeued.event.requeue_count, 1);
    assert.equal(store.claim().some((row) => row.id === "ob1"), true);
  });
  db.close();
});

test("admin health surfaces commerce retry and dead-letter failures while older schemas stay safe", () => {
  const db = setup();
  runWithWorkspace("w1", () => {
    const health = createBusinessBuilderAdminHealth(db).summary();
    assert.equal(health.counters.commerceOutboxRetrying, 1);
    assert.equal(health.counters.commerceOutboxDeadLetter, 0);
    assert.equal(health.status, "degraded");
    assert.ok(health.incidents.some((incident) => incident.code === "COMMERCE_OUTBOX_RETRYING"));

    db.prepare("UPDATE business_builder_commerce_outbox SET dead_lettered_at=?,dead_letter_reason=? WHERE id='ob1'").run("2026-09-05T02:00:00.000Z","poison");
    const deadLetterHealth = createBusinessBuilderAdminHealth(db).summary();
    assert.equal(deadLetterHealth.counters.commerceOutboxRetrying, 0);
    assert.equal(deadLetterHealth.counters.commerceOutboxDeadLetter, 1);
    assert.ok(deadLetterHealth.incidents.some((incident) => incident.code === "COMMERCE_OUTBOX_DEAD_LETTER"));
  });
  db.close();
});

test("admin health distinguishes active claims from claims stale beyond the recovery grace", () => {
  const db = setup();
  runWithWorkspace("w1", () => {
    db.prepare("UPDATE business_builder_commerce_outbox SET last_error=NULL,available_at=?,claim_token=?,claimed_at=?,claim_expires_at=? WHERE id='ob1'").run(
      "2020-01-01T00:00:00.000Z",
      "claim-active",
      new Date().toISOString(),
      new Date(Date.now()+5*60_000).toISOString(),
    );
    const active = createBusinessBuilderAdminHealth(db).summary();
    assert.equal(active.counters.commerceOutboxClaimsActive, 1);
    assert.equal(active.counters.commerceOutboxClaimsStale, 0);
    assert.equal(active.incidents.some((incident) => incident.code === "COMMERCE_OUTBOX_STALE_CLAIM"), false);

    db.prepare("UPDATE business_builder_commerce_outbox SET claim_expires_at=? WHERE id='ob1'").run(new Date(Date.now()-2*60_000).toISOString());
    const stale = createBusinessBuilderAdminHealth(db).summary();
    assert.equal(stale.counters.commerceOutboxClaimsActive, 0);
    assert.equal(stale.counters.commerceOutboxClaimsStale, 1);
    assert.ok(stale.incidents.some((incident) => incident.code === "COMMERCE_OUTBOX_STALE_CLAIM" && incident.severity === "medium"));
  });
  db.close();
});
