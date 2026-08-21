export const migration007BusinessDnaImmutability = {
  version: 7,
  name: "business_dna_immutability",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_business_dna_immutable_content
      BEFORE UPDATE OF
        workspace_id,
        business_profile_id,
        version_number,
        value_proposition,
        target_audiences_json,
        offerings_json,
        positioning,
        differentiators_json,
        goals_json,
        constraints_json,
        brand_voice,
        growth_drivers_json,
        created_by_user_id,
        created_at
      ON business_dna_versions
      WHEN OLD.status IN ('active', 'archived')
      BEGIN
        SELECT RAISE(ABORT, 'active and archived Business DNA versions are immutable');
      END;
    `);
  },
};
