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
      dead_lettered_at TEXT
    );
  `);
  return db;
}

function insert(db, { id, workspaceId, status = "pending", availableAt = "2000-01-01T00:00:00.000Z", deadLetteredAt = null }) {
  db.prepare(`
    INSERT INTO business_builder_commerce_outbox(id, workspace_id, status, available_at, dead_lettered_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, workspaceId, status, availableAt, deadLetteredAt);
}

test("worker discovers only eligible workspaces and drains inside tenant context", async () => {
  const db = createDb();
  insert(db, { id: "a", workspaceId: "workspace-a" });
  insert(db, { id: "b", workspaceId: "workspace-a" });
  insert(db, { id: "c", workspaceId: "workspace-b", deadLetteredAt: "2026-09-05T00:00:00.000Z" });
  insert(db, { id: "d", workspaceId: "workspace-c", availableAt: "2999-01-01T00:00:00.000Z" });
  insert(db, { id: "e", workspaceId: "workspace-d", status: "delivered" });

  const seen = [];
  const runtimeBridge = {
    async drain({ limit }) {
      seen.push({ workspaceId: requireWorkspaceId(), limit });
      return [{ ok: true }];
    },
  };
  const worker = createCommerceOutboxWorker({ db, runtimeBridge, batchSize: 17, logger: null });

  assert.deepEqual(worker.discoverWorkspaceIds(), ["workspace-a"]);
  const result = await worker.tick();

  assert.deepEqual(seen, [{ workspaceId: "workspace-a", limit: 17 }]);
  assert.equal(result.workspaceCount, 1);
  assert.equal(result.processed, 1);
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

test("worker stays idle until the dead-letter schema is available", async () => {
  const db = new Database(":memory:");
  const runtimeBridge = { drain: async () => { throw new Error("must not drain"); } };
  const worker = createCommerceOutboxWorker({ db, runtimeBridge, logger: null });

  assert.deepEqual(worker.discoverWorkspaceIds(), []);
  const result = await worker.tick();
  assert.deepEqual(result, { workspaceCount: 0, processed: 0, failed: 0, workspaces: [] });
  db.close();
});
