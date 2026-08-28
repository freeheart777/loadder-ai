export const migration045SitePreviewTokens = {
  version: 45,
  name: "site_preview_tokens",
  up(db) {
    db.exec(`
ALTER TABLE site_projects ADD COLUMN preview_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_site_projects_preview_token ON site_projects(preview_token_hash);
`);
  }
};
