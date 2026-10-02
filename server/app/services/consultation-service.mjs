import { requireWorkspaceId } from "../tenant-context.mjs";
import { createSensitiveAccessAudit } from "./sensitive-access-audit.mjs";

export class ConsultationError extends Error {
  constructor(code, status = 400, message = "Consultation request could not be completed.") { super(message); this.name = "ConsultationError"; this.code = code; this.status = status; }
}
const notFound = () => new ConsultationError("CONSULTATION_NOT_FOUND", 404, "Consultation not found.");

export const JOIN_WINDOW_BEFORE_MS = 15 * 60_000;
export const MAX_JOIN_LINK_LENGTH = 500;

// A join link is a human-entered https address. It is never generated, never
// fetched and never contains credentials; nothing here knows any provider.
export function validateJoinLink(value) {
  if (value === null) return null;
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > MAX_JOIN_LINK_LENGTH || /[\s\u0000-\u001f]/.test(raw)) throw new ConsultationError("CONSULTATION_JOIN_LINK_INVALID", 400, "Enter a valid https link.");
  let url;
  try { url = new URL(raw); } catch { throw new ConsultationError("CONSULTATION_JOIN_LINK_INVALID", 400, "Enter a valid https link."); }
  if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) throw new ConsultationError("CONSULTATION_JOIN_LINK_INVALID", 400, "Enter a valid https link.");
  return url.href;
}

export function createConsultationService({ db, audit = createSensitiveAccessAudit(db), now = () => new Date() }) {
  const wsId = () => requireWorkspaceId();
  const iso = () => now().toISOString();
  const durationMs = (appointment) => (db.prepare("SELECT duration_minutes AS m FROM booking_services WHERE id=? AND workspace_id=?").get(appointment.service_id, wsId())?.m ?? 30) * 60_000;
  const row = (siteProjectId, appointmentId) => {
    const found = db.prepare("SELECT c.*, a.starts_at AS appt_starts_at, a.status AS appt_status, a.service_id AS appt_service_id, a.app_user_id AS appt_app_user_id, a.auth_project_id AS appt_auth_project_id FROM consultations c JOIN booking_appointments a ON a.id=c.appointment_id AND a.workspace_id=c.workspace_id WHERE c.workspace_id=? AND c.site_project_id=? AND c.appointment_id=?").get(wsId(), siteProjectId, appointmentId);
    return found || null;
  };
  const windowOpen = (c) => c.appt_status === "CONFIRMED" && now().getTime() >= Date.parse(c.appt_starts_at) - JOIN_WINDOW_BEFORE_MS;
  const base = (c) => ({ id: c.id, appointmentId: c.appointment_id, modality: c.modality, state: c.state, startedAt: c.started_at, completedAt: c.completed_at, joinAvailableFrom: new Date(Date.parse(c.appt_starts_at) - JOIN_WINDOW_BEFORE_MS).toISOString() });

  function getForPatient({ siteProjectId, patient, appointmentId }) {
    const c = row(siteProjectId, appointmentId);
    if (!c || c.appt_app_user_id !== patient.id || c.appt_auth_project_id !== patient.authProjectId) throw notFound();
    const open = c.join_link && ["scheduled", "in_progress"].includes(c.state) && windowOpen(c);
    if (open) audit.record({ siteProjectId, actor: { kind: "app_user", id: patient.id }, action: "consultation.join_link.read", resourceType: "consultation", resourceId: c.id, metadata: {} });
    return { ...base(c), joinLink: open ? c.join_link : null, joinLinkSet: Boolean(c.join_link) };
  }

  function getForDoctor({ siteProjectId, doctor, appointmentId }) {
    const c = row(siteProjectId, appointmentId);
    if (!c || c.provider_id !== doctor.providerId) throw notFound();
    return { ...base(c), joinLink: c.join_link || null, joinLinkSet: Boolean(c.join_link) };
  }

  // Both the assigned doctor and (explicitly) an operator may fill the slot.
  function setJoinLink({ siteProjectId, appointmentId, actor, doctor = null, url }) {
    const c = row(siteProjectId, appointmentId);
    if (!c || (doctor && c.provider_id !== doctor.providerId)) throw notFound();
    if (!["scheduled", "in_progress"].includes(c.state)) throw new ConsultationError("CONSULTATION_CLOSED", 409, "This consultation is closed.");
    const link = validateJoinLink(url === undefined ? "" : url);
    db.prepare("UPDATE consultations SET join_link=?,join_link_set_at=?,updated_at=? WHERE id=? AND workspace_id=?").run(link, link ? iso() : null, iso(), c.id, wsId());
    audit.record({ siteProjectId, actor, action: link ? "consultation.join_link.set" : "consultation.join_link.cleared", resourceType: "consultation", resourceId: c.id, metadata: {} });
    return getForDoctor({ siteProjectId, doctor: { providerId: c.provider_id }, appointmentId });
  }

  function transition({ siteProjectId, doctor, appointmentId, to }) {
    const c = row(siteProjectId, appointmentId);
    if (!c || c.provider_id !== doctor.providerId) throw notFound();
    const at = now().getTime(), start = Date.parse(c.appt_starts_at), end = start + durationMs({ service_id: c.appt_service_id });
    const invalid = (code, message) => new ConsultationError(code, 409, message);
    if (to === "in_progress") {
      if (c.state !== "scheduled") throw invalid("CONSULTATION_TRANSITION_INVALID", "Only a scheduled consultation can start.");
      if (c.appt_status !== "CONFIRMED") throw invalid("CONSULTATION_APPOINTMENT_NOT_CONFIRMED", "The appointment must be confirmed first.");
      if (at < start - JOIN_WINDOW_BEFORE_MS) throw invalid("CONSULTATION_NOT_STARTED", "It is too early to start this consultation.");
    } else if (to === "completed") {
      if (c.state !== "in_progress") throw invalid("CONSULTATION_TRANSITION_INVALID", "Only a consultation in progress can be completed.");
    } else if (to === "missed") {
      if (c.state !== "scheduled") throw invalid("CONSULTATION_TRANSITION_INVALID", "Only a scheduled consultation can be marked missed.");
      if (at < end) throw invalid("CONSULTATION_NOT_ENDED", "The scheduled time has not ended yet.");
    } else throw new ConsultationError("CONSULTATION_TRANSITION_INVALID", 400, "Unsupported consultation action.");
    const changed = db.prepare(`UPDATE consultations SET state=?,started_at=CASE WHEN ?='in_progress' THEN ? ELSE started_at END,completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END,updated_at=? WHERE id=? AND workspace_id=? AND state=?`).run(to, to, iso(), to, iso(), iso(), c.id, wsId(), c.state).changes;
    if (changed !== 1) throw invalid("CONSULTATION_CONFLICT", "The consultation changed; reload and retry.");
    audit.record({ siteProjectId, actor: { kind: "app_user", id: doctor.id }, action: `consultation.${to}`, resourceType: "consultation", resourceId: c.id, metadata: { from: c.state } });
    return getForDoctor({ siteProjectId, doctor, appointmentId });
  }

  return Object.freeze({ getForPatient, getForDoctor, setJoinLink, transition });
}
