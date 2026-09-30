import express from "express";
import { resolveCapabilities } from "../site-platform/capability-resolver.mjs";

const text = (value, max = 200) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const bookingEnabled = (siteProjectService) => siteProjectService.list().some((project) => resolveCapabilities(project).capabilities.includes("booking"));

export function createBookingRouter({ repository, siteProjectService }) {
  const router = express.Router();
  const bad = (res, message = "Invalid booking input.") => res.status(400).json({ success: false, message });
  const requireBookingCapability = (_req, res, next) => {
    if (!bookingEnabled(siteProjectService)) return res.status(403).json({ success: false, code: "BOOKING_CAPABILITY_REQUIRED", message: "Booking is not enabled for this workspace." });
    return next();
  };

  router.use("/booking", requireBookingCapability);
  router.get("/booking", (_req, res) => res.json({ success: true, services: repository.listServices(), providers: repository.listProviders(), associations: repository.listAssociations(), availability: repository.listAvailability(), appointments: repository.listAppointments() }));
  router.post("/booking/services", (req, res) => { const name = text(req.body?.name); const durationMinutes = Number(req.body?.durationMinutes); if (!name || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) return bad(res); return res.status(201).json({ success: true, service: repository.createService({ name, durationMinutes }) }); });
  router.post("/booking/providers", (req, res) => { const name = text(req.body?.name); if (!name) return bad(res); return res.status(201).json({ success: true, provider: repository.createProvider({ name }) }); });
  router.post("/booking/providers/:providerId/services/:serviceId", (req, res) => repository.associate(req.params.providerId, req.params.serviceId) ? res.status(201).json({ success: true }) : res.status(404).json({ success: false, message: "Booking record not found." }));
  router.post("/booking/availability", (req, res) => { const { providerId, weekday, startsAt, endsAt } = req.body || {}; if (!text(providerId) || !Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !text(startsAt) || !text(endsAt) || startsAt >= endsAt) return bad(res); const availability = repository.addAvailability({ providerId, weekday, startsAt, endsAt }); return availability ? res.status(201).json({ success: true, availability }) : res.status(404).json({ success: false, message: "Provider not found." }); });
  router.post("/booking/appointments", (req, res) => { const { serviceId, providerId, customerName, startsAt } = req.body || {}; if (!text(serviceId) || !text(providerId) || !text(customerName) || !text(startsAt)) return bad(res); const appointment = repository.createAppointment({ serviceId, providerId, customerName, startsAt }); return appointment ? res.status(201).json({ success: true, appointment }) : res.status(404).json({ success: false, message: "Booking records not found." }); });
  return router;
}
