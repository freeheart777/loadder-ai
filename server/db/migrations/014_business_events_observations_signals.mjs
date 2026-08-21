export const migration014BusinessEventsObservationsSignals = {
  version: 14,
  name: "business_events_observations_signals",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_version INTEGER NOT NULL CHECK (event_version > 0),
        occurred_at TEXT NOT NULL,
        ingested_at TEXT NOT NULL,
        actor_type TEXT,
        actor_id TEXT,
        subject_type TEXT,
        subject_id TEXT,
        source_type TEXT NOT NULL,
        source_id TEXT,
        channel TEXT,
        campaign_id TEXT,
        customer_id TEXT,
        session_id TEXT,
        correlation_id TEXT,
        causation_id TEXT,
        context_version_id TEXT,
        schema_version TEXT NOT NULL,
        idempotency_key TEXT,
        properties_json TEXT NOT NULL DEFAULT '{}',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_business_events_workspace_occurred
        ON business_events(workspace_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_business_events_workspace_ingested
        ON business_events(workspace_id, ingested_at DESC);
      CREATE INDEX IF NOT EXISTS idx_business_events_workspace_type_time
        ON business_events(workspace_id, event_type, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_business_events_workspace_customer_time
        ON business_events(workspace_id, customer_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_business_events_workspace_source
        ON business_events(workspace_id, source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_business_events_workspace_correlation
        ON business_events(workspace_id, correlation_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_business_events_idempotency
        ON business_events(workspace_id, source_type, COALESCE(source_id, ''), idempotency_key)
        WHERE idempotency_key IS NOT NULL;

      CREATE TABLE IF NOT EXISTS normalized_observations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        observation_type TEXT NOT NULL,
        observation_version INTEGER NOT NULL CHECK (observation_version > 0),
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        context_version_id TEXT NOT NULL,
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        value_type TEXT NOT NULL CHECK (value_type IN ('numeric','text','boolean','json')),
        numeric_value REAL,
        text_value TEXT,
        boolean_value INTEGER CHECK (boolean_value IN (0,1) OR boolean_value IS NULL),
        json_value TEXT,
        source_event_count INTEGER NOT NULL CHECK (source_event_count >= 1),
        source_manifest_json TEXT NOT NULL,
        calculated_at TEXT NOT NULL,
        valid_until TEXT,
        producer TEXT NOT NULL,
        producer_version TEXT NOT NULL,
        producer_key TEXT NOT NULL,
        UNIQUE (workspace_id, producer, producer_version, producer_key),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id),
        CHECK (window_end >= window_start),
        CHECK (
          (value_type='numeric' AND numeric_value IS NOT NULL AND text_value IS NULL AND boolean_value IS NULL AND json_value IS NULL) OR
          (value_type='text' AND numeric_value IS NULL AND text_value IS NOT NULL AND boolean_value IS NULL AND json_value IS NULL) OR
          (value_type='boolean' AND numeric_value IS NULL AND text_value IS NULL AND boolean_value IS NOT NULL AND json_value IS NULL) OR
          (value_type='json' AND numeric_value IS NULL AND text_value IS NULL AND boolean_value IS NULL AND json_value IS NOT NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS idx_observations_workspace_type_time
        ON normalized_observations(workspace_id, observation_type, calculated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_observations_workspace_subject
        ON normalized_observations(workspace_id, subject_type, subject_id, calculated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_observations_context
        ON normalized_observations(context_version_id);

      CREATE TABLE IF NOT EXISTS derived_signals (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        signal_version INTEGER NOT NULL CHECK (signal_version > 0),
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        context_version_id TEXT NOT NULL,
        state TEXT NOT NULL,
        score REAL NOT NULL CHECK (score BETWEEN 0 AND 1),
        confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
        severity TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
        observed_at TEXT NOT NULL,
        valid_until TEXT,
        producer TEXT NOT NULL,
        producer_version TEXT NOT NULL,
        producer_key TEXT NOT NULL,
        source_observation_ids TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        lifecycle_status TEXT NOT NULL DEFAULT 'active'
          CHECK (lifecycle_status IN ('active','expired','superseded')),
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, producer, producer_version, producer_key),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (context_version_id) REFERENCES business_context_versions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_signals_workspace_type_status
        ON derived_signals(workspace_id, signal_type, lifecycle_status, observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_signals_workspace_subject
        ON derived_signals(workspace_id, subject_type, subject_id, observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_signals_context
        ON derived_signals(context_version_id);
    `);
  },
};
