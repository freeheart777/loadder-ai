export const LOADDER_POSTGRES_SCHEMA_VERSION=1;
export const LOADDER_POSTGRES_DDL=`
CREATE TABLE IF NOT EXISTS business_builder_runtime_records (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, app_id, entity_id, id)
);
CREATE INDEX IF NOT EXISTS idx_builder_runtime_entity
  ON business_builder_runtime_records(workspace_id, app_id, entity_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_builder_runtime_json_gin
  ON business_builder_runtime_records USING GIN(data_json);
`;
export function sqliteRuntimeRowToPostgres(row){return{id:row.id,workspace_id:row.workspace_id,app_id:row.app_id,entity_id:row.entity_id,data_json:typeof row.data_json==="string"?JSON.parse(row.data_json):row.data_json,created_at:row.created_at,updated_at:row.updated_at};}
export function validatePostgresRuntimeRecord(row){if(!row||!row.id||!row.workspace_id||!row.app_id||!row.entity_id||!row.data_json||!row.created_at||!row.updated_at)throw new Error("Invalid PostgreSQL runtime record");return true;}
