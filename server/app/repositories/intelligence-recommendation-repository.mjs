import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const map = (row) => row && ({
  id: row.id, recommendationType: row.recommendation_type, recommendationVersion: row.recommendation_version,
  schemaVersion: row.schema_version, subjectType: row.subject_type, subjectId: row.subject_id, subjectKey: row.subject_key,
  considerationCode: row.consideration_code, rationaleCode: row.rationale_code, reviewPriority: row.review_priority,
  semanticFindingReferences: parse(row.semantic_manifest_json, []), semanticManifestHash: row.semantic_manifest_hash,
  semanticFindingCount: row.semantic_finding_count, contextVersionId: row.context_version_id,
  pointInTimeCutoff: row.point_in_time_cutoff, producer: row.producer, producerVersion: row.producer_version,
  confidence: row.confidence, confidenceReason: row.confidence_reason, provenance: parse(row.provenance_json, {}),
  calculatedAt: row.calculated_at, createdAt: row.created_at,
});

export function createIntelligenceRecommendationRepository(db) {
  const workspace = () => requireWorkspaceId();
  const findByProducerKey = (producer, producerVersion, producerKey) => map(db.prepare(`SELECT * FROM intelligence_recommendations WHERE workspace_id=? AND producer=? AND producer_version=? AND producer_key=?`).get(workspace(), producer, producerVersion, producerKey));
  function create(input) {
    const existing = findByProducerKey(input.producer, input.producerVersion, input.producerKey);
    if (existing) return { recommendation: existing, created: false };
    const id = crypto.randomUUID();
    try {
      db.prepare(`INSERT INTO intelligence_recommendations(id,workspace_id,recommendation_type,recommendation_version,schema_version,subject_type,subject_id,subject_key,consideration_code,rationale_code,review_priority,semantic_manifest_json,semantic_manifest_hash,semantic_finding_count,context_version_id,point_in_time_cutoff,producer,producer_version,producer_key,confidence,confidence_reason,provenance_json,calculated_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, workspace(), input.recommendationType, input.recommendationVersion, input.schemaVersion, input.subjectType,
        input.subjectId, input.subjectKey, input.considerationCode, input.rationaleCode, input.reviewPriority,
        JSON.stringify(input.semanticFindingReferences), input.semanticManifestHash, input.semanticFindingReferences.length,
        input.contextVersionId, input.pointInTimeCutoff, input.producer, input.producerVersion, input.producerKey,
        input.confidence, input.confidenceReason, JSON.stringify(input.provenance), input.calculatedAt, input.createdAt
      );
      return { recommendation: map(db.prepare("SELECT * FROM intelligence_recommendations WHERE id=? AND workspace_id=?").get(id, workspace())), created: true };
    } catch (error) {
      const winner = findByProducerKey(input.producer, input.producerVersion, input.producerKey);
      if (winner) return { recommendation: winner, created: false };
      throw error;
    }
  }
  function listPage(filters) {
    const clauses = ["workspace_id=?"], values = [workspace()];
    const columns = { recommendationType: "recommendation_type", subjectType: "subject_type", subjectKey: "subject_key", contextVersionId: "context_version_id", reviewPriority: "review_priority" };
    for (const [field, column] of Object.entries(columns)) if (filters[field]) { clauses.push(`${column}=?`); values.push(filters[field]); }
    if (filters.from) { clauses.push("calculated_at>=?"); values.push(filters.from); }
    if (filters.to) { clauses.push("calculated_at<=?"); values.push(filters.to); }
    if (filters.cursor) { clauses.push("(calculated_at<? OR(calculated_at=? AND id<?))"); values.push(filters.cursor.calculatedAt, filters.cursor.calculatedAt, filters.cursor.id); }
    values.push(filters.limit + 1);
    const rows = db.prepare(`SELECT * FROM intelligence_recommendations WHERE ${clauses.join(" AND ")} ORDER BY calculated_at DESC,id DESC LIMIT ?`).all(...values).map(map);
    return pageResult(rows, filters.limit, "intelligence_recommendations", (item) => ({ calculatedAt: item.calculatedAt, id: item.id }));
  }
  function findNewerForIdentity(item) {
    return map(db.prepare(`SELECT * FROM intelligence_recommendations WHERE workspace_id=? AND recommendation_type=? AND subject_type=? AND subject_id IS ? AND subject_key=? AND (calculated_at>? OR(calculated_at=? AND id>?)) ORDER BY calculated_at DESC,id DESC LIMIT 1`).get(workspace(),item.recommendationType,item.subjectType,item.subjectId,item.subjectKey,item.calculatedAt,item.calculatedAt,item.id));
  }
  return Object.freeze({ findByProducerKey, create, listPage, findNewerForIdentity, getById: (id) => map(db.prepare("SELECT * FROM intelligence_recommendations WHERE id=? AND workspace_id=?").get(id, workspace())) });
}
