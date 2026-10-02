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

const text = (value, max = 200) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const DOCTOR_STATUSES = ["CONFIRMED", "COMPLETED"];

// Minimum doctor portal. A doctor sees and changes only what belongs to their own
// provider, inside the site's strict scope; no other doctor's patients, ever.
export function createDoctorPortalRouter({ service, siteLookup, bookingRepository }) {
  const router = express.Router();
  const base = "/site/:siteProjectId/doctor";
  const run = (handler, { auth = true } = {}) => async (req, res) => {
    res.set(NO_STORE);
    const site = siteLookup(req.params.siteProjectId);
    if (!site) return res.status(404).json({ success: false, code: "SITE_NOT_FOUND" });
    try {
      return await runWithWorkspace(site.workspaceId, async () => {
        const doctor = auth ? service.resolveDoctor(req.params.siteProjectId, tokenOf(req)) : null;
        if (auth && !doctor) return res.status(401).json({ success: false, code: "DOCTOR_AUTH_REQUIRED" });
        return await handler(req, res, { site, doctor, scope: bookingScopeForSite(site) });
      });
    } catch (error) {
      if (error instanceof PatientIdentityError) {
        if (error.retryAfterSeconds) res.set("Retry-After", String(error.retryAfterSeconds));
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      if (error?.code && error?.status && String(error.code).startsWith("BOOKING_")) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      console.error("Doctor portal error:", error);
      return res.status(500).json({ success: false, code: "DOCTOR_PORTAL_ERROR" });
    }
  };
  router.post(`${base}/otp`, limited(10), express.json({ limit: "4kb" }), run(async (req, res) => res.status(202).json({ success: true, ...(await service.requestOtp({ siteProjectId: req.params.siteProjectId, mobile: req.body?.mobile, audience: "doctor" })) }), { auth: false }));
  router.post(`${base}/verify`, limited(20), express.json({ limit: "4kb" }), run((req, res) => res.json({ success: true, ...service.verifyOtp({ siteProjectId: req.params.siteProjectId, mobile: req.body?.mobile, code: req.body?.code, audience: "doctor" }) }), { auth: false }));
  router.get(`${base}/me`, limited(120), run((_req, res, { doctor }) => res.json({ success: true, doctor: { id: doctor.id, displayName: doctor.displayName || null } })));
  router.post(`${base}/logout`, limited(60), run((req, res) => res.json({ success: true, signedOut: service.signOut({ siteProjectId: req.params.siteProjectId, token: tokenOf(req) }) })));
  router.get(`${base}/appointments`, limited(120), run((req, res, { doctor, scope }) => {
    const all = bookingRepository.listAppointmentsForProvider({ providerId: doctor.providerId, scope });
    service.recordAccess({ siteProjectId: req.params.siteProjectId, principal: doctor, action: "doctor.appointments.read", resourceType: "booking_provider", resourceId: doctor.providerId, metadata: { count: all.length } });
    return res.json({ success: true, ...splitAppointmentTimeline(all.map((item) => ({ ...item }))) });
  }));
  router.post(`${base}/appointments/:appointmentId/status`, limited(60), express.json({ limit: "4kb" }), run((req, res, { doctor, scope }) => {
    const to = String(req.body?.status || "").toUpperCase();
    if (!DOCTOR_STATUSES.includes(to)) return res.status(400).json({ success: false, code: "BOOKING_STATUS_UNSUPPORTED", message: "Doctors can confirm or complete their own appointments." });
    const reason = req.body?.reason == null ? null : text(req.body.reason, 200);
    if (req.body?.reason != null && !reason) return res.status(400).json({ success: false, code: "BOOKING_REASON_INVALID", message: "Invalid reason." });
    const appointment = bookingRepository.transitionAppointment({ id: req.params.appointmentId, to, reason, actor: { kind: "app_user", id: doctor.id }, scope, providerId: doctor.providerId });
    return res.json({ success: true, appointment: { id: appointment.id, status: appointment.status } });
  }));
  router.get(`${base}/availability`, limited(120), run((_req, res, { doctor, scope }) => res.json({ success: true, availability: bookingRepository.listAvailabilityForProvider({ providerId: doctor.providerId, scope }) })));
  router.post(`${base}/availability`, limited(60), express.json({ limit: "4kb" }), run((req, res, { doctor, scope, site }) => {
    const { weekday, startsAt, endsAt } = req.body || {}, capacity = req.body?.capacity == null ? 1 : Number(req.body.capacity);
    const time = /^\d{2}:\d{2}$/;
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !time.test(String(startsAt)) || !time.test(String(endsAt)) || startsAt >= endsAt || !Number.isInteger(capacity) || capacity < 1 || capacity > 50) return res.status(400).json({ success: false, code: "BOOKING_AVAILABILITY_INVALID", message: "Invalid availability." });
    const availability = bookingRepository.addAvailability({ providerId: doctor.providerId, weekday, startsAt, endsAt, capacity, scope });
    service.recordAccess({ siteProjectId: site.id, principal: doctor, action: "booking.availability.added", resourceType: "booking_availability", resourceId: availability.id, metadata: { weekday, startsAt, endsAt, capacity } });
    return res.status(201).json({ success: true, availability: { id: availability.id, weekday, startsAt, endsAt, capacity, status: availability.status } });
  }));
  router.patch(`${base}/availability/:availabilityId`, limited(60), express.json({ limit: "4kb" }), run((req, res, { doctor, scope, site }) => {
    const status = String(req.body?.status || "").toUpperCase();
    const updated = ["ACTIVE", "CANCELLED"].includes(status) ? bookingRepository.setAvailabilityStatus({ id: req.params.availabilityId, providerId: doctor.providerId, status, scope }) : null;
    if (!updated) return res.status(404).json({ success: false, code: "BOOKING_AVAILABILITY_NOT_FOUND", message: "Availability not found." });
    service.recordAccess({ siteProjectId: site.id, principal: doctor, action: "booking.availability.status_changed", resourceType: "booking_availability", resourceId: updated.id, metadata: { status } });
    return res.json({ success: true, availability: updated });
  }));
  return router;
}

// Operator-side switch: owner/admin enables patient sign-in for a Medical site.
export function createPatientIdentityAdminRouter({ service, db }) {
  const router = express.Router();
  const operatorOnly = (req, res, next) => isWorkspaceOperator(db, requireWorkspaceId(), req.user?.id)
    ? next()
    : res.status(403).json({ success: false, code: "PATIENT_OPERATOR_REQUIRED", message: "Workspace owner or admin access is required." });
  router.use("/site-projects/:id/patient-identity", operatorOnly);
  router.use("/site-projects/:id/doctor-identities", operatorOnly);
  const fail = (res, error) => { if (error instanceof PatientIdentityError) return res.status(error.status).json({ success: false, code: error.code, message: error.message }); throw error; };
  router.get("/site-projects/:id/patient-identity", (req, res) => res.json({ success: true, ...service.status(req.params.id) }));
  router.post("/site-projects/:id/patient-identity", (req, res) => { try { return res.status(201).json({ success: true, ...service.enableForSite(req.params.id, { actorUserId: req.user?.id || null }) }); } catch (error) { return fail(res, error); } });
  router.get("/site-projects/:id/doctor-identities", (req, res) => res.json({ success: true, doctors: service.listDoctors(req.params.id) }));
  router.post("/site-projects/:id/doctor-identities", (req, res) => {
    try {
      const { providerId, mobile, displayName } = req.body || {};
      if (typeof providerId !== "string" || typeof mobile !== "string") return res.status(400).json({ success: false, code: "DOCTOR_IDENTITY_INPUT_INVALID", message: "providerId and mobile are required." });
      return res.status(201).json({ success: true, doctor: service.linkDoctor({ siteProjectId: req.params.id, providerId, mobile, displayName, actorUserId: req.user?.id || null }) });
    } catch (error) { return fail(res, error); }
  });
  router.delete("/site-projects/:id/doctor-identities/:providerId", (req, res) => { try { return res.json({ success: true, doctor: service.unlinkDoctor({ siteProjectId: req.params.id, providerId: req.params.providerId, actorUserId: req.user?.id || null }) }); } catch (error) { return fail(res, error); } });
  return router;
}
