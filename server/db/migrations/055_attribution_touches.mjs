export const migration055AttributionTouches={version:55,name:"attribution_touches",up(db){db.exec(`
  CREATE TABLE IF NOT EXISTS attribution_touches(
    id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    distribution_context_id TEXT NOT NULL REFERENCES distribution_contexts(id),
    touch_type TEXT NOT NULL CHECK(touch_type IN('LANDING_VISIT','CLICK','MESSAGE_INTERACTION','FORM_START','FORM_SUBMIT','CALL_ACTION','OTHER')),
    sensor_type TEXT NOT NULL CHECK(length(sensor_type) BETWEEN 1 AND 80 AND sensor_type NOT GLOB '*[^a-z0-9._-]*'),
    sensor_version INTEGER NOT NULL CHECK(sensor_version>0),
    occurred_at TEXT NOT NULL CHECK(length(occurred_at) BETWEEN 20 AND 40),
    ingested_at TEXT NOT NULL CHECK(length(ingested_at) BETWEEN 20 AND 40),
    anonymous_session_key TEXT CHECK(anonymous_session_key IS NULL OR length(anonymous_session_key) BETWEEN 1 AND 200),
    visitor_correlation_key TEXT CHECK(visitor_correlation_key IS NULL OR length(visitor_correlation_key) BETWEEN 1 AND 200),
    landing_reference TEXT CHECK(landing_reference IS NULL OR length(landing_reference) BETWEEN 1 AND 2000),
    source_snapshot TEXT CHECK(source_snapshot IS NULL OR length(source_snapshot) BETWEEN 1 AND 200),
    medium_snapshot TEXT CHECK(medium_snapshot IS NULL OR length(medium_snapshot) BETWEEN 1 AND 200),
    utm_snapshot TEXT CHECK(utm_snapshot IS NULL OR(json_valid(utm_snapshot) AND length(utm_snapshot)<=8192)),
    external_reference TEXT CHECK(external_reference IS NULL OR length(external_reference) BETWEEN 1 AND 500),
    payload_fingerprint TEXT CHECK(payload_fingerprint IS NULL OR(length(payload_fingerprint)=64 AND payload_fingerprint NOT GLOB '*[^0-9a-f]*')),
    idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
    request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
    created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_attribution_touches_ingestion ON attribution_touches(workspace_id,sensor_type,sensor_version,COALESCE(external_reference,''),idempotency_key);
  CREATE INDEX IF NOT EXISTS idx_attribution_touches_context_history ON attribution_touches(workspace_id,distribution_context_id,occurred_at DESC,ingested_at DESC,id DESC);
  CREATE TRIGGER IF NOT EXISTS trg_attribution_touches_insert_guard BEFORE INSERT ON attribution_touches BEGIN
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active') THEN RAISE(ABORT,'attribution touch workspace must be active') END;
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM distribution_contexts WHERE id=NEW.distribution_context_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'attribution touch context mismatch') END;
  END;
  CREATE TRIGGER IF NOT EXISTS trg_attribution_touches_update_reject BEFORE UPDATE ON attribution_touches BEGIN SELECT RAISE(ABORT,'attribution touches are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS trg_attribution_touches_delete_reject BEFORE DELETE ON attribution_touches BEGIN SELECT RAISE(ABORT,'attribution touches are immutable'); END;
`);}};
