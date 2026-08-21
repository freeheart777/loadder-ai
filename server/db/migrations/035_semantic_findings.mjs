export const migration035SemanticFindings = { version: 35, name: "semantic_findings", up(db) { db.exec(`
CREATE TABLE IF NOT EXISTS semantic_findings(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  semantic_type TEXT NOT NULL,
  semantic_version INTEGER NOT NULL CHECK(semantic_version>0),
  schema_version INTEGER NOT NULL CHECK(schema_version>0),
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  subject_key TEXT NOT NULL,
  state TEXT NOT NULL,
  value_json TEXT CHECK(value_json IS NULL OR json_valid(value_json)),
  evidence_manifest_json TEXT NOT NULL CHECK(json_valid(evidence_manifest_json) AND json_type(evidence_manifest_json)='array'),
  evidence_manifest_hash TEXT NOT NULL,
  evidence_count INTEGER NOT NULL CHECK(evidence_count>=0),
  context_version_id TEXT,
  context_state TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  point_in_time_cutoff TEXT NOT NULL,
  producer TEXT NOT NULL,
  producer_version TEXT NOT NULL,
  producer_key TEXT NOT NULL,
  confidence REAL CHECK(confidence IS NULL OR(confidence>=0 AND confidence<=1)),
  confidence_reason TEXT NOT NULL,
  provenance_json TEXT NOT NULL CHECK(json_valid(provenance_json)),
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,producer,producer_version,producer_key),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_semantic_findings_page ON semantic_findings(workspace_id,calculated_at DESC,id DESC);

CREATE TRIGGER IF NOT EXISTS trg_semantic_findings_insert_guard BEFORE INSERT ON semantic_findings BEGIN
  SELECT CASE WHEN NEW.context_version_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM business_context_versions c WHERE c.id=NEW.context_version_id AND c.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'cross-workspace semantic context') END;
  SELECT CASE WHEN NEW.evidence_count != json_array_length(NEW.evidence_manifest_json)
    THEN RAISE(ABORT,'semantic evidence count mismatch') END;
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.evidence_manifest_json) e
    WHERE json_extract(e.value,'$.kind') NOT IN(
      'normalized_observation','derived_signal','feature_value','listening_aggregate',
      'listening_topic_match','listening_trend_signal','listening_anomaly_result'
    ) OR typeof(json_extract(e.value,'$.id'))!='text'
  ) THEN RAISE(ABORT,'unsupported semantic evidence') END;
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.evidence_manifest_json) e WHERE
      (json_extract(e.value,'$.kind')='normalized_observation' AND NOT EXISTS(SELECT 1 FROM normalized_observations x WHERE x.id=json_extract(e.value,'$.id') AND x.workspace_id=NEW.workspace_id)) OR
      (json_extract(e.value,'$.kind')='derived_signal' AND NOT EXISTS(SELECT 1 FROM derived_signals x WHERE x.id=json_extract(e.value,'$.id') AND x.workspace_id=NEW.workspace_id)) OR
      (json_extract(e.value,'$.kind')='feature_value' AND NOT EXISTS(SELECT 1 FROM feature_values x WHERE x.id=json_extract(e.value,'$.id') AND x.workspace_id=NEW.workspace_id)) OR
      (json_extract(e.value,'$.kind')='listening_aggregate' AND NOT EXISTS(SELECT 1 FROM listening_aggregates x WHERE x.id=json_extract(e.value,'$.id') AND x.workspace_id=NEW.workspace_id)) OR
      (json_extract(e.value,'$.kind')='listening_topic_match' AND NOT EXISTS(SELECT 1 FROM listening_topic_matches x WHERE x.id=json_extract(e.value,'$.id') AND x.workspace_id=NEW.workspace_id)) OR
      (json_extract(e.value,'$.kind')='listening_trend_signal' AND NOT EXISTS(SELECT 1 FROM listening_trend_signals x WHERE x.id=json_extract(e.value,'$.id') AND x.workspace_id=NEW.workspace_id)) OR
      (json_extract(e.value,'$.kind')='listening_anomaly_result' AND NOT EXISTS(SELECT 1 FROM listening_anomaly_results x WHERE x.id=json_extract(e.value,'$.id') AND x.workspace_id=NEW.workspace_id))
  ) THEN RAISE(ABORT,'cross-workspace semantic evidence') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_findings_update BEFORE UPDATE ON semantic_findings BEGIN SELECT RAISE(ABORT,'semantic findings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_semantic_findings_delete BEFORE DELETE ON semantic_findings BEGIN SELECT RAISE(ABORT,'semantic findings are immutable'); END;
`); } };
