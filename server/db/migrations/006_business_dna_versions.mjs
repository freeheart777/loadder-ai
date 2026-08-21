export const migration006BusinessDnaVersions = {
  version: 6,
  name: "business_dna_versions",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_dna_versions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        business_profile_id TEXT NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'archived')),
        value_proposition TEXT,
        target_audiences_json TEXT NOT NULL DEFAULT '[]',
        offerings_json TEXT NOT NULL DEFAULT '[]',
        positioning TEXT,
        differentiators_json TEXT NOT NULL DEFAULT '[]',
        goals_json TEXT NOT NULL DEFAULT '[]',
        constraints_json TEXT NOT NULL DEFAULT '[]',
        brand_voice TEXT,
        growth_drivers_json TEXT NOT NULL DEFAULT '[]',
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

      CREATE INDEX IF NOT EXISTS idx_business_dna_workspace_status
        ON business_dna_versions(workspace_id, status);
      CREATE INDEX IF NOT EXISTS idx_business_dna_profile
        ON business_dna_versions(business_profile_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_business_dna_one_active
        ON business_dna_versions(workspace_id)
        WHERE status = 'active';

      CREATE TRIGGER IF NOT EXISTS trg_business_dna_profile_workspace_insert
      BEFORE INSERT ON business_dna_versions
      WHEN NOT EXISTS (
        SELECT 1 FROM business_profiles
        WHERE id = NEW.business_profile_id
          AND workspace_id = NEW.workspace_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'cross-workspace business profile reference');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_business_dna_profile_workspace_update
      BEFORE UPDATE OF business_profile_id, workspace_id ON business_dna_versions
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
