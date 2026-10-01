import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteMediaRepository } from "../app/repositories/site-media-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteMediaService } from "../app/services/site-media-service.mjs";
import { createLearningAccessService } from "../app/services/learning-access-service.mjs";
import { resolveBookingIdentity } from "../app/services/booking-identity.mjs";
import { createPublicEducationRouter } from "../app/routes/public-education.mjs";
import { LoadderAppUserAuth } from "../app/business-builder/app-user-auth.mjs";
import { migration098BookingAppointmentIdentityLink } from "../db/migrations/098_booking_appointment_identity_link.mjs";

const future = (() => { const d = new Date(Date.now() + 14 * 86400000); return d.toISOString().slice(0, 10); })();
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();

function fixture() {
  const db = createSiteTestDb();
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES('app-1','ws-1','S','s','fa-IR','ready','x','x'),('app-2','ws-2','S2','s','fa-IR','ready','x','x')").run();
  const booking = createBookingRepository(db), auth = new LoadderAppUserAuth(db);
  const projectService = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const site = runWithWorkspace("ws-1", () => projectService.create({ name: "Academy", siteType: "EDUCATION", content: {} }));
  const ids = runWithWorkspace("ws-1", () => {
    const service = booking.createService({ name: "پیانو", durationMinutes: 45, modalities: ["ONLINE"] }), provider = booking.createProvider({ name: "مدرس" });
    booking.associate(provider.id, service.id);
    booking.addAvailability({ providerId: provider.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 5 });
    booking.addAvailability({ providerId: provider.id, weekday, startsAt: "12:00", endsAt: "13:00", capacity: 5 });
    return { serviceId: service.id, providerId: provider.id };
  });
  const mk = (ws, projectId, email, role = "customer") => runWithWorkspace(ws, () => { const user = auth.createUser({ projectId, email, role }); return { user, token: auth.createSession(user.id).token, principal: { id: user.id, projectId, role } }; });
  const a = mk("ws-1", "app-1", "a@x.test"), b = mk("ws-1", "app-1", "b@x.test"), staff = mk("ws-1", "app-1", "s@x.test", "employee"), foreign = mk("ws-2", "app-2", "f@x.test");
  const book = (startsAt, identity, extra = {}) => runWithWorkspace("ws-1", () => booking.createCustomerAppointment({ ...ids, date: future, startsAt, customerName: "نام یکسان", customerContact: "0912", modality: "ONLINE", identity, ...extra }));
  return { db, booking, auth, site, ids, a, b, staff, foreign, book };
}
const idOf = (user) => ({ appUserId: user.user.id, authProjectId: user.principal.projectId });

test("pre-migration appointments stay valid, unlinked and unclaimed", () => {
  const db = createSiteTestDb({ maxVersion: 97 });
  const at = "2026-01-01T00:00:00.000Z";
  db.prepare("INSERT INTO booking_services(id,workspace_id,name,duration_minutes,active,created_at,updated_at) VALUES('s1','ws-1','Old',30,1,?,?)").run(at, at);
  db.prepare("INSERT INTO booking_providers(id,workspace_id,name,active,created_at,updated_at) VALUES('p1','ws-1','Old',1,?,?)").run(at, at);
  db.prepare("INSERT INTO booking_provider_services(workspace_id,provider_id,service_id,created_at) VALUES('ws-1','p1','s1',?)").run(at);
  db.prepare("INSERT INTO booking_appointments(id,workspace_id,service_id,provider_id,customer_name,starts_at,status,created_at,updated_at) VALUES('old','ws-1','s1','p1','نام یکسان','2026-01-02T10:00:00.000Z','CONFIRMED',?,?)").run(at, at);
  migration098BookingAppointmentIdentityLink.up(db);
  const row = db.prepare("SELECT * FROM booking_appointments WHERE id='old'").get();
  assert.equal(row.status, "CONFIRMED"); assert.equal(row.app_user_id, null); assert.equal(row.auth_project_id, null);
  assert.equal(runWithWorkspace("ws-1", () => createBookingRepository(db).listAppointments()).length, 1, "admin read still sees it");
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  db.close();
});

test("anonymous bookings are never claimed; authenticated bookings link to exactly one identity", () => {
  const f = fixture();
  const anonymous = f.book("10:00", null), mine = f.book("10:00", idOf(f.a)), theirs = f.book("12:00", idOf(f.b));
  const list = (u) => runWithWorkspace("ws-1", () => f.booking.listAppointmentsForIdentity(idOf(u)));
  assert.deepEqual(list(f.a).map((x) => x.id), [mine.appointment.id]);
  assert.deepEqual(list(f.b).map((x) => x.id), [theirs.appointment.id]);
  assert.equal(list(f.a).some((x) => x.id === anonymous.appointment.id), false, "same display name/contact does not claim an anonymous booking");
  assert.equal(anonymous.appointment.app_user_id ?? null, null);
  assert.deepEqual(runWithWorkspace("ws-2", () => f.booking.listAppointmentsForIdentity(idOf(f.a))), [], "other workspace sees nothing");
  const admin = runWithWorkspace("ws-1", () => f.booking.listAppointments());
  assert.equal(admin.length, 3, "Booking Studio/admin sees the same canonical appointments");
  assert.ok(admin.some((x) => x.id === mine.appointment.id && x.booking_reference === mine.confirmation.reference));
  const projection = JSON.stringify(list(f.a));
  assert.equal(/customer|contact|0912|app_user|workspace/.test(projection), false, "student projection exposes no contact or identity internals");
  f.db.close();
});

test("database rejects links to non-customers, other workspaces, and re-assignment", () => {
  const f = fixture();
  assert.throws(() => f.book("10:00", idOf(f.staff)), /customer app user/);
  assert.throws(() => f.book("10:00", idOf(f.foreign)), /customer app user/);
  const own = f.book("10:00", idOf(f.a));
  assert.throws(() => f.db.prepare("UPDATE booking_appointments SET app_user_id=? WHERE id=?").run(f.b.user.id, own.appointment.id), /immutable/);
  const anonymous = f.book("12:00", null);
  assert.throws(() => f.db.prepare("UPDATE booking_appointments SET app_user_id=?,auth_project_id='app-1' WHERE id=?").run(f.a.user.id, anonymous.appointment.id), /immutable/, "no silent later claim");
  f.db.close();
});

test("booking identity resolution: anonymous allowed, supplied credentials must be a valid active customer", () => {
  const f = fixture();
  runWithWorkspace("ws-1", () => {
    assert.equal(resolveBookingIdentity(f.db, {}), null);
    assert.deepEqual(resolveBookingIdentity(f.db, { token: f.a.token, projectId: "app-1" }), idOf(f.a));
    for (const input of [{ token: "bad", projectId: "app-1" }, { token: f.a.token }, { projectId: "app-1" }, { token: f.a.token, projectId: "app-2" }, { token: f.staff.token, projectId: "app-1" }]) {
      assert.throws(() => resolveBookingIdentity(f.db, input), (e) => e.code === "BOOKING_IDENTITY_INVALID" && e.status === 401);
    }
    f.auth.setStatus(f.a.user.id, "disabled");
    assert.throws(() => resolveBookingIdentity(f.db, { token: f.a.token, projectId: "app-1" }), (e) => e.code === "BOOKING_IDENTITY_INVALID");
  });
  runWithWorkspace("ws-2", () => assert.throws(() => resolveBookingIdentity(f.db, { token: f.a.token, projectId: "app-1" }), (e) => e.code === "BOOKING_IDENTITY_INVALID"));
  f.db.close();
});

test("Student Portal appointments: enrolled own rows only, upcoming vs past, gates enforced", async () => {
  const f = fixture();
  const mediaService = createSiteMediaService({ repository: createSiteMediaRepository(f.db), siteProjectService: createSiteProjectService({ repository: createSiteProjectRepository(f.db) }), storage: { publicAssetUrl: (k) => k } });
  const access = createLearningAccessService({ db: f.db, mediaService });
  const enrol = (u) => runWithWorkspace("ws-1", () => access.enroll(f.site.id, { authProjectId: "app-1", appUserId: u.user.id }));
  const enrolmentA = enrol(f.a); enrol(f.b);
  const upcoming = f.book("10:00", idOf(f.a)), past = f.book("12:00", idOf(f.a)), cancelled = f.book("12:00", idOf(f.a)), other = f.book("10:00", idOf(f.b));
  f.db.prepare("UPDATE booking_appointments SET starts_at='2020-01-06T12:00:00.000Z' WHERE id=?").run(past.appointment.id);
  f.db.prepare("UPDATE booking_appointments SET status='CANCELLED' WHERE id=?").run(cancelled.appointment.id);
  const app = express();
  app.use("/api/auth", createPublicEducationRouter({ db: f.db, accessService: access, bookingRepository: f.booking }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const get = (token, projectId = "app-1") => fetch(`http://127.0.0.1:${server.address().port}/api/auth/public/apps/${projectId}/education/sites/${f.site.id}/appointments`, { headers: token ? { "X-Loadder-App-Token": token } : {} });
  try {
    assert.equal((await get(null)).status, 401);
    const own = await (await get(f.a.token)).json();
    assert.deepEqual(own.upcoming.map((x) => x.id), [upcoming.appointment.id]);
    assert.deepEqual(own.past.map((x) => x.id).sort(), [past.appointment.id, cancelled.appointment.id].sort());
    assert.equal(own.upcoming[0].service.name, "پیانو"); assert.equal(own.upcoming[0].provider.name, "مدرس"); assert.equal(own.upcoming[0].modality, "ONLINE");
    assert.equal([...own.upcoming, ...own.past].some((x) => x.id === other.appointment.id), false, "student A never sees student B");
    assert.equal(own.past.find((x) => x.id === cancelled.appointment.id).status, "CANCELLED");
    const theirs = await (await get(f.b.token)).json();
    assert.deepEqual(theirs.upcoming.map((x) => x.id), [other.appointment.id]); assert.deepEqual(theirs.past, []);
    assert.equal((await get(f.foreign.token, "app-2")).status, 404, "cross-workspace site is not reachable");
    assert.equal((await get(f.staff.token)).status, 403, "non-student role");
    runWithWorkspace("ws-1", () => access.revoke(f.site.id, enrolmentA.id));
    assert.equal((await get(f.a.token)).status, 403, "revoked enrolment");
    runWithWorkspace("ws-1", () => f.auth.setStatus(f.b.user.id, "disabled"));
    assert.equal((await get(f.b.token)).status, 401, "disabled app user cannot use the portal session");
  } finally { await new Promise((resolve) => server.close(resolve)); f.db.close(); }
});
