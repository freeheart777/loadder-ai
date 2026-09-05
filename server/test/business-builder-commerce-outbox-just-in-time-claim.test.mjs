import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createCommerceRuntimeBridge } from "../app/business-builder/commerce-runtime-bridge.mjs";

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
  const insert = db.prepare(`
    INSERT INTO business_builder_commerce_outbox(
      id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const [index, id] of ["evt-1", "evt-2"].entries()) {
    const event = { id, type: "commerce.order.created", workspaceId: "w1", projectId: "p1", orderId: `o${index + 1}` };
    insert.run(`ob${index + 1}`,"w1","s1","p1",event.id,event.type,event.orderId,JSON.stringify(event),"pending",0,"2000-01-01T00:00:00.000Z",`2000-01-01T00:00:0${index}.000Z`);
  }
  return db;
}

test("drain claims the next event only when its processing is ready to start", async () => {
  const db = setup();
  let firstStarted;
  let releaseFirst;
  const firstStartedGate = new Promise((resolve) => { firstStarted = resolve; });
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const processed = [];
  const eventProcessor = {
    async process(event) {
      processed.push(event.id);
      if (event.id === "evt-1") {
        firstStarted();
        await firstGate;
      }
      return { ok: true };
    },
  };

  try {
    await runWithWorkspace("w1", async () => {
      const bridge = createCommerceRuntimeBridge({ db, projects: {}, eventProcessor, leaseMs: 1000, leaseHeartbeatMs: 50 });
      const draining = bridge.drain({ limit: 2 });
      await firstStartedGate;

      const rowsWhileFirstRuns = db.prepare("SELECT id,status,claim_token FROM business_builder_commerce_outbox ORDER BY created_at").all();
      assert.ok(rowsWhileFirstRuns[0].claim_token);
      assert.equal(rowsWhileFirstRuns[1].status, "pending");
      assert.equal(rowsWhileFirstRuns[1].claim_token, null);
      assert.deepEqual(processed, ["evt-1"]);

      releaseFirst();
      const results = await draining;
      assert.equal(results.length, 2);
      assert.deepEqual(processed, ["evt-1", "evt-2"]);
      assert.ok(results.every((row) => row.ok === true));
      const finalRows = db.prepare("SELECT status,claim_token FROM business_builder_commerce_outbox ORDER BY created_at").all();
      assert.deepEqual(finalRows, [
        { status: "delivered", claim_token: null },
        { status: "delivered", claim_token: null },
      ]);
    });
  } finally {
    db.close();
  }
});

test("drain still respects the requested bounded batch limit", async () => {
  const db = setup();
  const processed = [];
  const eventProcessor = { async process(event) { processed.push(event.id); return { ok: true }; } };
  try {
    await runWithWorkspace("w1", async () => {
      const bridge = createCommerceRuntimeBridge({ db, projects: {}, eventProcessor });
      const results = await bridge.drain({ limit: 1 });
      assert.equal(results.length, 1);
      assert.deepEqual(processed, ["evt-1"]);
      const remaining = db.prepare("SELECT status,claim_token FROM business_builder_commerce_outbox WHERE id='ob2'").get();
      assert.deepEqual(remaining, { status: "pending", claim_token: null });
    });
  } finally {
    db.close();
  }
});
