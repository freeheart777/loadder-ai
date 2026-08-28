export async function up(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS site_media_assets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    site_project_id TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('logo','hero','banner','product','gallery','favicon')),
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`);
  await db.exec('CREATE INDEX IF NOT EXISTS idx_site_media_assets_project ON site_media_assets(workspace_id, site_project_id);');
}

export async function down(db) {
  await db.exec('DROP TABLE IF EXISTS site_media_assets;');
}
