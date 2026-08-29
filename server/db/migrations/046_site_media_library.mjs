export const migration046SiteMediaLibrary = {
  version: 46,
  name: "site_media_library",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS site_media_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo','hero','banner','product','gallery','favicon')),
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_site_media_assets_project ON site_media_assets(workspace_id, site_project_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_site_media_assets_workspace_guard BEFORE INSERT ON site_media_assets BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'site media workspace mismatch') END;
END;
`);
  },
};
