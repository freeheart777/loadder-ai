import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { decodeCursor } from "../query/cursor-pagination.mjs";
import { validateContentBrief } from "../content-generation/content-brief.mjs";
import { projectGenerationContext } from "../content-generation/generation-context.mjs";
import { composeTextGenerationTemplate } from "../content-generation/template-registry.mjs";
import { TextProviderError } from "../content-generation/openai-text-provider.mjs";

const REQUEST_FIELDS = ["contractId", "contractVersion", "placementId", "placementVersion", "brief", "variantCount"];
const DISABLED_CONTRACTS = new Set(["social_image", "story_image", "website_hero_image", "display_banner", "short_ad_video", "reel_story_video", "product_promo_video", "brand_intro_video"]);
const PROVIDER_FAILURES = new Set(["CONTENT_PROVIDER_UNAVAILABLE", "CONTENT_PROVIDER_TIMEOUT", "CONTENT_OUTPUT_INVALID", "CONTENT_GENERATION_FAILED"]);
const canonical = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");

export class ContentGenerationError extends Error {
  constructor(code, status = 400, message = "Content generation failed.", retryAfter = null) { super(message); this.name = "ContentGenerationError"; this.code = code; this.status = status; this.retryAfter = retryAfter; }
}

function request(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !REQUEST_FIELDS.includes(key)) || REQUEST_FIELDS.some((key) => !Object.hasOwn(input, key))) throw new ContentGenerationError("CONTENT_INPUT_INVALID");
  if (typeof input.contractId !== "string" || !/^[a-z][a-z0-9_]{0,99}$/.test(input.contractId) || !Number.isInteger(input.contractVersion) || input.contractVersion < 1 || typeof input.placementId !== "string" || !/^[a-z][a-z0-9_.]{0,99}$/.test(input.placementId) || !Number.isInteger(input.placementVersion) || input.placementVersion < 1 || !Number.isInteger(input.variantCount) || input.variantCount < 1) throw new ContentGenerationError("CONTENT_INPUT_INVALID");
  let brief;
  try { brief = validateContentBrief(input.brief); } catch { throw new ContentGenerationError("CONTENT_INPUT_INVALID"); }
  return Object.freeze({ ...input, brief });
}

export function createContentGenerationService({ repository, contractRegistry, placementRegistry, providerBindingRegistry, contextGateway, provider, rateLimiter, operationMetrics, now = () => new Date() }) {
  const inflight = new Map();
  const metric = (start, input) => operationMetrics.record({ operation: "content.generate", workspaceId: requireWorkspaceId(), durationMs: performance.now() - start, ...input });
  function resolveContext(userId, key) {
    const result = contextGateway.consume({ consumer: "content_studio", operation: "content.generate", executionRequestId: key, userId });
    if (result.state === "MISSING_CONTEXT") throw new ContentGenerationError("CONTENT_CONTEXT_MISSING", 409);
    if (result.state === "STALE_CONTEXT") throw new ContentGenerationError("CONTENT_CONTEXT_STALE", 409);
    if (result.state !== "READY") throw new ContentGenerationError("CONTENT_CONTEXT_UNSUPPORTED", 422);
    return result;
  }
  function priorResult(prior, fingerprint) {
    if (prior.requestFingerprint !== fingerprint) throw new ContentGenerationError("CONTENT_IDEMPOTENCY_CONFLICT", 409);
    if (prior.status === "FAILED") throw new ContentGenerationError(prior.errorCode, PROVIDER_FAILURES.has(prior.errorCode) ? 502 : 500);
    return { generation: prior, reusedResult: true };
  }
  async function perform({ normalized, contract, placement, brief, generationContext, binding, actor, idempotencyKey, fingerprint, requestHash, briefHash, started }) {
    const workspaceId = requireWorkspaceId();
    const lease = rateLimiter.acquire(workspaceId, actor.userId);
    if (!lease.allowed) { metric(started, { mediaType: contract.mediaType, contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, errorCode: "CONTENT_RATE_LIMITED" }); throw new ContentGenerationError("CONTENT_RATE_LIMITED", 429, "Content generation rate limit exceeded.", lease.retryAfter); }
    const createdAt = now().toISOString();
    let usage = { inputTokens: null, outputTokens: null };
    try {
      const template = composeTextGenerationTemplate({ contract, placement, brief, generationContext, variantCount: normalized.variantCount });
      const result = await provider.generateRegisteredContract({ binding, contract, template });
      usage = result.usage;
      let variants;
      try { variants = contract.validateOutput(result.output, normalized.variantCount); }
      catch { throw new TextProviderError("CONTENT_OUTPUT_INVALID"); }
      const saved = repository.create({ userId: actor.userId, mediaType: contract.mediaType, contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, contextVersionId: generationContext.contextVersionId, templateVersion: contract.templateVersion, providerBinding: binding.bindingId, providerBindingVersion: binding.bindingVersion, providerModel: binding.model, briefHash, requestFingerprint: fingerprint, idempotencyKey, requestHash, status: "SUCCEEDED", normalizedResult: { variants }, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedCostMinor: null, costCurrency: null, errorCode: null, createdAt, completedAt: now().toISOString() });
      const finalResult = saved.created ? { generation: saved.generation, reusedResult: false } : priorResult(saved.generation, fingerprint);
      metric(started, { mediaType: contract.mediaType, contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, providerKind: binding.providerKind, providerBindingVersion: binding.bindingVersion, providerModel: binding.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, rowsWritten: Number(saved.created), resultCount: variants.length, reusedResult: finalResult.reusedResult });
      return finalResult;
    } catch (error) {
      const code = error instanceof TextProviderError ? error.code : error instanceof ContentGenerationError ? error.code : "CONTENT_GENERATION_FAILED";
      if (PROVIDER_FAILURES.has(code)) repository.create({ userId: actor.userId, mediaType: contract.mediaType, contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, contextVersionId: generationContext.contextVersionId, templateVersion: contract.templateVersion, providerBinding: binding.bindingId, providerBindingVersion: binding.bindingVersion, providerModel: binding.model, briefHash, requestFingerprint: fingerprint, idempotencyKey, requestHash, status: "FAILED", normalizedResult: null, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedCostMinor: null, costCurrency: null, errorCode: code, createdAt, completedAt: now().toISOString() });
      metric(started, { mediaType: contract.mediaType, contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, providerKind: binding.providerKind, providerBindingVersion: binding.bindingVersion, providerModel: binding.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, rowsWritten: Number(PROVIDER_FAILURES.has(code)), errorCode: code });
      if (error instanceof ContentGenerationError) throw error;
      throw new ContentGenerationError(code, code === "CONTENT_PROVIDER_UNAVAILABLE" ? 503 : code === "CONTENT_PROVIDER_TIMEOUT" ? 504 : 502);
    } finally { lease.release(); }
  }
  return Object.freeze({
    async generate(input, actor, idempotencyKey) {
      const started = performance.now();
      if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 200) throw new ContentGenerationError("CONTENT_INPUT_INVALID");
      const normalized = request(input);
      if (DISABLED_CONTRACTS.has(normalized.contractId)) throw new ContentGenerationError("CONTENT_MEDIA_DISABLED", 409);
      const contract = contractRegistry.get(normalized.contractId, normalized.contractVersion);
      if (!contract) throw new ContentGenerationError("CONTENT_CONTRACT_NOT_FOUND", 404);
      if (normalized.variantCount > contract.maximumVariants) throw new ContentGenerationError("CONTENT_INPUT_INVALID");
      if (["ad_copy", "landing_page_copy"].includes(contract.contractId) && !normalized.brief.cta) throw new ContentGenerationError("CONTENT_INPUT_INVALID");
      const placement = placementRegistry.get(normalized.placementId, normalized.placementVersion);
      if (!placement || !placement.productionEnabled) throw new ContentGenerationError("CONTENT_PLACEMENT_NOT_SUPPORTED", 422);
      if (contract.placementId !== placement.placementId || contract.placementVersion !== placement.placementVersion) throw new ContentGenerationError("CONTENT_PLACEMENT_NOT_SUPPORTED", 422);
      const binding = providerBindingRegistry.get(contract.providerBindingVersion);
      if (!binding) throw new ContentGenerationError("CONTENT_PROVIDER_UNAVAILABLE", 503);
      const contextResult = resolveContext(actor.userId, idempotencyKey.trim());
      let generationContext;
      try { generationContext = projectGenerationContext(contextResult, normalized.brief); }
      catch { throw new ContentGenerationError("CONTENT_CONTEXT_UNSUPPORTED", 422); }
      const fingerprint = hash({ contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, contextVersionId: generationContext.contextVersionId, brief: normalized.brief, variantCount: normalized.variantCount });
      const requestHash = hash({ operation: "content.generate", fingerprint });
      const prior = repository.findByIdempotency(actor.userId, idempotencyKey.trim());
      if (prior) { const result = priorResult(prior, fingerprint); metric(started, { mediaType: contract.mediaType, contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, reusedResult: true, resultCount: result.generation.variants?.length || 0, rowsRead: 1 }); return result; }
      const key = `${requireWorkspaceId()}:${actor.userId}:${idempotencyKey.trim()}`;
      const running = inflight.get(key);
      if (running) {
        if (running.fingerprint !== fingerprint) throw new ContentGenerationError("CONTENT_IDEMPOTENCY_CONFLICT", 409);
        const result = await running.promise; return { ...result, reusedResult: true };
      }
      const promise = perform({ normalized, contract, placement, brief: normalized.brief, generationContext, binding, actor, idempotencyKey: idempotencyKey.trim(), fingerprint, requestHash, briefHash: hash(normalized.brief), started });
      inflight.set(key, { fingerprint, promise });
      try { return await promise; } finally { inflight.delete(key); }
    },
    list(query = {}) {
      const limit = query.limit === undefined ? 20 : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || Object.keys(query).some((key) => !["limit", "cursor"].includes(key))) throw new ContentGenerationError("CONTENT_INPUT_INVALID");
      const cursor = decodeCursor(query.cursor, "content_generations", ["createdAt", "id"]);
      return repository.listPage({ limit, cursor });
    },
  });
}
