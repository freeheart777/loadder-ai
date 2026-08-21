import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { decodeCursor, CursorPaginationError } from "../query/cursor-pagination.mjs";
import { createOperationMetrics } from "../observability/operation-metrics.mjs";
import { produceAttentionEvidenceReview, produceCompetitiveVisibilityEvidenceReview } from "../recommendations/recommendation-producers.mjs";

export class RecommendationIntelligenceError extends Error {
  constructor(message, status = 400, code = "RECOMMENDATION_INTELLIGENCE_INVALID") { super(message); this.status = status; this.code = code; }
}
const canonical = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
const text = (value, name, required = true) => { if ((value === undefined || value === null || value === "") && !required) return null; if (typeof value !== "string" || !value.trim() || value.length > 200) throw new RecommendationIntelligenceError(`${name} is invalid.`); return value.trim(); };
const iso = (value, name) => { if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new RecommendationIntelligenceError(`${name} is invalid.`); return new Date(value).toISOString(); };
const manifestReference = (finding) => ({ id: finding.id, semanticType: finding.semanticType, semanticVersion: finding.semanticVersion, schemaVersion: finding.schemaVersion, producer: finding.producer, producerVersion: finding.producerVersion, state: finding.state, contextVersionId: finding.contextVersionId, pointInTimeCutoff: finding.pointInTimeCutoff });
const compareReferences = (left, right) => `${left.semanticType}:${left.id}`.localeCompare(`${right.semanticType}:${right.id}`);

export function createRecommendationIntelligenceService({ repository, semanticRepository, registry, contextGateway, now = () => new Date(), operationMetrics = createOperationMetrics() }) {
  function parseRequest(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new RecommendationIntelligenceError("Request body is invalid.");
    const allowed = new Set(["recommendationTypes", "subjectType", "subjectId", "subjectKey", "pointInTimeCutoff", "scope"]);
    if (Object.keys(payload).some((key) => !allowed.has(key)) || Object.hasOwn(payload, "workspaceId") || Object.hasOwn(payload, "workspace_id")) throw new RecommendationIntelligenceError("Request contains unsupported fields or workspace ownership.");
    if (!Array.isArray(payload.recommendationTypes) || payload.recommendationTypes.length < 1 || payload.recommendationTypes.length > 2 || new Set(payload.recommendationTypes).size !== payload.recommendationTypes.length) throw new RecommendationIntelligenceError("recommendationTypes is invalid.");
    const contracts = payload.recommendationTypes.map((type) => registry.get(type));
    if (contracts.some((contract) => !contract)) throw new RecommendationIntelligenceError("recommendationTypes contains an unregistered recommendation type.");
    const subjectType = text(payload.subjectType, "subjectType"), subjectId = text(payload.subjectId, "subjectId", false), subjectKey = text(payload.subjectKey, "subjectKey");
    if (contracts.some((contract) => !contract.subjectTypes.includes(subjectType))) throw new RecommendationIntelligenceError("subjectType is not supported by the recommendation contract.");
    if (!payload.scope || typeof payload.scope !== "object" || Array.isArray(payload.scope)) throw new RecommendationIntelligenceError("scope is invalid.");
    if (contracts.some((contract) => Object.keys(payload.scope).length !== contract.scopeKeys.length || Object.keys(payload.scope).some((key) => !contract.scopeKeys.includes(key)))) throw new RecommendationIntelligenceError("scope contains unsupported keys.");
    const window = text(payload.scope.window, "scope.window");
    if (contracts.some((contract) => !contract.scopeWindows.includes(window))) throw new RecommendationIntelligenceError("scope.window is invalid.");
    return { contracts, subjectType, subjectId, subjectKey, pointInTimeCutoff: iso(payload.pointInTimeCutoff, "pointInTimeCutoff"), scope: Object.freeze({ window }) };
  }
  function producerFor(contract, finding) {
    return contract.recommendationType === "attention_evidence_review"
      ? produceAttentionEvidenceReview(finding)
      : produceCompetitiveVisibilityEvidenceReview(finding);
  }
  function calculate(payload = {}, userId = null) {
    const started = performance.now(), workspaceId = requireWorkspaceId();
    let rowsRead = 0, rowsWritten = 0, reusedResult = true, failure = null, semanticFindingCount = 0, insufficientEvidenceCount = 0;
    try {
      const request = parseRequest(payload), recommendations = [], skipped = [];
      let context = null;
      for (const contract of request.contracts) {
        if (!context) {
          context = contextGateway.consume({ consumer: "recommendation_intelligence", operation: "calculate", executionRequestId: sha({ workspaceId, cutoff: request.pointInTimeCutoff, subjectType: request.subjectType, subjectId: request.subjectId, subjectKey: request.subjectKey, scope: request.scope }), userId });
          if (context.state !== "READY") throw new RecommendationIntelligenceError(`Business Context is ${context.state}.`, 409, context.state);
        }
        const finding = semanticRepository.findLatestForRecommendation({ semanticType: contract.semanticType, subjectType: request.subjectType, subjectId: request.subjectId, subjectKey: request.subjectKey, cutoff: request.pointInTimeCutoff, window: request.scope.window });
        rowsRead += 1;
        if (!finding) { insufficientEvidenceCount += 1; skipped.push({ recommendationType: contract.recommendationType, reason: "SEMANTIC_FINDING_UNAVAILABLE" }); continue; }
        semanticFindingCount += 1;
        if (finding.contextVersionId !== context.contextVersionId) throw new RecommendationIntelligenceError("Semantic Finding Context does not match active Business Context.", 409, "CONTEXT_SEMANTIC_MISMATCH");
        if (finding.pointInTimeCutoff > request.pointInTimeCutoff) throw new RecommendationIntelligenceError("Semantic Finding is after the point-in-time cutoff.", 409, "FUTURE_SEMANTIC_EVIDENCE");
        const references = [manifestReference(finding)].sort(compareReferences);
        const identity = { workspaceId, recommendationType: contract.recommendationType, recommendationVersion: contract.recommendationVersion, schemaVersion: contract.schemaVersion, producer: contract.producer, producerVersion: contract.producerVersion, policyVersion: contract.policyVersion, contextVersionId: context.contextVersionId, pointInTimeCutoff: request.pointInTimeCutoff, subjectType: request.subjectType, subjectId: request.subjectId, subjectKey: request.subjectKey, scope: request.scope, sortedSemanticFindingReferences: references };
        const producerKey = sha(identity), prior = repository.findByProducerKey(contract.producer, contract.producerVersion, producerKey);
        rowsRead += 1;
        if (prior) { recommendations.push(prior); continue; }
        reusedResult = false;
        const output = producerFor(contract, finding);
        if (!output) { if (finding.state === "INSUFFICIENT_EVIDENCE") insufficientEvidenceCount += 1; skipped.push({ recommendationType: contract.recommendationType, reason: "NO_RECOMMENDATION", semanticFindingId: finding.id }); continue; }
        if (!contract.recommendationStates.includes(finding.state) || !contract.allowedConsiderationCodes.includes(output.considerationCode) || !contract.allowedRationaleCodes.includes(output.rationaleCode) || !contract.allowedReviewPriorities.includes(output.reviewPriority) || output.confidence !== null) throw new RecommendationIntelligenceError("Recommendation producer returned an invalid contract.", 500, "INVALID_RECOMMENDATION_OUTPUT");
        const calculatedAt = now().toISOString(), semanticManifestHash = sha(references);
        const saved = repository.create({ ...contract, ...request, ...output, semanticFindingReferences: references, semanticManifestHash, contextVersionId: context.contextVersionId, producerKey, provenance: { advisoryOnly: true, causalClaim: false, executable: false, policyVersion: contract.policyVersion, semanticManifestHash, scope: request.scope }, calculatedAt, createdAt: calculatedAt });
        rowsWritten += Number(saved.created); recommendations.push(saved.recommendation);
      }
      const state = recommendations.length ? "RECOMMENDATIONS_AVAILABLE" : "NO_RECOMMENDATION";
      return { state, recommendations, skipped, reusedResult: recommendations.length > 0 && reusedResult, createdCount: rowsWritten };
    } catch (error) { failure = error.code || "UNEXPECTED_ERROR"; throw error; }
    finally { operationMetrics.record({ operation: "recommendation.calculate", workspaceId, durationMs: performance.now() - started, rowsRead, rowsWritten, resultCount: rowsWritten, reusedResult, errorCode: failure, semanticFindingCount, recommendationCount: rowsWritten, insufficientEvidenceCount }); }
  }
  function list(query = {}) {
    const started = performance.now(), workspaceId = requireWorkspaceId(); let resultCount = 0, failure = null;
    try {
      const allowedQuery = new Set(["limit", "cursor", "recommendationType", "subjectType", "subjectKey", "contextVersionId", "from", "to", "reviewPriority"]);
      if (Object.keys(query).some((key) => !allowedQuery.has(key))) throw new RecommendationIntelligenceError("Query contains unsupported filters.");
      const limit = Number(query.limit || 50); if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RecommendationIntelligenceError("limit must be between 1 and 100.");
      const filters = { limit };
      for (const field of ["recommendationType", "subjectType", "subjectKey", "contextVersionId", "reviewPriority"]) if (query[field] !== undefined) filters[field] = text(query[field], field);
      if (filters.recommendationType && !registry.get(filters.recommendationType)) throw new RecommendationIntelligenceError("recommendationType is invalid.");
      if (filters.reviewPriority && !["LOW", "MEDIUM", "HIGH"].includes(filters.reviewPriority)) throw new RecommendationIntelligenceError("reviewPriority is invalid.");
      for (const field of ["from", "to"]) if (query[field] !== undefined) filters[field] = iso(query[field], field);
      try { filters.cursor = decodeCursor(query.cursor, "intelligence_recommendations", ["calculatedAt", "id"]); } catch (error) { if (error instanceof CursorPaginationError) throw new RecommendationIntelligenceError(error.message, 400, error.code); throw error; }
      const page = repository.listPage(filters); resultCount = page.items.length; return page;
    } catch (error) { failure = error.code || "UNEXPECTED_ERROR"; throw error; }
    finally { operationMetrics.record({ operation: "recommendation.list", workspaceId, durationMs: performance.now() - started, rowsRead: resultCount, rowsWritten: 0, resultCount, errorCode: failure }); }
  }
  function get(id) {
    const started = performance.now(), workspaceId = requireWorkspaceId(); let item = null, failure = null;
    try { item = repository.getById(text(id, "recommendationId")); if (!item) throw new RecommendationIntelligenceError("Recommendation not found.", 404, "RECOMMENDATION_NOT_FOUND"); return item; }
    catch (error) { failure = error.code || "UNEXPECTED_ERROR"; throw error; }
    finally { operationMetrics.record({ operation: "recommendation.get", workspaceId, durationMs: performance.now() - started, rowsRead: item ? 1 : 0, rowsWritten: 0, resultCount: item ? 1 : 0, errorCode: failure }); }
  }
  return Object.freeze({ calculate, list, get, operationMeasurements: operationMetrics.recent });
}
