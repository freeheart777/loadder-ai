import { requireWorkspaceId } from "../tenant-context.mjs";
import { createSensitiveAccessAudit } from "./sensitive-access-audit.mjs";

export class MedicalControlCenterError extends Error {
  constructor(code, status = 400, message = "Medical control center request could not be completed.") { super(message); this.name = "MedicalControlCenterError"; this.code = code; this.status = status; }
}
const maskMobile = (mobile) => (mobile ? `${mobile.slice(0, 4)}***${mobile.slice(-2)}` : null);

// Read model for the Medical Control Center. Every number is a count of real
// rows in the canonical tables (Booking, identity, documents); nothing is
// derived, estimated or invented, and an empty site simply reports zeros.
export function createMedicalControlCenterService({ db, readiness, audit = createSensitiveAccessAudit(db), now = () => new Date() }) {
  const site = (siteProjectId) => {
    const row = db.prepare("SELECT id,name,status,site_type AS siteType FROM site_projects WHERE id=? AND workspace_id=?").get(siteProjectId, requireWorkspaceId());
    if (!row) throw new MedicalControlCenterError("SITE_PROJECT_NOT_FOUND", 404, "Site project not found.");
    if (String(row.siteType).toUpperCase() !== "MEDICAL") throw new MedicalControlCenterError("MEDICAL_SITE_REQUIRED", 422, "The Medical control center is only available for Medical sites.");
    return row;
  };
  const count = (sql, ...params) => Number(db.prepare(sql).get(...params).n);

  function summary(siteProjectId) {
    const row = site(siteProjectId), workspaceId = requireWorkspaceId(), at = now().toISOString();
    const byStatus = Object.fromEntries(db.prepare("SELECT status,count(*) AS n FROM booking_appointments WHERE workspace_id=? AND site_project_id=? GROUP BY status").all(workspaceId, siteProjectId).map((r) => [r.status, Number(r.n)]));
    return {
      site: { id: row.id, name: row.name, status: row.status },
      patients: count("SELECT count(*) AS n FROM business_builder_app_users u JOIN site_identity_bindings b ON b.auth_project_id=u.project_id AND b.workspace_id=u.workspace_id WHERE b.site_project_id=? AND u.workspace_id=? AND u.role='customer'", siteProjectId, workspaceId),
      providers: count("SELECT count(*) AS n FROM booking_providers WHERE workspace_id=? AND site_project_id=?", workspaceId, siteProjectId),
      doctorIdentities: count("SELECT count(*) AS n FROM booking_provider_identities WHERE workspace_id=? AND site_project_id=? AND status='active'", workspaceId, siteProjectId),
      services: count("SELECT count(*) AS n FROM booking_services WHERE workspace_id=? AND site_project_id=? AND active=1", workspaceId, siteProjectId),
      appointments: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), PENDING: byStatus.PENDING || 0, CONFIRMED: byStatus.CONFIRMED || 0, CANCELLED: byStatus.CANCELLED || 0, COMPLETED: byStatus.COMPLETED || 0 },
      upcoming: count("SELECT count(*) AS n FROM booking_appointments WHERE workspace_id=? AND site_project_id=? AND status IN('PENDING','CONFIRMED') AND starts_at>=?", workspaceId, siteProjectId, at),
      documents: count("SELECT count(*) AS n FROM medical_documents WHERE workspace_id=? AND site_project_id=? AND lifecycle_state='active'", workspaceId, siteProjectId),
    };
  }

  // Operators see enough to run the clinic (name, masked mobile, activity), not contact details.
  function listPatients(siteProjectId, { operatorId = null } = {}) {
    site(siteProjectId);
    const rows = db.prepare(`SELECT u.id,u.display_name AS displayName,u.status,u.created_at AS createdAt,i.value_normalized AS mobile,
        (SELECT count(*) FROM booking_appointments a WHERE a.workspace_id=u.workspace_id AND a.site_project_id=b.site_project_id AND a.app_user_id=u.id) AS appointments
      FROM business_builder_app_users u
      JOIN site_identity_bindings b ON b.auth_project_id=u.project_id AND b.workspace_id=u.workspace_id
      LEFT JOIN app_user_identifiers i ON i.app_user_id=u.id AND i.kind='mobile'
      WHERE b.site_project_id=? AND u.workspace_id=? AND u.role='customer' ORDER BY u.created_at DESC LIMIT 500`).all(siteProjectId, requireWorkspaceId());
    audit.record({ siteProjectId, actor: { kind: "operator", id: operatorId }, action: "medical.patients.listed", resourceType: "site_project", resourceId: siteProjectId, metadata: { count: rows.length } });
    return rows.map((row) => ({ id: row.id, displayName: row.displayName || null, status: row.status, createdAt: row.createdAt, mobile: maskMobile(row.mobile), appointments: Number(row.appointments) }));
  }

  // Honest readiness: what is configured now, and what still blocks production.
  function settings(siteProjectId) {
    const row = site(siteProjectId), binding = db.prepare("SELECT auth_project_id FROM site_identity_bindings WHERE workspace_id=? AND site_project_id=? AND status='active'").get(requireWorkspaceId(), siteProjectId);
    return { site: { id: row.id, name: row.name, status: row.status }, patientIdentity: { enabled: Boolean(binding) }, ...readiness() };
  }

  return Object.freeze({ summary, listPatients, settings });
}
