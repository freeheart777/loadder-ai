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

test("execution fails after bounded retries", async () => {
  const store = memoryStore(); let calls = 0;
  const provider = { async execute() { calls += 1; throw new Error("down"); } };
  await assert.rejects(() => createDurableExecution({ store, provider, maxAttempts: 2 }).run({ executionId: "e3" }), (error) => error instanceof DurableExecutionError && error.code === "EXECUTION_FAILED");
  assert.equal(calls, 2); assert.equal(store.map.get("e3").status, "failed");
});
