import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireWorkspaceId, runWithWorkspace } from "../tenant-context.mjs";
import { isWorkspaceOperator } from "../workspace-authorization.mjs";
import { ConsultationError } from "../services/consultation-service.mjs";

const limited = (limit) => rateLimit({
  windowMs: 60_000, limit, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "unknown")}:${String(req.params.siteProjectId || "unknown").slice(0, 80)}`,
  handler: (_req, res) => res.status(429).json({ success: false, code: "CONSULTATION_RATE_LIMITED" }),
});
const tokenOf = (req) => String(req.get("X-Loadder-App-Token") || "").trim();

// Consultation lifecycle for the patient and the assigned doctor. The join link
// is a human-entered slot; the server never generates or fetches one.
export function createConsultationRouter({ service, identity, siteLookup }) {
  const router = express.Router();
  const guarded = (audience, handler) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    const site = siteLookup(req.params.siteProjectId);
    if (!site) return res.status(404).json({ success: false, code: "SITE_NOT_FOUND" });
    try {
      return await runWithWorkspace(site.workspaceId, async () => {
        const principal = audience === "doctor" ? identity.resolveDoctor(req.params.siteProjectId, tokenOf(req)) : identity.resolve(req.params.siteProjectId, tokenOf(req));
        if (!principal) return res.status(401).json({ success: false, code: audience === "doctor" ? "DOCTOR_AUTH_REQUIRED" : "PATIENT_AUTH_REQUIRED" });
        return await handler(req, res, principal);
      });
    } catch (error) {
      if (error instanceof ConsultationError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      console.error("Consultation error:", error);
      return res.status(500).json({ success: false, code: "CONSULTATION_ERROR" });
    }
  };
  const patient = "/site/:siteProjectId/patient/appointments/:appointmentId/consultation", doctor = "/site/:siteProjectId/doctor/appointments/:appointmentId/consultation";
  router.get(patient, limited(120), guarded("patient", (req, res, principal) => res.json({ success: true, consultation: service.getForPatient({ siteProjectId: req.params.siteProjectId, patient: principal, appointmentId: req.params.appointmentId }) })));
  router.get(doctor, limited(120), guarded("doctor", (req, res, principal) => res.json({ success: true, consultation: service.getForDoctor({ siteProjectId: req.params.siteProjectId, doctor: principal, appointmentId: req.params.appointmentId }) })));
  router.put(`${doctor}/join-link`, limited(30), express.json({ limit: "2kb" }), guarded("doctor", (req, res, principal) => {
    if (!req.body || !("url" in req.body)) return res.status(400).json({ success: false, code: "CONSULTATION_JOIN_LINK_INVALID", message: "url is required (null clears it)." });
    return res.json({ success: true, consultation: service.setJoinLink({ siteProjectId: req.params.siteProjectId, appointmentId: req.params.appointmentId, doctor: principal, actor: { kind: "app_user", id: principal.id }, url: req.body.url }) });
  }));
  for (const [action, to] of [["start", "in_progress"], ["complete", "completed"], ["missed", "missed"]]) {
    router.post(`${doctor}/${action}`, limited(30), guarded("doctor", (req, res, principal) => res.json({ success: true, consultation: service.transition({ siteProjectId: req.params.siteProjectId, doctor: principal, appointmentId: req.params.appointmentId, to }) })));
  }
  return router;
}

// Operators may also fill the join-link slot (explicitly, audited); they never start or complete a consultation.
export function createConsultationAdminRouter({ service, db }) {
  const router = express.Router();
  router.put("/site-projects/:id/consultations/:appointmentId/join-link", express.json({ limit: "2kb" }), (req, res) => {
    if (!isWorkspaceOperator(db, requireWorkspaceId(), req.user?.id)) return res.status(403).json({ success: false, code: "CONSULTATION_OPERATOR_REQUIRED", message: "Workspace owner or admin access is required." });
    try {
      if (!req.body || !("url" in req.body)) return res.status(400).json({ success: false, code: "CONSULTATION_JOIN_LINK_INVALID", message: "url is required (null clears it)." });
      const consultation = service.setJoinLink({ siteProjectId: req.params.id, appointmentId: req.params.appointmentId, actor: { kind: "operator", id: req.user?.id || null }, url: req.body.url });
      return res.json({ success: true, consultation: { id: consultation.id, state: consultation.state, joinLinkSet: consultation.joinLinkSet } });
    } catch (error) {
      if (error instanceof ConsultationError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      throw error;
    }
  });
  return router;
}
