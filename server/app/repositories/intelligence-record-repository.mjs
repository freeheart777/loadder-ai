import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";

function parseJson(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function observation(row) {
  if (!row) return null;
  return {
    id: row.id, observationType: row.observation_type, observationVersion: row.observation_version,
    subjectType: row.subject_type, subjectId: row.subject_id, contextVersionId: row.context_version_id,
    windowStart: row.window_start, windowEnd: row.window_end, valueType: row.value_type,
    numericValue: row.numeric_value, textValue: row.text_value,
    booleanValue: row.boolean_value === null ? null : Boolean(row.boolean_value),
    jsonValue: row.json_value ? parseJson(row.json_value, null) : null,
    sourceEventCount: row.source_event_count, sourceManifest: parseJson(row.source_manifest_json, {}),
    calculatedAt: row.calculated_at, validUntil: row.valid_until,
    producer: row.producer, producerVersion: row.producer_version,
  };
}
function signal(row) {
  if (!row) return null;
  return {
    id: row.id, signalType: row.signal_type, signalVersion: row.signal_version,
    subjectType: row.subject_type, subjectId: row.subject_id, contextVersionId: row.context_version_id,
    state: row.state, score: row.score, confidence: row.confidence, severity: row.severity,
    observedAt: row.observed_at, validUntil: row.valid_until,
    producer: row.producer, producerVersion: row.producer_version,
    sourceObservationIds: parseJson(row.source_observation_ids, []),
    provenance: parseJson(row.provenance_json, {}), lifecycleStatus: row.lifecycle_status,
    createdAt: row.created_at,
  };
}

export function createIntelligenceRecordRepository(db) {
  function getObservationByProducerKey(producer, version, key) {
    return observation(db.prepare(`SELECT * FROM normalized_observations
      WHERE workspace_id=? AND producer=? AND producer_version=? AND producer_key=?`)
      .get(requireWorkspaceId(), producer, version, key));
  }
  function createObservation(input) {
    const existing = getObservationByProducerKey(input.producer, input.producerVersion, input.producerKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO normalized_observations (
      id,workspace_id,observation_type,observation_version,subject_type,subject_id,
      context_version_id,window_start,window_end,value_type,numeric_value,text_value,
      boolean_value,json_value,source_event_count,source_manifest_json,calculated_at,
      valid_until,producer,producer_version,producer_key
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, requireWorkspaceId(), input.observationType, input.observationVersion,
      input.subjectType, input.subjectId, input.contextVersionId, input.windowStart,
      input.windowEnd, input.valueType, input.numericValue ?? null, input.textValue ?? null,
      input.booleanValue === undefined ? null : Number(input.booleanValue),
      input.jsonValue === undefined ? null : JSON.stringify(input.jsonValue),
      input.sourceEventCount, JSON.stringify(input.sourceManifest), input.calculatedAt,
      input.validUntil, input.producer, input.producerVersion, input.producerKey
    );
    return getObservationByProducerKey(input.producer, input.producerVersion, input.producerKey);
  }
  function getSignalByProducerKey(producer, version, key) {
    return signal(db.prepare(`SELECT * FROM derived_signals
      WHERE workspace_id=? AND producer=? AND producer_version=? AND producer_key=?`)
      .get(requireWorkspaceId(), producer, version, key));
  }
  function createSignal(input) {
    const existing = getSignalByProducerKey(input.producer, input.producerVersion, input.producerKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO derived_signals (
      id,workspace_id,signal_type,signal_version,subject_type,subject_id,
      context_version_id,state,score,confidence,severity,observed_at,valid_until,
      producer,producer_version,producer_key,source_observation_ids,provenance_json,
      lifecycle_status,created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?)`).run(
      id, requireWorkspaceId(), input.signalType, input.signalVersion, input.subjectType,
      input.subjectId, input.contextVersionId, input.state, input.score, input.confidence,
      input.severity, input.observedAt, input.validUntil, input.producer,
      input.producerVersion, input.producerKey, JSON.stringify(input.sourceObservationIds),
      JSON.stringify(input.provenance), input.createdAt
    );
    return getSignalByProducerKey(input.producer, input.producerVersion, input.producerKey);
  }
  function list(table, mapper, filters) {
    const typeColumn = table === "normalized_observations" ? "observation_type" : "signal_type";
    const timeColumn = table === "normalized_observations" ? "calculated_at" : "observed_at";
    const clauses = ["workspace_id=?"];
    const values = [requireWorkspaceId()];
    if (filters.type) { clauses.push(`${typeColumn}=?`); values.push(filters.type); }
    if (filters.subjectType) { clauses.push("subject_type=?"); values.push(filters.subjectType); }
    if (filters.subjectId) { clauses.push("subject_id=?"); values.push(filters.subjectId); }
    if (filters.lifecycleStatus && table === "derived_signals") {
      clauses.push("lifecycle_status=?"); values.push(filters.lifecycleStatus);
    }
    values.push(filters.limit);
    return db.prepare(`SELECT * FROM ${table} WHERE ${clauses.join(" AND ")}
      ORDER BY ${timeColumn} DESC LIMIT ?`).all(...values).map(mapper);
  }
  return {
    transaction: (work) => db.transaction(work)(),
    createObservation, createSignal,
    listObservations: (filters) => list("normalized_observations", observation, filters),
    listSignals: (filters) => list("derived_signals", signal, filters),
  };
}
