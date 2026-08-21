export const migration008BrandBookVersions = {
  version: 8,
  name: "brand_book_versions",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS brand_book_versions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        business_profile_id TEXT NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'archived')),
        brand_identity_json TEXT NOT NULL DEFAULT '{}',
        brand_personality_json TEXT NOT NULL DEFAULT '[]',
        tone_of_voice TEXT,
        messaging_principles_json TEXT NOT NULL DEFAULT '[]',
        visual_direction TEXT,
        primary_colors_json TEXT NOT NULL DEFAULT '[]',
        secondary_colors_json TEXT NOT NULL DEFAULT '[]',
        typography_json TEXT NOT NULL DEFAULT '{}',
        logo_usage_notes TEXT,
        imagery_direction TEXT,
        prohibited_patterns_json TEXT NOT NULL DEFAULT '[]',
        key_phrases_json TEXT NOT NULL DEFAULT '[]',
        brand_promises_json TEXT NOT NULL DEFAULT '[]',
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        activated_at TEXT,
        archived_at TEXT,
        UNIQUE (workspace_id, version_number),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (business_profile_id) REFERENCES business_profiles(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_brand_book_workspace_status
        ON brand_book_versions(workspace_id, status);
      CREATE INDEX IF NOT EXISTS idx_brand_book_profile
        ON brand_book_versions(business_profile_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_book_one_active
        ON brand_book_versions(workspace_id)
        WHERE status = 'active';

      CREATE TRIGGER IF NOT EXISTS trg_brand_book_profile_workspace_insert
      BEFORE INSERT ON brand_book_versions
      WHEN NOT EXISTS (
        SELECT 1 FROM business_profiles
        WHERE id = NEW.business_profile_id
          AND workspace_id = NEW.workspace_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'cross-workspace business profile reference');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_brand_book_profile_workspace_update
      BEFORE UPDATE OF business_profile_id, workspace_id ON brand_book_versions
      WHEN NOT EXISTS (
        SELECT 1 FROM business_profiles
        WHERE id = NEW.business_profile_id
          AND workspace_id = NEW.workspace_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'cross-workspace business profile reference');
      END;
    `);
  },
};
