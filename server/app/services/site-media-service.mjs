import { requireWorkspaceId } from "../tenant-context.mjs";

const ASSET_TYPES = new Set(["logo", "hero", "banner", "product", "gallery", "favicon"]);
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export class SiteMediaError extends Error {
  constructor(message, status = 400, code = "SITE_MEDIA_ERROR") {
    super(message); this.name = "SiteMediaError"; this.status = status; this.code = code;
  }
}

const requireAssetType = (value) => {
  if (!ASSET_TYPES.has(value)) throw new SiteMediaError("assetType is invalid.", 400, "SITE_MEDIA_ASSET_TYPE_INVALID");
  return value;
};

const requireMimeType = (value) => {
  const mimeType = String(value || "").toLowerCase();
  if (!MIME_TYPES.has(mimeType)) throw new SiteMediaError("mimeType is not supported.", 400, "SITE_MEDIA_MIME_TYPE_INVALID");
  return mimeType;
};

const requireSize = (value) => {
  const sizeBytes = Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new SiteMediaError("sizeBytes must be a positive integer.", 400, "SITE_MEDIA_SIZE_INVALID");
  if (sizeBytes > MAX_FILE_SIZE) throw new SiteMediaError("Media file is too large.", 413, "SITE_MEDIA_TOO_LARGE");
  return sizeBytes;
};

export function createSiteMediaService({ repository, siteProjectService, storage, now = () => new Date() }) {
  const expose = (asset) => asset ? ({ ...asset, url: storage.publicAssetUrl(asset.storageKey) }) : null;

  async function createUpload(siteProjectId, input = {}) {
    const project = siteProjectService.get(siteProjectId);
    const assetType = requireAssetType(input.assetType);
    const mimeType = requireMimeType(input.mimeType);
    const sizeBytes = requireSize(input.sizeBytes);
    const fileName = String(input.fileName || "").trim();
    if (!fileName) throw new SiteMediaError("fileName is required.", 400, "SITE_MEDIA_FILENAME_REQUIRED");
    const upload = await storage.signedUpload({
      workspaceId: requireWorkspaceId(), siteProjectId: project.id, assetType, fileName, upsert: false,
    });
    return { ...upload, assetType, mimeType, sizeBytes };
  }

  function completeUpload(siteProjectId, input = {}) {
    const project = siteProjectService.get(siteProjectId);
    const workspaceId = requireWorkspaceId();
    const assetType = requireAssetType(input.assetType);
    const mimeType = requireMimeType(input.mimeType);
    const sizeBytes = requireSize(input.sizeBytes);
    const storageKey = String(input.storageKey || "").trim();
    const expectedPrefix = `${workspaceId}/${project.id}/${assetType}/`;
    if (!storageKey.startsWith(expectedPrefix) || storageKey === expectedPrefix) {
      throw new SiteMediaError("storageKey does not belong to this project.", 403, "SITE_MEDIA_STORAGE_KEY_FORBIDDEN");
    }
    const asset = repository.create({
      siteProjectId: project.id,
      assetType,
      storageKey,
      mimeType,
      sizeBytes,
      metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {},
      now: now().toISOString(),
    });
    return expose(asset);
  }

  function list(siteProjectId) {
    siteProjectService.get(siteProjectId);
    return repository.listByProject(siteProjectId).map(expose);
  }

  function remove(siteProjectId, mediaId) {
    siteProjectService.get(siteProjectId);
    if (!repository.get(siteProjectId, mediaId)) throw new SiteMediaError("Media asset not found.", 404, "SITE_MEDIA_NOT_FOUND");
    return repository.remove(siteProjectId, mediaId);
  }

  return Object.freeze({ createUpload, completeUpload, list, remove });
}
