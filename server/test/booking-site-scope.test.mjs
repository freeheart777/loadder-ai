import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createBookingRouter } from "../app/routes/booking.mjs";
import { LEGACY_BOOKING_SCOPE, bookingScopeForSite } from "../app/services/booking-scope.mjs";
import { createSensitiveAccessAudit, sanitizeAuditMetadata } from "../app/services/sensitive-access-audit.mjs";
import { migration099BookingSiteScope } from "../db/migrations/099_booking_site_scope.mjs";

const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();

function fixture({ clock } = {}) {
  const db = createSiteTestDb();
  const booking = createBookingRepository(db, clock ? { clock } : {}), audit = createSensitiveAccessAudit(db);
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const make = (ws, name, siteType) => runWithWorkspace(ws, () => projects.create({ name, siteType, content: {} }));
  const medA = make("ws-1", "NAVA A", "MEDICAL"), medB = make("ws-1", "NAVA B", "MEDICAL"), edu = make("ws-1", "Academy", "EDUCATION"), foreign = make("ws-2", "Other", "MEDICAL");
  const scope = (site) => bookingScopeForSite(site);
  const seed = (ws, sc, label) => runWithWorkspace(ws, () => {
    const s = booking.createService({ name: `${label}-service`, durationMinutes: 30, modalities: ["IN_PERSON"], scope: sc });
    const p = booking.createProvider({ name: `${label}-doctor`, scope: sc });
    assert.equal(booking.associate(p.id, s.id, sc), true);
    booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 3, scope: sc });
    return { serviceId: s.id, providerId: p.id };
  });
  const a = seed("ws-1", scope(medA), "A"), b = seed("ws-1", scope(medB), "B"), legacy = seed("ws-1", LEGACY_BOOKING_SCOPE, "legacy"), eduRows = seed("ws-1", scope(edu), "edu");
  const book = (ids, sc, extra = {}) => runWithWorkspace("ws-1", () => booking.createCustomerAppointment({ ...ids, date: future, startsAt: "10:00", customerName: "بیمار", customerContact: "09120000000", scope: sc, ...extra }));
  return { db, booking, audit, projects, medA, medB, edu, foreign, scope, a, b, legacy, eduRows, book };
}
const names = (rows) => rows.map((row) => row.name).sort();

test("migration 099 keeps legacy rows valid and unscoped", () => {
  const db = createSiteTestDb({ maxVersion: 98 });
  const at = "2026-01-01T00:00:00.000Z";
  db.prepare("INSERT INTO booking_services(id,workspace_id,name,duration_minutes,active,created_at,updated_at) VALUES('s','ws-1','Old',30,1,?,?)").run(at, at);
  db.prepare("INSERT INTO booking_providers(id,workspace_id,name,active,created_at,updated_at) VALUES('p','ws-1','Old',1,?,?)").run(at, at);
  db.prepare("INSERT INTO booking_provider_services(workspace_id,provider_id,service_id,created_at) VALUES('ws-1','p','s',?)").run(at);
  db.prepare("INSERT INTO booking_appointments(id,workspace_id,service_id,provider_id,customer_name,starts_at,status,created_at,updated_at) VALUES('a','ws-1','s','p','x','2026-01-02T10:00:00.000Z','CONFIRMED',?,?)").run(at, at);
  migration099BookingSiteScope.up(db);
  for (const table of ["booking_services", "booking_providers", "booking_appointments"]) assert.equal(db.prepare(`SELECT site_project_id FROM ${table}`).get().site_project_id, null, table);
  const repo = createBookingRepository(db);
  runWithWorkspace("ws-1", () => { assert.equal(repo.listAppointments().length, 1); assert.equal(repo.listServices().length, 1); assert.equal(repo.listAssociations().length, 1); });
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  db.close();
});

test("Medical sites are strict: never see another site or legacy rows; Education sees own plus legacy", () => {
  const f = fixture();
  runWithWorkspace("ws-1", () => {
    assert.deepEqual(names(f.booking.listServices(f.scope(f.medA))), ["A-service"]);
    assert.deepEqual(names(f.booking.listServices(f.scope(f.medB))), ["B-service"]);
    assert.deepEqual(names(f.booking.listProviders(f.scope(f.medA))), ["A-doctor"]);
    assert.deepEqual(names(f.booking.listServices(f.scope(f.edu))), ["edu-service", "legacy-service"]);
    assert.deepEqual(names(f.booking.listServices(LEGACY_BOOKING_SCOPE)), ["legacy-service"], "omitted scope keeps the legacy view");
    assert.deepEqual(f.booking.listCustomerServices(f.scope(f.medA)).map((s) => s.name), ["A-service"]);
    assert.deepEqual(f.booking.listEligibleProviders(f.a.serviceId, f.scope(f.medA)).map((p) => p.name), ["A-doctor"]);
    assert.deepEqual(f.booking.listEligibleProviders(f.b.serviceId, f.scope(f.medA)), [], "another site's service has no providers here");
    assert.deepEqual(f.booking.listEligibleProviders(f.legacy.serviceId, f.scope(f.medA)), [], "strict never reaches legacy");
    assert.equal(f.booking.listEligibleProviders(f.legacy.serviceId, f.scope(f.edu)).length, 1, "legacy stays reachable from Education");
    assert.equal(f.booking.listAvailability(f.scope(f.medA)).length, 1);
    assert.equal(f.booking.listAssociations(f.scope(f.medA)).length, 1);
    assert.deepEqual(f.booking.listCustomerSlots({ ...f.b, date: future, scope: f.scope(f.medA) }), []);
    assert.equal(f.booking.listCustomerSlots({ ...f.a, date: future, scope: f.scope(f.medA) }).length, 1);
    assert.equal(f.booking.quoteCustomerBooking({ ...f.b, date: future, startsAt: "10:00", scope: f.scope(f.medA) }), null);
  });
  f.db.close();
});

test("cross-site, cross-scope and cross-workspace writes are rejected", () => {
  const f = fixture();
  runWithWorkspace("ws-1", () => {
    assert.throws(() => f.book(f.b, f.scope(f.medA)), (e) => e.code === "BOOKING_SLOT_NOT_FOUND");
    assert.throws(() => f.book({ serviceId: f.a.serviceId, providerId: f.b.providerId }, f.scope(f.medA)), (e) => e.code === "BOOKING_SLOT_NOT_FOUND");
    assert.throws(() => f.book(f.legacy, f.scope(f.medA)), (e) => e.code === "BOOKING_SLOT_NOT_FOUND");
    assert.equal(f.booking.associate(f.b.providerId, f.a.serviceId, f.scope(f.medA)), false);
    assert.equal(f.booking.addAvailability({ providerId: f.b.providerId, weekday, startsAt: "12:00", endsAt: "13:00", scope: f.scope(f.medA) }), null);
    assert.equal(f.booking.createAppointment({ ...f.b, customerName: "x", startsAt: "2030-01-01T10:00:00.000Z", scope: f.scope(f.medA) }), null);
    // Even with compat scope, a provider and service of different scopes cannot be associated.
    assert.throws(() => f.booking.associate(f.legacy.providerId, f.eduRows.serviceId, { kind: "compat", siteProjectId: f.edu.id }), (e) => e.code === "BOOKING_SCOPE_MISMATCH");
    // Database-level guards hold even if the repository were bypassed.
    assert.throws(() => f.db.prepare("INSERT INTO booking_provider_services(workspace_id,provider_id,service_id,created_at) VALUES('ws-1',?,?,'x')").run(f.a.providerId, f.b.serviceId), /scope mismatch/);
    assert.throws(() => f.db.prepare("INSERT INTO booking_appointments(id,workspace_id,service_id,provider_id,customer_name,starts_at,status,created_at,updated_at,site_project_id) VALUES('x','ws-1',?,?,'n','2030-01-01T10:00:00.000Z','PENDING','x','x',?)").run(f.a.serviceId, f.a.providerId, f.medB.id), /scope mismatch/);
    assert.throws(() => f.db.prepare("UPDATE booking_services SET site_project_id=? WHERE id=?").run(f.medB.id, f.a.serviceId), /immutable/);
    assert.throws(() => f.db.prepare("UPDATE booking_services SET site_project_id=NULL WHERE id=?").run(f.a.serviceId), /immutable/);
    assert.throws(() => f.db.prepare("UPDATE booking_services SET site_project_id=? WHERE id=?").run(f.medA.id, f.legacy.serviceId), /immutable/, "legacy rows are never silently claimed by a site");
  });
  assert.throws(() => runWithWorkspace("ws-1", () => f.booking.createService({ name: "x", durationMinutes: 30, scope: { kind: "strict", siteProjectId: f.foreign.id } })), /site scope must belong to the workspace/);
  f.db.close();
});

test("public confirmation and identity reads respect scope; strict sites never echo contact", () => {
  const f = fixture();
  const own = f.book(f.a, f.scope(f.medA), { identity: null }), other = f.book(f.b, f.scope(f.medB));
  runWithWorkspace("ws-1", () => {
    assert.equal(own.appointment.site_project_id, f.medA.id);
    assert.equal(f.booking.getCustomerConfirmation(own.confirmation.reference, f.scope(f.medB)), null, "another site cannot read this confirmation");
    assert.equal(f.booking.getCustomerConfirmation(own.confirmation.reference, LEGACY_BOOKING_SCOPE), null);
    const readBack = f.booking.getCustomerConfirmation(own.confirmation.reference, f.scope(f.medA));
    assert.equal(readBack.appointmentId, own.appointment.id);
    assert.equal(readBack.customer.contact, null, "Medical confirmation does not return the patient's phone");
    assert.equal(f.booking.getCustomerConfirmation(other.confirmation.reference, f.scope(f.medA)), null);
    assert.equal(f.booking.listAppointments(f.scope(f.medA)).length, 1);
    assert.equal(f.booking.listAppointments(LEGACY_BOOKING_SCOPE).length, 0);
  });
  const legacyBooking = f.book(f.legacy, f.scope(f.edu));
  runWithWorkspace("ws-1", () => assert.equal(f.booking.getCustomerConfirmation(legacyBooking.confirmation.reference, f.scope(f.edu)).customer.contact, "09120000000", "legacy-compatible sites keep the existing confirmation shape"));
  f.db.close();
});

test("appointment status contract: lawful transitions only, audited, scoped", () => {
  let now = new Date();
  const f = fixture({ clock: () => now });
  const op = { kind: "operator", id: "op-1" };
  const created = f.book(f.a, f.scope(f.medA)).appointment;
  runWithWorkspace("ws-1", () => {
    assert.throws(() => f.booking.transitionAppointment({ id: created.id, to: "CONFIRMED", actor: op, scope: f.scope(f.medB) }), (e) => e.code === "BOOKING_APPOINTMENT_NOT_FOUND", "another site cannot move it");
    assert.throws(() => f.booking.transitionAppointment({ id: created.id, to: "COMPLETED", actor: op, scope: f.scope(f.medA) }), (e) => e.code === "BOOKING_STATUS_TRANSITION_INVALID", "PENDING cannot complete");
    assert.equal(f.booking.transitionAppointment({ id: created.id, to: "CONFIRMED", reason: "تأیید تلفنی", actor: op, scope: f.scope(f.medA) }).status, "CONFIRMED");
    assert.throws(() => f.booking.transitionAppointment({ id: created.id, to: "COMPLETED", actor: op, scope: f.scope(f.medA) }), (e) => e.code === "BOOKING_APPOINTMENT_NOT_STARTED", "completed sessions are never fabricated");
    now = new Date(Date.now() + 30 * 86400000);
    assert.equal(f.booking.transitionAppointment({ id: created.id, to: "COMPLETED", actor: op, scope: f.scope(f.medA) }).status, "COMPLETED");
    for (const to of ["CONFIRMED", "CANCELLED", "PENDING"]) assert.throws(() => f.booking.transitionAppointment({ id: created.id, to, actor: op, scope: f.scope(f.medA) }), (e) => e.code === "BOOKING_STATUS_TRANSITION_INVALID", `terminal -> ${to}`);
    const events = f.audit.list({ resourceType: "booking_appointment", resourceId: created.id });
    assert.deepEqual(events.map((e) => [e.metadata.from, e.metadata.to]), [["PENDING", "CONFIRMED"], ["CONFIRMED", "COMPLETED"]], "only successful transitions are audited, in order");
    assert.ok(events.every((e) => e.siteProjectId === f.medA.id && e.actorKind === "operator" && e.actorId === "op-1" && e.action === "booking.appointment.status_changed"));
    assert.equal(events[0].metadata.reason, "تأیید تلفنی");
    // Cancelling releases capacity.
    const second = f.book(f.a, f.scope(f.medA)).appointment;
    assert.equal(f.booking.listCustomerSlots({ ...f.a, date: future, scope: f.scope(f.medA) })[0].remainingCapacity, 2);
    f.booking.transitionAppointment({ id: second.id, to: "CANCELLED", actor: op, scope: f.scope(f.medA) });
    assert.equal(f.booking.listCustomerSlots({ ...f.a, date: future, scope: f.scope(f.medA) })[0].remainingCapacity, 3);
  });
  f.db.close();
});

test("sensitive audit is append-only, workspace-scoped and never stores secrets", () => {
  const f = fixture();
  runWithWorkspace("ws-1", () => {
    const id = f.audit.record({ siteProjectId: f.medA.id, actor: { kind: "app_user", id: "u1" }, action: "x.read", resourceType: "doc", resourceId: "d1", metadata: { ok: true, count: 2, note: "a".repeat(500), token: "SECRET", otpHash: "h", storageKey: "k", nested: { a: 1 }, sessionToken: "s" } });
    const [event] = f.audit.list({ resourceType: "doc" });
    assert.equal(event.id, id);
    assert.deepEqual(Object.keys(event.metadata).sort(), ["count", "note", "ok"]);
    assert.equal(event.metadata.note.length, 200);
    assert.equal(/SECRET|storageKey|otpHash/.test(JSON.stringify(event)), false);
    assert.throws(() => f.db.prepare("UPDATE sensitive_access_events SET action='y' WHERE id=?").run(id), /append-only/);
    assert.throws(() => f.db.prepare("UPDATE sensitive_access_events SET workspace_id='ws-2' WHERE id=?").run(id), /append-only/);
    assert.throws(() => f.db.prepare("DELETE FROM sensitive_access_events WHERE id=?").run(id), /append-only/);
    assert.throws(() => f.audit.record({ actor: { kind: "stranger" }, action: "x", resourceType: "y" }));
  });
  runWithWorkspace("ws-2", () => assert.deepEqual(f.audit.list({ resourceType: "doc" }), []));
  assert.deepEqual(sanitizeAuditMetadata({ password: "p", Authorization: "a", fine: "v" }), { fine: "v" });
  f.db.close();
});

test("operator Booking API: explicit site scope, legacy default, foreign site 404, operator-only status", async () => {
  const f = fixture();
  f.db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role) VALUES('m1','ws-1','owner','active','owner'),('m2','ws-1','member','active','member')").run();
  let actor = "owner";
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: actor }; runWithWorkspace("ws-1", next); });
  app.use(createBookingRouter({ repository: f.booking, siteProjectService: f.projects, db: f.db }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => { const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, body: await res.json() }; };
  try {
    const legacyView = await call("GET", "/booking");
    assert.deepEqual(names(legacyView.body.services), ["legacy-service"], "no siteProjectId keeps the legacy view");
    const medical = await call("GET", `/booking?siteProjectId=${f.medA.id}`);
    assert.deepEqual(names(medical.body.services), ["A-service"]);
    assert.equal((await call("GET", `/booking?siteProjectId=${f.foreign.id}`)).status, 404, "a site from another workspace is never a silent fallback");
    const created = await call("POST", "/booking/services", { siteProjectId: f.medA.id, name: "ویزیت", durationMinutes: 20 });
    assert.equal(created.status, 201); assert.equal(created.body.service.site_project_id, f.medA.id);
    assert.deepEqual(names((await call("GET", `/booking?siteProjectId=${f.medB.id}`)).body.services), ["B-service"], "site B never sees site A's new service");
    const unscoped = await call("POST", "/booking/services", { name: "قدیمی", durationMinutes: 20 });
    assert.equal(unscoped.body.service.site_project_id ?? null, null, "existing callers keep creating legacy rows");
    assert.equal((await call("POST", `/booking/providers/${f.a.providerId}/services/${f.b.serviceId}`, { siteProjectId: f.medA.id })).status, 404);

    const appointment = f.book(f.a, f.scope(f.medA)).appointment;
    actor = "member";
    assert.equal((await call("POST", `/booking/appointments/${appointment.id}/status`, { siteProjectId: f.medA.id, status: "CONFIRMED" })).status, 403, "plain members cannot change appointment status");
    actor = "owner";
    assert.equal((await call("POST", `/booking/appointments/${appointment.id}/status`, { status: "CONFIRMED" })).status, 404, "without the site scope the appointment is invisible");
    assert.equal((await call("POST", `/booking/appointments/${appointment.id}/status`, { siteProjectId: f.medB.id, status: "CONFIRMED" })).status, 404);
    assert.equal((await call("POST", `/booking/appointments/${appointment.id}/status`, { siteProjectId: f.medA.id, status: "BOGUS" })).status, 400);
    const ok = await call("POST", `/booking/appointments/${appointment.id}/status`, { siteProjectId: f.medA.id, status: "CONFIRMED", reason: "ok" });
    assert.equal(ok.status, 200); assert.equal(ok.body.appointment.status, "CONFIRMED");
    assert.equal((await call("POST", `/booking/appointments/${appointment.id}/status`, { siteProjectId: f.medA.id, status: "PENDING" })).status, 400);
    assert.equal((await call("POST", `/booking/appointments/${appointment.id}/status`, { siteProjectId: f.medA.id, status: "CONFIRMED" })).status, 409);
    assert.equal(runWithWorkspace("ws-1", () => f.audit.list({ resourceId: appointment.id })).length, 1);
  } finally { await new Promise((resolve) => server.close(resolve)); f.db.close(); }
});
