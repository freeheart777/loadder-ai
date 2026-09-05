import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { requireWorkspaceId } from "../app/tenant-context.mjs";
import { createCommerceOutboxWorker } from "../app/business-builder/commerce-outbox-worker.mjs";

function createDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE business_builder_commerce_outbox (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      status TEXT NOT NULL,
      available_at TEXT NOT NULL,
      dead_lettered_at TEXT,
      claim_expires_at TEXT
    );
  `);
  return db;
}

function insert(db, { id, workspaceId, status = "pending", availableAt = "2000-01-01T00:00:00.000Z", deadLetteredAt = null, claimExpiresAt = null }) {
  db.prepare(`
    INSERT INTO business_builder_commerce_outbox(id, workspace_id, status, available_at, dead_lettered_at, claim_expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, workspaceId, status, availableAt, deadLetteredAt, claimExpiresAt);
}

test("worker discovers only eligible unclaimed workspaces and drains inside tenant context", async () => {
  const db = createDb();
  insert(db, { id: "a", workspaceId: "workspace-a" });
  insert(db, { id: "b", workspaceId: "workspace-a" });
  insert(db, { id: "c", workspaceId: "workspace-b", deadLetteredAt: "2026-09-05T00:00:00.000Z" });
  insert(db, { id: "d", workspaceId: "workspace-c", availableAt: "2999-01-01T00:00:00.000Z" });
  insert(db, { id: "e", workspaceId: "workspace-d", status: "delivered" });
  insert(db, { id: "f", workspaceId: "workspace-e", claimExpiresAt: "2999-01-01T00:00:00.000Z" });
  insert(db, { id: "g", workspaceId: "workspace-f", claimExpiresAt: "2000-01-01T00:00:00.000Z" });

  const seen = [];
  const runtimeBridge = {
    async drain({ limit }) {
      seen.push({ workspaceId: requireWorkspaceId(), limit });
      return [{ ok: true }];
    },
  };
  const worker = createCommerceOutboxWorker({ db, runtimeBridge, batchSize: 17, logger: null });

  assert.deepEqual(worker.discoverWorkspaceIds(), ["workspace-a", "workspace-f"]);
  const result = await worker.tick();

  assert.deepEqual(seen, [
    { workspaceId: "workspace-a", limit: 17 },
    { workspaceId: "workspace-f", limit: 17 },
  ]);
  assert.equal(result.workspaceCount, 2);
  assert.equal(result.processed, 2);
  assert.equal(result.failed, 0);
  db.close();
});

test("worker coalesces overlapping ticks into one drain pass", async () => {
  const db = createDb();
  insert(db, { id: "a", workspaceId: "workspace-a" });

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let drains = 0;
  const runtimeBridge = {
    async drain() {
      drains += 1;
      await gate;
      return [{ ok: true }];
    },
  };
  const worker = createCommerceOutboxWorker({ db, runtimeBridge, logger: null });

  const first = worker.tick();
  const second = worker.tick();
  assert.equal(first, second);
  assert.equal(drains, 1);

  release();
  await first;
  assert.equal(drains, 1);
  db.close();
});

test("worker stays idle until the claim-lease schema is available", async () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE business_builder_commerce_outbox(id TEXT PRIMARY KEY, workspace_id TEXT, status TEXT, available_at TEXT, dead_lettered_at TEXT);`);
  const runtimeBridge = { drain: async () => { throw new Error("must not drain"); } };
  const worker = createCommerceOutboxWorker({ db, runtimeBridge, logger: null });

  assert.deepEqual(worker.discoverWorkspaceIds(), []);
  const result = await worker.tick();
  assert.deepEqual(result, { workspaceCount: 0, processed: 0, failed: 0, workspaces: [] });
  db.close();
});
