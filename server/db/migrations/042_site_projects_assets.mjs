export const migration042SiteProjectsAssets = {
  version: 42,
  name: "site_projects_assets",

  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        context_version_id TEXT,
        name TEXT NOT NULL,
        site_type TEXT NOT NULL,
        slug TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        content_json TEXT NOT NULL DEFAULT '{}',
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, slug)
      );
      CREATE INDEX IF NOT EXISTS ix_site_projects_workspace
        ON site_projects(workspace_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS site_assets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        site_project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        alt_text TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS ix_site_assets_project
        ON site_assets(workspace_id, site_project_id, created_at DESC);
    `);
  }
};
