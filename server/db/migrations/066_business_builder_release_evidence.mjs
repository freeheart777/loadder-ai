export const migration066BusinessBuilderReleaseEvidence={version:66,name:"business_builder_release_evidence",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS business_builder_release_evidence(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  release_sha TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('full_gate','backup_restore','canary','rollback')),
  status TEXT NOT NULL CHECK(status IN ('passed','failed')),
  details_json TEXT NOT NULL DEFAULT '{}',
  recorded_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,project_id,version_id,release_sha,evidence_type),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(version_id) REFERENCES business_builder_versions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bb_release_evidence_lookup ON business_builder_release_evidence(workspace_id,project_id,version_id,release_sha,created_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_bb_release_evidence_insert_tenant_guard
BEFORE INSERT ON business_builder_release_evidence
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_builder_projects p
    WHERE p.id=NEW.project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'release evidence project workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_builder_versions v
    WHERE v.id=NEW.version_id AND v.project_id=NEW.project_id AND v.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'release evidence version project workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bb_release_evidence_immutable_update
BEFORE UPDATE ON business_builder_release_evidence
BEGIN SELECT RAISE(ABORT,'release evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bb_release_evidence_immutable_delete
BEFORE DELETE ON business_builder_release_evidence
BEGIN SELECT RAISE(ABORT,'release evidence is immutable'); END;
`);}};
