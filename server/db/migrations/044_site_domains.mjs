export const migration044SiteDomains = {
  version: 44,
  name: "site_domains",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_domains (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        site_project_id TEXT NOT NULL,
        domain TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS ix_site_domains_project ON site_domains(site_project_id, status);
      CREATE INDEX IF NOT EXISTS ix_site_domains_workspace ON site_domains(workspace_id, status);
    `);
  }
};
