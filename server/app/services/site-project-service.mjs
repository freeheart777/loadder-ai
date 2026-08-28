import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const TYPES = new Set(["BUSINESS", "STORE", "NEWS", "LEGAL", "MEDICAL"]);
const ASSET_KINDS = new Set(["logo", "hero", "banner", "product", "gallery", "favicon"]);
const MAX_ASSET_NAME = 200;
const MAX_ASSET_URL = 8 * 1024 * 1024;
const MAX_STORAGE_KEY = 500;
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `site-${crypto.randomUUID().slice(0, 8)}`;
const hashPreviewToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export class SiteProjectError extends Error {
  constructor(message, status = 400, code = "SITE_PROJECT_ERROR") { super(message); this.status = status; this.code = code; }
}

const validateAssetUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) throw new SiteProjectError("Asset name and url are required.");
  const url = value.trim();
  if (url.length > MAX_ASSET_URL) throw new SiteProjectError("Asset payload is too large.", 413, "SITE_ASSET_TOO_LARGE");
  if (url.startsWith("data:")) {
    if (!/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(url)) throw new SiteProjectError("Only base64 image data URLs are supported.", 400, "SITE_ASSET_URL_INVALID");
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("unsupported protocol");
  } catch {
    throw new SiteProjectError("Asset url must be an HTTP(S) URL or supported image data URL.", 400, "SITE_ASSET_URL_INVALID");
  }
  return url;
};

export function createSiteProjectService({ repository, businessContextService, domainService, now = () => new Date() }) {
  const requireType = (siteType) => { if (!TYPES.has(siteType)) throw new SiteProjectError("siteType is invalid.", 400, "SITE_TYPE_INVALID"); return siteType; };
  function contextSeed() {
    const current = businessContextService?.getCurrent?.();
    if (!current?.activeContext) throw new SiteProjectError("Business Context is required before creating a site.", 409, "BUSINESS_CONTEXT_REQUIRED");
    if (current.isStale) throw new SiteProjectError("Business Context is stale. Refresh it before creating a site.", 409, "BUSINESS_CONTEXT_STALE");
    return current.activeContext;
  }
  function create({ name, siteType, slug, content = {} }) {
    const context = contextSeed();
    if (typeof name !== "string" || !name.trim()) throw new SiteProjectError("name is required.");
    requireType(siteType);
    const cleanName = name.trim();
    return repository.create({ name: cleanName, siteType, slug: slugify(slug || cleanName), contextVersionId: context.id, content, now: now().toISOString() });
  }
  function update(id, input = {}) {
    const current = repository.get(id);
    if (!current) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND");
    if (input.siteType !== undefined) requireType(input.siteType);
    return repository.update(id, { ...input, slug: input.slug ? slugify(input.slug) : undefined, now: now().toISOString() });
  }
  function publish(id) {
    const current = repository.get(id);
    if (!current) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND");
    if (!current.content || Object.keys(current.content).length === 0) throw new SiteProjectError("A site needs content before publishing.", 409, "SITE_CONTENT_REQUIRED");
    return repository.publish(id, now().toISOString());
  }
  function versions(id) { get(id); return repository.listPublishVersions(id); }
  function list() { return repository.list(); }
  function get(id) { const project = repository.get(id); if (!project) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND"); return project; }
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
  function remove(id) { get(id); return repository.remove(id); }
  function removeAsset(projectId, assetId) {
    get(projectId);
    if (!repository.removeAsset(projectId, assetId)) throw new SiteProjectError("Asset not found.", 404, "SITE_ASSET_NOT_FOUND");
    return true;
  }
  return Object.freeze({ list, get, create, update, publish, versions, assets, addAsset, domains, addDomain, removeDomain, createPreviewToken, remove, removeAsset });
}
