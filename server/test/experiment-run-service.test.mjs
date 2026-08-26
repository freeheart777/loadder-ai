import test from "node:test";
import assert from "node:assert/strict";
import { createExperimentRunService, ExperimentRunError } from "../app/services/experiment-run-service.mjs";

test("experiment run lifecycle is deterministic and context-pinned", async (t) => {
  let sequence = 0;
  const runs = new Map();
  const repository = {
    getExperiment: (id) => id === "exp-1" ? { id, context_version_id: "ctx-1" } : null,
    get: (id) => runs.get(id) || null,
    create: ({ experimentId, contextVersionId, now }) => {
      const run = { id: `run-${++sequence}`, workspaceId: "w1", experimentId, contextVersionId, runNumber: sequence, status: "PLANNED", startedAt: null, completedAt: null, outcome: null, createdAt: now, updatedAt: now };
      runs.set(run.id, run);
      return run;
    },
    updateStatus: ({ id, status, startedAt, completedAt, outcome, now }) => {
      const run = runs.get(id);
      if (!run) return null;
      Object.assign(run, { status, startedAt: startedAt ?? run.startedAt, completedAt: completedAt ?? run.completedAt, outcome: outcome === undefined ? run.outcome : outcome, updatedAt: now });
      return run;
    },
    list: () => ({ items: [...runs.values()], nextCursor: null }),
  };
  const service = createExperimentRunService({ repository, now: () => `2026-08-26T19:00:0${sequence}.000Z` });

  await t.test("requires an exact experiment context", () => {
    assert.throws(() => service.create({ experimentId: "exp-1", contextVersionId: "ctx-old" }), (e) => e.code === "EXPERIMENT_RUN_CONTEXT_MISMATCH");
    assert.throws(() => service.create({ experimentId: "missing", contextVersionId: "ctx-1" }), (e) => e.code === "EXPERIMENT_NOT_FOUND");
  });

  await t.test("creates planned run and starts it", () => {
    const run = service.create({ experimentId: "exp-1", contextVersionId: "ctx-1" });
    assert.equal(run.status, "PLANNED");
    const started = service.start(run.id, { contextVersionId: "ctx-1" });
    assert.equal(started.status, "RUNNING");
    assert.ok(started.startedAt);
  });

  await t.test("completed, failed and cancelled are terminal", () => {
    const completed = service.complete("run-1", { contextVersionId: "ctx-1", outcome: { metric: 0.42 } });
    assert.equal(completed.status, "COMPLETED");
    assert.deepEqual(completed.outcome, { metric: 0.42 });
    assert.ok(completed.completedAt);
    assert.throws(() => service.start("run-1"), (e) => e.code === "EXPERIMENT_RUN_INVALID_TRANSITION");

    const failed = service.create({ experimentId: "exp-1", contextVersionId: "ctx-1" });
    service.start(failed.id);
    assert.equal(service.fail(failed.id, { outcome: { reason: "guardrail" } }).status, "FAILED");

    const cancelled = service.create({ experimentId: "exp-1", contextVersionId: "ctx-1" });
    assert.equal(service.cancel(cancelled.id).status, "CANCELLED");
  });

  await t.test("rejects context drift and unknown runs", () => {
    assert.throws(() => service.start("run-2", { contextVersionId: "ctx-other" }), (e) => e.code === "EXPERIMENT_RUN_CONTEXT_MISMATCH");
    assert.throws(() => service.get("missing"), (e) => e instanceof ExperimentRunError && e.status === 404);
  });
});
