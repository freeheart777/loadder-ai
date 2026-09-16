import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

export class SiteLeadError extends Error {
  constructor(message, code = "SITE_LEAD_ERROR", status = 400) {
    super(message);
    this.name = "SiteLeadError";
    this.code = code;
    this.status = status;
  }
}

const clamp = (value, max) => String(value ?? "").trim().slice(0, max);

// Website contact forms write into the canonical CRM `leads` table rather than
// a builder-owned store, so a lead captured by a published site is the same
// object the pipeline already understands. Nothing new is invented here.
export function createSiteLeadService({ db, clock = () => new Date().toISOString() } = {}) {
  if (!db) throw new SiteLeadError("Database is required.", "SITE_LEAD_DATABASE_REQUIRED", 500);

  function submit(siteProjectId, input = {}) {
    const workspaceId = requireWorkspaceId();
    const name = clamp(input.name, 120);
    const phone = clamp(input.phone, 32);
    if (!name || !phone) throw new SiteLeadError("نام و شماره تماس الزامی است.", "SITE_LEAD_CONTACT_REQUIRED", 400);

    const email = clamp(input.email, 180) || null;
    const company = clamp(input.company, 120) || null;
    const message = clamp(input.message, 1000);
    const at = clock();
    const id = crypto.randomUUID();
    // The site project is the provenance of this lead, not free-form client text.
    const source = `website:${clamp(siteProjectId, 60)}`;

    db.prepare(`
      INSERT INTO leads(id,workspace_id,name,phone,email,company,source,score,status,opportunity_value,customer_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,0,'new',0,NULL,?,?)
    `).run(id, workspaceId, name, phone, email, company, source, at, at);

    return { id, name, source, message, createdAt: at };
  }

  return Object.freeze({ submit });
}
