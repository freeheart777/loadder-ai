export const migration047GoogleAdsCampaignDrafts = {
  version: 47,
  name: "google_ads_campaign_drafts",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS google_ads_campaign_drafts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        connection_id TEXT,
        customer_id TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN('DRAFT','VALID','READY_FOR_AUTH','PUBLISHED','FAILED')) DEFAULT 'DRAFT',
        payload_json TEXT NOT NULL DEFAULT '{}',
        validation_json TEXT NOT NULL DEFAULT '[]',
        google_resource_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        CHECK(json_valid(payload_json)),
        CHECK(json_valid(validation_json)),
        CHECK(json_valid(google_resource_json))
      );
      CREATE INDEX IF NOT EXISTS idx_google_ads_drafts_workspace ON google_ads_campaign_drafts(workspace_id, updated_at DESC);
      CREATE TRIGGER IF NOT EXISTS trg_google_ads_drafts_workspace_immutable
      BEFORE UPDATE ON google_ads_campaign_drafts
      BEGIN
        SELECT CASE WHEN OLD.workspace_id <> NEW.workspace_id THEN RAISE(ABORT,'google ads draft workspace is immutable') END;
      END;
    `);
  }
};
