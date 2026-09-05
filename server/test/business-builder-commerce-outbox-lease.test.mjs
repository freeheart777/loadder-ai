import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { CommerceOutboxStore } from "../app/business-builder/commerce-runtime-bridge.mjs";

function open(path) {
  const db = new Database(path);
  db.pragma("journal_mode=WAL");
  db.pragma("busy_timeout=2000");
  return db;
}

test("claim lease excludes another worker, supports renewal and expiry reclaim, and rejects stale ownership", async () => {
  const dir = await mkdtemp(join(tmpdir(), "commerce-outbox-lease-"));
  const path = join(dir, "outbox.sqlite");
  const dbA = open(path);
  dbA.exec(`
    CREATE TABLE business_builder_commerce_outbox(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_error TEXT,
      delivered_at TEXT,
      dead_lettered_at TEXT,
      dead_letter_reason TEXT,
      claim_token TEXT,
      claimed_at TEXT,
      claim_expires_at TEXT
    );
  `);
  dbA.prepare(`INSERT INTO business_builder_commerce_outbox(id,workspace_id,status,available_at,created_at) VALUES(?,?,?,?,?)`).run(
    "event-1", "w1", "pending", "2000-01-01T00:00:00.000Z", "2000-01-01T00:00:00.000Z"
  );
  const dbB = open(path);

  try {
    await runWithWorkspace("w1", async () => {
      const workerA = new CommerceOutboxStore(dbA, { leaseMs: 60_000 });
      const workerB = new CommerceOutboxStore(dbB, { leaseMs: 60_000 });

      const first = workerA.claim(1);
      assert.equal(first.length, 1);
      assert.ok(first[0].claim_token);
      assert.equal(workerA.ownsClaim("event-1", first[0].claim_token), true);
      assert.equal(workerB.claim(1).length, 0);

      dbA.prepare("UPDATE business_builder_commerce_outbox SET claim_expires_at=? WHERE id=?").run("2000-01-01T00:00:00.000Z", "event-1");
      assert.equal(workerA.renewClaim("event-1", first[0].claim_token), true);
      const renewed = workerA.get("event-1");
      assert.ok(new Date(renewed.claim_expires_at).getTime() > Date.now());
      assert.equal(workerB.claim(1).length, 0);

      dbA.prepare("UPDATE business_builder_commerce_outbox SET claim_expires_at=? WHERE id=?").run("2000-01-01T00:00:00.000Z", "event-1");
      const reclaimed = workerB.claim(1);
      assert.equal(reclaimed.length, 1);
      assert.notEqual(reclaimed[0].claim_token, first[0].claim_token);
      assert.equal(workerA.ownsClaim("event-1", first[0].claim_token), false);
      assert.equal(workerA.renewClaim("event-1", first[0].claim_token), false);
      assert.equal(workerB.ownsClaim("event-1", reclaimed[0].claim_token), true);

      workerA.delivered("event-1", first[0].claim_token);
      assert.equal(workerA.get("event-1").status, "pending");

      workerB.delivered("event-1", reclaimed[0].claim_token);
      const delivered = workerB.get("event-1");
      assert.equal(delivered.status, "delivered");
      assert.equal(delivered.claim_token, null);
      assert.equal(delivered.claim_expires_at, null);
      assert.equal(workerB.ownsClaim("event-1", reclaimed[0].claim_token), false);
    });
  } finally {
    dbB.close();
    dbA.close();
    await rm(dir, { recursive: true, force: true });
  }
});
