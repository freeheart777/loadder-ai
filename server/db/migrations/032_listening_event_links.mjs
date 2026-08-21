export const migration032ListeningEventLinks = {
  version: 32,
  name: "listening_event_links",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS listening_record_event_links (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        listening_record_id TEXT NOT NULL,
        business_event_id TEXT NOT NULL,
        mapping_id TEXT NOT NULL,
        mapping_version INTEGER NOT NULL,
        producer_key TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(workspace_id,listening_record_id,mapping_id,mapping_version),
        UNIQUE(workspace_id,producer_key),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(listening_record_id) REFERENCES canonical_listening_records(id),
        FOREIGN KEY(business_event_id) REFERENCES business_events(id),
        CHECK(json_valid(provenance_json))
      );
      CREATE INDEX IF NOT EXISTS idx_listening_event_links_record ON listening_record_event_links(workspace_id,listening_record_id);
    `);
  },
};
