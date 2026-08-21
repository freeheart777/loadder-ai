import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const json = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const finding = (row) => row && ({
  id: row.id, semanticType: row.semantic_type, semanticVersion: row.semantic_version, schemaVersion: row.schema_version,
  subjectType: row.subject_type, subjectId: row.subject_id, subjectKey: row.subject_key, state: row.state,
  value: row.value_json ? json(row.value_json, null) : null, evidenceReferences: json(row.evidence_manifest_json, []),
  evidenceManifestHash: row.evidence_manifest_hash, evidenceCount: row.evidence_count,
  contextVersionId: row.context_version_id, contextState: row.context_state, calculatedAt: row.calculated_at,
  pointInTimeCutoff: row.point_in_time_cutoff, producer: row.producer, producerVersion: row.producer_version,
  confidence: row.confidence, confidenceReason: row.confidence_reason, provenance: json(row.provenance_json, {}), createdAt: row.created_at,
});
const aggregate = (row) => row && ({
  id: row.id, metricType: row.metric_type, metricVersion: row.metric_version, state: row.state,
  value: row.json_value ? json(row.json_value, null) : row.numeric_value, numerator: row.numerator, denominator: row.denominator,
  window: row.window_policy, windowStart: row.window_start, windowEnd: row.window_end,
  pointInTimeCutoff: row.point_in_time_cutoff, calculatedAt: row.calculated_at, contextVersionId: row.context_version_id,
  producer: row.producer, producerVersion: row.producer_version, provenance: json(row.provenance_json, {}),
});

export function createSemanticFindingRepository(db) {
  const workspace = () => requireWorkspaceId();
  const byKey = (producer, producerVersion, producerKey) => finding(db.prepare(`SELECT * FROM semantic_findings WHERE workspace_id=? AND producer=? AND producer_version=? AND producer_key=?`).get(workspace(), producer, producerVersion, producerKey));
  function listeningEvidence({ window, cutoff, semanticType }) {
    const mentionRow = db.prepare(`SELECT * FROM listening_aggregates WHERE workspace_id=? AND metric_type='mention_count' AND window_policy=? AND point_in_time_cutoff=? AND window_end<=? ORDER BY calculated_at DESC,id DESC LIMIT 1`).get(workspace(), window, cutoff, cutoff);
    if (!mentionRow) return null;
    const mention = aggregate(mentionRow);
    if (semanticType === "listening_attention_state") {
      const trend = db.prepare(`SELECT * FROM listening_trend_signals WHERE workspace_id=? AND current_aggregate_id=? AND window_end<=? ORDER BY calculated_at DESC,id DESC LIMIT 1`).get(workspace(), mention.id, cutoff);
      const anomaly = db.prepare(`SELECT * FROM listening_anomaly_results WHERE workspace_id=? AND aggregate_id=? ORDER BY calculated_at DESC,id DESC LIMIT 1`).get(workspace(), mention.id);
      return { mention, trend: trend && { id: trend.id, state: trend.state, signalVersion: trend.signal_version, windowStart: trend.window_start, windowEnd: trend.window_end, calculatedAt: trend.calculated_at, contextVersionId: trend.context_version_id, producer: trend.producer, producerVersion: trend.producer_version }, anomaly: anomaly && { id: anomaly.id, state: anomaly.state, methodVersion: anomaly.method_version, calculatedAt: anomaly.calculated_at, producer: "listening_anomaly", producerVersion: String(anomaly.method_version) } };
    }
    const peers = db.prepare(`SELECT * FROM listening_aggregates WHERE workspace_id=? AND window_policy=? AND window_start=? AND window_end=? AND point_in_time_cutoff=? AND context_version_id IS ? AND metric_type IN('share_of_voice','competitor_mention_count')`).all(workspace(), window, mention.windowStart, mention.windowEnd, cutoff, mention.contextVersionId).map(aggregate);
    return { mention, shareOfVoice: peers.find((item) => item.metricType === "share_of_voice") || null, competitorMentions: peers.find((item) => item.metricType === "competitor_mention_count") || null };
  }
  function create(input) {
    const existing = byKey(input.producer, input.producerVersion, input.producerKey);
    if (existing) return { finding: existing, created: false };
    const id = crypto.randomUUID();
    try {
      db.prepare(`INSERT INTO semantic_findings(id,workspace_id,semantic_type,semantic_version,schema_version,subject_type,subject_id,subject_key,state,value_json,evidence_manifest_json,evidence_manifest_hash,evidence_count,context_version_id,context_state,calculated_at,point_in_time_cutoff,producer,producer_version,producer_key,confidence,confidence_reason,provenance_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, workspace(), input.semanticType, input.semanticVersion, input.schemaVersion, input.subjectType, input.subjectId,
        input.subjectKey, input.state, input.value === null ? null : JSON.stringify(input.value), JSON.stringify(input.evidenceReferences),
        input.evidenceManifestHash, input.evidenceReferences.length, input.contextVersionId, input.contextState, input.calculatedAt,
        input.pointInTimeCutoff, input.producer, input.producerVersion, input.producerKey, input.confidence,
        input.confidenceReason, JSON.stringify(input.provenance), input.createdAt
      );
      return { finding: finding(db.prepare("SELECT * FROM semantic_findings WHERE id=? AND workspace_id=?").get(id, workspace())), created: true };
    } catch (error) {
      const winner = byKey(input.producer, input.producerVersion, input.producerKey);
      if (winner) return { finding: winner, created: false };
      throw error;
    }
  }
  function listPage(filters) {
    const clauses = ["workspace_id=?"], values = [workspace()];
    const columns = { semanticType: "semantic_type", state: "state", subjectType: "subject_type", subjectKey: "subject_key", contextVersionId: "context_version_id" };
    for (const [field, column] of Object.entries(columns)) if (filters[field]) { clauses.push(`${column}=?`); values.push(filters[field]); }
    if (filters.from) { clauses.push("calculated_at>=?"); values.push(filters.from); }
    if (filters.to) { clauses.push("calculated_at<=?"); values.push(filters.to); }
    if (filters.cursor) { clauses.push("(calculated_at<? OR(calculated_at=? AND id<?))"); values.push(filters.cursor.calculatedAt, filters.cursor.calculatedAt, filters.cursor.id); }
    values.push(filters.limit + 1);
    const rows = db.prepare(`SELECT * FROM semantic_findings WHERE ${clauses.join(" AND ")} ORDER BY calculated_at DESC,id DESC LIMIT ?`).all(...values).map(finding);
    return pageResult(rows, filters.limit, "semantic_findings", (item) => ({ calculatedAt: item.calculatedAt, id: item.id }));
  }
  return Object.freeze({ transaction: (work) => db.transaction(work)(), listeningEvidence, findByProducerKey: byKey, create, listPage, getById: (id) => finding(db.prepare("SELECT * FROM semantic_findings WHERE id=? AND workspace_id=?").get(id, workspace())) });
}
