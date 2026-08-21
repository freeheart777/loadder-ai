export const migration023KnowledgeKpiFoundation={version:23,name:"knowledge_kpi_foundation",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS knowledge_artifacts(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,artifact_type TEXT NOT NULL,title TEXT NOT NULL,source TEXT NOT NULL,language TEXT,status TEXT NOT NULL CHECK(status IN('active','archived')),
 created_at TEXT NOT NULL,FOREIGN KEY(workspace_id) REFERENCES workspaces(id));
CREATE INDEX IF NOT EXISTS idx_artifacts_workspace ON knowledge_artifacts(workspace_id,artifact_type,created_at DESC);
CREATE TABLE IF NOT EXISTS knowledge_artifact_versions(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,artifact_id TEXT NOT NULL,version_number INTEGER NOT NULL,mime_type TEXT NOT NULL,filename TEXT,content_hash TEXT NOT NULL,
 storage_reference TEXT,structured_content_json TEXT,provenance_json TEXT NOT NULL,effective_from TEXT,effective_to TEXT,created_by_user_id TEXT,created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(artifact_id) REFERENCES knowledge_artifacts(id),FOREIGN KEY(created_by_user_id) REFERENCES users(id),
 CHECK(structured_content_json IS NULL OR json_valid(structured_content_json)),CHECK(json_valid(provenance_json)),UNIQUE(workspace_id,artifact_id,version_number),UNIQUE(workspace_id,artifact_id,content_hash));
CREATE INDEX IF NOT EXISTS idx_artifact_versions ON knowledge_artifact_versions(workspace_id,artifact_id,version_number DESC);
CREATE TABLE IF NOT EXISTS kpi_definitions(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,kpi_key TEXT NOT NULL,version_number INTEGER NOT NULL,name TEXT NOT NULL,description TEXT,unit TEXT NOT NULL,
 directionality TEXT NOT NULL CHECK(directionality IN('increase','decrease','target','neutral')),target_value REAL,warning_threshold REAL,critical_threshold REAL,
 measurement_frequency TEXT NOT NULL,source_type TEXT NOT NULL,effective_from TEXT,effective_to TEXT,status TEXT NOT NULL CHECK(status IN('draft','active','archived')),
 provenance_json TEXT NOT NULL,created_by_user_id TEXT,created_at TEXT NOT NULL,FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(created_by_user_id) REFERENCES users(id),
 CHECK(json_valid(provenance_json)),UNIQUE(workspace_id,kpi_key,version_number));
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_one_active ON kpi_definitions(workspace_id,kpi_key) WHERE status='active';
CREATE TABLE IF NOT EXISTS kpi_measurements(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,kpi_definition_id TEXT NOT NULL,measured_at TEXT NOT NULL,period_start TEXT,period_end TEXT,actual_value REAL NOT NULL,target_value REAL,
 context_version_id TEXT,source_type TEXT NOT NULL,source_record_id TEXT,provenance_json TEXT NOT NULL,created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(kpi_definition_id) REFERENCES kpi_definitions(id),FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
 CHECK(json_valid(provenance_json)),UNIQUE(workspace_id,kpi_definition_id,measured_at,source_type,source_record_id));
CREATE INDEX IF NOT EXISTS idx_kpi_measurements ON kpi_measurements(workspace_id,kpi_definition_id,measured_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_measurement_idempotency ON kpi_measurements(workspace_id,kpi_definition_id,measured_at,source_type,IFNULL(source_record_id,''));`);}};
