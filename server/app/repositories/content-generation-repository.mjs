import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

function parse(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
const map = (row) => row && Object.freeze({
  generationId: row.id,
  userId: row.user_id,
  mediaType: row.media_type,
  contractId: row.contract_id,
  contractVersion: row.contract_version,
  placementId: row.placement_id,
  placementVersion: row.placement_version,
  contextVersionId: row.context_version_id,
  intentId: row.intent_id ?? null,
  templateVersion: row.template_version,
  providerBinding: row.provider_binding,
  providerBindingVersion: row.provider_binding_version,
  providerModel: row.provider_model,
  briefHash: row.brief_hash,
  requestFingerprint: row.request_fingerprint,
  requestHash: row.request_hash,
  status: row.status,
  variants: row.normalized_result_json ? parse(row.normalized_result_json, { variants: [] }).variants : null,
  inputTokens: row.input_tokens,
  outputTokens: row.output_tokens,
  estimatedCostMinor: row.estimated_cost_minor,
  costCurrency: row.cost_currency,
  errorCode: row.error_code,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});

export function createContentGenerationRepository(db) {
  const hasIntent = Boolean(db.prepare("SELECT 1 FROM pragma_table_info('content_generations') WHERE name='intent_id'").get());
  const workspace = () => requireWorkspaceId();
  const findById = (id) => map(db.prepare("SELECT * FROM content_generations WHERE id=? AND workspace_id=?").get(id, workspace()));
  const findByIdempotency = (userId, key) => map(db.prepare(`SELECT * FROM content_generations
    WHERE workspace_id=? AND user_id=? AND operation_kind='content.generate' AND idempotency_key=?`).get(workspace(), userId, key));
  function create(input) {
    const id = crypto.randomUUID();
    try {
      db.prepare(`INSERT INTO content_generations(
        id,workspace_id,user_id,media_type,contract_id,contract_version,placement_id,placement_version,
        context_version_id,template_version,provider_binding,provider_binding_version,provider_model,
        brief_hash,request_fingerprint,operation_kind,idempotency_key,request_hash,status,normalized_result_json,
        input_tokens,output_tokens,estimated_cost_minor,cost_currency,error_code,created_at,completed_at${hasIntent ? ",intent_id" : ""}
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'content.generate',?,?,?,?,?,?,?,?,?,?,?${hasIntent ? ",?" : ""})`).run(
        id, workspace(), input.userId, input.mediaType, input.contractId, input.contractVersion,
        input.placementId, input.placementVersion, input.contextVersionId, input.templateVersion,
        input.providerBinding, input.providerBindingVersion, input.providerModel, input.briefHash,
        input.requestFingerprint, input.idempotencyKey, input.requestHash, input.status,
        input.normalizedResult ? JSON.stringify(input.normalizedResult) : null, input.inputTokens,
        input.outputTokens, input.estimatedCostMinor, input.costCurrency, input.errorCode,
        input.createdAt, input.completedAt, ...(hasIntent ? [input.intentId ?? null] : [])
      );
      return { generation: map(db.prepare("SELECT * FROM content_generations WHERE id=? AND workspace_id=?").get(id, workspace())), created: true };
    } catch (error) {
      const winner = findByIdempotency(input.userId, input.idempotencyKey);
      if (winner) return { generation: winner, created: false };
      throw error;
    }
  }
  function listPage({ limit, cursor }) {
    const values = [workspace()];
    let where = "workspace_id=?";
    if (cursor) { where += " AND (created_at<? OR(created_at=? AND id<?))"; values.push(cursor.createdAt, cursor.createdAt, cursor.id); }
    values.push(limit + 1);
    const rows = db.prepare(`SELECT * FROM content_generations WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(map);
    return pageResult(rows, limit, "content_generations", (item) => ({ createdAt: item.createdAt, id: item.generationId }));
  }
  return Object.freeze({ findById, findByIdempotency, create, listPage });
}
