import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { decodeCursor, CursorPaginationError } from "../query/cursor-pagination.mjs";
import { createOperationMetrics } from "../observability/operation-metrics.mjs";
import { produceListeningAttention, produceCompetitiveVisibility } from "../semantic/semantic-producers.mjs";

export class SemanticIntelligenceError extends Error { constructor(message, status = 400, code = "SEMANTIC_INTELLIGENCE_INVALID") { super(message); this.status = status; this.code = code; } }
const canonical = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
const text = (value, name, required = true) => { if ((!value && !required)) return null; if (typeof value !== "string" || !value.trim() || value.length > 200) throw new SemanticIntelligenceError(`${name} is invalid.`); return value.trim(); };
const iso = (value, name) => { if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new SemanticIntelligenceError(`${name} is invalid.`); return new Date(value).toISOString(); };
const ref = (kind, item, contractVersion) => ({ kind, id: item.id, contractVersion, producer: item.producer, producerVersion: item.producerVersion, sourceTimestamp: item.windowEnd || item.calculatedAt || null, windowStart: item.windowStart || null, windowEnd: item.windowEnd || null });
const compareRefs = (a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`);

function selectedEvidence(repository, contract, request) {
  const evidence = repository.listeningEvidence({ window: request.window, cutoff: request.cutoff, semanticType: contract.semanticType });
  if (!evidence) return null;
  if (contract.semanticType === "listening_attention_state") {
    const references = [ref("listening_aggregate", evidence.mention, evidence.mention.metricVersion)];
    if (evidence.trend) references.push(ref("listening_trend_signal", evidence.trend, evidence.trend.signalVersion));
    if (evidence.anomaly) references.push(ref("listening_anomaly_result", evidence.anomaly, evidence.anomaly.methodVersion));
    return { evidence, references: references.sort(compareRefs), contextVersionId: evidence.mention.contextVersionId };
  }
  const rows = [evidence.shareOfVoice, evidence.competitorMentions].filter(Boolean);
  return { evidence, references: rows.map((item) => ref("listening_aggregate", item, item.metricVersion)).sort(compareRefs), contextVersionId: evidence.shareOfVoice?.contextVersionId || evidence.mention.contextVersionId };
}

export function createSemanticIntelligenceService({ repository, registry, contextGateway, now = () => new Date(), operationMetrics = createOperationMetrics() }) {
  function parseRequest(payload) {
    if (Object.hasOwn(payload, "workspaceId") || Object.hasOwn(payload, "workspace_id")) throw new SemanticIntelligenceError("Workspace ownership is server-resolved.");
    if (!Array.isArray(payload.semanticTypes) || payload.semanticTypes.length < 1 || payload.semanticTypes.length > 2 || new Set(payload.semanticTypes).size !== payload.semanticTypes.length) throw new SemanticIntelligenceError("semanticTypes is invalid.");
    const contracts = payload.semanticTypes.map((type) => registry.get(type));
    if (contracts.some((item) => !item)) throw new SemanticIntelligenceError("semanticTypes contains an unregistered semantic type.");
    const subjectType = text(payload.subjectType, "subjectType"), subjectKey = text(payload.subjectKey, "subjectKey"), subjectId = text(payload.subjectId, "subjectId", false);
    if (contracts.some((contract) => !contract.subjectTypes.includes(subjectType))) throw new SemanticIntelligenceError("subjectType is not supported by the semantic contract.");
    if (!["1h", "24h", "7d", "30d"].includes(payload.window)) throw new SemanticIntelligenceError("window is invalid.");
    return { contracts, subjectType, subjectKey, subjectId, window: payload.window, cutoff: iso(payload.pointInTimeCutoff, "pointInTimeCutoff") };
  }
  function calculate(payload = {}, userId = null) {
    const started = performance.now(), workspaceId = requireWorkspaceId(); let rowsRead = 0, rowsWritten = 0, reusedResult = true, failure = null, evidenceCount = 0, insufficientEvidenceCount = 0;
    try {
      const request = parseRequest(payload), findings = [];
      for (const contract of request.contracts) {
        const selection = selectedEvidence(repository, contract, request);
        if (!selection) throw new SemanticIntelligenceError("Canonical semantic evidence is unavailable.", 409, "EVIDENCE_UNAVAILABLE");
        rowsRead += selection.references.length; evidenceCount += selection.references.length;
        const scope = { window: request.window };
        const identity = { workspaceId, semanticType: contract.semanticType, semanticVersion: contract.semanticVersion, schemaVersion: contract.schemaVersion, producer: contract.producer, producerVersion: contract.producerVersion, contextVersionId: selection.contextVersionId, pointInTimeCutoff: request.cutoff, subjectType: request.subjectType, subjectId: request.subjectId, subjectKey: request.subjectKey, scope, evidenceSelectionPolicyVersion: 1, evidence: selection.references };
        const producerKey = sha(identity), prior = repository.findByProducerKey(contract.producer, contract.producerVersion, producerKey);
        if (prior) { findings.push(prior); continue; }
        reusedResult = false;
        const context = contextGateway.consume({ consumer: "semantic_intelligence", operation: `calculate:${contract.semanticType}`, executionRequestId: producerKey, userId });
        if (context.state !== "READY") throw new SemanticIntelligenceError(`Business Context is ${context.state}.`, 409, context.state);
        if (context.contextVersionId !== selection.contextVersionId) throw new SemanticIntelligenceError("Canonical evidence is not attributed to the active Business Context.", 409, "CONTEXT_EVIDENCE_MISMATCH");
        const output = contract.semanticType === "listening_attention_state" ? produceListeningAttention(selection.evidence) : produceCompetitiveVisibility(selection.evidence);
        if (!contract.allowedStates.includes(output.state) || (output.value !== null && !contract.valuePermitted) || output.confidence !== null) throw new SemanticIntelligenceError("Semantic producer returned an invalid contract.", 500, "INVALID_PRODUCER_OUTPUT");
        if (output.state === "INSUFFICIENT_EVIDENCE") insufficientEvidenceCount += 1;
        const at = now().toISOString(), evidenceManifestHash = sha(selection.references);
        const saved = repository.create({ ...contract, ...request, state: output.state, value: output.value, confidence: output.confidence, confidenceReason: output.confidenceReason, evidenceReferences: selection.references, evidenceManifestHash, contextVersionId: selection.contextVersionId, contextState: context.state, calculatedAt: at, pointInTimeCutoff: request.cutoff, producerKey, provenance: { rule: `${contract.semanticType}@${contract.semanticVersion}`, evidenceSelectionPolicy: "canonical_listening_window@1", evidenceManifestHash, scope, factualInterpretationOnly: true }, createdAt: at });
        rowsWritten += Number(saved.created); findings.push(saved.finding);
      }
      return { state: "CALCULATED", findings, reusedResult: reusedResult && findings.length > 0 };
    } catch (error) { failure = error.code || "UNEXPECTED_ERROR"; throw error; }
    finally { operationMetrics.record({ operation: "semantic.calculate", workspaceId, durationMs: performance.now() - started, rowsRead, rowsWritten, resultCount: rowsWritten, reusedResult, errorCode: failure, evidenceCount, findingCount: rowsWritten, insufficientEvidenceCount }); }
  }
  function list(query = {}) {
    const started = performance.now(), workspaceId = requireWorkspaceId(); let resultCount = 0, failure = null;
    try {
      const limit = Number(query.limit || 50); if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new SemanticIntelligenceError("limit must be between 1 and 100.");
      const filters = { limit };
      for (const field of ["semanticType", "state", "subjectType", "subjectKey", "contextVersionId"]) if (query[field] !== undefined) filters[field] = text(query[field], field);
      for (const field of ["from", "to"]) if (query[field] !== undefined) filters[field] = iso(query[field], field);
      try { filters.cursor = decodeCursor(query.cursor, "semantic_findings", ["calculatedAt", "id"]); } catch (error) { if (error instanceof CursorPaginationError) throw new SemanticIntelligenceError(error.message, 400, error.code); throw error; }
      const page = repository.listPage(filters); resultCount = page.items.length; return page;
    } catch (error) { failure = error.code || "UNEXPECTED_ERROR"; throw error; }
    finally { operationMetrics.record({ operation: "semantic.findings.list", workspaceId, durationMs: performance.now() - started, rowsRead: resultCount, rowsWritten: 0, resultCount, errorCode: failure }); }
  }
  function get(id) {
    const started = performance.now(), workspaceId = requireWorkspaceId(); let found = null, failure = null;
    try { found = repository.getById(text(id, "findingId")); if (!found) throw new SemanticIntelligenceError("Semantic Finding not found.", 404, "SEMANTIC_FINDING_NOT_FOUND"); return found; }
    catch (error) { failure = error.code || "UNEXPECTED_ERROR"; throw error; }
    finally { operationMetrics.record({ operation: "semantic.finding.get", workspaceId, durationMs: performance.now() - started, rowsRead: found ? 1 : 0, rowsWritten: 0, resultCount: found ? 1 : 0, errorCode: failure }); }
  }
  return Object.freeze({ calculate, list, get, operationMeasurements: operationMetrics.recent });
}
