import express from "express";
import { resolveCapabilities } from "../site-platform/capability-resolver.mjs";
import { BookingError } from "../repositories/booking-repository.mjs";
import { SiteProjectError } from "../services/site-project-service.mjs";
import { LEGACY_BOOKING_SCOPE, bookingScopeForSite } from "../services/booking-scope.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { isWorkspaceOperator } from "../workspace-authorization.mjs";

const text = (value, max = 200) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const hasBooking = (project) => resolveCapabilities(project).capabilities.includes("booking");
const STATUSES = ["CONFIRMED", "CANCELLED", "COMPLETED"];

// Operator Booking API. Without `siteProjectId` it keeps today's behavior (the
// legacy, site-less view). With it, reads are limited to that site's scope
// (strict for Medical, own+legacy for other types) and writes are stamped with
// it; a site from another workspace is a 404, never a silent fallback.
export function createBookingRouter({ repository, siteProjectService, db = null }) {
  const router = express.Router();
  const bad = (res, message = "Invalid booking input.") => res.status(400).json({ success: false, message });
  const fail = (res, error) => {
    if (error instanceof BookingError || error instanceof SiteProjectError) return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
    throw error;
  };
  const scopeOf = (req) => {
    const siteProjectId = text(req.query?.siteProjectId, 80) || text(req.body?.siteProjectId, 80);
    if (!siteProjectId) return { scope: LEGACY_BOOKING_SCOPE, enabled: siteProjectService.list().some(hasBooking) };
    const site = siteProjectService.get(siteProjectId);
    return { scope: bookingScopeForSite(site), enabled: hasBooking(site) };
  };
  const route = (handler) => (req, res) => {
    try {
      const { scope, enabled } = scopeOf(req);
      if (!enabled) return res.status(403).json({ success: false, code: "BOOKING_CAPABILITY_REQUIRED", message: "Booking is not enabled for this workspace." });
      return handler(req, res, scope);
    } catch (error) { return fail(res, error); }
  };
  const operatorOnly = (req, res, next) => db && isWorkspaceOperator(db, requireWorkspaceId(), req.user?.id)
    ? next()
    : res.status(403).json({ success: false, code: "BOOKING_OPERATOR_REQUIRED", message: "Workspace owner or admin access is required." });

  router.get("/booking", route((_req, res, scope) => res.json({ success: true, services: repository.listServices(scope), providers: repository.listProviders(scope), associations: repository.listAssociations(scope), availability: repository.listAvailability(scope), appointments: repository.listAppointments(scope) })));
  router.post("/booking/services", route((req, res, scope) => { const name = text(req.body?.name); const durationMinutes = Number(req.body?.durationMinutes), modalities = Array.isArray(req.body?.modalities) && req.body.modalities.every((entry) => text(entry, 40)) ? req.body.modalities.map((entry) => entry.trim()) : []; const priceAmount = req.body?.priceAmount == null ? null : Number(req.body.priceAmount), priceCurrency = req.body?.priceCurrency == null ? null : text(req.body.priceCurrency, 8); if (!name || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440 || (priceAmount != null && (!Number.isInteger(priceAmount) || priceAmount < 0)) || (priceAmount != null && !priceCurrency)) return bad(res); return res.status(201).json({ success: true, service: repository.createService({ name, durationMinutes, modalities, priceAmount, priceCurrency, scope }) }); }));
  router.post("/booking/providers", route((req, res, scope) => { const name = text(req.body?.name); if (!name) return bad(res); return res.status(201).json({ success: true, provider: repository.createProvider({ name, scope }) }); }));
  router.post("/booking/providers/:providerId/services/:serviceId", route((req, res, scope) => repository.associate(req.params.providerId, req.params.serviceId, scope) ? res.status(201).json({ success: true }) : res.status(404).json({ success: false, message: "Booking record not found." })));
  router.post("/booking/availability", route((req, res, scope) => { const { providerId, weekday, startsAt, endsAt } = req.body || {}, capacity = req.body?.capacity == null ? 1 : Number(req.body.capacity), status = req.body?.status || "ACTIVE"; if (!text(providerId) || !Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !text(startsAt) || !text(endsAt) || startsAt >= endsAt || !Number.isInteger(capacity) || capacity < 1 || !["ACTIVE", "CANCELLED"].includes(status)) return bad(res); const availability = repository.addAvailability({ providerId, weekday, startsAt, endsAt, capacity, status, scope }); return availability ? res.status(201).json({ success: true, availability }) : res.status(404).json({ success: false, message: "Provider not found." }); }));
  router.post("/booking/appointments", route((req, res, scope) => { const { serviceId, providerId, customerName, startsAt } = req.body || {}; if (!text(serviceId) || !text(providerId) || !text(customerName) || !text(startsAt)) return bad(res); const appointment = repository.createAppointment({ serviceId, providerId, customerName, startsAt, scope }); return appointment ? res.status(201).json({ success: true, appointment }) : res.status(404).json({ success: false, message: "Booking records not found." }); }));
  router.post("/booking/appointments/:appointmentId/status", operatorOnly, route((req, res, scope) => {
    const to = String(req.body?.status || "").toUpperCase();
    if (!STATUSES.includes(to)) return bad(res, "Unsupported appointment status.");
    const reason = req.body?.reason == null ? null : text(req.body.reason, 200);
    if (req.body?.reason != null && !reason) return bad(res, "Invalid reason.");
    const appointment = repository.transitionAppointment({ id: req.params.appointmentId, to, reason, actor: { kind: "operator", id: req.user?.id || null }, scope });
    return res.json({ success: true, appointment });
  }));
  router.get("/booking/customer/services", route((_req, res, scope) => res.json({ success: true, services: repository.listCustomerServices(scope) })));
  router.get("/booking/customer/services/:serviceId/providers", route((req, res, scope) => res.json({ success: true, providers: repository.listEligibleProviders(req.params.serviceId, scope) })));
  router.get("/booking/customer/slots", route((req, res, scope) => { const { serviceId, providerId, date } = req.query; if (!text(serviceId) || !text(providerId) || !text(date, 10)) return bad(res); return res.json({ success: true, slots: repository.listCustomerSlots({ serviceId, providerId, date, scope }) }); }));
  router.post("/booking/customer/review", route((req, res, scope) => { const { serviceId, providerId, date, startsAt, modality } = req.body || {}; const quote = repository.quoteCustomerBooking({ serviceId, providerId, date, startsAt, modality: modality || null, scope }); return quote ? res.json({ success: true, quote }) : res.status(404).json({ success: false, code: "BOOKING_SLOT_NOT_FOUND", message: "The selected booking details are unavailable." }); }));
  router.post("/booking/customer/appointments", route((req, res, scope) => { const { serviceId, providerId, date, startsAt, customerName, customerContact, modality } = req.body || {}; if (!text(serviceId) || !text(providerId) || !text(date, 10) || !text(startsAt, 5) || !text(customerName) || (customerContact != null && !text(customerContact))) return bad(res); const created = repository.createCustomerAppointment({ serviceId, providerId, date, startsAt, customerName, customerContact: customerContact || null, modality: modality || null, scope }); return res.status(201).json({ success: true, ...created }); }));
  router.get("/booking/customer/confirmations/:reference", route((req, res, scope) => { const confirmation = repository.getCustomerConfirmation(req.params.reference, scope); return confirmation ? res.json({ success: true, confirmation }) : res.status(404).json({ success: false, code: "BOOKING_CONFIRMATION_NOT_FOUND", message: "Booking confirmation was not found." }); }));
  return router;
}
