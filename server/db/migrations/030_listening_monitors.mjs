export const migration030ListeningMonitors = {
  version: 30,
  name: "listening_monitors",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS listening_monitors (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        monitor_type TEXT NOT NULL CHECK (monitor_type IN ('BRAND','COMPETITOR','PRODUCT','KEYWORD','INDUSTRY','REPUTATION','CUSTOM')),
        status TEXT NOT NULL CHECK (status IN ('ACTIVE','PAUSED','ARCHIVED')),
        created_by_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_listening_monitors_workspace ON listening_monitors(workspace_id,status,created_at DESC);

      CREATE TABLE IF NOT EXISTS listening_monitor_versions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        monitor_id TEXT NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        schema_version TEXT NOT NULL,
        keywords_json TEXT NOT NULL DEFAULT '[]',
        exact_phrases_json TEXT NOT NULL DEFAULT '[]',
        excluded_phrases_json TEXT NOT NULL DEFAULT '[]',
        brand_names_json TEXT NOT NULL DEFAULT '[]',
        competitor_names_json TEXT NOT NULL DEFAULT '[]',
        product_names_json TEXT NOT NULL DEFAULT '[]',
        domains_json TEXT NOT NULL DEFAULT '[]',
        source_categories_json TEXT NOT NULL,
        provider_filters_json TEXT NOT NULL DEFAULT '[]',
        languages_json TEXT NOT NULL DEFAULT '[]',
        regions_json TEXT NOT NULL DEFAULT '[]',
        author_filters_json TEXT NOT NULL DEFAULT '[]',
        collection_frequency TEXT NOT NULL,
        retention_class TEXT NOT NULL CHECK (retention_class IN ('EPHEMERAL_RAW','NORMALIZED_ONLY','COMPLIANCE_ARCHIVE','EXTERNAL_REFERENCE_ONLY')),
        retention_days INTEGER CHECK (retention_days IS NULL OR retention_days BETWEEN 1 AND 3650),
        max_records_per_run INTEGER NOT NULL CHECK (max_records_per_run BETWEEN 1 AND 1000),
        max_normalized_text_length INTEGER NOT NULL CHECK (max_normalized_text_length BETWEEN 100 AND 20000),
        provenance_json TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(workspace_id,monitor_id,version_number),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (monitor_id) REFERENCES listening_monitors(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id),
        CHECK(json_valid(keywords_json) AND json_valid(exact_phrases_json) AND json_valid(excluded_phrases_json) AND json_valid(brand_names_json) AND json_valid(competitor_names_json) AND json_valid(product_names_json) AND json_valid(domains_json) AND json_valid(source_categories_json) AND json_valid(provider_filters_json) AND json_valid(languages_json) AND json_valid(regions_json) AND json_valid(author_filters_json) AND json_valid(provenance_json))
      );
      CREATE INDEX IF NOT EXISTS idx_listening_monitor_versions ON listening_monitor_versions(workspace_id,monitor_id,version_number DESC);
    `);
  },
};
