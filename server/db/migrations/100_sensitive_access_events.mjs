// Append-only evidence for sensitive actions (ADR-005): appointment status
// changes now, medical-document access later. Rows can never be updated or
// deleted, so ownership (workspace, site, actor) is immutable by construction.
export const migration100SensitiveAccessEvents = {
  version: 100,
  name: "sensitive_access_events",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS sensitive_access_events(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT,
  actor_kind TEXT NOT NULL CHECK(actor_kind IN('operator','app_user','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
);
CREATE INDEX IF NOT EXISTS idx_sensitive_access_events_workspace ON sensitive_access_events(workspace_id,created_at);
CREATE INDEX IF NOT EXISTS idx_sensitive_access_events_resource ON sensitive_access_events(workspace_id,resource_type,resource_id);
CREATE TRIGGER IF NOT EXISTS trg_sensitive_access_events_no_update BEFORE UPDATE ON sensitive_access_events BEGIN SELECT RAISE(ABORT,'sensitive access events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_sensitive_access_events_no_delete BEFORE DELETE ON sensitive_access_events BEGIN SELECT RAISE(ABORT,'sensitive access events are append-only'); END;`);
  },
};
