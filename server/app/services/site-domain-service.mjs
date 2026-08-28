import crypto from "node:crypto";

const normalizeDomain = (value) => {
  if (typeof value !== "string" || !value.trim()) throw new Error("domain is required.");
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (domain.length > 253 || domain.includes("/") || domain.includes(" ") || !domain.includes(".")) throw new Error("Invalid domain.");
  return domain;
};

export function createSiteDomainService(db) {
  const get = (domain) => db.prepare("SELECT * FROM site_domains WHERE domain=?").get(normalizeDomain(domain)) ?? null;
  const attach = ({ workspaceId, siteProjectId, domain, now }) => {
    const normalized = normalizeDomain(domain);
    const existing = get(normalized);
    if (existing && existing.site_project_id !== siteProjectId) throw Object.assign(new Error("Domain is already connected to another site."), { status: 409, code: "SITE_DOMAIN_CONFLICT" });
    const id = existing?.id ?? crypto.randomUUID();
    db.prepare(`INSERT INTO site_domains(id,workspace_id,site_project_id,domain,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(domain) DO UPDATE SET site_project_id=excluded.site_project_id,status='ACTIVE',updated_at=excluded.updated_at`).run(id, workspaceId, siteProjectId, normalized, "ACTIVE", now, now);
    return db.prepare("SELECT * FROM site_domains WHERE domain=?").get(normalized);
  };
  const resolve = (domain) => db.prepare("SELECT * FROM site_domains WHERE domain=? AND status='ACTIVE'").get(normalizeDomain(domain)) ?? null;
  const remove = (workspaceId, siteProjectId, domain) => db.prepare("DELETE FROM site_domains WHERE workspace_id=? AND site_project_id=? AND domain=?").run(workspaceId, siteProjectId, normalizeDomain(domain)).changes === 1;
  return Object.freeze({ normalizeDomain, get, attach, resolve, remove });
}
