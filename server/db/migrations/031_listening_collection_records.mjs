export const migration031ListeningCollectionRecords = {
  version: 31,
  name: "listening_collection_records",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS listening_collection_runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        monitor_version_id TEXT NOT NULL,
        source_definition_id TEXT NOT NULL,
        source_definition_version INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','RATE_LIMITED','FAILED')),
        cursor_before_json TEXT NOT NULL DEFAULT '{}',
        cursor_after_json TEXT NOT NULL DEFAULT '{}',
        items_discovered INTEGER NOT NULL DEFAULT 0 CHECK(items_discovered >= 0),
        items_accepted INTEGER NOT NULL DEFAULT 0 CHECK(items_accepted >= 0),
        items_deduplicated INTEGER NOT NULL DEFAULT 0 CHECK(items_deduplicated >= 0),
        items_rejected INTEGER NOT NULL DEFAULT 0 CHECK(items_rejected >= 0),
        rate_limit_state_json TEXT NOT NULL DEFAULT '{}',
        error_summary_json TEXT NOT NULL DEFAULT '[]',
        provenance_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(monitor_version_id) REFERENCES listening_monitor_versions(id),
        CHECK(json_valid(cursor_before_json) AND json_valid(cursor_after_json) AND json_valid(rate_limit_state_json) AND json_valid(error_summary_json) AND json_valid(provenance_json))
      );
      CREATE INDEX IF NOT EXISTS idx_listening_runs_workspace_time ON listening_collection_runs(workspace_id,started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_listening_runs_monitor ON listening_collection_runs(workspace_id,monitor_version_id,started_at DESC);

      CREATE TABLE IF NOT EXISTS canonical_listening_records (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        monitor_version_id TEXT NOT NULL,
        collection_run_id TEXT NOT NULL,
        canonical_type TEXT NOT NULL CHECK(canonical_type IN ('web_document','news_article','social_post','social_comment','social_mention','review','engagement_metric')),
        schema_version TEXT NOT NULL,
        source_category TEXT NOT NULL CHECK(source_category IN ('WEB','SOCIAL')),
        provider TEXT NOT NULL,
        external_object_id TEXT,
        identity_key TEXT NOT NULL,
        canonical_url TEXT,
        parent_external_id TEXT,
        author_external_reference TEXT,
        published_at TEXT,
        collected_at TEXT NOT NULL,
        language TEXT,
        locale TEXT,
        script_direction TEXT CHECK(script_direction IN ('rtl','ltr') OR script_direction IS NULL),
        region TEXT,
        title TEXT,
        normalized_text TEXT,
        content_hash TEXT,
        engagement_json TEXT NOT NULL DEFAULT '{}',
        source_metadata_json TEXT NOT NULL DEFAULT '{}',
        object_storage_reference TEXT,
        retention_class TEXT NOT NULL CHECK(retention_class IN ('EPHEMERAL_RAW','NORMALIZED_ONLY','COMPLIANCE_ARCHIVE','EXTERNAL_REFERENCE_ONLY')),
        retention_until TEXT,
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(workspace_id,provider,identity_key),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(monitor_version_id) REFERENCES listening_monitor_versions(id),
        FOREIGN KEY(collection_run_id) REFERENCES listening_collection_runs(id),
        CHECK(json_valid(engagement_json) AND json_valid(source_metadata_json) AND json_valid(provenance_json))
      );
      CREATE INDEX IF NOT EXISTS idx_listening_records_workspace_time ON canonical_listening_records(workspace_id,collected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_listening_records_workspace_published ON canonical_listening_records(workspace_id,published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_listening_records_filters ON canonical_listening_records(workspace_id,provider,canonical_type,source_category,language);
      CREATE INDEX IF NOT EXISTS idx_listening_records_monitor ON canonical_listening_records(workspace_id,monitor_version_id,collected_at DESC);
    `);
  },
};
