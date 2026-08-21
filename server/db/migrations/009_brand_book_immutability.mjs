export const migration009BrandBookImmutability = {
  version: 9,
  name: "brand_book_immutability",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_brand_book_immutable_content
      BEFORE UPDATE OF
        workspace_id, business_profile_id, version_number,
        brand_identity_json, brand_personality_json, tone_of_voice,
        messaging_principles_json, visual_direction,
        primary_colors_json, secondary_colors_json, typography_json,
        logo_usage_notes, imagery_direction, prohibited_patterns_json,
        key_phrases_json, brand_promises_json,
        created_by_user_id, created_at
      ON brand_book_versions
      WHEN OLD.status IN ('active', 'archived')
      BEGIN
        SELECT RAISE(ABORT, 'active and archived Brand Book versions are immutable');
      END;
    `);
  },
};
