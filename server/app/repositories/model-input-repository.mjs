import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

function json(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function map(row) { return row ? {
  id: row.id, specificationId: row.specification_id, specificationVersion: row.specification_version,
  subjectType: row.subject_type, subjectId: row.subject_id, contextVersionId: row.context_version_id,
  snapshotSchemaVersion: row.snapshot_schema_version, asOf: row.as_of, status: row.status,
  featureValues: json(row.feature_values_json, {}), featureManifest: json(row.feature_manifest_json, []),
  missingFeatures: json(row.missing_features_json, []), expiredFeatures: json(row.expired_features_json, []),
  incompatibleFeatures: json(row.incompatible_features_json, []), unavailableFeatures: json(row.unavailable_features_json, []),
  builder: row.builder, builderVersion: row.builder_version, provenance: json(row.provenance_json, {}), createdAt: row.created_at,
} : null; }

export function createModelInputRepository(db) {
  const getById = (id) => map(db.prepare("SELECT * FROM model_input_snapshots WHERE id=? AND workspace_id=?").get(id, requireWorkspaceId()));
  const getByKey = (builder, version, key) => map(db.prepare(`SELECT * FROM model_input_snapshots
    WHERE workspace_id=? AND builder=? AND builder_version=? AND producer_key=?`).get(requireWorkspaceId(), builder, version, key));
  function create(input) {
    const existing = getByKey(input.builder, input.builderVersion, input.producerKey); if (existing) return existing;
    const id = crypto.randomUUID();
    try {
      db.prepare(`INSERT INTO model_input_snapshots (
        id,workspace_id,specification_id,specification_version,subject_type,subject_id,context_version_id,
        snapshot_schema_version,as_of,status,feature_values_json,feature_manifest_json,missing_features_json,
        expired_features_json,incompatible_features_json,unavailable_features_json,builder,builder_version,
        producer_key,provenance_json,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, requireWorkspaceId(), input.specificationId, input.specificationVersion, input.subjectType, input.subjectId,
        input.contextVersionId, input.snapshotSchemaVersion, input.asOf, input.status, JSON.stringify(input.featureValues),
        JSON.stringify(input.featureManifest), JSON.stringify(input.missingFeatures), JSON.stringify(input.expiredFeatures),
        JSON.stringify(input.incompatibleFeatures), JSON.stringify(input.unavailableFeatures), input.builder,
        input.builderVersion, input.producerKey, JSON.stringify(input.provenance), input.createdAt
      );
      return getById(id);
    } catch (error) {
      const concurrent = getByKey(input.builder, input.builderVersion, input.producerKey);
      if (concurrent && String(error.code || "").startsWith("SQLITE_CONSTRAINT")) return concurrent;
      throw error;
    }
  }
  function list({ specificationId, subjectType, subjectId, status, limit }) {
    const clauses=["workspace_id=?"], values=[requireWorkspaceId()];
    for (const [column,value] of [["specification_id",specificationId],["subject_type",subjectType],["subject_id",subjectId],["status",status]])
      if (value) { clauses.push(`${column}=?`); values.push(value); }
    values.push(limit); return db.prepare(`SELECT * FROM model_input_snapshots WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).all(...values).map(map);
  }
  return { create, getById, list };
}
