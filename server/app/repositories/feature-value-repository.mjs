import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";

function parseJson(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function mapFeature(row) {
  if (!row) return null;
  const value = row.value_type === "numeric" ? row.numeric_value
    : row.value_type === "boolean" ? Boolean(row.boolean_value)
      : row.value_type === "categorical" ? row.categorical_value
        : parseJson(row.json_value, null);
  return {
    id: row.id, featureName: row.feature_name, featureVersion: row.feature_version,
    subjectType: row.subject_type, subjectId: row.subject_id,
    contextVersionId: row.context_version_id, windowStart: row.window_start, windowEnd: row.window_end,
    valueType: row.value_type, value, calculatedAt: row.calculated_at, validUntil: row.valid_until,
    producer: row.producer, producerVersion: row.producer_version,
    sourceObservationIds: parseJson(row.source_observation_ids_json, []),
    sourceSignalIds: parseJson(row.source_signal_ids_json, []),
    provenance: parseJson(row.provenance_json, {}), createdAt: row.created_at,
  };
}

export function createFeatureValueRepository(db) {
  function getById(id) {
    return mapFeature(db.prepare("SELECT * FROM feature_values WHERE id=? AND workspace_id=?")
      .get(id, requireWorkspaceId()));
  }
  function getByProducerKey(producer, producerVersion, producerKey) {
    return mapFeature(db.prepare(`SELECT * FROM feature_values
      WHERE workspace_id=? AND producer=? AND producer_version=? AND producer_key=?`)
      .get(requireWorkspaceId(), producer, producerVersion, producerKey));
  }
  function create(input) {
    const existing = getByProducerKey(input.producer, input.producerVersion, input.producerKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    const typed = {
      numeric: [input.value, null, null, null],
      boolean: [null, Number(input.value), null, null],
      categorical: [null, null, input.value, null],
      json: [null, null, null, JSON.stringify(input.value)],
    }[input.valueType];
    try {
      db.prepare(`INSERT INTO feature_values (
        id,workspace_id,feature_name,feature_version,subject_type,subject_id,
        context_version_id,window_start,window_end,value_type,numeric_value,boolean_value,
        categorical_value,json_value,calculated_at,valid_until,producer,producer_version,
        producer_key,source_observation_ids_json,source_signal_ids_json,provenance_json,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, requireWorkspaceId(), input.featureName, input.featureVersion, input.subjectType,
        input.subjectId, input.contextVersionId, input.windowStart, input.windowEnd,
        input.valueType, ...typed, input.calculatedAt, input.validUntil, input.producer,
        input.producerVersion, input.producerKey, JSON.stringify(input.sourceObservationIds),
        JSON.stringify(input.sourceSignalIds), JSON.stringify(input.provenance), input.createdAt
      );
      return getById(id);
    } catch (error) {
      const concurrent = getByProducerKey(input.producer, input.producerVersion, input.producerKey);
      if (concurrent && String(error.code || "").startsWith("SQLITE_CONSTRAINT")) return concurrent;
      throw error;
    }
  }
  function list(filters) {
    const clauses = ["workspace_id=?"];
    const values = [requireWorkspaceId()];
    for (const [column, value] of [
      ["feature_name", filters.featureName], ["subject_type", filters.subjectType],
      ["subject_id", filters.subjectId], ["context_version_id", filters.contextVersionId],
    ]) if (value) { clauses.push(`${column}=?`); values.push(value); }
    if (filters.freshOnly) {
      clauses.push("(valid_until IS NULL OR valid_until > ?)"); values.push(filters.now);
    }
    values.push(filters.limit);
    return db.prepare(`SELECT * FROM feature_values WHERE ${clauses.join(" AND ")}
      ORDER BY calculated_at DESC, feature_name ASC LIMIT ?`).all(...values).map(mapFeature);
  }
  function listSubject(subjectType, subjectId) {
    const rows = db.prepare(`SELECT * FROM feature_values
      WHERE workspace_id=? AND subject_type=? AND subject_id=?
      ORDER BY calculated_at DESC`).all(requireWorkspaceId(), subjectType, subjectId).map(mapFeature);
    if (!rows.length) return [];
    const contextVersionId = rows[0].contextVersionId;
    const seen = new Set();
    return rows.filter((item) => {
      if (item.contextVersionId !== contextVersionId || seen.has(item.featureName)) return false;
      seen.add(item.featureName); return true;
    });
  }
  function listPointInTime(subjectType, subjectId, asOf) {
    return db.prepare(`SELECT * FROM feature_values
      WHERE workspace_id=? AND subject_type=? AND subject_id=? AND calculated_at<=?
      ORDER BY calculated_at DESC, created_at DESC`).all(
      requireWorkspaceId(), subjectType, subjectId, asOf
    ).map(mapFeature);
  }
  return { create, getById, list, listSubject, listPointInTime };
}
