import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceOutboxOperations } from "../app/business-builder/commerce-outbox-operations.mjs";

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE business_builder_commerce_outbox(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      business_builder_project_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      available_at TEXT NOT NULL,
      delivered_at TEXT,
      dead_lettered_at TEXT,
      dead_letter_reason TEXT,
      requeue_count INTEGER NOT NULL DEFAULT 0,
      claim_token TEXT,
      claimed_at TEXT,
      claim_expires_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE business_builder_commerce_event_receipts(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      consumer TEXT NOT NULL,
      status TEXT NOT NULL,
      details_json TEXT,
      processed_at TEXT
    );
  `);
  const payload = JSON.stringify({ id: "evt1", type: "commerce.order.created", workspaceId: "w1", projectId: "p1", orderId: "o1" });
  db.prepare(`INSERT INTO business_builder_commerce_outbox(
    id,workspace_id,business_builder_project_id,event_id,payload_json,status,attempts,last_error,available_at,claim_token,claimed_at,claim_expires_at,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    "ob1","w1","p1","evt1",payload,"pending",1,"previous timeout","2099-01-01T00:00:00.000Z","active-token",new Date().toISOString(),new Date(Date.now()+5*60_000).toISOString(),"2026-09-05T00:00:00.000Z"
  );
  db.prepare("INSERT INTO business_builder_commerce_event_receipts(id,workspace_id,project_id,event_id,consumer,status,details_json,processed_at) VALUES(?,?,?,?,?,?,?,?)")
    .run("r1","w1","p1","evt1","inventory","processed","{}","2026-09-05T00:01:00.000Z");
  return db;
}

test("active claim is visible as processing and blocks manual retry", () => {
  const db = setup();
  try {
    runWithWorkspace("w1", () => {
      const operations = new CommerceOutboxOperations(db);
      const processing = operations.list({ state: "processing" });
      assert.equal(processing.length, 1);
      assert.equal(processing[0].operational_state, "processing");
      assert.equal(processing[0].claim_state, "active");

      const summary = operations.summary();
      assert.equal(summary.processing, 1);
      assert.equal(summary.staleClaim, 0);
      assert.equal(summary.retrying, 0);

      const reconciliation = operations.reconcile("ob1");
      assert.equal(reconciliation.lease.state, "active");
      assert.equal(reconciliation.lease.retrySafeNow, false);
      assert.equal(reconciliation.processed, 1);
      assert.deepEqual(reconciliation.missing, ["crm", "accounting", "analytics"]);

      const before = operations.get("ob1");
      const retry = operations.retry("ob1");
      const after = operations.get("ob1");
      assert.equal(retry.ok, false);
      assert.equal(retry.code, "COMMERCE_OUTBOX_IN_FLIGHT");
      assert.equal(after.available_at, before.available_at);
      assert.equal(after.claim_token, "active-token");
    });
  } finally {
    db.close();
  }
});

test("expired claim is classified stale and can be safely re-armed", () => {
  const db = setup();
  try {
    runWithWorkspace("w1", () => {
      db.prepare("UPDATE business_builder_commerce_outbox SET claim_expires_at=? WHERE id='ob1'").run(new Date(Date.now()-60_000).toISOString());
      const operations = new CommerceOutboxOperations(db);

      const stale = operations.list({ state: "stale_claim" });
      assert.equal(stale.length, 1);
      assert.equal(stale[0].operational_state, "stale_claim");
      assert.equal(operations.summary().staleClaim, 1);

      const reconciliation = operations.reconcile("ob1");
      assert.equal(reconciliation.lease.state, "stale");
      assert.equal(reconciliation.lease.retrySafeNow, true);

      const retry = operations.retry("ob1");
      assert.equal(retry.ok, true);
      assert.equal(retry.event.claim_state, "stale");
      assert.ok(retry.event.available_at < "2099-01-01T00:00:00.000Z");
    });
  } finally {
    db.close();
  }
});
