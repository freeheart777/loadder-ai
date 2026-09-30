// SQLite cannot alter a CHECK constraint in place. Rebuild only the Site
// Project table, preserving every existing project/revision relationship.
export const migration093SiteProjectStarterTypes = {
  version: 93,
  name: "site_project_starter_types",
  up(db) {
    // Some focused fixtures intentionally migrate only a narrow domain slice.
    // There is nothing to widen when the Site Project owner is not installed.
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='site_projects'").get()) return;
    // SQLite validates triggers while rebuilding a referenced table. Preserve
    // and restore every existing guard (including later revision/patch guards)
    // rather than weakening those integrity boundaries.
    const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND sql LIKE '%site_projects%'").all();
    for (const { name } of triggers) db.exec(`DROP TRIGGER "${name.replaceAll('"', '""')}"`);
    db.exec(`
CREATE TABLE site_projects_next(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  context_version_id TEXT,
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  site_type TEXT NOT NULL CHECK(site_type IN('BUSINESS','STORE','NEWS','LEGAL','MEDICAL','CORPORATE','EDUCATION','ECOMMERCE','HYBRID')),
  slug TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('DRAFT','PUBLISHED','ARCHIVED')) DEFAULT 'DRAFT',
  content_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  preview_token_hash TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
  UNIQUE(workspace_id,slug)
);
INSERT INTO site_projects_next(id,workspace_id,context_version_id,name,site_type,slug,status,content_json,published_at,created_at,updated_at,preview_token_hash)
  SELECT id,workspace_id,context_version_id,name,site_type,slug,status,content_json,published_at,created_at,updated_at,preview_token_hash FROM site_projects;
DROP TABLE site_projects;
ALTER TABLE site_projects_next RENAME TO site_projects;
CREATE INDEX idx_site_projects_workspace ON site_projects(workspace_id,updated_at DESC,id DESC);
CREATE INDEX idx_site_projects_published ON site_projects(workspace_id,status,slug);
CREATE INDEX idx_site_projects_preview_token ON site_projects(preview_token_hash);
`);
    for (const { sql } of triggers) if (sql) db.exec(sql);
  },
};
