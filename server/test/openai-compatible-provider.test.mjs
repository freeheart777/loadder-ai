import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAICompatibleProvider } from "../app/experiments/providers/openai-compatible-provider.mjs";

test("OpenAI-compatible provider executes against chat completions", async () => {
  let request;
  const provider = createOpenAICompatibleProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://provider.test/v1",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        id: "resp-1",
        model: "test-model",
        choices: [{ message: { content: "result" } }],
        usage: { total_tokens: 7 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await provider({
    plan: { objective: "test objective", successMetric: "accuracy", treatmentDefinition: "treatment A" },
    input: { prompt: "run experiment" },
  });

  assert.equal(request.url, "https://provider.test/v1/chat/completions");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  assert.equal(JSON.parse(request.options.body).model, "test-model");
  assert.equal(result.content, "result");
  assert.equal(result.responseId, "resp-1");
});

test("OpenAI-compatible provider surfaces provider failures", async () => {
  const provider = createOpenAICompatibleProvider({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 }),
  });

  await assert.rejects(
    () => provider({ plan: { objective: "o", successMetric: "m", treatmentDefinition: "t" }, input: { prompt: "p" } }),
    (error) => error.code === "EXPERIMENT_PROVIDER_REQUEST_ERROR" && error.status === 429 && error.message === "rate limited",
  );
});

test("OpenAI-compatible provider requires a prompt", async () => {
  const provider = createOpenAICompatibleProvider({ apiKey: "test-key", model: "test-model", fetchImpl: async () => { throw new Error("should not call"); } });
  await assert.rejects(
    () => provider({ plan: { objective: "o", successMetric: "m", treatmentDefinition: "t" }, input: {} }),
    (error) => error.code === "EXPERIMENT_PROVIDER_INPUT_ERROR" && error.status === 400,
  );
});
