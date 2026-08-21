export const migration018ModelInputSnapshots = {
  version: 18,
  name: "model_input_snapshots",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_input_snapshots (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        specification_id TEXT NOT NULL,
        specification_version INTEGER NOT NULL CHECK (specification_version > 0),
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        context_version_id TEXT NOT NULL,
        snapshot_schema_version TEXT NOT NULL,
        as_of TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ready','incomplete','incompatible')),
        feature_values_json TEXT NOT NULL DEFAULT '{}',
        feature_manifest_json TEXT NOT NULL DEFAULT '[]',
        missing_features_json TEXT NOT NULL DEFAULT '[]',
        expired_features_json TEXT NOT NULL DEFAULT '[]',
        incompatible_features_json TEXT NOT NULL DEFAULT '[]',
        unavailable_features_json TEXT NOT NULL DEFAULT '[]',
        builder TEXT NOT NULL,
        builder_version TEXT NOT NULL,
        producer_key TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, builder, builder_version, producer_key),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id),
        CHECK (json_valid(feature_values_json)),
        CHECK (json_valid(feature_manifest_json)),
        CHECK (json_valid(missing_features_json)),
        CHECK (json_valid(expired_features_json)),
        CHECK (json_valid(incompatible_features_json)),
        CHECK (json_valid(unavailable_features_json)),
        CHECK (json_valid(provenance_json))
      );

      CREATE INDEX IF NOT EXISTS idx_model_inputs_workspace_spec_subject
        ON model_input_snapshots(workspace_id, specification_id, specification_version, subject_type, subject_id, as_of DESC);
      CREATE INDEX IF NOT EXISTS idx_model_inputs_workspace_subject
        ON model_input_snapshots(workspace_id, subject_type, subject_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_model_inputs_context ON model_input_snapshots(context_version_id);
      CREATE INDEX IF NOT EXISTS idx_model_inputs_status ON model_input_snapshots(workspace_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_model_inputs_producer_key
        ON model_input_snapshots(workspace_id, builder, builder_version, producer_key);
    `);
  },
};
