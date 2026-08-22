import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { assertContentAssetStore, ContentAssetStoreError } from "../content-assets/content-asset-store.mjs";
import { assertContentAssetQuota, sanitizeOriginalFilename, validateDeclaredAsset } from "../content-assets/content-asset-policy.mjs";

const ROLES = new Set(["owner", "admin", "member"]);
const FIELDS = ["mediaType", "declaredMimeType", "declaredByteSize", "declaredSha256", "originalFilename"];
const canonical = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = (value) => crypto.createHash("sha256").update(canonical(value)).digest("hex");
const exact = (value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((field) => FIELDS.includes(field));

export class ContentAssetError extends Error {
  constructor(code, status = 400) { super(code); this.name = "ContentAssetError"; this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new ContentAssetError(code, status); };
const timestampAfter = (candidate, previous) => candidate > previous ? candidate : new Date(Date.parse(previous) + 1).toISOString();
const safe = (asset) => asset && Object.freeze({
  id: asset.id, mediaType: asset.mediaType, declaredMimeType: asset.declaredMimeType, declaredByteSize: asset.declaredByteSize,
  mimeType: asset.mimeType, byteSize: asset.byteSize, width: asset.width, height: asset.height, durationMs: asset.durationMs,
  originalFilename: asset.originalFilename, status: asset.status, failureCode: asset.failureCode,
  uploadExpiresAt: asset.uploadExpiresAt, createdAt: asset.createdAt, updatedAt: asset.updatedAt, readyAt: asset.readyAt,
});

export function createContentAssetService({ repository, store, operationMetrics, now = () => new Date(), id = () => crypto.randomUUID() }) {
  assertContentAssetStore(store);
  const metric = (operation, started, data = {}) => operationMetrics?.record({ operation, workspaceId: requireWorkspaceId(), durationMs: performance.now() - started, ...data });
  const actorAllowed = (actor) => { if (!actor?.userId || !ROLES.has(actor.role)) fail("CONTENT_ASSET_INVALID", 403); };
  const key = (value) => { if (typeof value !== "string" || !value.trim() || value.length > 200) fail("CONTENT_ASSET_INVALID"); return value.trim(); };
  const get = (assetId) => repository.findById(assetId) || fail("CONTENT_ASSET_NOT_FOUND", 404);
  return Object.freeze({
    createFoundationIntent(input, actor, rawIdempotencyKey) {
      const started = performance.now(); actorAllowed(actor);
      if (store.kind !== "TEST_MEMORY") throw new ContentAssetStoreError();
      if (!exact(input) || ["mediaType", "declaredMimeType", "declaredByteSize", "declaredSha256"].some((field) => !Object.hasOwn(input, field))) fail("CONTENT_ASSET_INVALID");
      let declared; let originalFilename;
      try { declared = validateDeclaredAsset(input); originalFilename = sanitizeOriginalFilename(input.originalFilename); assertContentAssetQuota(repository.quotaUsage(), declared.declaredByteSize); } catch (error) { if (error?.code) throw error; fail("CONTENT_ASSET_INVALID"); }
      const idempotencyKey = key(rawIdempotencyKey), requestHash = hash({ ...declared, originalFilename });
      const prior = repository.findByIdempotency(actor.userId, "content_asset.intent", idempotencyKey);
      if (prior) { if (prior.requestHash !== requestHash) fail("CONTENT_ASSET_IDEMPOTENCY_CONFLICT", 409); metric("asset.intent.create", started, { mediaType: prior.mediaType, status: prior.status, reusedResult: true, rowsRead: 1 }); return Object.freeze({ asset: safe(prior), reusedResult: true }); }
      const assetId = id(), workspaceId = requireWorkspaceId(), storageObjectKey = `workspaces/${workspaceId}/content-assets/${assetId}/original`, createdAt = now().toISOString();
      const uploadExpiresAt = new Date(Date.parse(createdAt) + 10 * 60 * 1000).toISOString();
      const result = repository.create({ id: assetId, createdByUserId: actor.userId, ...declared, originalFilename, storageProvider: "TEST_MEMORY", storageObjectKey, operationKind: "content_asset.intent", idempotencyKey, requestHash, uploadExpiresAt, createdAt });
      if (!result.created && result.asset.requestHash !== requestHash) fail("CONTENT_ASSET_IDEMPOTENCY_CONFLICT", 409);
      metric("asset.intent.create", started, { mediaType: result.asset.mediaType, status: result.asset.status, reusedResult: !result.created, rowsWritten: Number(result.created) });
      return Object.freeze({ asset: safe(result.asset), reusedResult: !result.created });
    },
    get(assetId) { return safe(get(assetId)); },
    claimVerification(assetId) { const asset = get(assetId), changed = repository.claimVerification(assetId, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordReady(assetId, verified) { const asset = get(assetId), changed = repository.recordReady(assetId, verified, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordRejected(assetId, failureCode) { const asset = get(assetId), changed = repository.recordRejected(assetId, failureCode, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordFailed(assetId, failureCode) { const asset = get(assetId), changed = repository.recordFailed(assetId, failureCode, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    requestDeletion(assetId) { const asset = get(assetId), changed = repository.requestDeletion(assetId, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordDeleted(assetId) { const asset = get(assetId), changed = repository.recordDeleted(assetId, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
  });
}
