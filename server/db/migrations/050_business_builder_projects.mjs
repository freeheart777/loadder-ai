export const migration050BusinessBuilderProjects = {
  version: 50,
  name: "business_builder_projects_versions_previews",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_builder_projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        intent TEXT NOT NULL,
        locale TEXT NOT NULL DEFAULT 'fa-IR',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','archived')),
        active_version_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_business_builder_projects_workspace ON business_builder_projects(workspace_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS business_builder_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        definition_json TEXT NOT NULL,
        ui_json TEXT NOT NULL,
        bundle_json TEXT NOT NULL,
        build_plan_json TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, version_number),
        FOREIGN KEY (project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_business_builder_versions_project ON business_builder_versions(project_id, version_number DESC);

      CREATE TABLE IF NOT EXISTS business_builder_preview_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active','expired','failed')),
        preview_url TEXT,
        runtime_adapter TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (version_id) REFERENCES business_builder_versions(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS business_builder_approvals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        stage TEXT NOT NULL CHECK(stage IN ('preview','production')),
        decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
        decided_by TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (version_id) REFERENCES business_builder_versions(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_business_builder_approvals_project ON business_builder_approvals(project_id, created_at DESC);
    `);
  },
};
