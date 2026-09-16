import crypto from "node:crypto";

const normalizeDomain = (value) => {
  if (typeof value !== "string" || !value.trim()) throw new Error("domain is required.");
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (domain.length > 253 || domain.includes("/") || domain.includes(" ") || !domain.includes(".")) throw new Error("Invalid domain.");
  return domain;
};

export function createSiteDomainService(db) {
  const get = (domain) => db.prepare("SELECT * FROM site_domains WHERE domain=?").get(normalizeDomain(domain)) ?? null;
  const listByProject = (workspaceId, siteProjectId) => db.prepare("SELECT * FROM site_domains WHERE workspace_id=? AND site_project_id=? AND status='ACTIVE' ORDER BY domain").all(workspaceId, siteProjectId);
  const attach = ({ workspaceId, siteProjectId, domain, now }) => {
    const normalized = normalizeDomain(domain);
    return db.transaction(() => {
      const existing = get(normalized);
      if (existing && (existing.workspace_id !== workspaceId || existing.site_project_id !== siteProjectId)) throw Object.assign(new Error("Domain is already connected to another site."), { status: 409, code: "SITE_DOMAIN_CONFLICT" });
      if (existing) {
        db.prepare("UPDATE site_domains SET status='ACTIVE',updated_at=? WHERE id=? AND workspace_id=? AND site_project_id=?").run(now, existing.id, workspaceId, siteProjectId);
      } else {
        try {
          db.prepare("INSERT INTO site_domains(id,workspace_id,site_project_id,domain,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(), workspaceId, siteProjectId, normalized, "ACTIVE", now, now);
        } catch (error) {
          if (String(error?.code || "").startsWith("SQLITE_CONSTRAINT")) throw Object.assign(new Error("Domain is already connected to another site."), { status: 409, code: "SITE_DOMAIN_CONFLICT" });
          throw error;
        }
      }
      const attached = get(normalized);
      if (!attached || attached.workspace_id !== workspaceId || attached.site_project_id !== siteProjectId) throw Object.assign(new Error("Domain is already connected to another site."), { status: 409, code: "SITE_DOMAIN_CONFLICT" });
      return attached;
    })();
  };
  const resolve = (domain) => db.prepare("SELECT * FROM site_domains WHERE domain=? AND status='ACTIVE'").get(normalizeDomain(domain)) ?? null;
  const remove = (workspaceId, siteProjectId, domain) => db.prepare("DELETE FROM site_domains WHERE workspace_id=? AND site_project_id=? AND domain=?").run(workspaceId, siteProjectId, normalizeDomain(domain)).changes === 1;
  return Object.freeze({ normalizeDomain, get, listByProject, attach, resolve, remove });
}
