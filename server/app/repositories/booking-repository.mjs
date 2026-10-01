import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

export class BookingError extends Error {
  constructor(code, status = 400, message = "Booking request could not be completed.") {
    super(message); this.code = code; this.status = status;
  }
}
const map = (row) => row && ({ ...row, active: row.active === 1 });
const modalities = (value) => { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
const dateOnly = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
const timeOnly = (value) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : null;
const isoFor = (date, time) => new Date(`${date}T${time}:00.000Z`).toISOString();

export function createBookingRepository(db) {
  const ws = () => requireWorkspaceId(), now = () => new Date().toISOString();
  const list = (table) => db.prepare(`SELECT * FROM ${table} WHERE workspace_id=? ORDER BY created_at DESC`).all(ws()).map(map);
  const owns = (table, id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND workspace_id=?`).get(id, ws()));
  const insert = (table, data) => { const id = crypto.randomUUID(), at = now(), fields = Object.keys(data); db.prepare(`INSERT INTO ${table}(id,workspace_id,${fields.join(",")},created_at,updated_at) VALUES(?,?,${fields.map(() => "?").join(",")},?,?)`).run(id, ws(), ...fields.map((key) => data[key]), at, at); return db.prepare(`SELECT * FROM ${table} WHERE id=? AND workspace_id=?`).get(id, ws()); };
  const service = (id) => db.prepare("SELECT * FROM booking_services WHERE id=? AND workspace_id=?").get(id, ws());
  const provider = (id) => db.prepare("SELECT * FROM booking_providers WHERE id=? AND workspace_id=?").get(id, ws());
  const presentService = (row) => ({ id: row.id, name: row.name, durationMinutes: row.duration_minutes, modalities: modalities(row.modalities_json), price: row.price_amount == null ? null : { amount: row.price_amount, currency: row.price_currency || null } });
  const presentProvider = (row) => ({ id: row.id, name: row.name });
  const slotFor = ({ serviceId, providerId, date, startsAt }) => {
    const selectedService = service(serviceId), selectedProvider = provider(providerId);
    if (!selectedService?.active || !selectedProvider?.active || !dateOnly(date) || !timeOnly(startsAt)) return null;
    if (!db.prepare("SELECT 1 FROM booking_provider_services WHERE workspace_id=? AND provider_id=? AND service_id=?").get(ws(), providerId, serviceId)) return null;
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const availability = db.prepare("SELECT * FROM booking_availability WHERE workspace_id=? AND provider_id=? AND weekday=? AND starts_at=? ORDER BY created_at DESC LIMIT 1").get(ws(), providerId, weekday, startsAt);
    if (!availability) return null;
    const slotStartsAt = isoFor(date, startsAt), booked = db.prepare("SELECT count(*) AS count FROM booking_appointments WHERE workspace_id=? AND provider_id=? AND starts_at=? AND status IN ('PENDING','CONFIRMED')").get(ws(), providerId, slotStartsAt).count;
    const state = availability.status === "CANCELLED" ? "cancelled" : booked >= availability.capacity ? "full" : booked > 0 ? "limited" : "available";
    return { id: `${availability.id}:${date}:${startsAt}`, availabilityId: availability.id, serviceId, providerId, startsAt: slotStartsAt, startsAtTime: startsAt, endsAt: isoFor(date, availability.ends_at), state, capacity: availability.capacity, remainingCapacity: Math.max(0, availability.capacity - booked), modalityOptions: modalities(selectedService.modalities_json), price: presentService(selectedService).price };
  };
  const confirmation = (appointment) => appointment && ({ reference: appointment.booking_reference, appointmentId: appointment.id, status: appointment.status, startsAt: appointment.starts_at, service: presentService(service(appointment.service_id)), provider: presentProvider(provider(appointment.provider_id)), modality: appointment.modality || null, customer: { name: appointment.customer_name, contact: appointment.customer_contact || null } });
  const claim = db.transaction(({ serviceId, providerId, date, startsAt, customerName, customerContact = null, modality = null, identity = null }) => {
    const slot = slotFor({ serviceId, providerId, date, startsAt });
    if (!slot) throw new BookingError("BOOKING_SLOT_NOT_FOUND", 404, "The selected slot is not available for this service and provider.");
    if (slot.state === "cancelled") throw new BookingError("BOOKING_SLOT_CANCELLED", 409, "The selected slot has been cancelled.");
    if (slot.state === "full") throw new BookingError("BOOKING_SLOT_FULL", 409, "The selected slot is no longer available.");
    if (modality && !slot.modalityOptions.includes(modality)) throw new BookingError("BOOKING_MODALITY_INVALID", 400, "The selected modality is not available for this service.");
    const reference = `BK-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const appointment = map(insert("booking_appointments", { service_id: serviceId, provider_id: providerId, customer_name: customerName, customer_contact: customerContact, starts_at: slot.startsAt, modality, booking_reference: reference, status: "PENDING", ...(identity ? { app_user_id: identity.appUserId, auth_project_id: identity.authProjectId } : {}) }));
    return { appointment, confirmation: confirmation(appointment) };
  });
  return Object.freeze({
    listServices: () => list("booking_services"), listProviders: () => list("booking_providers"), listAppointments: () => list("booking_appointments"),
    listAssociations: () => db.prepare("SELECT provider_id AS providerId, service_id AS serviceId, created_at AS createdAt FROM booking_provider_services WHERE workspace_id=? ORDER BY created_at DESC").all(ws()),
    createService: ({ name, durationMinutes, modalities: inputModalities = [], priceAmount = null, priceCurrency = null }) => map(insert("booking_services", { name, duration_minutes: durationMinutes, modalities_json: JSON.stringify(inputModalities), price_amount: priceAmount, price_currency: priceCurrency, active: 1 })),
    createProvider: ({ name }) => map(insert("booking_providers", { name, active: 1 })),
    associate(providerId, serviceId) { if (!owns("booking_providers", providerId) || !owns("booking_services", serviceId)) return false; db.prepare("INSERT OR IGNORE INTO booking_provider_services(workspace_id,provider_id,service_id,created_at) VALUES(?,?,?,?)").run(ws(), providerId, serviceId, now()); return true; },
    addAvailability({ providerId, weekday, startsAt, endsAt, capacity = 1, status = "ACTIVE" }) { if (!owns("booking_providers", providerId)) return null; const id = crypto.randomUUID(); db.prepare("INSERT INTO booking_availability(id,workspace_id,provider_id,weekday,starts_at,ends_at,capacity,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id, ws(), providerId, weekday, startsAt, endsAt, capacity, status, now()); return db.prepare("SELECT * FROM booking_availability WHERE id=? AND workspace_id=?").get(id, ws()); },
    listAvailability: () => list("booking_availability"),
    createAppointment({ serviceId, providerId, customerName, startsAt }) { if (!owns("booking_services", serviceId) || !owns("booking_providers", providerId) || !db.prepare("SELECT 1 FROM booking_provider_services WHERE workspace_id=? AND provider_id=? AND service_id=?").get(ws(), providerId, serviceId)) return null; return map(insert("booking_appointments", { service_id: serviceId, provider_id: providerId, customer_name: customerName, starts_at: startsAt, status: "PENDING" })); },
    listCustomerServices: () => db.prepare("SELECT * FROM booking_services WHERE workspace_id=? AND active=1 ORDER BY created_at DESC").all(ws()).map(presentService),
    listEligibleProviders: (serviceId) => !service(serviceId)?.active ? [] : db.prepare("SELECT p.* FROM booking_providers p JOIN booking_provider_services ps ON ps.provider_id=p.id AND ps.workspace_id=p.workspace_id WHERE p.workspace_id=? AND p.active=1 AND ps.service_id=? ORDER BY p.created_at DESC").all(ws(), serviceId).map(presentProvider),
    listCustomerSlots: ({ serviceId, providerId, date }) => { if (!dateOnly(date)) return []; const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay(); return db.prepare("SELECT starts_at FROM booking_availability WHERE workspace_id=? AND provider_id=? AND weekday=? ORDER BY starts_at ASC").all(ws(), providerId, weekday).map(({ starts_at }) => slotFor({ serviceId, providerId, date, startsAt: starts_at })).filter(Boolean); },
    quoteCustomerBooking: ({ serviceId, providerId, date, startsAt, modality = null }) => { const slot = slotFor({ serviceId, providerId, date, startsAt }); if (!slot || (modality && !slot.modalityOptions.includes(modality))) return null; return { slot, service: presentService(service(serviceId)), provider: presentProvider(provider(providerId)), modality }; },
    createCustomerAppointment: claim,
    // Student-facing projection: only rows explicitly linked to this identity.
    listAppointmentsForIdentity: ({ authProjectId, appUserId }) => db.prepare("SELECT * FROM booking_appointments WHERE workspace_id=? AND auth_project_id=? AND app_user_id=? ORDER BY starts_at ASC").all(ws(), authProjectId, appUserId).map((row) => ({
      id: row.id, reference: row.booking_reference || null, status: row.status, startsAt: row.starts_at, modality: row.modality || null,
      service: service(row.service_id) ? { name: service(row.service_id).name, durationMinutes: service(row.service_id).duration_minutes } : null,
      provider: provider(row.provider_id) ? { name: provider(row.provider_id).name } : null,
    })),
    getCustomerConfirmation: (reference) => confirmation(db.prepare("SELECT * FROM booking_appointments WHERE workspace_id=? AND booking_reference=?").get(ws(), reference)),
  });
}
