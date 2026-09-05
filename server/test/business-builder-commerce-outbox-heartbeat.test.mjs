import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createCommerceRuntimeBridge } from "../app/business-builder/commerce-runtime-bridge.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE business_builder_commerce_outbox(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      site_project_id TEXT NOT NULL,
      business_builder_project_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      order_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      available_at TEXT NOT NULL,
      delivered_at TEXT,
      dead_lettered_at TEXT,
      dead_letter_reason TEXT,
      claim_token TEXT,
      claimed_at TEXT,
      claim_expires_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const event = { id: "evt-1", type: "commerce.order.created", workspaceId: "w1", projectId: "p1", orderId: "o1" };
  db.prepare(`
    INSERT INTO business_builder_commerce_outbox(
      id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `).run("ob1","w1","s1","p1",event.id,event.type,event.orderId,JSON.stringify(event),"pending",0,"2000-01-01T00:00:00.000Z","2000-01-01T00:00:00.000Z");
  return db;
}

test("bridge heartbeat extends an owned lease until long processing completes", async () => {
  const db = setup();
  let started;
  let release;
  const startedGate = new Promise((resolve) => { started = resolve; });
  const processGate = new Promise((resolve) => { release = resolve; });
  const eventProcessor = {
    async process() {
      started();
      await processGate;
      return { ok: true };
    },
  };

  try {
    await runWithWorkspace("w1", async () => {
      const bridge = createCommerceRuntimeBridge({ db, projects: {}, eventProcessor, leaseMs: 1000, leaseHeartbeatMs: 50 });
      const draining = bridge.drain({ limit: 1 });
      await startedGate;

      const first = db.prepare("SELECT claim_token,claim_expires_at FROM business_builder_commerce_outbox WHERE id='ob1'").get();
      assert.ok(first.claim_token);
      const firstExpiry = new Date(first.claim_expires_at).getTime();

      await sleep(180);
      const renewed = db.prepare("SELECT claim_token,claim_expires_at FROM business_builder_commerce_outbox WHERE id='ob1'").get();
      assert.equal(renewed.claim_token, first.claim_token);
      assert.ok(new Date(renewed.claim_expires_at).getTime() > firstExpiry);

      release();
      const result = await draining;
      assert.equal(result.length, 1);
      assert.equal(result[0].ok, true);
      const delivered = db.prepare("SELECT status,claim_token,claim_expires_at FROM business_builder_commerce_outbox WHERE id='ob1'").get();
      assert.equal(delivered.status, "delivered");
      assert.equal(delivered.claim_token, null);
      assert.equal(delivered.claim_expires_at, null);
    });
  } finally {
    db.close();
  }
});

test("bridge reports lease loss instead of false success when ownership changes mid-processing", async () => {
  const db = setup();
  let started;
  let release;
  const startedGate = new Promise((resolve) => { started = resolve; });
  const processGate = new Promise((resolve) => { release = resolve; });
  const eventProcessor = {
    async process() {
      started();
      await processGate;
      return { ok: true };
    },
  };

  try {
    await runWithWorkspace("w1", async () => {
      const bridge = createCommerceRuntimeBridge({ db, projects: {}, eventProcessor, leaseMs: 1000, leaseHeartbeatMs: 50 });
      const draining = bridge.drain({ limit: 1 });
      await startedGate;
      const original = db.prepare("SELECT claim_token FROM business_builder_commerce_outbox WHERE id='ob1'").get();
      assert.ok(original.claim_token);

      db.prepare("UPDATE business_builder_commerce_outbox SET claim_token=?,claim_expires_at=? WHERE id='ob1'").run("new-owner",new Date(Date.now()+10_000).toISOString());
      await sleep(80);
      release();

      const result = await draining;
      assert.equal(result.length, 1);
      assert.equal(result[0].ok, false);
      assert.equal(result[0].leaseLost, true);
      assert.match(result[0].error, /lease ownership lost/);
      const row = db.prepare("SELECT status,claim_token FROM business_builder_commerce_outbox WHERE id='ob1'").get();
      assert.equal(row.status, "pending");
      assert.equal(row.claim_token, "new-owner");
    });
  } finally {
    db.close();
  }
});
