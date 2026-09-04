export const migration065BusinessBuilderPreviewQualityEvidence={version:65,name:"business_builder_preview_quality_evidence",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS business_builder_preview_quality_evidence(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  checks_json TEXT NOT NULL,
  recorded_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,project_id,version_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(version_id) REFERENCES business_builder_versions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bb_preview_quality_project ON business_builder_preview_quality_evidence(workspace_id,project_id,created_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_bb_preview_quality_insert_tenant_guard
BEFORE INSERT ON business_builder_preview_quality_evidence
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_builder_projects p
    WHERE p.id=NEW.project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'preview quality project workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_builder_versions v
    WHERE v.id=NEW.version_id AND v.project_id=NEW.project_id AND v.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'preview quality version project workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bb_preview_quality_immutable_update
BEFORE UPDATE ON business_builder_preview_quality_evidence
BEGIN SELECT RAISE(ABORT,'preview quality evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bb_preview_quality_immutable_delete
BEFORE DELETE ON business_builder_preview_quality_evidence
BEGIN SELECT RAISE(ABORT,'preview quality evidence is immutable'); END;
`);}};
