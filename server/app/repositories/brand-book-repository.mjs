import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function mapVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessProfileId: row.business_profile_id,
    versionNumber: row.version_number,
    status: row.status,
    brandIdentity: parseJson(row.brand_identity_json, {}),
    brandPersonality: parseJson(row.brand_personality_json, []),
    toneOfVoice: row.tone_of_voice,
    messagingPrinciples: parseJson(row.messaging_principles_json, []),
    visualDirection: row.visual_direction,
    primaryColors: parseJson(row.primary_colors_json, []),
    secondaryColors: parseJson(row.secondary_colors_json, []),
    typography: parseJson(row.typography_json, {}),
    logoUsageNotes: row.logo_usage_notes,
    imageryDirection: row.imagery_direction,
    prohibitedPatterns: parseJson(row.prohibited_patterns_json, []),
    keyPhrases: parseJson(row.key_phrases_json, []),
    brandPromises: parseJson(row.brand_promises_json, []),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at,
    archivedAt: row.archived_at,
  };
}

const columns = {
  brandIdentity: "brand_identity_json",
  brandPersonality: "brand_personality_json",
  toneOfVoice: "tone_of_voice",
  messagingPrinciples: "messaging_principles_json",
  visualDirection: "visual_direction",
  primaryColors: "primary_colors_json",
  secondaryColors: "secondary_colors_json",
  typography: "typography_json",
  logoUsageNotes: "logo_usage_notes",
  imageryDirection: "imagery_direction",
  prohibitedPatterns: "prohibited_patterns_json",
  keyPhrases: "key_phrases_json",
  brandPromises: "brand_promises_json",
};
const jsonFields = new Set([
  "brandIdentity", "brandPersonality", "messagingPrinciples",
  "primaryColors", "secondaryColors", "typography",
  "prohibitedPatterns", "keyPhrases", "brandPromises",
]);

export function createBrandBookRepository(db) {
  const workspaceId = () => requireWorkspaceId();
  const getProfile = () => db.prepare(
    "SELECT id FROM business_profiles WHERE workspace_id = ?"
  ).get(workspaceId()) || null;

  function getVersion(id) {
    return mapVersion(db.prepare(`
      SELECT * FROM brand_book_versions WHERE id = ? AND workspace_id = ?
    `).get(id, workspaceId()));
  }

  function getActiveVersion() {
    return mapVersion(db.prepare(`
      SELECT * FROM brand_book_versions
      WHERE workspace_id = ? AND status = 'active'
    `).get(workspaceId()));
  }

  function getLatestDraft() {
    return mapVersion(db.prepare(`
      SELECT * FROM brand_book_versions
      WHERE workspace_id = ? AND status = 'draft'
      ORDER BY version_number DESC LIMIT 1
    `).get(workspaceId()));
  }

  function listVersions() {
    return db.prepare(`
      SELECT * FROM brand_book_versions
      WHERE workspace_id = ? ORDER BY version_number DESC
    `).all(workspaceId()).map(mapVersion);
  }

  function createDraft(values, userId, timestamp) {
    const scopedWorkspaceId = workspaceId();
    const profile = getProfile();
    if (!profile) return null;
    const versionNumber = db.prepare(`
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next
      FROM brand_book_versions WHERE workspace_id = ?
    `).get(scopedWorkspaceId).next;
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO brand_book_versions (
        id, workspace_id, business_profile_id, version_number, status,
        brand_identity_json, brand_personality_json, tone_of_voice,
        messaging_principles_json, visual_direction, primary_colors_json,
        secondary_colors_json, typography_json, logo_usage_notes,
        imagery_direction, prohibited_patterns_json, key_phrases_json,
        brand_promises_json, created_by_user_id, created_at, updated_at,
        activated_at, archived_at
      ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `).run(
      id, scopedWorkspaceId, profile.id, versionNumber,
      JSON.stringify(values.brandIdentity), JSON.stringify(values.brandPersonality),
      values.toneOfVoice, JSON.stringify(values.messagingPrinciples),
      values.visualDirection, JSON.stringify(values.primaryColors),
      JSON.stringify(values.secondaryColors), JSON.stringify(values.typography),
      values.logoUsageNotes, values.imageryDirection,
      JSON.stringify(values.prohibitedPatterns), JSON.stringify(values.keyPhrases),
      JSON.stringify(values.brandPromises), userId, timestamp, timestamp
    );
    return getVersion(id);
  }

  function updateDraft(id, values, timestamp) {
    const entries = Object.entries(values).filter(([key]) => columns[key]);
    if (!entries.length) return getVersion(id);
    const result = db.prepare(`
      UPDATE brand_book_versions
      SET ${entries.map(([key]) => `${columns[key]} = ?`).join(", ")}, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND status = 'draft'
    `).run(
      ...entries.map(([key, value]) => jsonFields.has(key) ? JSON.stringify(value) : value),
      timestamp, id, workspaceId()
    );
    return result.changes ? getVersion(id) : null;
  }

  function activateVersion(id, timestamp) {
    return db.transaction(() => {
      const scopedWorkspaceId = workspaceId();
      const target = getVersion(id);
      if (!target || target.status !== "draft") return null;
      const previous = getActiveVersion();
      if (previous) {
        db.prepare(`UPDATE brand_book_versions
          SET status = 'archived', archived_at = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ? AND status = 'active'`)
          .run(timestamp, timestamp, previous.id, scopedWorkspaceId);
      }
      db.prepare(`UPDATE brand_book_versions
        SET status = 'active', activated_at = ?, archived_at = NULL, updated_at = ?
        WHERE id = ? AND workspace_id = ? AND status = 'draft'`)
        .run(timestamp, timestamp, id, scopedWorkspaceId);
      return { version: getVersion(id), previousActiveVersionId: previous?.id || null };
    })();
  }

  function archiveDraft(id, timestamp) {
    const result = db.prepare(`UPDATE brand_book_versions
      SET status = 'archived', archived_at = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND status = 'draft'`)
      .run(timestamp, timestamp, id, workspaceId());
    return result.changes ? getVersion(id) : null;
  }

  return {
    getVersion, getActiveVersion, getLatestDraft, listVersions,
    createDraft, updateDraft, activateVersion, archiveDraft,
  };
}
