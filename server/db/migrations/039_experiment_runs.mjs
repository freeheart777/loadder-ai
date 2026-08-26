export const migration039ExperimentRuns = {
  version: 39,
  name: "experiment_runs",

  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS experiment_runs(
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        experiment_id TEXT NOT NULL,
        context_version_id TEXT NOT NULL,
        run_number INTEGER NOT NULL,
        status TEXT NOT NULL
          CHECK(status IN('PLANNED','RUNNING','COMPLETED','FAILED','CANCELLED'))
          DEFAULT 'PLANNED',
        started_at TEXT,
        completed_at TEXT,
        outcome_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(experiment_id) REFERENCES experiments(id),
        FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),

        UNIQUE(workspace_id, experiment_id, run_number)
      );

      CREATE INDEX IF NOT EXISTS idx_experiment_runs_page
        ON experiment_runs(workspace_id, experiment_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_experiment_runs_status
        ON experiment_runs(workspace_id, status, created_at DESC, id DESC);

      CREATE TRIGGER IF NOT EXISTS trg_experiment_runs_insert_guard
      BEFORE INSERT ON experiment_runs
      BEGIN
        SELECT CASE WHEN NOT EXISTS(
          SELECT 1
          FROM experiments e
          WHERE e.id = NEW.experiment_id
            AND e.workspace_id = NEW.workspace_id
            AND e.context_version_id = NEW.context_version_id
        )
        THEN RAISE(ABORT, 'experiment run identity mismatch')
        END;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_experiment_runs_update_identity
      BEFORE UPDATE ON experiment_runs
      BEGIN
        SELECT CASE
          WHEN OLD.workspace_id <> NEW.workspace_id
            OR OLD.experiment_id <> NEW.experiment_id
            OR OLD.context_version_id <> NEW.context_version_id
            OR OLD.run_number <> NEW.run_number
          THEN RAISE(ABORT, 'experiment run identity is immutable')
        END;
      END;
    `);
  }
};
