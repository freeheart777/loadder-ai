export const migration052BusinessBuilderActionLedger={version:52,name:"business_builder_action_ledger",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS business_builder_action_ledger (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 project_id TEXT NOT NULL,
 version_id TEXT NOT NULL,
 action_key TEXT NOT NULL,
 action_type TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('proposed','drafted','approved','rejected','executing','succeeded','failed','evaluated')),
 idempotency_key TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 result_json TEXT,
 actor_id TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,idempotency_key),
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
CREATE INDEX IF NOT EXISTS idx_builder_action_project ON business_builder_action_ledger(workspace_id,project_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_builder_action_status ON business_builder_action_ledger(workspace_id,status,updated_at DESC);
`);}};
