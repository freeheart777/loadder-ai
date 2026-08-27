import test from "node:test";
import assert from "node:assert/strict";
import { createExperimentRunWorker } from "../app/experiments/worker/experiment-run-worker.mjs";

test("worker does not execute an unclaimed run", async () => {
  let executions = 0;
  const worker = createExperimentRunWorker({
    runService: { claim: () => null },
    executor: async () => { executions += 1; return { ok: true }; },
  });

  const result = await worker.process({ runId: "run-1", plan: {}, leaseToken: "lease-1" });
  assert.equal(result.status, "NOT_CLAIMED");
  assert.equal(executions, 0);
});

test("worker executes only after a successful claim and completes the run", async () => {
  const calls = [];
  const run = { id: "run-1", contextVersionId: "ctx-1", status: "RUNNING" };
  const completed = { ...run, status: "COMPLETED" };
  const worker = createExperimentRunWorker({
    runService: {
      claim: (id, options) => { calls.push(["claim", id, options]); return run; },
      complete: (id, options) => { calls.push(["complete", id, options]); return completed; },
      fail: () => { throw new Error("unexpected fail"); },
    },
    executor: async ({ run: claimedRun }) => { assert.equal(claimedRun.id, "run-1"); return { ok: true }; },
  });

  const result = await worker.process({ runId: "run-1", plan: { experimentId: "exp-1" }, leaseToken: "lease-1" });
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(calls.map(([name]) => name), ["claim", "complete"]);
});

test("worker fails a claimed run after executor crash", async () => {
  let failed;
  const worker = createExperimentRunWorker({
    runService: {
      claim: () => ({ id: "run-1", contextVersionId: "ctx-1", status: "RUNNING" }),
      complete: () => { throw new Error("unexpected complete"); },
      fail: (id, options) => { failed = { id, options }; return { id, status: "FAILED" }; },
    },
    executor: async () => { throw new Error("provider timeout"); },
  });

  const result = await worker.process({ runId: "run-1", plan: {}, leaseToken: "lease-1" });
  assert.equal(result.status, "FAILED");
  assert.equal(failed.id, "run-1");
  assert.equal(failed.options.outcome.executionError.message, "provider timeout");
});
