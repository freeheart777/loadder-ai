export const migration013BusinessContextUsage = {
  version: 13,
  name: "business_context_usage",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_context_usage (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        context_version_id TEXT NOT NULL,
        user_id TEXT,
        consumer TEXT NOT NULL CHECK (length(consumer) BETWEEN 1 AND 100),
        operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 120),
        execution_request_id TEXT CHECK (
          execution_request_id IS NULL OR length(execution_request_id) BETWEEN 1 AND 200
        ),
        created_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_context_usage_workspace_created
        ON business_context_usage(workspace_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_context_usage_context
        ON business_context_usage(context_version_id);
      CREATE INDEX IF NOT EXISTS idx_context_usage_consumer_operation
        ON business_context_usage(consumer, operation);
      CREATE INDEX IF NOT EXISTS idx_context_usage_execution_request
        ON business_context_usage(execution_request_id)
        WHERE execution_request_id IS NOT NULL;

      CREATE TRIGGER IF NOT EXISTS trg_context_usage_workspace_insert
      BEFORE INSERT ON business_context_usage
      WHEN NOT EXISTS (
        SELECT 1 FROM business_context_versions context
        WHERE context.id = NEW.context_version_id
          AND context.workspace_id = NEW.workspace_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid or cross-workspace Business Context usage');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_context_usage_immutable
      BEFORE UPDATE ON business_context_usage
      BEGIN
        SELECT RAISE(ABORT, 'Business Context usage records are immutable');
      END;
    `);
  },
};
