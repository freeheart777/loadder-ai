export const migration051BusinessBuilderRuntimeRecords = {
  version: 51,
  name: "business_builder_runtime_records",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_builder_runtime_records (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, app_id, entity_id, id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );
      CREATE INDEX IF NOT EXISTS idx_builder_runtime_entity ON business_builder_runtime_records(workspace_id, app_id, entity_id, updated_at DESC);
    `);
  },
};
