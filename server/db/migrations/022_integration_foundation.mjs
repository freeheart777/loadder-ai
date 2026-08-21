export const migration022IntegrationFoundation={version:22,name:"integration_foundation",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS connector_connections(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,connector_id TEXT NOT NULL,connector_version INTEGER NOT NULL,display_name TEXT NOT NULL,region TEXT NOT NULL,
 credential_reference TEXT,status TEXT NOT NULL CHECK(status IN('CONNECTED','AUTH_REQUIRED','SYNCING','HEALTHY','DEGRADED','RATE_LIMITED','FAILED','DISCONNECTED')),
 last_successful_sync_at TEXT,last_attempted_sync_at TEXT,cursor_json TEXT NOT NULL DEFAULT '{}',last_error_code TEXT,retry_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(workspace_id) REFERENCES workspaces(id),CHECK(json_valid(cursor_json)),UNIQUE(workspace_id,id));
CREATE INDEX IF NOT EXISTS idx_connections_workspace ON connector_connections(workspace_id,status);
CREATE TABLE IF NOT EXISTS connector_sync_runs(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,connection_id TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN('full','incremental','webhook','file_import')),
 status TEXT NOT NULL CHECK(status IN('started','completed','failed','partial')),cursor_before_json TEXT NOT NULL,cursor_after_json TEXT NOT NULL,
 records_received INTEGER NOT NULL DEFAULT 0,records_imported INTEGER NOT NULL DEFAULT 0,records_failed INTEGER NOT NULL DEFAULT 0,error_code TEXT,started_at TEXT NOT NULL,completed_at TEXT,
 FOREIGN KEY(workspace_id,connection_id) REFERENCES connector_connections(workspace_id,id),CHECK(json_valid(cursor_before_json)),CHECK(json_valid(cursor_after_json)));
CREATE INDEX IF NOT EXISTS idx_sync_runs_connection ON connector_sync_runs(workspace_id,connection_id,started_at DESC);
CREATE TABLE IF NOT EXISTS import_batches(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,connection_id TEXT NOT NULL,format TEXT NOT NULL CHECK(format IN('csv','json')),canonical_contract TEXT NOT NULL,
 mapping_version TEXT NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('created','completed','partial','failed')),
 total_rows INTEGER NOT NULL DEFAULT 0,imported_rows INTEGER NOT NULL DEFAULT 0,failed_rows INTEGER NOT NULL DEFAULT 0,error_summary_json TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL,completed_at TEXT,
 FOREIGN KEY(workspace_id,connection_id) REFERENCES connector_connections(workspace_id,id),CHECK(json_valid(error_summary_json)),UNIQUE(workspace_id,connection_id,content_hash,mapping_version));
CREATE INDEX IF NOT EXISTS idx_import_batches_workspace ON import_batches(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS canonical_import_records(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,connection_id TEXT NOT NULL,batch_id TEXT NOT NULL,provider TEXT NOT NULL,external_object_type TEXT NOT NULL,external_object_id TEXT NOT NULL,
 canonical_type TEXT NOT NULL,mapping_version TEXT NOT NULL,source_timestamp TEXT,ingested_at TEXT NOT NULL,data_json TEXT NOT NULL,provenance_json TEXT NOT NULL,content_hash TEXT NOT NULL,
 FOREIGN KEY(workspace_id,connection_id) REFERENCES connector_connections(workspace_id,id),FOREIGN KEY(batch_id) REFERENCES import_batches(id),
 CHECK(json_valid(data_json)),CHECK(json_valid(provenance_json)),UNIQUE(workspace_id,connection_id,external_object_type,external_object_id,content_hash));
CREATE INDEX IF NOT EXISTS idx_import_records_external ON canonical_import_records(workspace_id,connection_id,external_object_type,external_object_id);
CREATE INDEX IF NOT EXISTS idx_import_records_type ON canonical_import_records(workspace_id,canonical_type,ingested_at DESC);`);}};
