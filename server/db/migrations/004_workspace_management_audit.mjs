function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((entry) => entry.name === column);
}

export const migration004WorkspaceManagementAudit = {
  version: 4,
  name: "workspace_management_audit",
  up(db) {
    if (!hasColumn(db, "sessions", "active_workspace_id")) {
      db.exec(`
        ALTER TABLE sessions
        ADD COLUMN active_workspace_id TEXT REFERENCES workspaces(id)
      `);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_active_workspace
        ON sessions(active_workspace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created
        ON audit_logs(workspace_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
        ON audit_logs(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
        ON audit_logs(action, created_at DESC);
    `);

    db.exec(`
      UPDATE sessions
      SET active_workspace_id = (
        SELECT wm.workspace_id
        FROM workspace_memberships wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = sessions.user_id
          AND wm.status = 'active'
          AND w.status = 'active'
        ORDER BY wm.created_at ASC
        LIMIT 1
      )
      WHERE active_workspace_id IS NULL
    `);
  },
};
