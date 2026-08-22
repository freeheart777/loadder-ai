export const migration050RealAssetUpload = {
  version: 50,
  name: "real_asset_upload",
  up(db) {
    const columns = new Set(db.prepare("PRAGMA table_info(content_assets)").all().map(({ name }) => name));
    const add = (name, sql) => { if (!columns.has(name)) db.exec(`ALTER TABLE content_assets ADD COLUMN ${name} ${sql}`); };
    add("canonical_storage_object_key", "TEXT CHECK(canonical_storage_object_key IS NULL OR length(canonical_storage_object_key) BETWEEN 1 AND 500)");
    add("storage_backend_kind", "TEXT CHECK(storage_backend_kind IS NULL OR storage_backend_kind IN ('OBJECT_STORAGE','TEST_MEMORY'))");
    add("canonical_mime_type", "TEXT CHECK(canonical_mime_type IS NULL OR canonical_mime_type IN ('image/jpeg','image/png','image/webp','video/mp4'))");
    add("canonical_byte_size", "INTEGER CHECK(canonical_byte_size IS NULL OR canonical_byte_size>0)");
    add("canonical_sha256", "TEXT CHECK(canonical_sha256 IS NULL OR(length(canonical_sha256)=64 AND canonical_sha256 NOT GLOB '*[^0-9a-f]*'))");
    add("optimization_policy_version", "TEXT CHECK(optimization_policy_version IS NULL OR length(optimization_policy_version) BETWEEN 1 AND 100)");
    add("optimization_outcome", "TEXT CHECK(optimization_outcome IS NULL OR optimization_outcome IN ('ORIGINAL_KEPT','LOSSLESS_OPTIMIZED','TRANSCODED','OPTIMIZATION_SKIPPED','OPTIMIZATION_FAILED_FALLBACK'))");
    add("source_retention_until", "TEXT CHECK(source_retention_until IS NULL OR length(source_retention_until) BETWEEN 20 AND 40)");
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_content_assets_workspace_maintenance
        ON content_assets(workspace_id,status,updated_at,id);
      CREATE TRIGGER IF NOT EXISTS trg_content_assets_canonical_guard BEFORE UPDATE ON content_assets WHEN
        OLD.status='READY' AND (
          NEW.canonical_storage_object_key IS NOT OLD.canonical_storage_object_key OR
          NEW.canonical_sha256 IS NOT OLD.canonical_sha256 OR
          NEW.canonical_byte_size IS NOT OLD.canonical_byte_size OR
          NEW.canonical_mime_type IS NOT OLD.canonical_mime_type
        )
      BEGIN SELECT RAISE(ABORT,'ready canonical asset is immutable'); END;
    `);
  },
};
