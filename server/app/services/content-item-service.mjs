import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { decodeCursor } from "../query/cursor-pagination.mjs";
import { assertContentSourceCreationEnabled } from "../content-items/source-type-registry.mjs";

const ROLES = new Set(["owner", "admin", "member"]);
const MEDIA = new Set(["TEXT", "IMAGE", "VIDEO"]);
const SAVE_FIELDS = ["variantIndex", "title"];
const UPDATE_FIELDS = ["title", "content", "expectedRevision"];
const DUPLICATE_FIELDS = ["title"];
const MANUAL_FIELDS = ["contractId", "contractVersion", "placementId", "placementVersion", "title", "content"];
const ASSET_FIELDS = ["assetId", "title"];
const LABELS = Object.freeze({ social_post: "پست اینستاگرام", ad_copy: "متن تبلیغ", marketing_email: "ایمیل بازاریابی", blog_outline: "طرح مقاله", landing_page_copy: "متن صفحه فرود" });
const canonical = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = (value) => crypto.createHash("sha256").update(canonical(value)).digest("hex");
const exact = (value, allowed) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key));

export class ContentItemError extends Error {
  constructor(code, status = 400) { super(code); this.name = "ContentItemError"; this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new ContentItemError(code, status); };
const permission = (actor) => { if (!actor?.userId || !ROLES.has(actor.role)) fail("CONTENT_ITEM_PERMISSION_DENIED", 403); };
const key = (value) => {
  if (typeof value !== "string" || !value.trim() || value.length > 200) fail("CONTENT_ITEM_INVALID");
  return value.trim();
};
const title = (value, optional = false) => {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string" || !value.trim() || [...value].length > 200) fail("CONTENT_ITEM_INVALID");
  return value.trim();
};
const contractFor = (registry, item) => {
  if (item.mediaType !== "TEXT") fail("CONTENT_ITEM_PERMISSION_DENIED", 403);
  const contract = registry.get(item.contractId, item.contractVersion);
  if (!contract || contract.mediaType !== "TEXT" || contract.placementId !== item.placementId || contract.placementVersion !== item.placementVersion) fail("CONTENT_ITEM_INVALID");
  return contract;
};
const validate = (contract, content) => {
  try { contract.validateOutput({ variants: [content] }, 1); } catch { fail("CONTENT_ITEM_INVALID"); }
  if ([...JSON.stringify(content)].length > 35000) fail("CONTENT_ITEM_INVALID");
  return content;
};
const safe = (item, asset = null) => item && Object.freeze({
  id: item.contentItemId, sourceType: item.sourceType, mediaType: item.mediaType, contractId: item.contractId, contractVersion: item.contractVersion,
  placementId: item.placementId, placementVersion: item.placementVersion, title: item.title, content: item.content,
  revision: item.revision, sourceGenerationId: item.sourceGenerationId, sourceVariantIndex: item.sourceVariantIndex,
  contextVersionId: item.contextVersionId, createdAt: item.createdAt, updatedAt: item.updatedAt,
  primaryAsset: asset ? Object.freeze({ id: asset.id, mediaType: asset.mediaType, mimeType: asset.canonicalMimeType || asset.mimeType, byteSize: asset.canonicalByteSize || asset.byteSize, width: asset.width, height: asset.height, durationMs: asset.durationMs, originalFilename: asset.originalFilename, status: asset.status }) : null,
});
const advancingTimestamp = (candidate, previous) => candidate > previous ? candidate : new Date(Date.parse(previous) + 1).toISOString();

export function createContentItemService({ repository, generationRepository, assetRepository, contractRegistry, placementRegistry, operationMetrics, now = () => new Date() }) {
  const metric = (operation, started, data = {}) => operationMetrics.record({ operation, workspaceId: requireWorkspaceId(), durationMs: performance.now() - started, ...data });
  const getStored = (id) => repository.findById(id) || fail("CONTENT_ITEM_NOT_FOUND", 404);
  const present = (item) => safe(item, item?.primaryAssetId ? assetRepository.findById(item.primaryAssetId) : null);
  const prior = (userId, operation, idempotencyKey, requestHash) => {
    const item = repository.findByIdempotency(userId, operation, idempotencyKey);
    if (!item) return null;
    if (item.requestHash !== requestHash) fail("CONTENT_ITEM_IDEMPOTENCY_CONFLICT", 409);
    return item;
  };
  return Object.freeze({
    createFromAsset(input, actor, rawKey) {
      const started = performance.now(); permission(actor);
      if (!exact(input, ASSET_FIELDS) || ASSET_FIELDS.some((field) => !Object.hasOwn(input, field)) || typeof input.assetId !== "string" || !input.assetId) fail("CONTENT_ITEM_INVALID");
      assertContentSourceCreationEnabled("CLIENT_UPLOADED");
      const normalizedTitle = title(input.title), idempotencyKey = key(rawKey), requestHash = hash({ assetId: input.assetId, title: normalizedTitle });
      const replay = prior(actor.userId, "content_item.from_asset", idempotencyKey, requestHash);
      if (replay) return { item: present(replay), reusedResult: true };
      const asset = assetRepository.findById(input.assetId);
      if (!asset) fail("CONTENT_ASSET_NOT_FOUND", 404);
      if (asset.status !== "READY") fail("CONTENT_ASSET_NOT_READY", 409);
      const timestamp = now().toISOString();
      const result = repository.create({ userId: actor.userId, sourceType: "CLIENT_UPLOADED", sourceGenerationId: null, sourceVariantIndex: null, mediaType: asset.mediaType, contractId: null, contractVersion: null, placementId: null, placementVersion: null, contextVersionId: null, primaryAssetId: asset.id, title: normalizedTitle, content: {}, operationKind: "content_item.from_asset", idempotencyKey, requestHash, now: timestamp });
      if (!result.created && result.item.requestHash !== requestHash) fail("CONTENT_ITEM_IDEMPOTENCY_CONFLICT", 409);
      metric("content_item.from_asset", started, { mediaType: asset.mediaType, rowsWritten: Number(result.created), reusedResult: !result.created });
      return { item: present(result.item), reusedResult: !result.created };
    },
    saveGeneration(generationId, input, actor, rawKey) {
      const started = performance.now(); permission(actor);
      if (!exact(input, SAVE_FIELDS) || !Number.isInteger(input.variantIndex) || input.variantIndex < 0) fail("CONTENT_ITEM_INVALID");
      const idempotencyKey = key(rawKey), normalizedTitle = title(input.title, true);
      const requestHash = hash({ generationId, variantIndex: input.variantIndex, title: normalizedTitle ?? null });
      const replay = prior(actor.userId, "content_item.save", idempotencyKey, requestHash);
      if (replay) { metric("content_item.save", started, { reusedResult: true, rowsRead: 1 }); return { item: safe(replay), reusedResult: true }; }
      const generation = generationRepository.findById(generationId);
      if (!generation) fail("CONTENT_ITEM_NOT_FOUND", 404);
      if (generation.status !== "SUCCEEDED") fail("CONTENT_GENERATION_NOT_SAVABLE", 409);
      if (!Array.isArray(generation.variants) || input.variantIndex >= generation.variants.length) fail("CONTENT_VARIANT_NOT_FOUND", 404);
      const contract = contractFor(contractRegistry, generation), content = validate(contract, generation.variants[input.variantIndex]);
      const timestamp = now().toISOString();
      const derivedTitle = normalizedTitle ?? `${LABELS[generation.contractId] || "محتوا"} — ${timestamp.slice(0, 10)}`;
      const result = repository.create({ userId: actor.userId, sourceType: "AI_GENERATED", sourceGenerationId: generation.generationId, sourceVariantIndex: input.variantIndex, mediaType: generation.mediaType, contractId: generation.contractId, contractVersion: generation.contractVersion, placementId: generation.placementId, placementVersion: generation.placementVersion, contextVersionId: generation.contextVersionId, title: derivedTitle, content, operationKind: "content_item.save", idempotencyKey, requestHash, now: timestamp });
      if (!result.created && result.item.requestHash !== requestHash) fail("CONTENT_ITEM_IDEMPOTENCY_CONFLICT", 409);
      metric("content_item.save", started, { mediaType: generation.mediaType, contractId: generation.contractId, contractVersion: generation.contractVersion, placementId: generation.placementId, placementVersion: generation.placementVersion, rowsWritten: Number(result.created), reusedResult: !result.created });
      return { item: safe(result.item), reusedResult: !result.created };
    },
    createManual(input, actor, rawKey) {
      const started = performance.now(); permission(actor);
      if (input && typeof input === "object" && Object.hasOwn(input, "sourceType")) fail("CONTENT_SOURCE_INVALID");
      if (!exact(input, MANUAL_FIELDS) || MANUAL_FIELDS.some((field) => !Object.hasOwn(input, field))) fail("CONTENT_ITEM_INVALID");
      assertContentSourceCreationEnabled("MANUAL_TEXT");
      if (typeof input.contractId !== "string" || !Number.isInteger(input.contractVersion) || typeof input.placementId !== "string" || !Number.isInteger(input.placementVersion)) fail("CONTENT_ITEM_INVALID");
      const contract = contractRegistry.get(input.contractId, input.contractVersion);
      if (!contract) fail("CONTENT_ITEM_NOT_FOUND", 404);
      if (contract.mediaType !== "TEXT") fail("CONTENT_SOURCE_INVALID");
      const placement = placementRegistry.get(input.placementId, input.placementVersion);
      if (!placement) fail("CONTENT_ITEM_NOT_FOUND", 404);
      if (placement.mediaType !== "TEXT" || contract.placementId !== placement.placementId || contract.placementVersion !== placement.placementVersion) fail("CONTENT_ITEM_INVALID");
      const normalizedTitle = title(input.title), content = validate(contract, input.content), idempotencyKey = key(rawKey);
      const requestHash = hash({ contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, title: normalizedTitle, content });
      const replay = prior(actor.userId, "content_item.manual", idempotencyKey, requestHash);
      if (replay) { metric("content_item.manual_create", started, { sourceType: "MANUAL_TEXT", mediaType: "TEXT", contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, reusedResult: true, rowsRead: 1 }); return { item: safe(replay), reusedResult: true }; }
      const timestamp = now().toISOString();
      const result = repository.create({ userId: actor.userId, sourceType: "MANUAL_TEXT", sourceGenerationId: null, sourceVariantIndex: null, mediaType: "TEXT", contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, contextVersionId: null, title: normalizedTitle, content, operationKind: "content_item.manual", idempotencyKey, requestHash, now: timestamp });
      if (!result.created && result.item.requestHash !== requestHash) fail("CONTENT_ITEM_IDEMPOTENCY_CONFLICT", 409);
      metric("content_item.manual_create", started, { sourceType: "MANUAL_TEXT", mediaType: "TEXT", contractId: contract.contractId, contractVersion: contract.contractVersion, placementId: placement.placementId, placementVersion: placement.placementVersion, rowsWritten: Number(result.created), reusedResult: !result.created });
      return { item: safe(result.item), reusedResult: !result.created };
    },
    list(query = {}, actor) {
      const started = performance.now(); permission(actor);
      if (Object.keys(query).some((field) => !["limit", "cursor", "mediaType", "contractId", "placementId"].includes(field))) fail("CONTENT_ITEM_INVALID");
      const limit = query.limit === undefined ? 20 : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (query.mediaType && !MEDIA.has(query.mediaType)) || [query.contractId, query.placementId].some((v) => v !== undefined && (typeof v !== "string" || !v || v.length > 100))) fail("CONTENT_ITEM_INVALID");
      let cursor; try { cursor = decodeCursor(query.cursor, "content_items", ["updatedAt", "id"]); } catch { fail("CONTENT_ITEM_INVALID"); }
      const page = repository.listPage({ limit, cursor, mediaType: query.mediaType, contractId: query.contractId, placementId: query.placementId });
      metric("content_item.list", started, { rowsRead: page.items.length, resultCount: page.items.length });
      return { items: page.items.map(present), nextCursor: page.nextCursor };
    },
    get(id, actor) { const started = performance.now(); permission(actor); const item = getStored(id); metric("content_item.get", started, { rowsRead: 1, mediaType: item.mediaType, contractId: item.contractId, contractVersion: item.contractVersion, placementId: item.placementId, placementVersion: item.placementVersion }); return present(item); },
    update(id, input, actor) {
      const started = performance.now(); permission(actor);
      if (!exact(input, UPDATE_FIELDS) || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1 || (input.title === undefined && input.content === undefined)) fail("CONTENT_ITEM_INVALID");
      const stored = getStored(id);
      if (stored.primaryAssetId && (input.content !== undefined || input.title === undefined)) fail("CONTENT_ITEM_INVALID");
      const contract = stored.primaryAssetId ? null : contractFor(contractRegistry, stored);
      const nextTitle = input.title === undefined ? stored.title : title(input.title);
      const nextContent = input.content === undefined ? stored.content : validate(contract, input.content);
      const updated = repository.update(id, input.expectedRevision, { title: nextTitle, content: nextContent, now: advancingTimestamp(now().toISOString(), stored.updatedAt) });
      if (!updated) { if (!repository.findById(id)) fail("CONTENT_ITEM_NOT_FOUND", 404); fail("CONTENT_ITEM_REVISION_CONFLICT", 409); }
      metric("content_item.update", started, { rowsWritten: 1, mediaType: updated.mediaType, contractId: updated.contractId, contractVersion: updated.contractVersion, placementId: updated.placementId, placementVersion: updated.placementVersion });
      return present(updated);
    },
    duplicate(id, input, actor, rawKey) {
      const started = performance.now(); permission(actor);
      if (!exact(input, DUPLICATE_FIELDS)) fail("CONTENT_ITEM_INVALID");
      const idempotencyKey = key(rawKey), normalizedTitle = title(input.title, true);
      const requestHash = hash({ contentItemId: id, title: normalizedTitle ?? null });
      const replay = prior(actor.userId, "content_item.duplicate", idempotencyKey, requestHash);
      if (replay) { metric("content_item.duplicate", started, { reusedResult: true, rowsRead: 1 }); return { item: safe(replay), reusedResult: true }; }
      const stored = getStored(id); if (!stored.primaryAssetId) contractFor(contractRegistry, stored);
      const timestamp = now().toISOString();
      const result = repository.create({ userId: actor.userId, sourceType: stored.sourceType, sourceGenerationId: stored.sourceGenerationId, sourceVariantIndex: stored.sourceVariantIndex, mediaType: stored.mediaType, contractId: stored.contractId, contractVersion: stored.contractVersion, placementId: stored.placementId, placementVersion: stored.placementVersion, contextVersionId: stored.contextVersionId, primaryAssetId: stored.primaryAssetId, title: normalizedTitle ?? `${stored.title} — نسخه کپی`, content: stored.content, operationKind: "content_item.duplicate", idempotencyKey, requestHash, now: timestamp });
      if (!result.created && result.item.requestHash !== requestHash) fail("CONTENT_ITEM_IDEMPOTENCY_CONFLICT", 409);
      metric("content_item.duplicate", started, { rowsWritten: Number(result.created), reusedResult: !result.created, mediaType: stored.mediaType, contractId: stored.contractId, contractVersion: stored.contractVersion, placementId: stored.placementId, placementVersion: stored.placementVersion });
      return { item: present(result.item), reusedResult: !result.created };
    },
  });
}
