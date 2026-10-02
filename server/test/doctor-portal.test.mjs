import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { bookingScopeForSite, LEGACY_BOOKING_SCOPE } from "../app/services/booking-scope.mjs";
import { createPatientIdentityService } from "../app/services/patient-identity-service.mjs";
import { createDoctorPortalRouter, createPatientIdentityAdminRouter, createPatientIdentityRouter } from "../app/routes/patient-identity.mjs";
import { createSensitiveAccessAudit } from "../app/services/sensitive-access-audit.mjs";

const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();

async function fixture() {
  const db = createSiteTestDb();
  let clock = new Date(), delivered = [];
  const service = createPatientIdentityService({ db, hashSecret: "s", deliver: async (m) => { delivered.push(m); }, now: () => clock });
  const booking = createBookingRepository(db, { clock: () => clock });
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const as = (ws, fn) => runWithWorkspace(ws, fn);
  const A = as("ws-1", () => projects.create({ name: "A", siteType: "MEDICAL", content: {} })), B = as("ws-1", () => projects.create({ name: "B", siteType: "MEDICAL", content: {} })), foreign = as("ws-2", () => projects.create({ name: "F", siteType: "MEDICAL", content: {} }));
  const sites = { [A.id]: { id: A.id, workspaceId: "ws-1", siteType: "MEDICAL" }, [B.id]: { id: B.id, workspaceId: "ws-1", siteType: "MEDICAL" } };
  as("ws-1", () => { service.enableForSite(A.id); service.enableForSite(B.id); });
  const seed = (site) => as("ws-1", () => {
    const scope = bookingScopeForSite(site), s = booking.createService({ name: `ویزیت ${site.name}`, durationMinutes: 30, modalities: ["IN_PERSON"], scope });
    const mk = (name) => { const p = booking.createProvider({ name, scope }); booking.associate(p.id, s.id, scope); booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 9, scope }); booking.addAvailability({ providerId: p.id, weekday, startsAt: "12:00", endsAt: "13:00", capacity: 9, scope }); return p.id; };
    return { serviceId: s.id, d1: mk(`${site.name}-دکتر یک`), d2: mk(`${site.name}-دکتر دو`), scope };
  });
  const ids = { a: seed(A), b: seed(B) };
  const book = (site, ids2, providerId, startsAt, name, identity = null) => as("ws-1", () => booking.createCustomerAppointment({ serviceId: ids2.serviceId, providerId, date: future, startsAt, customerName: name, customerContact: `0912${name.length}`, modality: "IN_PERSON", identity, scope: ids2.scope })).appointment;
  const doctorSignIn = async (site, mobile) => {
    await as("ws-1", () => service.requestOtp({ siteProjectId: site.id, mobile, audience: "doctor" }));
    const out = as("ws-1", () => service.verifyOtp({ siteProjectId: site.id, mobile, code: delivered.at(-1).code, audience: "doctor" }));
    clock = new Date(clock.getTime() + 61_000); return out;
  };
  let workspace = "ws-1";
  db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role) VALUES('m1','ws-1','owner','active','owner'),('m2','ws-1','member','active','member')").run();
  let actor = "owner";
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: actor }; runWithWorkspace("ws-1", next); });
  app.use(createPatientIdentityAdminRouter({ service, db }));
  app.use("/api/auth", createDoctorPortalRouter({ service, bookingRepository: booking, siteLookup: (id) => (sites[id] ? { ...sites[id], workspaceId: workspace } : null) }));
  app.use("/api/auth", createPatientIdentityRouter({ service, bookingRepository: booking, siteLookup: (id) => (sites[id] ? { ...sites[id], workspaceId: workspace } : null) }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, token } = {}) => { const res = await fetch(`${origin}${path}`, { method, headers: { "content-type": "application/json", ...(token ? { "X-Loadder-App-Token": token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, body: await res.json().catch(() => ({})) }; };
  return { db, service, booking, A, B, foreign, ids, as, book, doctorSignIn, call, delivered: () => delivered, tick: (ms) => { clock = new Date(clock.getTime() + ms); }, setActor: (u) => { actor = u; }, setWorkspace: (w) => { workspace = w; }, close: () => new Promise((r) => server.close(r)) };
}
const link = (f, site, providerId, mobile = "09125550001") => f.as("ws-1", () => f.service.linkDoctor({ siteProjectId: site.id, providerId, mobile, displayName: "دکتر", actorUserId: "owner" }));

test("doctor identities: operator-only, provider must be this site's, one identity per provider and per mobile", async () => {
  const f = await fixture();
  try {
    const path = `/site-projects/${f.A.id}/doctor-identities`;
    f.setActor("member"); assert.equal((await f.call("POST", path, { body: { providerId: f.ids.a.d1, mobile: "09125550001" } })).status, 403);
    f.setActor("owner");
    assert.equal((await f.call("POST", path, { body: { providerId: f.ids.a.d1, mobile: "09125550001" } })).status, 201);
    assert.equal((await f.call("POST", path, { body: { providerId: f.ids.a.d1, mobile: "09125550009" } })).body.code, "DOCTOR_IDENTITY_EXISTS", "one identity per provider");
    assert.equal((await f.call("POST", path, { body: { providerId: f.ids.a.d2, mobile: "۰۹۱۲۵۵۵۰۰۰۱" } })).body.code, "IDENTIFIER_IN_USE", "one mobile, one account");
    assert.equal((await f.call("POST", path, { body: { providerId: f.ids.b.d1, mobile: "09125550002" } })).body.code, "DOCTOR_PROVIDER_NOT_FOUND", "another site's provider");
    const legacy = f.as("ws-1", () => f.booking.createProvider({ name: "قدیمی", scope: LEGACY_BOOKING_SCOPE }));
    assert.equal((await f.call("POST", path, { body: { providerId: legacy.id, mobile: "09125550003" } })).body.code, "DOCTOR_PROVIDER_NOT_FOUND", "legacy providers cannot become Medical doctors");
    assert.equal((await f.call("POST", path, { body: { providerId: f.ids.a.d2, mobile: "12" } })).body.code, "PATIENT_MOBILE_INVALID");
    assert.equal((await f.call("POST", path, { body: { mobile: "09125550004" } })).status, 400);
    const listed = (await f.call("GET", path)).body.doctors;
    assert.equal(listed.length, 1); assert.match(listed[0].mobile, /\*\*\*/, "the list masks the number");
    assert.equal(JSON.stringify(listed).includes(".invalid"), false);
    assert.throws(() => f.as("ws-2", () => f.service.linkDoctor({ siteProjectId: f.A.id, providerId: f.ids.a.d1, mobile: "09125550077" })), (e) => e.status === 409 || e.status === 404, "another workspace");
    // a patient mobile cannot be re-used as a doctor
    await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.A.id, mobile: "09126660000" }));
    f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: f.A.id, mobile: "09126660000", code: f.delivered().at(-1).code }));
    assert.equal((await f.call("POST", path, { body: { providerId: f.ids.a.d2, mobile: "09126660000" } })).body.code, "IDENTIFIER_IN_USE");
  } finally { await f.close(); f.db.close(); }
});

test("doctor sign-in never creates accounts, never sends to unknown numbers, and is separate from patient sign-in", async () => {
  const f = await fixture();
  try {
    link(f, f.A, f.ids.a.d1, "09125550001");
    const before = f.delivered().length;
    const unknown = await f.call("POST", `/api/auth/site/${f.A.id}/doctor/otp`, { body: { mobile: "09127770000" } });
    f.tick(61_000);
    const known = await f.call("POST", `/api/auth/site/${f.A.id}/doctor/otp`, { body: { mobile: "09125550001" } });
    assert.equal(unknown.status, 202); assert.equal(known.status, 202);
    assert.deepEqual(Object.keys(unknown.body).sort(), Object.keys(known.body).sort(), "identical shape for known and unknown");
    assert.equal(f.delivered().length, before + 1, "only the real doctor receives a code");
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM app_user_otp_challenges WHERE value_normalized='09127770000'").get().n, 0, "no challenge for unknown numbers");
    const wrong = await f.call("POST", `/api/auth/site/${f.A.id}/doctor/verify`, { body: { mobile: "09127770000", code: "123456" } });
    assert.equal(wrong.body.code, "PATIENT_OTP_INVALID");
    const ok = await f.call("POST", `/api/auth/site/${f.A.id}/doctor/verify`, { body: { mobile: "09125550001", code: f.delivered().at(-1).code } });
    assert.equal(ok.status, 200); assert.equal(ok.body.doctor.providerId, f.ids.a.d1);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM business_builder_app_users").get().n, 1, "sign-in created no account");
    assert.equal(f.db.prepare("SELECT verified_at FROM app_user_identifiers WHERE value_normalized='09125550001'").get().verified_at !== null, true);
    const token = ok.body.session.token;
    assert.equal((await f.call("GET", `/api/auth/site/${f.A.id}/patient/appointments`, { token })).status, 401, "a doctor token is not a patient token");
    // a patient session is not a doctor session, and a doctor's mobile is not a patient login
    f.tick(61_000);
    await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.A.id, mobile: "09126660000" }));
    const patient = f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: f.A.id, mobile: "09126660000", code: f.delivered().at(-1).code }));
    assert.equal((await f.call("GET", `/api/auth/site/${f.A.id}/doctor/appointments`, { token: patient.session.token })).status, 401);
    f.tick(61_000);
    await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.A.id, mobile: "09125550001" }));
    assert.throws(() => f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: f.A.id, mobile: "09125550001", code: f.delivered().at(-1).code })), (e) => e.code === "PATIENT_OTP_INVALID", "a doctor identity cannot sign in as a patient");
    assert.equal((await f.call("GET", `/api/auth/site/${f.B.id}/doctor/appointments`, { token })).status, 401, "site-bound");
    f.setWorkspace("ws-2"); assert.equal((await f.call("GET", `/api/auth/site/${f.A.id}/doctor/appointments`, { token })).status, 401, "workspace-bound"); f.setWorkspace("ws-1");
  } finally { await f.close(); f.db.close(); }
});

test("a doctor sees and changes only their own appointments, with every read and change audited", async () => {
  const f = await fixture();
  try {
    link(f, f.A, f.ids.a.d1, "09125550001"); link(f, f.A, f.ids.a.d2, "09125550002");
    const mine = f.book(f.A, f.ids.a, f.ids.a.d1, "10:00", "بیمار یک"), mine2 = f.book(f.A, f.ids.a, f.ids.a.d1, "12:00", "بیمار دو"), theirs = f.book(f.A, f.ids.a, f.ids.a.d2, "10:00", "بیمار سه");
    f.book(f.B, f.ids.b, f.ids.b.d1, "10:00", "بیمار چهار");
    const d1 = await f.doctorSignIn(f.A, "09125550001"), d2 = await f.doctorSignIn(f.A, "09125550002");
    const list = await f.call("GET", `/api/auth/site/${f.A.id}/doctor/appointments`, { token: d1.session.token });
    assert.equal(list.status, 200);
    const seen = [...list.body.upcoming, ...list.body.past];
    assert.deepEqual(seen.map((x) => x.id).sort(), [mine.id, mine2.id].sort());
    assert.equal(seen.some((x) => x.patient.name === "بیمار سه" || x.patient.name === "بیمار چهار"), false, "no other doctor's patients, no other site");
    assert.deepEqual(Object.keys(seen[0].patient).sort(), ["contact", "linked", "name"]);
    assert.equal((await f.call("GET", `/api/auth/site/${f.A.id}/doctor/appointments`, { token: d2.session.token })).body.upcoming.map((x) => x.id)[0], theirs.id);
    assert.equal((await f.call("GET", `/api/auth/site/${f.A.id}/doctor/appointments`)).status, 401);

    const status = (id, body, token = d1.session.token) => f.call("POST", `/api/auth/site/${f.A.id}/doctor/appointments/${id}/status`, { token, body });
    assert.equal((await status(theirs.id, { status: "CONFIRMED" })).status, 404, "another doctor's appointment");
    assert.equal((await status(mine.id, { status: "CANCELLED" })).status, 400, "cancelling stays with the operator");
    assert.equal((await status(mine.id, { status: "COMPLETED" })).status, 409, "pending cannot complete");
    assert.equal((await status(mine.id, { status: "CONFIRMED", reason: "تأیید" })).body.appointment.status, "CONFIRMED");
    assert.equal((await status(mine.id, { status: "COMPLETED" })).body.code, "BOOKING_APPOINTMENT_NOT_STARTED", "no fabricated completions");
    const events = f.as("ws-1", () => createSensitiveAccessAudit(f.db).list());
    const reads = events.filter((e) => e.action === "doctor.appointments.read");
    assert.ok(reads.length >= 2 && reads.every((e) => e.actorKind === "app_user" && typeof e.metadata.count === "number"));
    const change = events.find((e) => e.action === "booking.appointment.status_changed" && e.resourceId === mine.id);
    assert.equal(change.actorKind, "app_user"); assert.equal(change.actorId, d1.doctor.id);
    assert.equal(JSON.stringify(events).includes("بیمار"), false, "audit never stores patient names or contacts");
  } finally { await f.close(); f.db.close(); }
});

test("a doctor manages only their own availability, audited", async () => {
  const f = await fixture();
  try {
    link(f, f.A, f.ids.a.d1, "09125550001"); link(f, f.A, f.ids.a.d2, "09125550002");
    const d1 = await f.doctorSignIn(f.A, "09125550001"), d2 = await f.doctorSignIn(f.A, "09125550002");
    const root = `/api/auth/site/${f.A.id}/doctor/availability`;
    const own = (await f.call("GET", root, { token: d1.session.token })).body.availability;
    assert.equal(own.length, 2);
    const othersId = (await f.call("GET", root, { token: d2.session.token })).body.availability[0].id;
    assert.equal((await f.call("PATCH", `${root}/${othersId}`, { token: d1.session.token, body: { status: "CANCELLED" } })).status, 404, "another doctor's slot");
    assert.equal((await f.call("PATCH", `${root}/${own[0].id}`, { token: d1.session.token, body: { status: "CANCELLED" } })).body.availability.status, "CANCELLED");
    assert.equal((await f.call("PATCH", `${root}/${own[0].id}`, { token: d1.session.token, body: { status: "BOGUS" } })).status, 404);
    const added = await f.call("POST", root, { token: d1.session.token, body: { weekday: 2, startsAt: "09:00", endsAt: "10:00", capacity: 2 } });
    assert.equal(added.status, 201);
    for (const bad of [{ weekday: 9, startsAt: "09:00", endsAt: "10:00" }, { weekday: 1, startsAt: "10:00", endsAt: "09:00" }, { weekday: 1, startsAt: "9:00", endsAt: "10:00" }, { weekday: 1, startsAt: "09:00", endsAt: "10:00", capacity: 0 }]) assert.equal((await f.call("POST", root, { token: d1.session.token, body: bad })).status, 400);
    assert.equal((await f.call("GET", root, { token: d2.session.token })).body.availability.length, 2, "the other doctor's schedule is untouched");
    assert.equal(f.as("ws-1", () => f.booking.listCustomerSlots({ serviceId: f.ids.a.serviceId, providerId: f.ids.a.d1, date: future, scope: f.ids.a.scope })).every((slot) => slot.startsAtTime !== own[0].startsAt || slot.state === "cancelled"), true, "a cancelled slot is shown to patients as cancelled");
    const actions = f.as("ws-1", () => createSensitiveAccessAudit(f.db).list()).map((e) => e.action);
    assert.ok(actions.includes("booking.availability.added") && actions.includes("booking.availability.status_changed"));
  } finally { await f.close(); f.db.close(); }
});

test("unlinking a doctor ends their sessions and sign-in", async () => {
  const f = await fixture();
  try {
    link(f, f.A, f.ids.a.d1, "09125550001");
    const d1 = await f.doctorSignIn(f.A, "09125550001");
    assert.equal((await f.call("GET", `/api/auth/site/${f.A.id}/doctor/me`, { token: d1.session.token })).status, 200);
    assert.equal((await f.call("DELETE", `/site-projects/${f.A.id}/doctor-identities/${f.ids.a.d1}`)).status, 200);
    assert.equal((await f.call("GET", `/api/auth/site/${f.A.id}/doctor/me`, { token: d1.session.token })).status, 401);
    const before = f.delivered().length;
    await f.call("POST", `/api/auth/site/${f.A.id}/doctor/otp`, { body: { mobile: "09125550001" } });
    assert.equal(f.delivered().length, before, "an unlinked doctor receives no code");
    assert.equal((await f.call("DELETE", `/site-projects/${f.A.id}/doctor-identities/${f.ids.a.d1}`)).status, 200);
    assert.deepEqual(f.as("ws-1", () => f.service.listDoctors(f.A.id)).map((d) => d.status), ["disabled"]);
    assert.ok(f.as("ws-1", () => createSensitiveAccessAudit(f.db).list()).some((e) => e.action === "doctor.identity.unlinked"));
  } finally { await f.close(); f.db.close(); }
});
