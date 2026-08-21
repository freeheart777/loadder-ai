export const migration019Evaluations = {
  version: 19,
  name: "statistical_evaluations",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        specification_id TEXT NOT NULL,
        specification_version INTEGER NOT NULL CHECK (specification_version > 0),
        input_snapshot_id TEXT NOT NULL,
        context_version_id TEXT NOT NULL,
        evaluator_id TEXT NOT NULL,
        evaluator_version TEXT NOT NULL,
        evaluation_schema_version TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('completed')),
        output_json TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        producer_key TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, evaluator_id, evaluator_version, producer_key),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (input_snapshot_id) REFERENCES model_input_snapshots(id),
        FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id),
        CHECK (json_valid(output_json)),
        CHECK (json_valid(metrics_json)),
        CHECK (json_valid(provenance_json))
      );

      CREATE INDEX IF NOT EXISTS idx_evaluations_workspace_spec
        ON evaluations(workspace_id, specification_id, specification_version, evaluated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_evaluations_input ON evaluations(input_snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_context ON evaluations(context_version_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_producer_key
        ON evaluations(workspace_id, evaluator_id, evaluator_version, producer_key);
    `);
  },
};
