import assert from "node:assert/strict";
import test from "node:test";
import { createDurableExecution, DurableExecutionError } from "../app/execution/durable-execution.mjs";

function memoryStore() { const map = new Map(); return { async get(id) { return map.get(id); }, async save(value) { map.set(value.executionId, value); }, map }; }

test("durable execution retries and persists completion", async () => {
  const store = memoryStore(); let calls = 0;
  const provider = { async execute() { calls += 1; if (calls < 2) throw Object.assign(new Error("temporary"), { code: "TEMP" }); return { ok: true }; } };
  const result = await createDurableExecution({ store, provider }).run({ executionId: "e1" });
  assert.equal(calls, 2); assert.equal(result.status, "completed"); assert.deepEqual(store.map.get("e1"), result);
});

test("completed executions are idempotent", async () => {
  const store = memoryStore(); let calls = 0;
  const provider = { async execute() { calls += 1; return { ok: true }; } };
  const runner = createDurableExecution({ store, provider });
  await runner.run({ executionId: "e2" }); await runner.run({ executionId: "e2" });
  assert.equal(calls, 1);
});

test("retryable persisted executions resume from their attempt", async () => {
  const store = memoryStore(); let calls = 0;
  await store.save({ executionId: "e-resume", status: "retryable", attempt: 1 });
  const provider = { async execute() { calls += 1; return { ok: true }; } };
  const result = await createDurableExecution({ store, provider, maxAttempts: 3 }).run({ executionId: "e-resume" });
  assert.equal(calls, 1); assert.equal(result.attempt, 2); assert.equal(result.status, "completed");
});

test("invalid maxAttempts is rejected", () => {
  assert.throws(() => createDurableExecution({ store: memoryStore(), provider: { execute: async () => null }, maxAttempts: 0 }), TypeError);
});

test("execution fails after bounded retries", async () => {
  const store = memoryStore(); let calls = 0;
  const provider = { async execute() { calls += 1; throw new Error("down"); } };
  await assert.rejects(() => createDurableExecution({ store, provider, maxAttempts: 2 }).run({ executionId: "e3" }), (error) => error instanceof DurableExecutionError && error.code === "EXECUTION_FAILED");
  assert.equal(calls, 2); assert.equal(store.map.get("e3").status, "failed");
});
