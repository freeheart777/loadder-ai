import assert from "node:assert/strict";
import test from "node:test";
import { createOpenAICompatibleProvider, ExperimentProviderError } from "../app/experiments/providers/openai-compatible-provider.mjs";
import { createExperimentProvider } from "../app/providers/experiment-provider.mjs";

const plan = { objective: "Improve conversion", successMetric: "conversion_rate", treatmentDefinition: "Treatment A" };

test("provider sends OpenAI-compatible request and normalizes response", async () => {
  let request;
  const provider = createOpenAICompatibleProvider({ apiKey: "test-key", model: "test-model", baseUrl: "https://example.test/v1", fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: "resp-1", model: "test-model", choices: [{ message: { content: "hello" } }], usage: { total_tokens: 3 } }) };
  } });
  const result = await provider({ plan, input: { prompt: "Say hello" } });
  assert.equal(request.url, "https://example.test/v1/chat/completions");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  assert.deepEqual(result, { provider: "openai-compatible", model: "test-model", responseId: "resp-1", content: "hello", usage: { total_tokens: 3 } });
});

test("provider surfaces upstream errors", async () => {
  const provider = createOpenAICompatibleProvider({ apiKey: "key", model: "model", fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "rate limited" } }) }) });
  await assert.rejects(() => provider({ plan, input: { prompt: "hello" } }), (error) => error instanceof ExperimentProviderError && error.status === 429 && error.code === "EXPERIMENT_PROVIDER_REQUEST_ERROR");
});

test("provider rejects missing prompt before network call", async () => {
  let called = false;
  const provider = createOpenAICompatibleProvider({ apiKey: "key", model: "model", fetchImpl: async () => { called = true; } });
  await assert.rejects(() => provider({ plan, input: {} }), (error) => error.code === "EXPERIMENT_PROVIDER_INPUT_ERROR");
  assert.equal(called, false);
});

test("execution provider wraps a concrete executor", async () => {
  const provider = createExperimentProvider({ execute: async ({ input }) => ({ output: input }) });
  assert.deepEqual(await provider.execute({ runId: "run-1", input: "hello" }), {
    status: "completed", provider: "experiment", providerVersion: "1.0", result: { output: "hello" },
  });
});
