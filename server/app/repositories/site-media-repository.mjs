import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const parseMetadata = (value) => {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
};

const mapRow = (row) => row ? ({
  id: row.id,
  workspaceId: row.workspace_id,
  siteProjectId: row.site_project_id,
  assetType: row.asset_type,
  storageKey: row.storage_key,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  metadata: parseMetadata(row.metadata_json),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}) : null;

export function createSiteMediaRepository(db) {
  function listByProject(siteProjectId) {
    return db.prepare(`SELECT * FROM site_media_assets WHERE workspace_id=? AND site_project_id=? ORDER BY created_at DESC`)
      .all(requireWorkspaceId(), siteProjectId).map(mapRow);
  }

  function get(siteProjectId, mediaId) {
    return mapRow(db.prepare(`SELECT * FROM site_media_assets WHERE id=? AND workspace_id=? AND site_project_id=?`)
      .get(mediaId, requireWorkspaceId(), siteProjectId));
  }

  function findByStorageKey(siteProjectId, storageKey) {
    return mapRow(db.prepare(`SELECT * FROM site_media_assets WHERE workspace_id=? AND site_project_id=? AND storage_key=? ORDER BY created_at DESC LIMIT 1`)
      .get(requireWorkspaceId(), siteProjectId, storageKey));
  }

  function create({ siteProjectId, assetType, storageKey, mimeType, sizeBytes, metadata = {}, now }) {
    const existing = findByStorageKey(siteProjectId, storageKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    const workspaceId = requireWorkspaceId();
    db.prepare(`INSERT INTO site_media_assets
      (id, workspace_id, site_project_id, asset_type, storage_key, mime_type, size_bytes, metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, workspaceId, siteProjectId, assetType, storageKey, mimeType, sizeBytes, JSON.stringify(metadata), now, now);
    return get(siteProjectId, id);
  }

  function remove(siteProjectId, mediaId) {
    return db.prepare(`DELETE FROM site_media_assets WHERE id=? AND workspace_id=? AND site_project_id=?`)
      .run(mediaId, requireWorkspaceId(), siteProjectId).changes > 0;
  }

  return Object.freeze({ listByProject, get, findByStorageKey, create, remove });
}
