import crypto from "node:crypto";
import { AiProviderError } from "../ai/ai-provider-errors.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { composeBusinessBrainInput } from "./business-brain-prompt.mjs";
import { businessDnaJsonSchema, validateBusinessDna } from "./business-brain-schema.mjs";
import { aiQualityGates } from "../ai/economy/quality-gates.mjs";

const FIELDS = Object.freeze(["website", "businessDescription", "brandNotes"]);
const LIMITS = Object.freeze({ website: 2_048, businessDescription: 6_000, brandNotes: 3_000 });
const hasUnsafeControl = (value) => [...value].some((character) => { const code = character.codePointAt(0); return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127 || (code >= 0x202A && code <= 0x202E) || (code >= 0x2066 && code <= 0x2069); });
const normalizeText = (value, maximum) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new AiProviderError("AI_INPUT_INVALID");
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[\t ]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length > maximum || hasUnsafeControl(normalized)) throw new AiProviderError("AI_INPUT_INVALID");
  return normalized;
};

export function validateBusinessBrainInput(input, maximumTotal = 10_000) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !FIELDS.includes(key))) throw new AiProviderError("AI_INPUT_INVALID");
  const normalized = Object.freeze(Object.fromEntries(FIELDS.map((field) => [field, normalizeText(input[field], LIMITS[field])])));
  if (!FIELDS.some((field) => normalized[field]) || FIELDS.reduce((total, field) => total + normalized[field].length, 0) > maximumTotal) throw new AiProviderError("AI_INPUT_INVALID");
  return normalized;
}

export function createBusinessBrainService({ provider, economyService = null, policyRegistry, rateLimiter, operationMetrics = null, now = () => Date.now(), duplicateTtlMs = 15_000 } = {}) {
  const recent = new Map(), inflight = new Map();
  const readiness = () => Object.freeze({ configured: Boolean(provider?.configured), enabled: Boolean(policyRegistry?.get("BUSINESS_BRAIN_ANALYSIS")), providerAvailability: "not-probed" });
  return Object.freeze({
    readiness,
    async analyze(input, actor) {
      const started = performance.now(), workspaceId = requireWorkspaceId(), policy = policyRegistry?.get("BUSINESS_BRAIN_ANALYSIS");
      if (!policy) throw new AiProviderError("AI_OPERATION_DISABLED");
      if (!actor?.userId) throw new AiProviderError("AI_REQUEST_REJECTED");
      const normalized = validateBusinessBrainInput(input, policy.maxInputCharacters), fingerprint = crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex"), key = `${workspaceId}:${actor.userId}:${fingerprint}`;
      const cached = recent.get(key);
      if (cached && now() - cached.at <= duplicateTtlMs) return Object.freeze({ data: cached.data, usage: cached.usage, reusedResult: true });
      if (inflight.has(key)) return Object.freeze({ ...(await inflight.get(key)), reusedResult: true });
      const limit = rateLimiter.acquire(workspaceId, actor.userId);
      if (!limit.allowed) { const error = new AiProviderError("AI_PROVIDER_RATE_LIMITED"); error.retryAfter = limit.retryAfter; throw error; }
      const run = (async () => {
        const providerInput = composeBusinessBrainInput(normalized);
        const result = economyService ? await economyService.execute({ workspaceId, userId: actor.userId, operation: policy.operationId, input: normalized, providerInput, schema: businessDnaJsonSchema, schemaName: "loadder_business_dna_v1", qualityGate: aiQualityGates.BUSINESS_BRAIN_ANALYSIS }) : await provider.executeStructured({ operation: policy.operationId, model: policy.model, input: providerInput, schema: businessDnaJsonSchema, schemaName: "loadder_business_dna_v1", reasoningEffort: policy.reasoningEffort, maxOutputTokens: policy.maxOutputTokens, timeoutMs: policy.timeoutMs });
        const data = validateBusinessDna(result.data), completed = Object.freeze({ data, usage: result.usage });
        recent.set(key, { ...completed, at: now() });
        operationMetrics?.record({ operation: "business_brain.analyze", workspaceId, durationMs: performance.now() - started, providerKind: result.provider, providerModel: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
        return completed;
      })();
      inflight.set(key, run);
      try { return Object.freeze({ ...(await run), reusedResult: false }); }
      catch (error) { operationMetrics?.record({ operation: "business_brain.analyze", workspaceId, durationMs: performance.now() - started, errorCode: error?.code || "AI_PROVIDER_UNAVAILABLE" }); throw error; }
      finally { inflight.delete(key); }
    },
  });
}
