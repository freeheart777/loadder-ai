import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";

function json(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function profile(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, legalName: row.legal_name,
    website: row.website, industry: row.industry, subindustry: row.subindustry,
    description: row.description, country: row.country, city: row.city,
    timezone: row.timezone, primaryLanguage: row.primary_language,
    updatedAt: row.updated_at,
  };
}

function dna(row) {
  if (!row) return null;
  return {
    id: row.id, versionNumber: row.version_number,
    businessProfileId: row.business_profile_id,
    valueProposition: row.value_proposition,
    targetAudiences: json(row.target_audiences_json, []),
    offerings: json(row.offerings_json, []), positioning: row.positioning,
    differentiators: json(row.differentiators_json, []),
    goals: json(row.goals_json, []), constraints: json(row.constraints_json, []),
    brandVoice: row.brand_voice, growthDrivers: json(row.growth_drivers_json, []),
    updatedAt: row.updated_at, activatedAt: row.activated_at,
  };
}

function brandBook(row) {
  if (!row) return null;
  return {
    id: row.id, versionNumber: row.version_number,
    businessProfileId: row.business_profile_id,
    brandIdentity: json(row.brand_identity_json, {}),
    brandPersonality: json(row.brand_personality_json, []),
    toneOfVoice: row.tone_of_voice,
    messagingPrinciples: json(row.messaging_principles_json, []),
    visualDirection: row.visual_direction,
    primaryColors: json(row.primary_colors_json, []),
    secondaryColors: json(row.secondary_colors_json, []),
    typography: json(row.typography_json, {}), logoUsageNotes: row.logo_usage_notes,
    imageryDirection: row.imagery_direction,
    prohibitedPatterns: json(row.prohibited_patterns_json, []),
    keyPhrases: json(row.key_phrases_json, []),
    brandPromises: json(row.brand_promises_json, []),
    updatedAt: row.updated_at, activatedAt: row.activated_at,
  };
}

function context(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessProfileId: row.business_profile_id,
    businessDnaVersionId: row.business_dna_version_id,
    brandBookVersionId: row.brand_book_version_id,
    versionNumber: row.version_number,
    status: row.status,
    contextSchemaVersion: row.context_schema_version,
    snapshot: json(row.snapshot_json, {}),
    sourceManifest: json(row.source_manifest_json, {}),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    archivedAt: row.archived_at,
  };
}

export function createBusinessContextRepository(db) {
  const workspaceId = () => requireWorkspaceId();

  function getCurrentSources() {
    const scoped = workspaceId();
    return {
      profile: profile(db.prepare(
        "SELECT * FROM business_profiles WHERE workspace_id = ? AND status = 'active'"
      ).get(scoped)),
      dna: dna(db.prepare(
        "SELECT * FROM business_dna_versions WHERE workspace_id = ? AND status = 'active'"
      ).get(scoped)),
      brandBook: brandBook(db.prepare(
        "SELECT * FROM brand_book_versions WHERE workspace_id = ? AND status = 'active'"
      ).get(scoped)),
    };
  }

  function getVersion(id) {
    return context(db.prepare(`SELECT * FROM business_context_versions
      WHERE id = ? AND workspace_id = ?`).get(id, workspaceId()));
  }
  function getActiveVersion() {
    return context(db.prepare(`SELECT * FROM business_context_versions
      WHERE workspace_id = ? AND status = 'active'`).get(workspaceId()));
  }
  function getLatestDraft() {
    return context(db.prepare(`SELECT * FROM business_context_versions
      WHERE workspace_id = ? AND status = 'draft'
      ORDER BY version_number DESC LIMIT 1`).get(workspaceId()));
  }
  function listVersions() {
    return db.prepare(`SELECT * FROM business_context_versions
      WHERE workspace_id = ? ORDER BY version_number DESC`)
      .all(workspaceId()).map(context);
  }

  function createDraft({ profile: p, dna: d, brandBook: b, snapshot, sourceManifest, schemaVersion, userId, timestamp }) {
    const scoped = workspaceId();
    const number = db.prepare(`SELECT COALESCE(MAX(version_number),0)+1 AS next
      FROM business_context_versions WHERE workspace_id = ?`).get(scoped).next;
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO business_context_versions (
      id, workspace_id, business_profile_id, business_dna_version_id,
      brand_book_version_id, version_number, status, context_schema_version,
      snapshot_json, source_manifest_json, created_by_user_id, created_at,
      activated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, NULL, NULL)`)
      .run(id, scoped, p.id, d.id, b.id, number, schemaVersion,
        JSON.stringify(snapshot), JSON.stringify(sourceManifest), userId, timestamp);
    return getVersion(id);
  }

  function activateVersion(id, timestamp) {
    return db.transaction(() => {
      const scoped = workspaceId();
      const target = getVersion(id);
      if (!target || target.status !== "draft") return null;
      const previous = getActiveVersion();
      if (previous) db.prepare(`UPDATE business_context_versions
        SET status='archived', archived_at=? WHERE id=? AND workspace_id=? AND status='active'`)
        .run(timestamp, previous.id, scoped);
      db.prepare(`UPDATE business_context_versions
        SET status='active', activated_at=?, archived_at=NULL
        WHERE id=? AND workspace_id=? AND status='draft'`)
        .run(timestamp, id, scoped);
      return { version: getVersion(id), previousActiveVersionId: previous?.id || null };
    })();
  }

  function archiveDraft(id, timestamp) {
    const result = db.prepare(`UPDATE business_context_versions
      SET status='archived', archived_at=?
      WHERE id=? AND workspace_id=? AND status='draft'`)
      .run(timestamp, id, workspaceId());
    return result.changes ? getVersion(id) : null;
  }

  return {
    getCurrentSources, getVersion, getActiveVersion, getLatestDraft,
    listVersions, createDraft, activateVersion, archiveDraft,
  };
}
