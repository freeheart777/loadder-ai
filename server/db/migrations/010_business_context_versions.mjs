export const migration010BusinessContextVersions = {
  version: 10,
  name: "business_context_versions",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_context_versions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        business_profile_id TEXT NOT NULL,
        business_dna_version_id TEXT NOT NULL,
        brand_book_version_id TEXT NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'archived')),
        context_schema_version TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        source_manifest_json TEXT NOT NULL,
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        activated_at TEXT,
        archived_at TEXT,
        UNIQUE (workspace_id, version_number),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (business_profile_id) REFERENCES business_profiles(id),
        FOREIGN KEY (business_dna_version_id) REFERENCES business_dna_versions(id),
        FOREIGN KEY (brand_book_version_id) REFERENCES brand_book_versions(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_business_context_workspace_status
        ON business_context_versions(workspace_id, status);
      CREATE INDEX IF NOT EXISTS idx_business_context_profile
        ON business_context_versions(business_profile_id);
      CREATE INDEX IF NOT EXISTS idx_business_context_dna
        ON business_context_versions(business_dna_version_id);
      CREATE INDEX IF NOT EXISTS idx_business_context_brand_book
        ON business_context_versions(brand_book_version_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_business_context_one_active
        ON business_context_versions(workspace_id)
        WHERE status = 'active';

      CREATE TRIGGER IF NOT EXISTS trg_business_context_sources_insert
      BEFORE INSERT ON business_context_versions
      WHEN NOT EXISTS (
        SELECT 1 FROM business_profiles p
        WHERE p.id = NEW.business_profile_id AND p.workspace_id = NEW.workspace_id
      ) OR NOT EXISTS (
        SELECT 1 FROM business_dna_versions d
        WHERE d.id = NEW.business_dna_version_id
          AND d.workspace_id = NEW.workspace_id
          AND d.business_profile_id = NEW.business_profile_id
          AND d.status = 'active'
      ) OR NOT EXISTS (
        SELECT 1 FROM brand_book_versions b
        WHERE b.id = NEW.brand_book_version_id
          AND b.workspace_id = NEW.workspace_id
          AND b.business_profile_id = NEW.business_profile_id
          AND b.status = 'active'
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid or cross-workspace Business Context sources');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_business_context_sources_update
      BEFORE UPDATE OF workspace_id, business_profile_id,
        business_dna_version_id, brand_book_version_id
      ON business_context_versions
      WHEN NOT EXISTS (
        SELECT 1 FROM business_profiles p
        WHERE p.id = NEW.business_profile_id AND p.workspace_id = NEW.workspace_id
      ) OR NOT EXISTS (
        SELECT 1 FROM business_dna_versions d
        WHERE d.id = NEW.business_dna_version_id
          AND d.workspace_id = NEW.workspace_id
          AND d.business_profile_id = NEW.business_profile_id
      ) OR NOT EXISTS (
        SELECT 1 FROM brand_book_versions b
        WHERE b.id = NEW.brand_book_version_id
          AND b.workspace_id = NEW.workspace_id
          AND b.business_profile_id = NEW.business_profile_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid or cross-workspace Business Context sources');
      END;
    `);
  },
};
