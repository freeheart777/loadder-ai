import assert from "node:assert/strict";
import test from "node:test";
import { createExperimentExecutionService } from "../app/experiments/experiment-execution-service.mjs";
import { createOpenAICompatibleProvider } from "../app/experiments/providers/openai-compatible-provider.mjs";

function fixture() {
  const calls = [];
  const experiment = {
    id: "exp-1", workspaceId: "ws-1", contextVersionId: "ctx-1",
    objective: "Improve conversion", successMetric: "conversion_rate",
    treatmentDefinition: "Treatment A", baselineValue: 0.12, hypothesis: "A improves conversion",
  };
  const runs = new Map();
  const experimentRepository = { get: (id) => id === experiment.id ? experiment : null };
  const runService = {
    create({ experimentId, contextVersionId }) { const run = { id: "run-1", experimentId, contextVersionId, status: "PLANNED" }; runs.set(run.id, run); calls.push(["create", run]); return run; },
    start(id) { const run = { ...runs.get(id), status: "RUNNING" }; runs.set(id, run); calls.push(["start", run]); return run; },
    complete(id, { outcome }) { const run = { ...runs.get(id), status: "COMPLETED", outcome }; runs.set(id, run); calls.push(["complete", run]); return run; },
    fail(id, { outcome }) { const run = { ...runs.get(id), status: "FAILED", outcome }; runs.set(id, run); calls.push(["fail", run]); return run; },
  };
  return { experimentRepository, runService, calls };
}

test("execution service runs the OpenAI-compatible provider and persists normalized outcome", async () => {
  const f = fixture();
  const executor = createOpenAICompatibleProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://provider.test/v1",
    fetchImpl: async () => new Response(JSON.stringify({ id: "resp-1", model: "test-model", choices: [{ message: { content: "generated result" } }], usage: { total_tokens: 9 } }), { status: 200 }),
  });
  const service = createExperimentExecutionService({ ...f, executor });
  const result = await service.execute("exp-1", { input: { prompt: "Run treatment analysis" } });

  assert.equal(result.run.status, "COMPLETED");
  assert.deepEqual(result.outcome.result, { provider: "openai-compatible", model: "test-model", responseId: "resp-1", content: "generated result", usage: { total_tokens: 9 } });
  assert.deepEqual(f.calls.map(([name]) => name), ["create", "start", "complete"]);
});
