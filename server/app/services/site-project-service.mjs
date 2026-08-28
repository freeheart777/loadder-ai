import crypto from "node:crypto";

const TYPES = new Set(["BUSINESS", "STORE", "NEWS", "LEGAL", "MEDICAL"]);
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || `site-${crypto.randomUUID().slice(0, 8)}`;

export class SiteProjectError extends Error {
  constructor(message, status = 400, code = "SITE_PROJECT_ERROR") { super(message); this.status = status; this.code = code; }
}

export function createSiteProjectService({ repository, businessContextService, now = () => new Date() }) {
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
  function list() { return repository.list(); }
  function get(id) { const project = repository.get(id); if (!project) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND"); return project; }
  function assets(id) { get(id); return repository.listAssets(id); }
  function addAsset(id, input) {
    if (!input?.url || !input?.name) throw new SiteProjectError("Asset name and url are required.");
    const asset = repository.addAsset(id, { ...input, now: now().toISOString() });
    if (!asset) throw new SiteProjectError("Site project not found.", 404, "SITE_PROJECT_NOT_FOUND");
    return asset;
  }
  function remove(id) { get(id); return repository.remove(id); }
  function removeAsset(id) { get(id); if (!repository.removeAsset(id)) throw new SiteProjectError("Asset not found.", 404, "SITE_ASSET_NOT_FOUND"); return true; }
  return Object.freeze({ list, get, create, update, publish, assets, addAsset, remove, removeAsset });
}
