export const migration005BusinessProfiles = {
  version: 5,
  name: "business_profiles",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_profiles (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        legal_name TEXT,
        website TEXT,
        industry TEXT,
        subindustry TEXT,
        description TEXT,
        country TEXT,
        city TEXT,
        phone TEXT,
        email TEXT,
        timezone TEXT,
        primary_language TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'inactive')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );

      CREATE INDEX IF NOT EXISTS idx_business_profiles_workspace
        ON business_profiles(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_business_profiles_status
        ON business_profiles(status);
      CREATE INDEX IF NOT EXISTS idx_business_profiles_website
        ON business_profiles(website)
        WHERE website IS NOT NULL;
    `);
  },
};
