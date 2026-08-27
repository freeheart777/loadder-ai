import assert from "node:assert/strict";
import test from "node:test";

import { createExperimentExecutionService } from "../app/experiments/experiment-execution-service.mjs";

function fixture() {
  const experiment = {
    id: "exp-1",
    workspaceId: "ws-1",
    contextVersionId: "ctx-1",
    hypothesis: "The treatment improves the target metric.",
    objective: "Improve conversion",
    successMetric: "conversion_rate",
    baselineValue: 0.12,
    treatmentDefinition: "Treatment A",
  };
  const calls = [];
  let runNumber = 0;
  const runs = new Map();
  const byKey = new Map();
  const experimentRepository = { get: (id) => id === experiment.id ? experiment : null };
  const runService = {
    getByIdempotencyKey(key) { return byKey.get(key) ?? null; },
    create(input) { calls.push(["create", input]); const run = { id: `run-${++runNumber}`, status: "PLANNED", experimentId: input.experimentId, contextVersionId: input.contextVersionId, outcome: null }; runs.set(run.id, run); if (input.idempotencyKey) byKey.set(input.idempotencyKey, run); return run; },
    start(id, input) { calls.push(["start", id, input]); const run = runs.get(id); run.status = "RUNNING"; return run; },
    complete(id, input) { calls.push(["complete", id, input]); const run = runs.get(id); run.status = "COMPLETED"; run.outcome = input.outcome; return run; },
    fail(id, input) { calls.push(["fail", id, input]); const run = runs.get(id); run.status = "FAILED"; run.outcome = input.outcome; return run; },
  };
  return { experiment, experimentRepository, runService, calls };
}

test("execution planning pins context and does not execute providers", () => {
  const f = fixture();
  const hypothesisEngine = { fromExperiment: (experiment) => ({ statement: experiment.hypothesis, sourceExperimentId: experiment.id }) };
  const service = createExperimentExecutionService({ experimentRepository: f.experimentRepository, runService: f.runService, hypothesisEngine, guardrails: ["safe"] });
  const plan = service.plan("exp-1");
  assert.equal(plan.contextVersionId, "ctx-1");
  assert.equal(plan.executionMode, "MANUAL_RESULT_SUBMISSION");
  assert.deepEqual(plan.hypothesis, { statement: f.experiment.hypothesis, sourceExperimentId: "exp-1" });
  assert.deepEqual(f.calls, []);
});

test("start creates and starts a run against the pinned context", () => {
  const f = fixture();
  const service = createExperimentExecutionService({ experimentRepository: f.experimentRepository, runService: f.runService, guardrails: [] });
  const result = service.start("exp-1");
  assert.equal(result.run.status, "RUNNING");
  assert.deepEqual(f.calls.map((call) => call[0]), ["create", "start"]);
  assert.deepEqual(f.calls[0][1], { experimentId: "exp-1", contextVersionId: "ctx-1" });
});

test("idempotency key returns the existing run without executing twice", async () => {
  const f = fixture();
  let executions = 0;
  const service = createExperimentExecutionService({
    experimentRepository: f.experimentRepository,
    runService: f.runService,
    executor: async () => { executions += 1; return { safe: true, metric: 0.2 }; },
  });
  const first = await service.execute("exp-1", { idempotencyKey: "checkout-42", input: { prompt: "run" } });
  const second = await service.execute("exp-1", { idempotencyKey: "checkout-42", input: { prompt: "run" } });
  assert.equal(first.run.id, second.run.id);
  assert.equal(executions, 1);
  assert.deepEqual(f.calls.map((call) => call[0]), ["create", "start", "complete"]);
});

test("idempotency key cannot be reused for another experiment context", () => {
  const f = fixture();
  const existing = { id: "run-existing", status: "COMPLETED", experimentId: "other", contextVersionId: "ctx-other", outcome: {} };
  f.runService.getByIdempotencyKey = () => existing;
  const service = createExperimentExecutionService({ experimentRepository: f.experimentRepository, runService: f.runService, executor: async () => ({ safe: true }) });
  assert.rejects(() => service.execute("exp-1", { idempotencyKey: "shared-key" }), (error) => error.code === "EXPERIMENT_IDEMPOTENCY_CONFLICT");
});

test("result recording completes only when guardrails pass and fails otherwise", () => {
  const f = fixture();
  const service = createExperimentExecutionService({ experimentRepository: f.experimentRepository, runService: f.runService, guardrails: ["safe"] });
  const good = service.start("exp-1");
  const completed = service.recordResult(good.run.id, { contextVersionId: "ctx-1", result: { safe: true, metric: 0.2 } });
  assert.equal(completed.run.status, "COMPLETED");
  assert.equal(completed.outcome.guardrailsPassed, true);
  const bad = service.start("exp-1");
  const failed = service.recordResult(bad.run.id, { contextVersionId: "ctx-1", result: { safe: false, metric: 0.05 } });
  assert.equal(failed.run.status, "FAILED");
  assert.equal(failed.outcome.guardrailsPassed, false);
});

test("automatic execution invokes the executor with the pinned plan and records its result", async () => {
  const f = fixture();
  const executorCalls = [];
  const service = createExperimentExecutionService({
    experimentRepository: f.experimentRepository,
    runService: f.runService,
    guardrails: ["safe"],
    executor: async ({ plan, run, input }) => { executorCalls.push({ plan, runId: run.id, input }); return { safe: true, metric: input.metric }; },
  });
  const result = await service.execute("exp-1", { input: { metric: 0.21 } });
  assert.equal(result.run.status, "COMPLETED");
  assert.equal(result.outcome.result.metric, 0.21);
  assert.equal(result.outcome.guardrailsPassed, true);
  assert.equal(executorCalls[0].plan.contextVersionId, "ctx-1");
  assert.deepEqual(executorCalls[0].input, { metric: 0.21 });
  assert.deepEqual(f.calls.map((call) => call[0]), ["create", "start", "complete"]);
});

test("automatic execution fails the run when the executor throws", async () => {
  const f = fixture();
  const service = createExperimentExecutionService({ experimentRepository: f.experimentRepository, runService: f.runService, executor: async () => { throw new Error("provider unavailable"); } });
  const result = await service.execute("exp-1");
  assert.equal(result.run.status, "FAILED");
  assert.deepEqual(result.outcome.executionError, { name: "Error", message: "provider unavailable" });
  assert.deepEqual(f.calls.map((call) => call[0]), ["create", "start", "fail"]);
});

test("automatic execution requires an executor", async () => {
  const f = fixture();
  const service = createExperimentExecutionService({ experimentRepository: f.experimentRepository, runService: f.runService });
  await assert.rejects(() => service.execute("exp-1"), (error) => error.code === "EXPERIMENT_EXECUTOR_NOT_CONFIGURED");
  assert.deepEqual(f.calls, []);
});

test("missing experiments and non-object results are rejected", () => {
  const f = fixture();
  const service = createExperimentExecutionService({ experimentRepository: f.experimentRepository, runService: f.runService });
  assert.throws(() => service.plan("missing"), (error) => error.code === "EXPERIMENT_NOT_FOUND");
  const started = service.start("exp-1");
  assert.throws(() => service.recordResult(started.run.id, { contextVersionId: "ctx-1", result: [] }), /result must be a JSON object/);
});
