import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { assertContentAssetStore, ContentAssetStoreError } from "../content-assets/content-asset-store.mjs";
import { assertContentAssetQuota, sanitizeOriginalFilename, validateDeclaredAsset } from "../content-assets/content-asset-policy.mjs";
import { MEDIA_OPTIMIZATION_POLICY } from "../content-assets/media-optimization-policy.mjs";
import { verifyAndOptimizeImage, verifyVideo } from "../content-assets/media-verifier.mjs";
import { imageVerificationSemaphore, videoVerificationSemaphore } from "../content-assets/media-concurrency.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  canonicalMimeType: asset.canonicalMimeType, canonicalByteSize: asset.canonicalByteSize, optimizationOutcome: asset.optimizationOutcome,
});

export function createContentAssetService({ repository, store, operationMetrics, now = () => new Date(), id = () => crypto.randomUUID() }) {
  assertContentAssetStore(store);
  const metric = (operation, started, data = {}) => operationMetrics?.record({ operation, workspaceId: requireWorkspaceId(), durationMs: performance.now() - started, ...data });
  const actorAllowed = (actor) => { if (!actor?.userId || !ROLES.has(actor.role)) fail("CONTENT_ASSET_INVALID", 403); };
  const key = (value) => { if (typeof value !== "string" || !value.trim() || value.length > 200) fail("CONTENT_ASSET_INVALID"); return value.trim(); };
  const get = (assetId) => repository.findById(assetId) || fail("CONTENT_ASSET_NOT_FOUND", 404);
  const locator = (asset, objectKey = asset.storageObjectKey) => ({ storageProvider: asset.storageBackendKind || asset.storageProvider, storageObjectKey: objectKey });
  const createIntentRecord = (input, actor, rawIdempotencyKey) => {
    actorAllowed(actor);
    if (!exact(input) || ["mediaType", "declaredMimeType", "declaredByteSize", "declaredSha256"].some((field) => !Object.hasOwn(input, field))) fail("CONTENT_ASSET_INVALID");
    let declared; let originalFilename;
    try { declared = validateDeclaredAsset(input); if (declared.mediaType === "VIDEO" && declared.declaredByteSize > MEDIA_OPTIMIZATION_POLICY.video.maxUploadBytes) fail("CONTENT_ASSET_TOO_LARGE", 413); originalFilename = sanitizeOriginalFilename(input.originalFilename); assertContentAssetQuota(repository.quotaUsage(), declared.declaredByteSize); } catch (error) { if (error?.code) throw error; fail("CONTENT_ASSET_INVALID"); }
    const idempotencyKey = key(rawIdempotencyKey), requestHash = hash({ ...declared, originalFilename });
    const prior = repository.findByIdempotency(actor.userId, "content_asset.intent", idempotencyKey);
    if (prior) { if (prior.requestHash !== requestHash) fail("CONTENT_ASSET_IDEMPOTENCY_CONFLICT", 409); return { asset: prior, reusedResult: true }; }
    const assetId = id(), workspaceId = requireWorkspaceId(), storageObjectKey = `workspaces/${workspaceId}/content-assets/${assetId}/original`, createdAt = now().toISOString(), uploadExpiresAt = new Date(Date.parse(createdAt) + 600000).toISOString();
    const result = repository.create({ id: assetId, createdByUserId: actor.userId, ...declared, originalFilename, storageProvider: store.legacyProviderKind, storageBackendKind: store.backendKind, storageObjectKey, operationKind: "content_asset.intent", idempotencyKey, requestHash, uploadExpiresAt, createdAt });
    if (!result.created && result.asset.requestHash !== requestHash) fail("CONTENT_ASSET_IDEMPOTENCY_CONFLICT", 409);
    return { asset: result.asset, reusedResult: !result.created };
  };
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
    async createUploadIntent(input, actor, rawIdempotencyKey) {
      const started = performance.now(); if (!store.uploadEnabled) throw new ContentAssetStoreError();
      const result = createIntentRecord(input, actor, rawIdempotencyKey);
      const authorization = await store.createUploadAuthorization({ locator: locator(result.asset), contentType: result.asset.declaredMimeType, contentSha256: result.asset.declaredSha256, expiresIn: 600 });
      metric("asset.upload_intent.create", started, { mediaType: result.asset.mediaType, reusedResult: result.reusedResult, rowsWritten: Number(!result.reusedResult) });
      return Object.freeze({ assetId: result.asset.id, ...authorization, reusedResult: result.reusedResult });
    },
    async complete(assetId, actor) {
      const started = performance.now(); actorAllowed(actor); const current = get(assetId);
      if (current.status === "READY") return safe(current);
      const semaphore = current.mediaType === "VIDEO" ? videoVerificationSemaphore : imageVerificationSemaphore;
      const release = semaphore.tryAcquire(); if (!release) fail("CONTENT_ASSET_BUSY", 503);
      let directory = null;
      const claimed = repository.claimVerification(assetId, timestampAfter(now().toISOString(), current.updatedAt)); if (!claimed) { release(); fail("CONTENT_ASSET_STATE_CONFLICT", 409); }
      try {
        const sourceLocator = locator(claimed), stat = await store.statObject(sourceLocator);
        if (stat.byteSize !== claimed.declaredByteSize || !(await store.verifyChecksum(sourceLocator, claimed.declaredSha256))) throw Object.assign(new Error(), { code: "CONTENT_ASSET_INTEGRITY_FAILED" });
        directory = await mkdtemp(join(tmpdir(), "loadder-media-")); const mediaPath = join(directory, "source");
        const downloaded = await store.downloadObjectToFile(sourceLocator, { destinationPath: mediaPath, maxBytes: claimed.declaredByteSize });
        if (downloaded.byteSize !== claimed.declaredByteSize) throw Object.assign(new Error(), { code: "CONTENT_ASSET_INTEGRITY_FAILED" });
        let media;
        if (claimed.mediaType === "IMAGE") media = await verifyAndOptimizeImage(mediaPath, claimed.declaredMimeType, downloaded.byteSize); else media = { original: await verifyVideo(mediaPath, downloaded.byteSize), canonical: null, outcome: "OPTIMIZATION_SKIPPED" };
        const candidate = media.canonical || media.original;
        const canonicalStorageObjectKey = media.canonical ? `workspaces/${claimed.workspaceId}/content-assets/${claimed.id}/optimized/1/master.webp` : claimed.storageObjectKey;
        if (media.canonical) await store.writeCanonicalObject(locator(claimed, canonicalStorageObjectKey), { body: candidate.body, contentType: candidate.mimeType, contentSha256: candidate.sha256 });
        const ready = repository.recordCanonicalReady(assetId, { sourceMimeType: media.original.mimeType, sourceByteSize: media.original.byteSize, sourceSha256: media.original.sha256, width: media.original.width, height: media.original.height, durationMs: media.original.durationMs || null, canonicalStorageObjectKey, canonicalMimeType: candidate.mimeType, canonicalByteSize: candidate.byteSize, canonicalSha256: candidate.sha256, optimizationPolicyVersion: MEDIA_OPTIMIZATION_POLICY.id, optimizationOutcome: media.outcome, sourceRetentionUntil: media.canonical ? new Date(now().getTime() + MEDIA_OPTIMIZATION_POLICY.sourceRecoveryMs).toISOString() : null }, timestampAfter(now().toISOString(), claimed.updatedAt));
        metric("asset.complete", started, { mediaType: ready.mediaType, status: ready.status, originalBytes: media.original.byteSize, canonicalBytes: candidate.byteSize, savedBytes: media.original.byteSize - candidate.byteSize, optimizationOutcome: ready.optimizationOutcome, rowsWritten: 1 }); return safe(ready);
      } catch (error) {
        const code = error?.code === "CONTENT_ASSET_STORAGE_UNAVAILABLE" ? error.code : error?.code === "CONTENT_ASSET_INTEGRITY_FAILED" ? error.code : "CONTENT_ASSET_MEDIA_INVALID";
        if (code === "CONTENT_ASSET_STORAGE_UNAVAILABLE") repository.recordFailed(assetId, code, timestampAfter(now().toISOString(), claimed.updatedAt)); else repository.recordRejected(assetId, code, timestampAfter(now().toISOString(), claimed.updatedAt)); throw new ContentAssetError(code, code === "CONTENT_ASSET_STORAGE_UNAVAILABLE" ? 503 : 422);
      } finally { if (directory) await rm(directory, { recursive: true, force: true }); release(); }
    },
    async access(assetId, actor) { actorAllowed(actor); const asset = get(assetId); if (asset.status !== "READY") fail("CONTENT_ASSET_NOT_READY", 409); return store.createReadAuthorization(locator(asset, asset.canonicalStorageObjectKey || asset.storageObjectKey), { expiresIn: asset.mediaType === "VIDEO" ? 900 : 300 }); },
    async delete(assetId, actor) { actorAllowed(actor); const asset = get(assetId); const deleting = asset.status === "DELETING" ? asset : repository.requestDeletion(assetId, timestampAfter(now().toISOString(), asset.updatedAt)); if (!deleting) fail("CONTENT_ASSET_STATE_CONFLICT", 409); try { const keys = new Set([deleting.storageObjectKey, deleting.canonicalStorageObjectKey].filter(Boolean)); for (const objectKey of keys) await store.deleteObject(locator(deleting, objectKey)); return safe(repository.recordDeleted(assetId, timestampAfter(now().toISOString(), deleting.updatedAt))); } catch { throw new ContentAssetError("CONTENT_ASSET_STORAGE_UNAVAILABLE", 503); } },
    get(assetId) { return safe(get(assetId)); },
    claimVerification(assetId) { const asset = get(assetId), changed = repository.claimVerification(assetId, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordReady(assetId, verified) { const asset = get(assetId), changed = repository.recordReady(assetId, verified, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordRejected(assetId, failureCode) { const asset = get(assetId), changed = repository.recordRejected(assetId, failureCode, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordFailed(assetId, failureCode) { const asset = get(assetId), changed = repository.recordFailed(assetId, failureCode, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    requestDeletion(assetId) { const asset = get(assetId), changed = repository.requestDeletion(assetId, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
    recordDeleted(assetId) { const asset = get(assetId), changed = repository.recordDeleted(assetId, timestampAfter(now().toISOString(), asset.updatedAt)); if (!changed) fail("CONTENT_ASSET_STATE_CONFLICT", 409); return safe(changed); },
  });
}
