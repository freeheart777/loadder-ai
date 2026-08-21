export const migration011BusinessContextImmutability = {
  version: 11,
  name: "business_context_immutability",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_business_context_immutable_snapshot
      BEFORE UPDATE OF
        workspace_id, business_profile_id, business_dna_version_id,
        brand_book_version_id, version_number, context_schema_version,
        snapshot_json, source_manifest_json, created_by_user_id, created_at
      ON business_context_versions
      WHEN OLD.status IN ('active', 'archived')
      BEGIN
        SELECT RAISE(ABORT, 'active and archived Business Context versions are immutable');
      END;
    `);
  },
};
