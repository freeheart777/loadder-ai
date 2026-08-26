export const id = 38;
export const name = "experiments";

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      decision_id TEXT NOT NULL,
      context_version_id TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      objective TEXT NOT NULL,
      success_metric TEXT NOT NULL,
      baseline_value REAL,
      treatment_definition TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','READY','RUNNING','COMPLETED','CANCELLED')),
      starts_at TEXT,
      ends_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (decision_id) REFERENCES decision_records(id),
      FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id),
      UNIQUE (workspace_id, decision_id)
    );

    CREATE INDEX IF NOT EXISTS idx_experiments_workspace_status
      ON experiments(workspace_id, status, created_at DESC, id DESC);

    CREATE INDEX IF NOT EXISTS idx_experiments_workspace_decision
      ON experiments(workspace_id, decision_id);
  `);
}

export function down(db) {
  db.exec(`DROP TABLE IF EXISTS experiments;`);
}
