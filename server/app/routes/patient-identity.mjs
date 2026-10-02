import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireWorkspaceId, runWithWorkspace } from "../tenant-context.mjs";
import { isWorkspaceOperator } from "../workspace-authorization.mjs";
import { bookingScopeForSite } from "../services/booking-scope.mjs";
import { splitAppointmentTimeline } from "../services/appointment-timeline.mjs";
import { PatientIdentityError } from "../services/patient-identity-service.mjs";

const limited = (limit) => rateLimit({
  windowMs: 60_000, limit, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "unknown")}:${String(req.params.siteProjectId || "unknown").slice(0, 80)}`,
  handler: (_req, res) => res.status(429).json({ success: false, code: "PATIENT_RATE_LIMITED" }),
});
const tokenOf = (req) => String(req.get("X-Loadder-App-Token") || "").trim();
const NO_STORE = { "Cache-Control": "no-store" };

// Public, site-scoped patient sign-in. Same answer for known and unknown mobiles.
export function createPatientIdentityRouter({ service, siteLookup, bookingRepository = null }) {
  const router = express.Router();
  const base = "/site/:siteProjectId/patient";
  const run = (handler) => async (req, res) => {
    res.set(NO_STORE);
    const site = siteLookup(req.params.siteProjectId);
    if (!site) return res.status(404).json({ success: false, code: "SITE_NOT_FOUND" });
    try { return await runWithWorkspace(site.workspaceId, () => handler(req, res, site)); }
    catch (error) {
      if (error instanceof PatientIdentityError) {
        if (error.retryAfterSeconds) res.set("Retry-After", String(error.retryAfterSeconds));
        return res.status(error.status).json({ success: false, code: error.code, message: error.message, ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) });
      }
      console.error("Patient identity error:", error);
      return res.status(500).json({ success: false, code: "PATIENT_IDENTITY_ERROR" });
    }
  };
  router.get(`${base}/config`, limited(120), run((req, res) => res.json({ success: true, ...service.status(req.params.siteProjectId) })));
  router.post(`${base}/otp`, limited(10), express.json({ limit: "4kb" }), run(async (req, res) => {
    const result = await service.requestOtp({ siteProjectId: req.params.siteProjectId, mobile: req.body?.mobile });
    return res.status(202).json({ success: true, ...result });
  }));
  router.post(`${base}/verify`, limited(20), express.json({ limit: "4kb" }), run((req, res) => {
    const result = service.verifyOtp({ siteProjectId: req.params.siteProjectId, mobile: req.body?.mobile, code: req.body?.code, name: req.body?.name });
    return res.json({ success: true, ...result });
  }));
  router.get(`${base}/me`, limited(120), run((req, res) => {
    const principal = service.resolve(req.params.siteProjectId, tokenOf(req));
    return principal ? res.json({ success: true, patient: { id: principal.id, displayName: principal.displayName || null } }) : res.status(401).json({ success: false, code: "PATIENT_AUTH_REQUIRED" });
  }));
  // The patient's own appointments only: rows linked to this identity (migration 098)
  // within this site's scope. No name/contact matching, so an anonymous booking is never shown.
  router.get(`${base}/appointments`, limited(120), run((req, res, site) => {
    const principal = service.resolve(req.params.siteProjectId, tokenOf(req));
    if (!principal) return res.status(401).json({ success: false, code: "PATIENT_AUTH_REQUIRED" });
    if (!bookingRepository) return res.status(404).json({ success: false, code: "BOOKING_NOT_AVAILABLE" });
    const all = bookingRepository.listAppointmentsForIdentity({ authProjectId: principal.authProjectId, appUserId: principal.id, scope: bookingScopeForSite(site) });
    return res.json({ success: true, ...splitAppointmentTimeline(all) });
  }));
  router.post(`${base}/logout`, limited(60), run((req, res) => res.json({ success: true, signedOut: service.signOut({ siteProjectId: req.params.siteProjectId, token: tokenOf(req) }) })));
  return router;
}

// Operator-side switch: owner/admin enables patient sign-in for a Medical site.
export function createPatientIdentityAdminRouter({ service, db }) {
  const router = express.Router();
  const operatorOnly = (req, res, next) => isWorkspaceOperator(db, requireWorkspaceId(), req.user?.id)
    ? next()
    : res.status(403).json({ success: false, code: "PATIENT_OPERATOR_REQUIRED", message: "Workspace owner or admin access is required." });
  router.use("/site-projects/:id/patient-identity", operatorOnly);
  const fail = (res, error) => { if (error instanceof PatientIdentityError) return res.status(error.status).json({ success: false, code: error.code, message: error.message }); throw error; };
  router.get("/site-projects/:id/patient-identity", (req, res) => res.json({ success: true, ...service.status(req.params.id) }));
  router.post("/site-projects/:id/patient-identity", (req, res) => { try { return res.status(201).json({ success: true, ...service.enableForSite(req.params.id, { actorUserId: req.user?.id || null }) }); } catch (error) { return fail(res, error); } });
  return router;
}
