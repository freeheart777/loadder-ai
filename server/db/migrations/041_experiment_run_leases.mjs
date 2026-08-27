export const migration041ExperimentRunLeases = {
  version: 41,
  name: "experiment_run_leases",
  up(db) {
    db.exec(`
      ALTER TABLE experiment_runs ADD COLUMN lease_token TEXT;
      ALTER TABLE experiment_runs ADD COLUMN lease_expires_at TEXT;
      CREATE INDEX IF NOT EXISTS ix_experiment_runs_recovery
        ON experiment_runs(workspace_id, status, lease_expires_at);
    `);
  }
};
