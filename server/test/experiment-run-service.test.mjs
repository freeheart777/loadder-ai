import assert from "node:assert/strict";
import test from "node:test";

import { createExperimentRunService } from "../app/services/experiment-run-service.mjs";
import { requireWorkspaceId, runWithWorkspace } from "../app/tenant-context.mjs";

function fixture() {
  let sequence = 0;
  const runs = new Map();
  const experiment = { id: "exp-1", workspace_id: "ws-1", context_version_id: "ctx-1", status: "READY" };
  return {
    repository: {
      getExperiment(id) { return id === experiment.id && requireWorkspaceId() === experiment.workspace_id ? experiment : null; },
      create({ experimentId, contextVersionId, now }) {
        const run = { id: `run-${++sequence}`, workspaceId: "ws-1", experimentId, contextVersionId, runNumber: sequence, status: "PLANNED", startedAt: null, completedAt: null, outcome: null, createdAt: now, updatedAt: now };
        runs.set(run.id, run); return run;
      },
      get(id) { const run = runs.get(id); return run?.workspaceId === requireWorkspaceId() ? run : null; },
      transition(id, input) {
        const run = runs.get(id);
        if (!run || run.workspaceId !== requireWorkspaceId() || run.contextVersionId !== input.contextVersionId || run.status !== input.from) return null;
        run.status = input.to;
        if (input.to === "RUNNING") run.startedAt ||= input.now;
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(input.to)) { run.completedAt ||= input.now; if (input.outcome !== undefined) run.outcome = input.outcome; }
        run.updatedAt = input.now;
        return run;
      },
      list() { return { items: [], nextCursor: null }; },
    },
  };
}

test("experiment run lifecycle is state-safe, context-pinned, and tenant-scoped", async () => {
  const f = fixture();
  const service = createExperimentRunService({ repository: f.repository, now: () => new Date("2026-08-26T20:00:00.000Z") });
  await runWithWorkspace("ws-1", async () => {
    const run = service.create({ experimentId: "exp-1", contextVersionId: "ctx-1" });
    assert.equal(run.status, "PLANNED");
    assert.equal(service.start(run.id, { contextVersionId: "ctx-1" }).status, "RUNNING");
    assert.throws(() => service.start(run.id, { contextVersionId: "ctx-1" }), /Invalid experiment run transition/);
    assert.throws(() => service.complete(run.id, { contextVersionId: "ctx-other", outcome: { metric: 1 } }), (e) => e.code === "EXPERIMENT_CONTEXT_MISMATCH");
    assert.equal(service.complete(run.id, { contextVersionId: "ctx-1", outcome: { metric: 1 } }).status, "COMPLETED");
    assert.throws(() => service.fail(run.id, { contextVersionId: "ctx-1", outcome: { reason: "late" } }), (e) => e.code === "EXPERIMENT_RUN_TERMINAL");
  });

  await runWithWorkspace("ws-2", async () => {
    assert.throws(() => service.get("run-1"), (e) => e.code === "EXPERIMENT_RUN_NOT_FOUND");
    assert.throws(() => service.create({ experimentId: "exp-1", contextVersionId: "ctx-1" }), (e) => e.code === "EXPERIMENT_NOT_FOUND");
  });
});

test("experiment run rejects invalid terminal outcomes", async () => {
  const f = fixture();
  const service = createExperimentRunService({
    repository: f.repository,
    now: () => new Date("2026-08-26T20:00:00.000Z"),
  });

  await runWithWorkspace("ws-1", async () => {
    const run = service.create({
      experimentId: "exp-1",
      contextVersionId: "ctx-1",
    });

    service.start(run.id, { contextVersionId: "ctx-1" });

    assert.throws(
      () => service.complete(run.id, {
        contextVersionId: "ctx-1",
        outcome: null,
      }),
      (e) => e.code === "EXPERIMENT_RUN_ERROR",
    );

    assert.throws(
      () => service.complete(run.id, {
        contextVersionId: "ctx-1",
        outcome: [],
      }),
      (e) => e.code === "EXPERIMENT_RUN_ERROR",
    );

    assert.throws(
      () => service.complete(run.id, {
        contextVersionId: "ctx-1",
        outcome: "completed",
      }),
      (e) => e.code === "EXPERIMENT_RUN_ERROR",
    );
  });
});

test("experiment run rejects oversized outcomes", async () => {
  const f = fixture();
  const service = createExperimentRunService({
    repository: f.repository,
    now: () => new Date("2026-08-26T20:00:00.000Z"),
  });

  await runWithWorkspace("ws-1", async () => {
    const run = service.create({
      experimentId: "exp-1",
      contextVersionId: "ctx-1",
    });

    service.start(run.id, { contextVersionId: "ctx-1" });

    const oversized = {
      payload: "x".repeat(32769),
    };

    assert.throws(
      () => service.complete(run.id, {
        contextVersionId: "ctx-1",
        outcome: oversized,
      }),
      (e) => e.code === "EXPERIMENT_OUTCOME_TOO_LARGE" && e.status === 413,
    );
  });
});

test("experiment run requires pinned context for every lifecycle mutation", async () => {
  const f = fixture();
  const service = createExperimentRunService({
    repository: f.repository,
    now: () => new Date("2026-08-26T20:00:00.000Z"),
  });

  await runWithWorkspace("ws-1", async () => {
    const run = service.create({
      experimentId: "exp-1",
      contextVersionId: "ctx-1",
    });

    assert.throws(
      () => service.start(run.id, {}),
      (e) => e.code === "EXPERIMENT_CONTEXT_MISMATCH",
    );

    assert.equal(
      service.start(run.id, {
        contextVersionId: "ctx-1",
      }).status,
      "RUNNING",
    );

    assert.throws(
      () => service.complete(run.id, {}),
      (e) => e.code === "EXPERIMENT_CONTEXT_MISMATCH",
    );
  });
});

test("experiment run rejects invalid creation context", async () => {
  const f = fixture();

  const service = createExperimentRunService({
    repository: f.repository,
    now: () => new Date("2026-08-26T20:00:00.000Z"),
  });

  await runWithWorkspace("ws-1", async () => {
    assert.throws(
      () => service.create({
        experimentId: "exp-1",
        contextVersionId: "ctx-other",
      }),
      (e) => e.code === "EXPERIMENT_CONTEXT_MISMATCH",
    );
  });
});
