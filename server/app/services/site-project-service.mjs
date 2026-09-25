import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { ensureWebsitePlatformContent } from "./website-platform-definition.mjs";
import { validateSiteDocument } from "./site-page-model.mjs";
import { translateInstruction } from "./v16-instruction-translator.mjs";

const TYPES = new Set(["BUSINESS", "STORE", "NEWS", "LEGAL", "MEDICAL"]);
const ASSET_KINDS = new Set(["logo", "hero", "banner", "product", "gallery", "favicon"]);
const MAX_ASSET_NAME = 200;
const MAX_ASSET_URL = 8 * 1024 * 1024;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const MAX_STORAGE_KEY = 500;
const SLUG_MAX = 80;
const isSlugConflict = (error) => {
  const message = String(error?.message || "");
  return message.includes("site_projects.slug") ||
    message.includes("site_projects.workspace_id, site_projects.slug");
};
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `site-${crypto.randomUUID().slice(0, 8)}`;
const hashPreviewToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export class SiteProjectError extends Error {
  constructor(message, status = 400, code = "SITE_PROJECT_ERROR") { super(message); this.status = status; this.code = code; }
}

const dataUrlBytes = (url) => {
  const comma = url.indexOf(",");
  if (comma < 0) return Infinity;
  const payload = url.slice(comma + 1).replace(/\s/g, "");
  if (!payload) return 0;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
};

const validateAssetUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) throw new SiteProjectError("Asset name and url are required.");
  const url = value.trim();
  if (url.length > MAX_ASSET_URL) throw new SiteProjectError("Asset payload is too large.", 413, "SITE_ASSET_TOO_LARGE");
  if (url.startsWith("data:")) {
    if (!/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(url)) throw new SiteProjectError("Only base64 image data URLs are supported.", 400, "SITE_ASSET_URL_INVALID");
    if (dataUrlBytes(url) > MAX_ASSET_BYTES) throw new SiteProjectError("Image must be 3 MB or smaller.", 413, "SITE_ASSET_TOO_LARGE");
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("unsupported protocol");
  } catch {
    throw new SiteProjectError("Asset url must be an HTTPS URL or supported image data URL.", 400, "SITE_ASSET_URL_INVALID");
  }
  return url;
};

export function createSiteProjectService({ repository, businessContextService, domainService, now = () => new Date() }) {
  const requireType = (siteType) => { if (!TYPES.has(siteType)) throw new SiteProjectError("siteType is invalid.", 400, "SITE_TYPE_INVALID"); return siteType; };
  function optionalContextSeed() {
    const current = businessContextService?.getCurrent?.();
    if (!current?.activeContext) return null;
    if (current.isStale) return null;
    return current.activeContext;
  }
  // A generated slug must never collide (site_projects has UNIQUE(workspace_id,
  // slug); a template-created project is named after the template, so the
  // second site from the same template used to hit it). A taken slug gets a
  // short random suffix; the check is global, which also keeps slugs ready
  // for a workspace-free public URL, and a random suffix (not "-2", "-3")
  // keeps other tenants' site addresses from being enumerable. Existing
  // projects' slugs are never changed.
  const slugTaken = (slug, excludeId = null) => (repository.isSlugTaken ? repository.isSlugTaken(slug, excludeId) : false);
  function availableSlug(base) {
    if (!slugTaken(base)) return base;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = `-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
      const candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
      if (!slugTaken(candidate)) return candidate;
    }
    throw new SiteProjectError("Unable to allocate a unique site address.", 409, "SITE_SLUG_UNAVAILABLE");
  }
  function create({ name, siteType, slug, content = {} }) {
    const context = optionalContextSeed();
    if (typeof name !== "string" || !name.trim()) throw new SiteProjectError("name is required.");
    requireType(siteType);
    const cleanName = name.trim();
    const normalizedContent = ensureWebsitePlatformContent(validateSiteDocument(content), { siteType, name: cleanName });
    const base = slugify(slug || cleanName);
    // One retry covers a concurrent create that claimed the same slug between check and insert.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return repository.create({ name: cleanName, siteType, slug: availableSlug(base), contextVersionId: context?.id ?? null, content: normalizedContent, now: now().toISOString() });
      } catch (error) {
        if (!isSlugConflict(error) || attempt >= 1) throw isSlugConflict(error) ? new SiteProjectError("Unable to allocate a unique site address.", 409, "SITE_SLUG_UNAVAILABLE") : error;
      }
    }
  }
  function get(id) {
    const workspaceId = requireWorkspaceId();
    const project = repository.get(id);
    if (!project || project.workspaceId !== workspaceId) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND");
    return project;
  }
  function update(id, input = {}) {
    const current = get(id);
    if (input.siteType !== undefined) requireType(input.siteType);
    const nextSiteType = input.siteType ?? current.siteType;
    const nextName = typeof input.name === "string" && input.name.trim() ? input.name.trim() : current.name;
    const nextContent = input.content === undefined
      ? undefined
      : ensureWebsitePlatformContent(validateSiteDocument(input.content), { siteType: nextSiteType, name: nextName });
    const nextSlug = input.slug ? slugify(input.slug) : undefined;
    // An explicitly chosen address is never silently changed: a clash is a 409.
    if (nextSlug !== undefined && nextSlug !== current.slug && slugTaken(nextSlug, id)) {
      throw new SiteProjectError("This site address is already in use.", 409, "SITE_SLUG_TAKEN");
    }
    try {
      return repository.update(id, {
        ...input,
        ...(nextContent === undefined ? {} : { content: nextContent }),
        slug: nextSlug,
        now: now().toISOString(),
      });
    } catch (error) {
      if (isSlugConflict(error)) throw new SiteProjectError("This site address is already in use.", 409, "SITE_SLUG_TAKEN");
      throw error;
    }
  }
  // A tracked draft save: the same validation and normalisation the ordinary
  // update path applies, plus an immutable revision recorded in the same
  // transaction.
  function saveDraft(id, { content, idempotencyKey, actorUserId = null, expectedRevision = null } = {}) {
    const current = get(id);
    const normalized = ensureWebsitePlatformContent(validateSiteDocument(content), { siteType: current.siteType, name: current.name });
    const result = repository.saveDraftWithRevision(id, { content: normalized, idempotencyKey, actorUserId, expectedRevision, now: now().toISOString() });
    if (!result) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND");
    return result;
  }

  // Exact forward restore. Revision N is replayed as a new revision; nothing
  // in history is mutated or removed.
  function restoreDraftRevision(id, { revision, idempotencyKey, actorUserId = null } = {}) {
    get(id);
    const result = repository.restoreDocumentRevision(id, { revision, idempotencyKey, actorUserId, now: now().toISOString() });
    if (!result) throw new SiteProjectError("Site document revision not found.", 404, "SITE_REVISION_NOT_FOUND");
    return result;
  }

  // Ask Loadder's translation step. Side-effect free: it only reads the
  // current draft to resolve the selected section, and never touches the
  // database. The caller still proposes/previews/applies the resulting
  // operations through the ordinary patch pipeline, so the same policy and
  // revision guarantees apply to an AI-authored patch as to any other.
  function translateAskLoadderInstruction(id, { target, instruction } = {}) {
    const current = get(id);
    return translateInstruction({ document: current.content, target, instruction });
  }

  function proposePatch(id, { operations, idempotencyKey, actorUserId = null } = {}) {
    get(id);
    const result = repository.proposePatch(id, { operations, idempotencyKey, actorUserId });
    if (!result) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND");
    return result;
  }

  function previewPatch(id, patchId) {
    get(id);
    const result = repository.previewPatch(id, patchId);
    if (!result) throw new SiteProjectError("Site document patch not found.", 404, "SITE_PATCH_NOT_FOUND");
    return result;
  }

  function applyPatch(id, { patchId } = {}) {
    get(id);
    const result = repository.applyPatch(id, { patchId, now: now().toISOString() });
    if (!result) throw new SiteProjectError("Site document patch not found.", 404, "SITE_PATCH_NOT_FOUND");
    return result;
  }

  function documentPatches(id) { get(id); return repository.listDocumentPatches(id); }
  function documentPatch(id, patchId) { get(id); return repository.getDocumentPatch(id, patchId); }

  function documentRevisions(id) { get(id); return repository.listDocumentRevisions(id); }
  function documentRevision(id, revision) { get(id); return repository.getDocumentRevision(id, revision); }
  function currentDocumentRevision(id) { get(id); return repository.currentDocumentRevision(id); }

  function publish(id) {
    const current = get(id);
    if (!current.content || Object.keys(current.content).length === 0) throw new SiteProjectError("A site needs content before publishing.", 409, "SITE_CONTENT_REQUIRED");
    return repository.publish(id, now().toISOString());
  }
  function rollbackPublishVersion(id, targetVersionId) {
    get(id);
    if (typeof targetVersionId !== "string" || !targetVersionId.trim()) throw new SiteProjectError("targetVersionId is required.", 400, "SITE_PUBLISH_VERSION_REQUIRED");
    const result = repository.rollbackPublishVersion(id, targetVersionId.trim(), now().toISOString());
    if (!result) throw new SiteProjectError("Published version not found.", 404, "SITE_PUBLISH_VERSION_NOT_FOUND");
    return result;
  }
  function versions(id) { get(id); return repository.listPublishVersions(id); }
  function list() { return repository.list(); }
  function assets(id) { get(id); return repository.listAssets(id); }
  function addAsset(id, input) {
    get(id);
    if (!ASSET_KINDS.has(input?.kind)) throw new SiteProjectError("Asset kind is invalid.", 400, "SITE_ASSET_KIND_INVALID");
    if (typeof input?.name !== "string" || !input.name.trim()) throw new SiteProjectError("Asset name and url are required.");
    if (input.name.trim().length > MAX_ASSET_NAME) throw new SiteProjectError("Asset name is too long.", 400, "SITE_ASSET_NAME_INVALID");
    const url = validateAssetUrl(input.url);
    const storageKey = input.storageKey == null ? null : String(input.storageKey).trim();
    if (storageKey && storageKey.length > MAX_STORAGE_KEY) throw new SiteProjectError("storageKey is too long.", 400, "SITE_ASSET_STORAGE_KEY_INVALID");
    return repository.addAsset(id, { ...input, name: input.name.trim(), url, storageKey: storageKey || null, metadata: input.metadata ?? {}, now: now().toISOString() });
  }
  function domains(id) { get(id); return domainService?.listByProject?.(requireWorkspaceId(), id) ?? []; }
  function addDomain(id, domain) {
    get(id);
    if (!domainService) throw new SiteProjectError("Domain service is not configured.", 501, "SITE_DOMAIN_SERVICE_NOT_CONFIGURED");
    try { return domainService.attach({ workspaceId: requireWorkspaceId(), siteProjectId: id, domain, now: now().toISOString() }); }
    catch (error) { throw new SiteProjectError(error.message, error.status || 400, error.code || "SITE_DOMAIN_ERROR"); }
  }
  function removeDomain(id, domain) {
    get(id);
    if (!domainService) throw new SiteProjectError("Domain service is not configured.", 501, "SITE_DOMAIN_SERVICE_NOT_CONFIGURED");
    return domainService.remove(requireWorkspaceId(), id, domain);
  }
  function createPreviewToken(id) {
    get(id);
    const token = crypto.randomBytes(32).toString("base64url");
    if (!repository.createPreviewToken(id, hashPreviewToken(token))) throw new SiteProjectError("Unable to create preview token.", 500, "SITE_PREVIEW_TOKEN_CREATE_FAILED");
    return token;
  }
  function revokePreviewToken(id) { get(id); return repository.revokePreviewToken(id); }
  function remove(id) { get(id); return repository.remove(id); }
  function removeAsset(projectId, assetId) {
    get(projectId);
    if (!repository.removeAsset(projectId, assetId)) throw new SiteProjectError("Asset not found.", 404, "SITE_ASSET_NOT_FOUND");
    return true;
  }
  return Object.freeze({ list, get, create, update, saveDraft, restoreDraftRevision, translateAskLoadderInstruction, proposePatch, previewPatch, applyPatch, documentPatches, documentPatch, documentRevisions, documentRevision, currentDocumentRevision, publish, rollbackPublishVersion, versions, assets, addAsset, domains, addDomain, removeDomain, createPreviewToken, revokePreviewToken, remove, removeAsset });
}
