export const migration036IntelligenceRecommendations = { version: 36, name: "intelligence_recommendations", up(db) { db.exec(`
CREATE TABLE IF NOT EXISTS intelligence_recommendations(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  recommendation_version INTEGER NOT NULL CHECK(recommendation_version>0),
  schema_version INTEGER NOT NULL CHECK(schema_version>0),
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  subject_key TEXT NOT NULL,
  consideration_code TEXT NOT NULL,
  rationale_code TEXT NOT NULL,
  review_priority TEXT NOT NULL CHECK(review_priority IN('LOW','MEDIUM','HIGH')),
  semantic_manifest_json TEXT NOT NULL CHECK(json_valid(semantic_manifest_json) AND json_type(semantic_manifest_json)='array'),
  semantic_manifest_hash TEXT NOT NULL,
  semantic_finding_count INTEGER NOT NULL CHECK(semantic_finding_count>=0 AND semantic_finding_count=json_array_length(semantic_manifest_json)),
  context_version_id TEXT NOT NULL,
  point_in_time_cutoff TEXT NOT NULL,
  producer TEXT NOT NULL,
  producer_version TEXT NOT NULL,
  producer_key TEXT NOT NULL,
  confidence REAL CHECK(confidence IS NULL OR(confidence>=0 AND confidence<=1)),
  confidence_reason TEXT NOT NULL,
  provenance_json TEXT NOT NULL CHECK(json_valid(provenance_json)),
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,producer,producer_version,producer_key),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_intelligence_recommendations_page ON intelligence_recommendations(workspace_id,calculated_at DESC,id DESC);

CREATE TRIGGER IF NOT EXISTS trg_intelligence_recommendations_insert_guard BEFORE INSERT ON intelligence_recommendations BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_context_versions c WHERE c.id=NEW.context_version_id AND c.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'recommendation context workspace mismatch') END;
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.semantic_manifest_json) e
    WHERE json_type(e.value)!='object'
      OR typeof(json_extract(e.value,'$.id'))!='text'
      OR typeof(json_extract(e.value,'$.semanticType'))!='text'
      OR typeof(json_extract(e.value,'$.semanticVersion'))!='integer'
      OR typeof(json_extract(e.value,'$.schemaVersion'))!='integer'
      OR typeof(json_extract(e.value,'$.producer'))!='text'
      OR typeof(json_extract(e.value,'$.producerVersion'))!='text'
      OR typeof(json_extract(e.value,'$.state'))!='text'
      OR typeof(json_extract(e.value,'$.contextVersionId'))!='text'
      OR typeof(json_extract(e.value,'$.pointInTimeCutoff'))!='text'
      OR EXISTS(SELECT 1 FROM json_each(e.value) f WHERE f.key NOT IN('id','semanticType','semanticVersion','schemaVersion','producer','producerVersion','state','contextVersionId','pointInTimeCutoff'))
  ) THEN RAISE(ABORT,'unsupported recommendation semantic manifest') END;
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.semantic_manifest_json) e
    WHERE NOT EXISTS(SELECT 1 FROM semantic_findings s WHERE s.id=json_extract(e.value,'$.id'))
  ) THEN RAISE(ABORT,'recommendation semantic finding missing') END;
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.semantic_manifest_json) e
    JOIN semantic_findings s ON s.id=json_extract(e.value,'$.id')
    WHERE s.workspace_id!=NEW.workspace_id
  ) THEN RAISE(ABORT,'recommendation semantic workspace mismatch') END;
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM json_each(NEW.semantic_manifest_json) e
    JOIN semantic_findings s ON s.id=json_extract(e.value,'$.id')
    WHERE s.context_version_id!=NEW.context_version_id
      OR s.semantic_type!=json_extract(e.value,'$.semanticType')
      OR s.semantic_version!=json_extract(e.value,'$.semanticVersion')
      OR s.schema_version!=json_extract(e.value,'$.schemaVersion')
      OR s.producer!=json_extract(e.value,'$.producer')
      OR s.producer_version!=json_extract(e.value,'$.producerVersion')
      OR s.state!=json_extract(e.value,'$.state')
      OR s.context_version_id!=json_extract(e.value,'$.contextVersionId')
      OR s.point_in_time_cutoff!=json_extract(e.value,'$.pointInTimeCutoff')
  ) THEN RAISE(ABORT,'recommendation semantic identity mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_intelligence_recommendations_update BEFORE UPDATE ON intelligence_recommendations BEGIN SELECT RAISE(ABORT,'intelligence recommendations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_intelligence_recommendations_delete BEFORE DELETE ON intelligence_recommendations BEGIN SELECT RAISE(ABORT,'intelligence recommendations are immutable'); END;
`); } };
