import assert from "node:assert/strict";
import test from "node:test";
import { createAiOperationRegistry } from "../app/ai/ai-operation-registry.mjs";
import { createContextFingerprint } from "../app/ai/economy/context-fingerprint.mjs";
import { deterministicCapabilityRegistry } from "../app/ai/economy/deterministic-capability-registry.mjs";
import { compileAiContext } from "../app/ai/economy/context-compiler.mjs";
import { routeAiOperation } from "../app/ai/economy/model-router.mjs";
import { createAiEconomyMetrics } from "../app/ai/economy/ai-economy-metrics.mjs";
import { createAiBudgetGovernor } from "../app/ai/economy/budget-governor.mjs";
import { createAiEconomyService } from "../app/ai/economy/ai-economy-service.mjs";
import { growthPatternRegistry, learnedIntelligencePolicy } from "../app/ai/economy/pattern-registry.mjs";
import { evaluateBenchmarkResult, persianAiBenchmarkRegistry } from "../app/ai/benchmarks/persian-benchmark-registry.mjs";
import { createOpenAITextGenerationProvider } from "../app/content-generation/openai-text-provider.mjs";

const registry = createAiOperationRegistry();
const fingerprint = (overrides = {}) => createContextFingerprint({ workspaceId: "w1", operation: "CONTENT_TEXT_GENERATION", operationPolicyVersion: 1, promptVersion: 1, modelPolicyVersion: 1, input: { objective: "رشد" }, ...overrides });
const createHarness = ({ executeStructured, now } = {}) => {
  const metrics = createAiEconomyMetrics();
  const budget = createAiBudgetGovernor();
  const calls = [];
  const provider = { async executeStructured(input) { calls.push(input); return executeStructured ? executeStructured(input) : { data: { ok: true }, usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16, cachedInputTokens: 2, reasoningTokens: 0 }, provider: "OPENAI", model: input.model }; } };
  return { calls, metrics, budget, service: createAiEconomyService({ provider, policyRegistry: registry, deterministicRegistry: deterministicCapabilityRegistry, metrics, budgetGovernor: budget, now }) };
};

test("AI Economy registry covers every governed operation with explicit policy", () => {
  const operations = registry.list();
  assert.equal(operations.length, 6);
  assert.ok(operations.every((policy) => policy.promptVersion === 1 && policy.modelPolicyVersion === 1 && policy.sideEffects === false));
});

test("cheap operations route Luna-first and benchmark-required operations route Terra", () => {
  assert.equal(routeAiOperation(registry.get("CONTENT_PLAN_GENERATION")).route, "LUNA");
  assert.equal(routeAiOperation(registry.get("GROWTH_STRATEGY_GENERATION")).route, "TERRA");
});

test("deterministic and reusable work bypass provider routing", () => {
  const policy = registry.get("CONTENT_TEXT_GENERATION");
  assert.equal(routeAiOperation(policy, { deterministic: true }).route, "DETERMINISTIC");
  assert.equal(routeAiOperation(policy, { reusable: true }).route, "REUSE");
});

test("callers cannot force expert model selection", () => {
  assert.throws(() => routeAiOperation(registry.get("CONTENT_TEXT_GENERATION"), { forceExpert: true }), /AI_MODEL_OVERRIDE_FORBIDDEN/);
});

test("fingerprints are stable across key order and volatile timestamps", () => {
  const a = fingerprint({ input: { b: 2, a: 1, updatedAt: "yesterday" } });
  const b = fingerprint({ input: { a: 1, b: 2, updatedAt: "today" } });
  assert.equal(a.fingerprint, b.fingerprint);
});

test("fingerprints change for tenant, policy, or meaningful input changes", () => {
  const base = fingerprint().fingerprint;
  assert.notEqual(base, fingerprint({ workspaceId: "w2" }).fingerprint);
  assert.notEqual(base, fingerprint({ modelPolicyVersion: 2 }).fingerprint);
  assert.notEqual(base, fingerprint({ input: { objective: "فروش" } }).fingerprint);
});

test("context compiler removes unrelated payload and measurably reduces characters", () => {
  const input = { strategicObjective: "رشد", targetSegments: ["مدیران"], growthPillars: ["اعتماد"], contentThemes: ["آموزش"], channelPriorities: ["وب‌سایت"], funnelPriorities: ["آگاهی"], unrelatedAuditHistory: "x".repeat(20_000) };
  const compiled = compileAiContext("CONTENT_PLAN_GENERATION", input);
  assert.ok(compiled.characters < JSON.stringify(input).length / 20);
  assert.equal(Object.hasOwn(compiled.context, "unrelatedAuditHistory"), false);
});

test("context compiler is deterministic and enforces its maximum", () => {
  const input = { strategicObjective: "رشد", targetSegments: ["کسب‌وکار"] };
  assert.deepEqual(compileAiContext("CONTENT_PLAN_GENERATION", input), compileAiContext("CONTENT_PLAN_GENERATION", input));
  assert.throws(() => compileAiContext("UNKNOWN", { payload: "x".repeat(32_001) }), /AI_CONTEXT_TOO_LARGE/);
});

test("deterministic capability registry resolves safe URLs without AI", async () => {
  const h = createHarness();
  const result = await h.service.execute({ workspaceId: "w1", userId: "u1", operation: "SAFE_URL_VALIDATION", input: {}, deterministicInput: { url: "https://loadder.ai" } });
  assert.equal(result.source, "DETERMINISTIC");
  assert.equal(result.data.valid, true);
  assert.equal(h.calls.length, 0);
  assert.equal(deterministicCapabilityRegistry.canResolve("SAFE_URL_VALIDATION", { url: "https://loadder.ai" }).result.valid, true);
  assert.equal(deterministicCapabilityRegistry.canResolve("SAFE_URL_VALIDATION", { url: "http://unsafe.test" }).result.valid, false);
});

test("identical calls converge to one provider invocation and bounded reuse", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const h = createHarness({ executeStructured: async (input) => { await pending; return { data: { ok: true }, usage: { totalTokens: 3 }, provider: "OPENAI", model: input.model }; } });
  const args = { workspaceId: "w1", userId: "u1", operation: "CONTENT_TEXT_GENERATION", input: { x: 1 }, providerInput: "bounded", schema: {}, schemaName: "Result" };
  const first = h.service.execute(args);
  const second = h.service.execute(args);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(h.calls.length, 1);
  assert.equal(a.source, "GENERATED");
  assert.equal(b.source, "REUSED");
  assert.equal((await h.service.execute(args)).source, "REUSED");
});

test("reuse is isolated by workspace and user", async () => {
  const h = createHarness();
  const base = { operation: "CONTENT_TEXT_GENERATION", input: { x: 1 }, providerInput: "bounded", schema: {}, schemaName: "Result" };
  await h.service.execute({ ...base, workspaceId: "w1", userId: "u1" });
  await h.service.execute({ ...base, workspaceId: "w2", userId: "u1" });
  await h.service.execute({ ...base, workspaceId: "w1", userId: "u2" });
  assert.equal(h.calls.length, 3);
});

test("approved persisted results are reused before provider invocation", async () => {
  const h = createHarness();
  const result = await h.service.execute({ workspaceId: "w1", userId: "u1", operation: "CONTENT_TEXT_GENERATION", input: { x: 1 }, reuseResult: async () => ({ approved: true }) });
  assert.equal(result.source, "REUSED");
  assert.deepEqual(result.data, { approved: true });
  assert.equal(h.calls.length, 0);
});

test("stale or rejected persisted candidates cannot bypass generation", async () => {
  const h = createHarness();
  const result = await h.service.execute({ workspaceId: "w1", userId: "u1", operation: "CONTENT_TEXT_GENERATION", input: { x: 1 }, providerInput: "bounded", schema: {}, schemaName: "Result", reuseResult: async () => null });
  assert.equal(result.source, "GENERATED");
  assert.equal(h.calls.length, 1);
});

test("provider failure does not trigger hidden retry or Terra fallback", async () => {
  const error = Object.assign(new Error("unavailable"), { code: "AI_PROVIDER_UNAVAILABLE" });
  const h = createHarness({ executeStructured: async () => { throw error; } });
  await assert.rejects(h.service.execute({ workspaceId: "w1", userId: "u1", operation: "CONTENT_TEXT_GENERATION", input: {}, providerInput: "bounded", schema: {}, schemaName: "Result" }), /unavailable/);
  assert.equal(h.calls.length, 1);
});

test("quality gates fail closed without a repair call", async () => {
  const h = createHarness();
  await assert.rejects(h.service.execute({ workspaceId: "w1", userId: "u1", operation: "CONTENT_TEXT_GENERATION", input: {}, providerInput: "bounded", schema: {}, schemaName: "Result", qualityGate: () => false }), /AI_OUTPUT_QUALITY_INSUFFICIENT/);
  assert.equal(h.calls.length, 1);
});

test("telemetry records routing and normalized usage without prompt content", async () => {
  const h = createHarness();
  await h.service.execute({ workspaceId: "w1", userId: "u1", operation: "CONTENT_TEXT_GENERATION", input: { secretPrompt: "never-store" }, providerInput: "never-store", schema: {}, schemaName: "Result" });
  const event = h.metrics.recent()[0];
  assert.equal(event.route, "LUNA");
  assert.equal(event.totalTokens, 16);
  assert.doesNotMatch(JSON.stringify(event), /never-store/);
});

test("economy metrics report provider avoidance and cache utilization", async () => {
  const h = createHarness();
  const args = { workspaceId: "w1", userId: "u1", operation: "CONTENT_TEXT_GENERATION", input: {}, providerInput: "bounded", schema: {}, schemaName: "Result" };
  await h.service.execute(args);
  await h.service.execute(args);
  const summary = h.metrics.summary("w1");
  assert.equal(summary.providerCalls, 1);
  assert.equal(summary.avoidedCalls, 1);
  assert.equal(summary.reuseRate, 0.5);
  assert.equal(summary.terraTokens, 0);
  assert.ok(summary.cacheUtilizationRate > 0);
});

test("budget governor observes and warns but never blocks", () => {
  const governor = createAiBudgetGovernor({ softDailyTokenBudget: 10, expertModelUsageLimit: 1, warningThreshold: 0.5 });
  const state = governor.observe("w1", "TERRA", 10);
  assert.equal(state.warning, true);
  assert.equal(state.softLimitExceeded, true);
  assert.equal(state.blocking, false);
  assert.equal(governor.readiness().mode, "OBSERVE_AND_WARN");
});

test("Persian benchmark registry is synthetic, PII-free, and human-gated", () => {
  const fixtures = persianAiBenchmarkRegistry.list();
  assert.equal(fixtures.length, 72);
  assert.ok(fixtures.every((fixture) => fixture.locale === "fa-IR" && fixture.containsPii === false));
  const result = evaluateBenchmarkResult({ fixture: fixtures[0], output: { summary: "رشد پایدار" }, schemaValid: true });
  assert.equal(result.decision, "BENCHMARK_REQUIRED");
  assert.equal(result.estimatedCost, null);
});

test("benchmark evaluation supports explicit scorecards without invented cost", () => {
  const fixture = persianAiBenchmarkRegistry.list()[0];
  const approved = evaluateBenchmarkResult({ fixture, output: { summary: "متن فارسی معتبر" }, schemaValid: true, latencyMs: 12, usage: { totalTokens: 7 }, humanScore: 90 });
  assert.equal(approved.decision, "APPROVED");
  assert.equal(approved.tokenUsage.totalTokens, 7);
  assert.equal(approved.costStatus, "UNAVAILABLE");
});

test("learned intelligence and pattern activation remain human-governed", () => {
  assert.deepEqual(growthPatternRegistry.list(), []);
  assert.equal(growthPatternRegistry.activationPolicy, "HUMAN_APPROVAL_REQUIRED");
  assert.equal(learnedIntelligencePolicy.automaticActivation, false);
  assert.equal(learnedIntelligencePolicy.generatedCode, false);
  assert.equal(learnedIntelligencePolicy.automaticPromptModification, false);
  assert.equal(learnedIntelligencePolicy.customerDataTraining, false);
});

test("content provider accepts zero-token governed reuse without a second call", async () => {
  const provider = createOpenAITextGenerationProvider({ economyService: { execute: async () => ({ data: { headline: "محتوای معتبر" }, usage: null, source: "REUSED" }) } });
  const result = await provider.generateRegisteredContract({ workspaceId: "w1", userId: "u1", binding: { model: "gpt-5.6-luna", reasoningEffort: "low", providerDeadlineMs: 25_000 }, contract: { contractId: "test_contract", contractVersion: 1, templateVersion: 1, maximumOutputCharacters: 2_000, outputSchema: {} }, template: { system: "stable", user: "dynamic" } });
  assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0 });
});
