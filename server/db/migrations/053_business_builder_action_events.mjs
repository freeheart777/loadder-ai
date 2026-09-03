export const migration053BusinessBuilderActionEvents={version:53,name:"business_builder_action_events",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS business_builder_action_events (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 action_id TEXT NOT NULL,
 from_status TEXT,
 to_status TEXT NOT NULL,
 actor_id TEXT,
 result_json TEXT,
 created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(action_id) REFERENCES business_builder_action_ledger(id)
);
CREATE INDEX IF NOT EXISTS idx_builder_action_events ON business_builder_action_events(workspace_id,action_id,created_at ASC);
CREATE TRIGGER IF NOT EXISTS trg_builder_action_events_no_update
BEFORE UPDATE ON business_builder_action_events
BEGIN SELECT RAISE(ABORT,'business_builder_action_events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_builder_action_events_no_delete
BEFORE DELETE ON business_builder_action_events
BEGIN SELECT RAISE(ABORT,'business_builder_action_events are append-only'); END;
`);}};
