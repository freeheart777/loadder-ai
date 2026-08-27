export const migration040ExperimentRunIdempotency = {
  version: 40,
  name: "experiment_run_idempotency",

  up(db) {
    db.exec(`
      ALTER TABLE experiment_runs ADD COLUMN idempotency_key TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS ux_experiment_runs_idempotency
        ON experiment_runs(workspace_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);
  }
};
