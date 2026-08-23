const DEFAULTS = Object.freeze([
  Object.freeze({ operationId: "BUSINESS_BRAIN_ANALYSIS", operationVersion: 1, provider: "OPENAI", modelConfigKey: "OPENAI_BUSINESS_BRAIN_MODEL", defaultModel: "gpt-5.6-terra", reasoningEffort: "low", maxInputCharacters: 10_000, maxOutputTokens: 1_600, timeoutMs: 25_000, automaticRetries: 0, featureExposure: "INTERNAL", structuredOutput: true, rawFreeText: false, sideEffects: false }),
  Object.freeze({ operationId: "CONTENT_TEXT_GENERATION", operationVersion: 1, provider: "OPENAI", modelConfigKey: "OPENAI_CONTENT_MODEL", defaultModel: "gpt-5.6-luna", reasoningEffort: "low", maxInputCharacters: 32_000, maxOutputTokens: 12_000, timeoutMs: 25_000, automaticRetries: 0, featureExposure: "CUSTOMER", structuredOutput: true, rawFreeText: false, sideEffects: false }),
  Object.freeze({ operationId: "GROWTH_STRATEGY_GENERATION", operationVersion: 1, provider: "OPENAI", modelConfigKey: "OPENAI_GROWTH_STRATEGY_MODEL", defaultModel: "gpt-5.6-terra", reasoningEffort: "low", maxInputCharacters: 32_000, maxOutputTokens: 4_000, timeoutMs: 25_000, automaticRetries: 0, featureExposure: "CUSTOMER", structuredOutput: true, rawFreeText: false, sideEffects: false }),
  Object.freeze({ operationId: "CONTENT_PLAN_GENERATION", operationVersion: 1, provider: "OPENAI", modelConfigKey: "OPENAI_CONTENT_PLAN_MODEL", defaultModel: "gpt-5.6-luna", reasoningEffort: "low", maxInputCharacters: 24_000, maxOutputTokens: 4_000, timeoutMs: 25_000, automaticRetries: 0, featureExposure: "CUSTOMER", structuredOutput: true, rawFreeText: false, sideEffects: false }),
  Object.freeze({ operationId: "LANDING_PROPOSAL_GENERATION", operationVersion: 1, provider: "OPENAI", modelConfigKey: "OPENAI_LANDING_PROPOSAL_MODEL", defaultModel: "gpt-5.6-luna", reasoningEffort: "low", maxInputCharacters: 24_000, maxOutputTokens: 4_000, timeoutMs: 25_000, automaticRetries: 0, featureExposure: "CUSTOMER", structuredOutput: true, rawFreeText: false, sideEffects: false }),
  Object.freeze({ operationId: "WEBSITE_PROPOSAL_GENERATION", operationVersion: 1, provider: "OPENAI", modelConfigKey: "OPENAI_WEBSITE_PROPOSAL_MODEL", defaultModel: "gpt-5.6-luna", reasoningEffort: "low", maxInputCharacters: 24_000, maxOutputTokens: 5_000, timeoutMs: 25_000, automaticRetries: 0, featureExposure: "CUSTOMER", structuredOutput: true, rawFreeText: false, sideEffects: false }),
]);

export function createAiOperationRegistry(entries = DEFAULTS, environment = process.env) {
  const allowed = ["operationId", "operationVersion", "provider", "modelConfigKey", "defaultModel", "reasoningEffort", "maxInputCharacters", "maxOutputTokens", "timeoutMs", "automaticRetries", "featureExposure", "structuredOutput", "rawFreeText", "sideEffects"];
  const policies = entries.map((entry) => {
    if (!entry || Object.keys(entry).some((key) => !allowed.includes(key)) || allowed.some((key) => !Object.hasOwn(entry, key)) || !/^[A-Z][A-Z0-9_]{2,79}$/.test(entry.operationId) || entry.operationVersion !== 1 || entry.provider !== "OPENAI" || !/^OPENAI_[A-Z0-9_]+$/.test(entry.modelConfigKey) || typeof entry.defaultModel !== "string" || !entry.defaultModel || entry.defaultModel.length > 120 || entry.reasoningEffort !== "low" || !Number.isInteger(entry.maxInputCharacters) || entry.maxInputCharacters < 100 || entry.maxInputCharacters > 100_000 || !Number.isInteger(entry.maxOutputTokens) || entry.maxOutputTokens < 100 || entry.maxOutputTokens > 12_000 || !Number.isInteger(entry.timeoutMs) || entry.timeoutMs < 1_000 || entry.timeoutMs > 30_000 || entry.automaticRetries !== 0 || !["INTERNAL", "CUSTOMER"].includes(entry.featureExposure) || entry.structuredOutput !== true || entry.rawFreeText !== false || entry.sideEffects !== false) throw new Error("AI operation policy is invalid.");
    const configuredModel = environment[entry.modelConfigKey];
    return Object.freeze({ ...entry, model: typeof configuredModel === "string" && configuredModel.trim() && configuredModel.length <= 120 ? configuredModel.trim() : entry.defaultModel });
  });
  const map = new Map(policies.map((policy) => [policy.operationId, policy]));
  if (map.size !== policies.length) throw new Error("Duplicate AI operation policy.");
  return Object.freeze({ get: (operationId) => map.get(operationId) || null, list: () => [...map.values()] });
}

export const aiOperationRegistry = createAiOperationRegistry();
