import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { LEGACY_BOOKING_SCOPE, normalizeScope, scopeClause } from "../services/booking-scope.mjs";
import { createSensitiveAccessAudit } from "../services/sensitive-access-audit.mjs";

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

// The canonical appointment lifecycle. Terminal states never reopen.
export const APPOINTMENT_TRANSITIONS = Object.freeze({
  PENDING: Object.freeze(["CONFIRMED", "CANCELLED"]),
  CONFIRMED: Object.freeze(["CANCELLED", "COMPLETED"]),
  CANCELLED: Object.freeze([]),
  COMPLETED: Object.freeze([]),
});

export function createBookingRepository(db, { audit = createSensitiveAccessAudit(db), clock = () => new Date() } = {}) {
  const ws = () => requireWorkspaceId(), now = () => clock().toISOString();
  const inScope = (scope, column) => scopeClause(scope, column);
  const list = (table, scope) => { const c = inScope(scope); return db.prepare(`SELECT * FROM ${table} WHERE workspace_id=? AND ${c.sql} ORDER BY created_at DESC`).all(ws(), ...c.params).map(map); };
  const owns = (table, id, scope) => { const c = inScope(scope); return Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND workspace_id=? AND ${c.sql}`).get(id, ws(), ...c.params)); };
  const insert = (table, data) => { const id = crypto.randomUUID(), at = now(), fields = Object.keys(data); db.prepare(`INSERT INTO ${table}(id,workspace_id,${fields.join(",")},created_at,updated_at) VALUES(?,?,${fields.map(() => "?").join(",")},?,?)`).run(id, ws(), ...fields.map((key) => data[key]), at, at); return db.prepare(`SELECT * FROM ${table} WHERE id=? AND workspace_id=?`).get(id, ws()); };
  const siteStamp = (scope) => { const resolved = normalizeScope(scope); return resolved.kind === "legacy" ? {} : { site_project_id: resolved.siteProjectId }; };
  const scoped = (table, id, scope) => { const c = inScope(scope); return db.prepare(`SELECT * FROM ${table} WHERE id=? AND workspace_id=? AND ${c.sql}`).get(id, ws(), ...c.params); };
  const service = (id, scope) => scoped("booking_services", id, scope);
  const provider = (id, scope) => scoped("booking_providers", id, scope);
  const anyService = (id) => db.prepare("SELECT * FROM booking_services WHERE id=? AND workspace_id=?").get(id, ws());
  const anyProvider = (id) => db.prepare("SELECT * FROM booking_providers WHERE id=? AND workspace_id=?").get(id, ws());
  const presentService = (row) => ({ id: row.id, name: row.name, durationMinutes: row.duration_minutes, modalities: modalities(row.modalities_json), price: row.price_amount == null ? null : { amount: row.price_amount, currency: row.price_currency || null } });
  const presentProvider = (row) => ({ id: row.id, name: row.name });
  const slotFor = ({ serviceId, providerId, date, startsAt, scope }) => {
    const selectedService = service(serviceId, scope), selectedProvider = provider(providerId, scope);
    if (!selectedService?.active || !selectedProvider?.active || !dateOnly(date) || !timeOnly(startsAt)) return null;
    if (!db.prepare("SELECT 1 FROM booking_provider_services WHERE workspace_id=? AND provider_id=? AND service_id=?").get(ws(), providerId, serviceId)) return null;
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const availability = db.prepare("SELECT * FROM booking_availability WHERE workspace_id=? AND provider_id=? AND weekday=? AND starts_at=? ORDER BY created_at DESC LIMIT 1").get(ws(), providerId, weekday, startsAt);
    if (!availability) return null;
    const slotStartsAt = isoFor(date, startsAt), booked = db.prepare("SELECT count(*) AS count FROM booking_appointments WHERE workspace_id=? AND provider_id=? AND starts_at=? AND status IN ('PENDING','CONFIRMED')").get(ws(), providerId, slotStartsAt).count;
    const state = availability.status === "CANCELLED" ? "cancelled" : booked >= availability.capacity ? "full" : booked > 0 ? "limited" : "available";
    return { id: `${availability.id}:${date}:${startsAt}`, availabilityId: availability.id, serviceId, providerId, startsAt: slotStartsAt, startsAtTime: startsAt, endsAt: isoFor(date, availability.ends_at), state, capacity: availability.capacity, remainingCapacity: Math.max(0, availability.capacity - booked), modalityOptions: modalities(selectedService.modalities_json), price: presentService(selectedService).price, siteProjectId: selectedService.site_project_id || null };
  };
  // Strict (Medical) sites never echo the patient's contact back by reference.
  const confirmation = (appointment, scope) => !appointment ? null : ({ reference: appointment.booking_reference, appointmentId: appointment.id, status: appointment.status, startsAt: appointment.starts_at, service: presentService(anyService(appointment.service_id)), provider: presentProvider(anyProvider(appointment.provider_id)), modality: appointment.modality || null, customer: { name: appointment.customer_name, contact: normalizeScope(scope).kind === "strict" ? null : (appointment.customer_contact || null) } });
  const claim = db.transaction(({ serviceId, providerId, date, startsAt, customerName, customerContact = null, modality = null, identity = null, scope = LEGACY_BOOKING_SCOPE }) => {
    const slot = slotFor({ serviceId, providerId, date, startsAt, scope });
    if (!slot) throw new BookingError("BOOKING_SLOT_NOT_FOUND", 404, "The selected slot is not available for this service and provider.");
    if (slot.state === "cancelled") throw new BookingError("BOOKING_SLOT_CANCELLED", 409, "The selected slot has been cancelled.");
    if (slot.state === "full") throw new BookingError("BOOKING_SLOT_FULL", 409, "The selected slot is no longer available.");
    if (modality && !slot.modalityOptions.includes(modality)) throw new BookingError("BOOKING_MODALITY_INVALID", 400, "The selected modality is not available for this service.");
    const reference = `BK-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const appointment = map(insert("booking_appointments", { service_id: serviceId, provider_id: providerId, customer_name: customerName, customer_contact: customerContact, starts_at: slot.startsAt, modality, booking_reference: reference, status: "PENDING", ...(slot.siteProjectId ? { site_project_id: slot.siteProjectId } : {}), ...(identity ? { app_user_id: identity.appUserId, auth_project_id: identity.authProjectId } : {}) }));
    return { appointment, confirmation: confirmation(appointment, scope) };
  });
  const transition = db.transaction(({ id, to, reason = null, actor, scope = LEGACY_BOOKING_SCOPE }) => {
    const row = scoped("booking_appointments", id, scope);
    if (!row) throw new BookingError("BOOKING_APPOINTMENT_NOT_FOUND", 404, "Appointment not found.");
    if (!(APPOINTMENT_TRANSITIONS[row.status] || []).includes(to)) throw new BookingError("BOOKING_STATUS_TRANSITION_INVALID", 409, `An appointment cannot move from ${row.status} to ${to}.`);
    if (to === "COMPLETED" && Date.parse(row.starts_at) > clock().getTime()) throw new BookingError("BOOKING_APPOINTMENT_NOT_STARTED", 409, "An appointment cannot be completed before it starts.");
    const changed = db.prepare("UPDATE booking_appointments SET status=?,updated_at=? WHERE id=? AND workspace_id=? AND status=?").run(to, now(), id, ws(), row.status).changes;
    if (changed !== 1) throw new BookingError("BOOKING_STATUS_CONFLICT", 409, "The appointment changed; reload and retry.");
    audit.record({ siteProjectId: row.site_project_id || null, actor, action: "booking.appointment.status_changed", resourceType: "booking_appointment", resourceId: id, metadata: { from: row.status, to, reason: reason ? String(reason).slice(0, 200) : null } });
    return map(db.prepare("SELECT * FROM booking_appointments WHERE id=? AND workspace_id=?").get(id, ws()));
  });
  return Object.freeze({
    listServices: (scope) => list("booking_services", scope), listProviders: (scope) => list("booking_providers", scope), listAppointments: (scope) => list("booking_appointments", scope),
    listAssociations: (scope) => { const c = inScope(scope, "p.site_project_id"); return db.prepare(`SELECT ps.provider_id AS providerId, ps.service_id AS serviceId, ps.created_at AS createdAt FROM booking_provider_services ps JOIN booking_providers p ON p.id=ps.provider_id AND p.workspace_id=ps.workspace_id WHERE ps.workspace_id=? AND ${c.sql} ORDER BY ps.created_at DESC`).all(ws(), ...c.params); },
    createService: ({ name, durationMinutes, modalities: inputModalities = [], priceAmount = null, priceCurrency = null, scope }) => map(insert("booking_services", { name, duration_minutes: durationMinutes, modalities_json: JSON.stringify(inputModalities), price_amount: priceAmount, price_currency: priceCurrency, active: 1, ...siteStamp(scope) })),
    createProvider: ({ name, scope }) => map(insert("booking_providers", { name, active: 1, ...siteStamp(scope) })),
    associate(providerId, serviceId, scope) {
      if (!owns("booking_providers", providerId, scope) || !owns("booking_services", serviceId, scope)) return false;
      try { db.prepare("INSERT OR IGNORE INTO booking_provider_services(workspace_id,provider_id,service_id,created_at) VALUES(?,?,?,?)").run(ws(), providerId, serviceId, now()); }
      catch (error) { if (/booking scope mismatch/.test(String(error?.message))) throw new BookingError("BOOKING_SCOPE_MISMATCH", 409, "A provider and service must share one site scope."); throw error; }
      return true;
    },
    addAvailability({ providerId, weekday, startsAt, endsAt, capacity = 1, status = "ACTIVE", scope }) { if (!owns("booking_providers", providerId, scope)) return null; const id = crypto.randomUUID(); db.prepare("INSERT INTO booking_availability(id,workspace_id,provider_id,weekday,starts_at,ends_at,capacity,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id, ws(), providerId, weekday, startsAt, endsAt, capacity, status, now()); return db.prepare("SELECT * FROM booking_availability WHERE id=? AND workspace_id=?").get(id, ws()); },
    listAvailability: (scope) => { const c = inScope(scope, "p.site_project_id"); return db.prepare(`SELECT a.* FROM booking_availability a JOIN booking_providers p ON p.id=a.provider_id AND p.workspace_id=a.workspace_id WHERE a.workspace_id=? AND ${c.sql} ORDER BY a.created_at DESC`).all(ws(), ...c.params); },
    createAppointment({ serviceId, providerId, customerName, startsAt, scope }) {
      const selectedService = service(serviceId, scope);
      if (!selectedService || !owns("booking_providers", providerId, scope) || !db.prepare("SELECT 1 FROM booking_provider_services WHERE workspace_id=? AND provider_id=? AND service_id=?").get(ws(), providerId, serviceId)) return null;
      return map(insert("booking_appointments", { service_id: serviceId, provider_id: providerId, customer_name: customerName, starts_at: startsAt, status: "PENDING", ...(selectedService.site_project_id ? { site_project_id: selectedService.site_project_id } : {}) }));
    },
    listCustomerServices: (scope) => { const c = inScope(scope); return db.prepare(`SELECT * FROM booking_services WHERE workspace_id=? AND active=1 AND ${c.sql} ORDER BY created_at DESC`).all(ws(), ...c.params).map(presentService); },
    listEligibleProviders: (serviceId, scope) => { if (!service(serviceId, scope)?.active) return []; const c = inScope(scope, "p.site_project_id"); return db.prepare(`SELECT p.* FROM booking_providers p JOIN booking_provider_services ps ON ps.provider_id=p.id AND ps.workspace_id=p.workspace_id WHERE p.workspace_id=? AND p.active=1 AND ps.service_id=? AND ${c.sql} ORDER BY p.created_at DESC`).all(ws(), serviceId, ...c.params).map(presentProvider); },
    listCustomerSlots: ({ serviceId, providerId, date, scope }) => { if (!dateOnly(date) || !provider(providerId, scope)) return []; const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay(); return db.prepare("SELECT starts_at FROM booking_availability WHERE workspace_id=? AND provider_id=? AND weekday=? ORDER BY starts_at ASC").all(ws(), providerId, weekday).map(({ starts_at }) => slotFor({ serviceId, providerId, date, startsAt: starts_at, scope })).filter(Boolean); },
    quoteCustomerBooking: ({ serviceId, providerId, date, startsAt, modality = null, scope }) => { const slot = slotFor({ serviceId, providerId, date, startsAt, scope }); if (!slot || (modality && !slot.modalityOptions.includes(modality))) return null; return { slot, service: presentService(anyService(serviceId)), provider: presentProvider(anyProvider(providerId)), modality }; },
    createCustomerAppointment: claim,
    transitionAppointment: transition,
    // Portal projection: only rows explicitly linked to this identity (and in scope).
    listAppointmentsForIdentity: ({ authProjectId, appUserId, scope }) => { const c = inScope(scope); return db.prepare(`SELECT * FROM booking_appointments WHERE workspace_id=? AND auth_project_id=? AND app_user_id=? AND ${c.sql} ORDER BY starts_at ASC`).all(ws(), authProjectId, appUserId, ...c.params).map((row) => ({
      id: row.id, reference: row.booking_reference || null, status: row.status, startsAt: row.starts_at, modality: row.modality || null,
      service: anyService(row.service_id) ? { name: anyService(row.service_id).name, durationMinutes: anyService(row.service_id).duration_minutes } : null,
      provider: anyProvider(row.provider_id) ? { name: anyProvider(row.provider_id).name } : null,
    })); },
    getCustomerConfirmation: (reference, scope) => { const c = inScope(scope); return confirmation(db.prepare(`SELECT * FROM booking_appointments WHERE workspace_id=? AND booking_reference=? AND ${c.sql}`).get(ws(), reference, ...c.params), scope); },
  });
}
