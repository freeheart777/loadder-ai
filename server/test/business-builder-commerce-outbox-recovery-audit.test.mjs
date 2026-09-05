import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceOutboxOperations } from "../app/business-builder/commerce-outbox-operations.mjs";

function setup({ withAudit = true } = {}) {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE business_builder_commerce_outbox(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      business_builder_project_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT,
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
  if (withAudit) db.exec(`CREATE TABLE audit_logs(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,metadata_json TEXT NOT NULL,created_at TEXT NOT NULL);`);
  const payload = JSON.stringify({ id: "evt1", email: "secret@example.com", card: "must-not-audit" });
  db.prepare(`INSERT INTO business_builder_commerce_outbox(id,workspace_id,business_builder_project_id,event_id,event_type,payload_json,status,attempts,last_error,available_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run("ob1","w1","p1","evt1","commerce.payment.captured",payload,"pending",2,"crm timeout","2099-01-01T00:00:00.000Z","2026-09-05T00:00:00.000Z");
  return db;
}

test("manual retry writes one minimal central audit record in the same workspace", () => {
  const db = setup();
  try {
    runWithWorkspace("w1", () => {
      const operations = new CommerceOutboxOperations(db);
      const result = operations.retry("ob1", { actorId: "admin-1", reason: "CRM recovered; retry downstream" });
      assert.equal(result.ok, true);
      const audit = db.prepare("SELECT * FROM audit_logs").get();
      assert.equal(audit.workspace_id, "w1");
      assert.equal(audit.user_id, "admin-1");
      assert.equal(audit.action, "commerce_outbox.retry");
      assert.equal(audit.resource_type, "business_builder_commerce_outbox");
      assert.equal(audit.resource_id, "ob1");
      const metadata = JSON.parse(audit.metadata_json);
      assert.deepEqual(metadata, {
        eventId: "evt1",
        eventType: "commerce.payment.captured",
        attempts: 2,
        beforeState: "retrying",
        reason: "CRM recovered; retry downstream",
      });
      assert.equal(audit.metadata_json.includes("secret@example.com"), false);
      assert.equal(audit.metadata_json.includes("must-not-audit"), false);
    });
  } finally { db.close(); }
});

test("dead-letter requeue audits the recovery and preserves immutable event identity", () => {
  const db = setup();
  try {
    runWithWorkspace("w1", () => {
      db.prepare("UPDATE business_builder_commerce_outbox SET attempts=5,dead_lettered_at=?,dead_letter_reason=? WHERE id='ob1'").run("2026-09-05T01:00:00.000Z","poison");
      const operations = new CommerceOutboxOperations(db);
      const before = operations.get("ob1");
      const result = operations.requeue("ob1", { actorId: "admin-2", reason: "fixed accounting mapping" });
      assert.equal(result.ok, true);
      assert.equal(result.event.event_id, before.event_id);
      assert.equal(result.event.payload_json, before.payload_json);
      assert.equal(result.event.requeue_count, 1);
      const audit = db.prepare("SELECT action,user_id,metadata_json FROM audit_logs").get();
      assert.equal(audit.action, "commerce_outbox.requeue");
      assert.equal(audit.user_id, "admin-2");
      const metadata = JSON.parse(audit.metadata_json);
      assert.equal(metadata.beforeState, "dead_letter");
      assert.equal(metadata.reason, "fixed accounting mapping");
    });
  } finally { db.close(); }
});

test("recovery mutation rolls back if its required audit write fails", () => {
  const db = setup({ withAudit: false });
  try {
    runWithWorkspace("w1", () => {
      const operations = new CommerceOutboxOperations(db);
      const before = operations.get("ob1");
      assert.throws(() => operations.retry("ob1", { actorId: "admin-1", reason: "must audit" }), /no such table: audit_logs/);
      const after = operations.get("ob1");
      assert.equal(after.available_at, before.available_at);
      assert.equal(after.attempts, before.attempts);
      assert.equal(after.last_error, before.last_error);
    });
  } finally { db.close(); }
});
