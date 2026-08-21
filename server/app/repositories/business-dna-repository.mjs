import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";

function parseList(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessProfileId: row.business_profile_id,
    versionNumber: row.version_number,
    status: row.status,
    valueProposition: row.value_proposition,
    targetAudiences: parseList(row.target_audiences_json),
    offerings: parseList(row.offerings_json),
    positioning: row.positioning,
    differentiators: parseList(row.differentiators_json),
    goals: parseList(row.goals_json),
    constraints: parseList(row.constraints_json),
    brandVoice: row.brand_voice,
    growthDrivers: parseList(row.growth_drivers_json),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at,
    archivedAt: row.archived_at,
  };
}

const columns = {
  valueProposition: "value_proposition",
  targetAudiences: "target_audiences_json",
  offerings: "offerings_json",
  positioning: "positioning",
  differentiators: "differentiators_json",
  goals: "goals_json",
  constraints: "constraints_json",
  brandVoice: "brand_voice",
  growthDrivers: "growth_drivers_json",
};
const listFields = new Set([
  "targetAudiences",
  "offerings",
  "differentiators",
  "goals",
  "constraints",
  "growthDrivers",
]);

function storedValue(key, value) {
  return listFields.has(key) ? JSON.stringify(value || []) : value;
}

export function createBusinessDnaRepository(db) {
  function getBusinessProfile() {
    return db
      .prepare("SELECT id FROM business_profiles WHERE workspace_id = ?")
      .get(requireWorkspaceId()) || null;
  }

  function getVersion(id) {
    return mapVersion(
      db.prepare(`
        SELECT * FROM business_dna_versions
        WHERE id = ? AND workspace_id = ?
      `).get(id, requireWorkspaceId())
    );
  }

  function getActiveVersion() {
    return mapVersion(
      db.prepare(`
        SELECT * FROM business_dna_versions
        WHERE workspace_id = ? AND status = 'active'
      `).get(requireWorkspaceId())
    );
  }

  function getLatestDraft() {
    return mapVersion(
      db.prepare(`
        SELECT * FROM business_dna_versions
        WHERE workspace_id = ? AND status = 'draft'
        ORDER BY version_number DESC LIMIT 1
      `).get(requireWorkspaceId())
    );
  }

  function listVersions() {
    return db.prepare(`
      SELECT * FROM business_dna_versions
      WHERE workspace_id = ?
      ORDER BY version_number DESC
    `).all(requireWorkspaceId()).map(mapVersion);
  }

  function createDraft(values, userId, timestamp) {
    const workspaceId = requireWorkspaceId();
    const profile = getBusinessProfile();
    if (!profile) return null;
    const versionNumber = db.prepare(`
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next
      FROM business_dna_versions WHERE workspace_id = ?
    `).get(workspaceId).next;
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO business_dna_versions (
        id, workspace_id, business_profile_id, version_number, status,
        value_proposition, target_audiences_json, offerings_json,
        positioning, differentiators_json, goals_json, constraints_json,
        brand_voice, growth_drivers_json, created_by_user_id,
        created_at, updated_at, activated_at, archived_at
      ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `).run(
      id, workspaceId, profile.id, versionNumber,
      values.valueProposition, JSON.stringify(values.targetAudiences),
      JSON.stringify(values.offerings), values.positioning,
      JSON.stringify(values.differentiators), JSON.stringify(values.goals),
      JSON.stringify(values.constraints), values.brandVoice,
      JSON.stringify(values.growthDrivers), userId, timestamp, timestamp
    );
    return getVersion(id);
  }

  function updateDraft(id, values, timestamp) {
    const entries = Object.entries(values).filter(([key]) => columns[key]);
    if (!entries.length) return getVersion(id);
    const assignments = entries.map(([key]) => `${columns[key]} = ?`);
    const result = db.prepare(`
      UPDATE business_dna_versions
      SET ${assignments.join(", ")}, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND status = 'draft'
    `).run(
      ...entries.map(([key, value]) => storedValue(key, value)),
      timestamp, id, requireWorkspaceId()
    );
    return result.changes ? getVersion(id) : null;
  }

  function activateVersion(id, timestamp) {
    return db.transaction(() => {
      const workspaceId = requireWorkspaceId();
      const target = getVersion(id);
      if (!target || target.status !== "draft") return null;
      const previous = getActiveVersion();
      if (previous) {
        db.prepare(`
          UPDATE business_dna_versions
          SET status = 'archived', archived_at = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ? AND status = 'active'
        `).run(timestamp, timestamp, previous.id, workspaceId);
      }
      db.prepare(`
        UPDATE business_dna_versions
        SET status = 'active', activated_at = ?, archived_at = NULL, updated_at = ?
        WHERE id = ? AND workspace_id = ? AND status = 'draft'
      `).run(timestamp, timestamp, id, workspaceId);
      return {
        version: getVersion(id),
        previousActiveVersionId: previous?.id || null,
      };
    })();
  }

  function archiveDraft(id, timestamp) {
    const result = db.prepare(`
      UPDATE business_dna_versions
      SET status = 'archived', archived_at = ?, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND status = 'draft'
    `).run(timestamp, timestamp, id, requireWorkspaceId());
    return result.changes ? getVersion(id) : null;
  }

  return {
    getVersion,
    getActiveVersion,
    getLatestDraft,
    listVersions,
    createDraft,
    updateDraft,
    activateVersion,
    archiveDraft,
  };
}
