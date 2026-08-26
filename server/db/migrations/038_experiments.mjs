export const migration038Experiments = {
  version: 38,
  name: "experiments",
  up(db) { db.exec(`
CREATE TABLE IF NOT EXISTS experiments(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  context_version_id TEXT NOT NULL,
  hypothesis TEXT NOT NULL CHECK(length(trim(hypothesis))>0),
  objective TEXT NOT NULL CHECK(length(trim(objective))>0),
  success_metric TEXT NOT NULL CHECK(length(trim(success_metric))>0),
  baseline_value REAL,
  treatment_definition TEXT NOT NULL CHECK(length(trim(treatment_definition))>0),
  status TEXT NOT NULL CHECK(status IN('DRAFT','READY','RUNNING','COMPLETED','CANCELLED')) DEFAULT 'DRAFT',
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(decision_id) REFERENCES decision_records(id),
  FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
  UNIQUE(workspace_id,decision_id)
);
CREATE INDEX IF NOT EXISTS idx_experiments_page ON experiments(workspace_id,status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_decision ON experiments(workspace_id,decision_id);

CREATE TRIGGER IF NOT EXISTS trg_experiments_insert_guard BEFORE INSERT ON experiments BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM decision_records d
    WHERE d.id=NEW.decision_id
      AND d.workspace_id=NEW.workspace_id
      AND d.context_version_id=NEW.context_version_id
  ) THEN RAISE(ABORT,'experiment decision identity mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_experiments_update BEFORE UPDATE ON experiments BEGIN
  SELECT CASE WHEN OLD.workspace_id<>NEW.workspace_id OR OLD.decision_id<>NEW.decision_id OR OLD.context_version_id<>NEW.context_version_id THEN RAISE(ABORT,'experiment identity is immutable') END;
END;
`); }
};
