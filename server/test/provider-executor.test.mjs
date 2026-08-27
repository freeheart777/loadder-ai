import assert from "node:assert/strict";
import test from "node:test";
import { createProviderExecutor } from "../app/experiments/provider-executor.mjs";

test("provider executor passes the pinned execution context and returns provider output", async () => {
  const seen = [];
  const executor = createProviderExecutor({
    provider: async (request) => {
      seen.push(request);
      return { provider: "test", output: request.input };
    },
  });
  const plan = Object.freeze({ experimentId: "exp-1", contextVersionId: "ctx-1" });
  const run = Object.freeze({ id: "run-1" });
  const result = await executor({ plan, run, input: { prompt: "hello" } });
  assert.deepEqual(result, { provider: "test", output: { prompt: "hello" } });
  assert.equal(seen[0].plan, plan);
  assert.equal(seen[0].run, run);
});

test("provider executor rejects non-object provider results", async () => {
  const executor = createProviderExecutor({ provider: async () => "invalid" });
  await assert.rejects(() => executor({ plan: {}, run: {} }), (error) => error.code === "EXPERIMENT_PROVIDER_RESULT_INVALID");
});
