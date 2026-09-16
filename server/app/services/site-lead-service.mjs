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
export const LEAD_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export function createSiteLeadService({ db, clock = () => new Date().toISOString(), duplicateWindowMs = LEAD_DUPLICATE_WINDOW_MS } = {}) {
  if (!db) throw new SiteLeadError("Database is required.", "SITE_LEAD_DATABASE_REQUIRED", 500);

  // A bot fills every field it can see. This one is hidden from people, so a
  // value in it means automation: the request is accepted so the bot learns
  // nothing, and nothing is written.
  const HONEYPOT_FIELDS = ["website", "companyUrl", "fax"];
  const trippedHoneypot = (input) => HONEYPOT_FIELDS.some((name) => String(input?.[name] ?? "").trim().length > 0);

  // Bounded duplicate suppression: the same person sending the same enquiry to
  // the same site within the window returns the existing lead instead of
  // stacking rows. It is scoped to one workspace and one site project.
  const recentDuplicate = (workspaceId, source, phone, message, at) => {
    const since = new Date(Date.parse(at) - duplicateWindowMs).toISOString();
    return db.prepare(`
      SELECT id, created_at FROM leads
      WHERE workspace_id=? AND source=? AND phone=? AND COALESCE(message,'')=? AND created_at >= ?
      ORDER BY created_at DESC LIMIT 1
    `).get(workspaceId, source, phone, message || "", since) || null;
  };

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

    // Discarded silently and reported as accepted, so automation gets no signal.
    if (trippedHoneypot(input)) return { id: null, name, source, message, createdAt: at, discarded: "HONEYPOT" };

    const duplicate = recentDuplicate(workspaceId, source, phone, message, at);
    if (duplicate) return { id: duplicate.id, name, source, message, createdAt: duplicate.created_at, discarded: "DUPLICATE" };

    db.prepare(`
      INSERT INTO leads(id,workspace_id,name,phone,email,company,source,message,score,status,opportunity_value,customer_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,0,'new',0,NULL,?,?)
    `).run(id, workspaceId, name, phone, email, company, source, message || null, at, at);

    return { id, name, source, message, createdAt: at, discarded: null };
  }

  return Object.freeze({ submit });
}
