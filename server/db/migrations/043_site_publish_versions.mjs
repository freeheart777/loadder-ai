export const migration043SitePublishVersions = {
  version: 43,
  name: "site_publish_versions",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS site_publish_versions(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  context_version_id TEXT,
  content_json TEXT NOT NULL,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  UNIQUE(workspace_id,site_project_id,version)
);
CREATE INDEX IF NOT EXISTS idx_site_publish_versions_project ON site_publish_versions(workspace_id,site_project_id,version DESC);
CREATE TRIGGER IF NOT EXISTS trg_site_publish_versions_workspace_guard BEFORE INSERT ON site_publish_versions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'site publish version workspace mismatch') END;
END;
`);
  }
};
