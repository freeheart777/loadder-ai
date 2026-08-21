export const migration016FeatureValues = {
  version: 16,
  name: "feature_values",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS feature_values (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        feature_name TEXT NOT NULL,
        feature_version INTEGER NOT NULL CHECK (feature_version > 0),
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        context_version_id TEXT NOT NULL,
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        value_type TEXT NOT NULL CHECK (value_type IN ('numeric','boolean','categorical','json')),
        numeric_value REAL,
        boolean_value INTEGER CHECK (boolean_value IN (0,1) OR boolean_value IS NULL),
        categorical_value TEXT,
        json_value TEXT,
        calculated_at TEXT NOT NULL,
        valid_until TEXT,
        producer TEXT NOT NULL,
        producer_version TEXT NOT NULL,
        producer_key TEXT NOT NULL,
        source_observation_ids_json TEXT NOT NULL DEFAULT '[]',
        source_signal_ids_json TEXT NOT NULL DEFAULT '[]',
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, producer, producer_version, producer_key),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id),
        CHECK (window_end >= window_start),
        CHECK (
          (value_type='numeric' AND numeric_value IS NOT NULL AND boolean_value IS NULL AND categorical_value IS NULL AND json_value IS NULL) OR
          (value_type='boolean' AND numeric_value IS NULL AND boolean_value IS NOT NULL AND categorical_value IS NULL AND json_value IS NULL) OR
          (value_type='categorical' AND numeric_value IS NULL AND boolean_value IS NULL AND categorical_value IS NOT NULL AND json_value IS NULL) OR
          (value_type='json' AND numeric_value IS NULL AND boolean_value IS NULL AND categorical_value IS NULL AND json_value IS NOT NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS idx_feature_values_workspace_feature_subject
        ON feature_values(workspace_id, feature_name, subject_type, subject_id, calculated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_feature_values_workspace_subject
        ON feature_values(workspace_id, subject_type, subject_id, calculated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_feature_values_context
        ON feature_values(context_version_id);
      CREATE INDEX IF NOT EXISTS idx_feature_values_valid_until
        ON feature_values(workspace_id, valid_until);
      CREATE INDEX IF NOT EXISTS idx_feature_values_producer_key
        ON feature_values(workspace_id, producer, producer_version, producer_key);
      CREATE INDEX IF NOT EXISTS idx_feature_values_window
        ON feature_values(workspace_id, feature_name, window_start, window_end);
    `);
  },
};
