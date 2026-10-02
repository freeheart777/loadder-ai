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
import { createConsultationService, validateJoinLink } from "../app/services/consultation-service.mjs";
import { createConsultationAdminRouter, createConsultationRouter } from "../app/routes/consultations.mjs";
import { createSensitiveAccessAudit } from "../app/services/sensitive-access-audit.mjs";

const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();
const LINK = "https://meet.example.org/room/abc123";

async function fixture() {
  const db = createSiteTestDb();
  let clock = new Date(), delivered = [];
  const identity = createPatientIdentityService({ db, hashSecret: "s", deliver: async (m) => { delivered.push(m); }, now: () => clock });
  const booking = createBookingRepository(db);
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const consultations = createConsultationService({ db, now: () => clock });
  const as = (ws, fn) => runWithWorkspace(ws, fn);
  const A = as("ws-1", () => projects.create({ name: "A", siteType: "MEDICAL", content: {} })), B = as("ws-1", () => projects.create({ name: "B", siteType: "MEDICAL", content: {} }));
  as("ws-1", () => { identity.enableForSite(A.id); identity.enableForSite(B.id); });
  const scope = bookingScopeForSite(A);
  const seed = as("ws-1", () => {
    const s = booking.createService({ name: "ویزیت", durationMinutes: 30, modalities: ["IN_PERSON", "VIDEO", "AUDIO"], scope });
    const mk = (name) => { const p = booking.createProvider({ name, scope }); booking.associate(p.id, s.id, scope); booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 9, scope }); return p.id; };
    return { serviceId: s.id, d1: mk("دکتر یک"), d2: mk("دکتر دو") };
  });
  const patient = async (mobile) => {
    await as("ws-1", () => identity.requestOtp({ siteProjectId: A.id, mobile }));
    const out = as("ws-1", () => identity.verifyOtp({ siteProjectId: A.id, mobile, code: delivered.at(-1).code })); clock = new Date(clock.getTime() + 61_000); return out;
  };
  const doctor = async (providerId, mobile) => {
    as("ws-1", () => identity.linkDoctor({ siteProjectId: A.id, providerId, mobile, actorUserId: "owner" }));
    await as("ws-1", () => identity.requestOtp({ siteProjectId: A.id, mobile, audience: "doctor" }));
    const out = as("ws-1", () => identity.verifyOtp({ siteProjectId: A.id, mobile, code: delivered.at(-1).code, audience: "doctor" })); clock = new Date(clock.getTime() + 61_000); return out;
  };
  const book = (providerId, p, modality = "VIDEO") => as("ws-1", () => booking.createCustomerAppointment({ serviceId: seed.serviceId, providerId, date: future, startsAt: "10:00", customerName: "ب", customerContact: "09120000000", modality, scope, identity: p ? { appUserId: p.patient.id, authProjectId: p.authProjectId } : null })).appointment;
  const confirm = (id) => as("ws-1", () => booking.transitionAppointment({ id, to: "CONFIRMED", actor: { kind: "operator", id: "owner" }, scope }));
  const cancel = (id) => as("ws-1", () => booking.transitionAppointment({ id, to: "CANCELLED", actor: { kind: "operator", id: "owner" }, scope }));
  const consultationOf = (id) => db.prepare("SELECT * FROM consultations WHERE appointment_id=?").get(id);
  const at = (appt, offsetMs) => { clock = new Date(Date.parse(appt.starts_at) + offsetMs); };
  db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role) VALUES('m1','ws-1','owner','active','owner'),('m2','ws-1','member','active','member')").run();
  let actor = "owner";
  const sites = { [A.id]: { id: A.id, workspaceId: "ws-1" }, [B.id]: { id: B.id, workspaceId: "ws-1" } };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: actor }; runWithWorkspace("ws-1", next); });
  app.use(createConsultationAdminRouter({ service: consultations, db }));
  app.use("/api/auth", createConsultationRouter({ service: consultations, identity, siteLookup: (id) => sites[id] || null }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const call = async (method, path, { token, body } = {}) => { const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { "content-type": "application/json", ...(token ? { "X-Loadder-App-Token": token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: res.status, body: await res.json().catch(() => ({})) }; };
  return { db, A, B, as, patient, doctor, book, confirm, cancel, consultationOf, at, call, seed, booking, scope, audit: () => as("ws-1", () => createSensitiveAccessAudit(db).list()), setActor: (u) => { actor = u; }, close: () => new Promise((r) => server.close(r)) };
}
const root = (f) => `/api/auth/site/${f.A.id}`;

test("a consultation record exists only for confirmed remote appointments, and closes with a cancellation", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001");
    const video = f.book(f.seed.d1, p, "VIDEO"), audio = f.book(f.seed.d1, p, "AUDIO"), inPerson = f.book(f.seed.d1, p, "IN_PERSON");
    assert.equal(f.consultationOf(video.id), undefined, "nothing before confirmation");
    for (const a of [video, audio, inPerson]) f.confirm(a.id);
    assert.equal(f.consultationOf(video.id).modality, "VIDEO"); assert.equal(f.consultationOf(audio.id).modality, "AUDIO");
    assert.equal(f.consultationOf(inPerson.id), undefined, "in-person visits have no consultation");
    assert.equal(f.consultationOf(video.id).join_link, null, "a join URL is never generated");
    f.cancel(video.id);
    assert.equal(f.consultationOf(video.id).state, "cancelled");
    const legacy = f.as("ws-1", () => { const s = f.booking.createService({ name: "ق", durationMinutes: 10, modalities: ["VIDEO"], scope: LEGACY_BOOKING_SCOPE }), pr = f.booking.createProvider({ name: "ق", scope: LEGACY_BOOKING_SCOPE }); f.booking.associate(pr.id, s.id, LEGACY_BOOKING_SCOPE); f.booking.addAvailability({ providerId: pr.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 2, scope: LEGACY_BOOKING_SCOPE }); return f.booking.createCustomerAppointment({ serviceId: s.id, providerId: pr.id, date: future, startsAt: "10:00", customerName: "ق", modality: "VIDEO", scope: LEGACY_BOOKING_SCOPE }).appointment; });
    f.as("ws-1", () => f.booking.transitionAppointment({ id: legacy.id, to: "CONFIRMED", actor: { kind: "operator", id: "owner" }, scope: LEGACY_BOOKING_SCOPE }));
    assert.equal(f.consultationOf(legacy.id), undefined, "legacy, site-less appointments are untouched");
  } finally { await f.close(); f.db.close(); }
});

test("join links are human-entered https addresses only", () => {
  assert.equal(validateJoinLink(LINK), LINK); assert.equal(validateJoinLink(null), null);
  for (const bad of ["", "   ", "http://meet.example.org/x", "javascript:alert(1)", "data:text/html,x", "ftp://a.example/x", "https://user:pw@meet.example.org/x", "https:///x", "not a url", "https://a.example/with space", `https://a.example/${"x".repeat(500)}`, 42, undefined]) assert.throws(() => validateJoinLink(bad), (e) => e.code === "CONSULTATION_JOIN_LINK_INVALID", String(bad));
});

test("the patient sees the join link only inside the window, only for their own confirmed consultation, and the read is audited", async () => {
  const f = await fixture();
  try {
    const p1 = await f.patient("09120000001"), p2 = await f.patient("09120000002");
    const a = f.book(f.seed.d1, p1), anonymous = f.book(f.seed.d1, null);
    f.confirm(a.id); f.confirm(anonymous.id);
    const d = await f.doctor(f.seed.d1, "09125550001"), other = await f.doctor(f.seed.d2, "09125550002");
    const path = `${root(f)}/patient/appointments/${a.id}/consultation`, doc = `${root(f)}/doctor/appointments/${a.id}/consultation`;
    assert.equal((await f.call("PUT", `${doc}/join-link`, { token: d.session.token, body: { url: LINK } })).status, 200);
    f.at(a, -60 * 60_000);
    const early = (await f.call("GET", path, { token: p1.session.token })).body.consultation;
    assert.equal(early.joinLink, null, "too early"); assert.equal(early.joinLinkSet, true); assert.ok(early.joinAvailableFrom);
    f.at(a, -10 * 60_000);
    assert.equal((await f.call("GET", path, { token: p1.session.token })).body.consultation.joinLink, LINK, "inside the window");
    assert.equal((await f.call("GET", path, { token: p2.session.token })).status, 404, "another patient");
    assert.equal((await f.call("GET", `${root(f)}/patient/appointments/${anonymous.id}/consultation`, { token: p1.session.token })).status, 404, "an anonymous booking is not theirs");
    assert.equal((await f.call("GET", path)).status, 401);
    assert.equal((await f.call("GET", `/api/auth/site/${f.B.id}/patient/appointments/${a.id}/consultation`, { token: p1.session.token })).status, 401, "site-bound");
    assert.equal((await f.call("GET", doc, { token: other.session.token })).status, 404, "another doctor");
    assert.equal((await f.call("GET", doc, { token: p1.session.token })).status, 401, "a patient session is not a doctor session");
    const reads = f.audit().filter((e) => e.action === "consultation.join_link.read");
    assert.ok(reads.length >= 1 && reads.every((e) => e.actorKind === "app_user" && e.actorId === p1.patient.id));
    assert.equal(f.audit().some((e) => JSON.stringify(e).includes("meet.example.org")), false, "the link itself never enters the audit trail");
    f.cancel(a.id);
    assert.equal((await f.call("GET", path, { token: p1.session.token })).body.consultation.joinLink, null, "no link once cancelled");
  } finally { await f.close(); f.db.close(); }
});

test("the doctor drives the lifecycle with real timing rules; nothing completes by itself", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001"), a = f.book(f.seed.d1, p), pending = f.book(f.seed.d1, p, "AUDIO");
    f.confirm(a.id);
    const d = await f.doctor(f.seed.d1, "09125550001");
    const doc = `${root(f)}/doctor/appointments/${a.id}/consultation`, post = (action) => f.call("POST", `${doc}/${action}`, { token: d.session.token });
    f.at(a, -2 * 60 * 60_000);
    assert.equal((await post("start")).body.code, "CONSULTATION_NOT_STARTED", "too early");
    assert.equal((await post("complete")).body.code, "CONSULTATION_TRANSITION_INVALID", "cannot complete what never started");
    assert.equal((await post("missed")).body.code, "CONSULTATION_NOT_ENDED");
    f.at(a, -5 * 60_000);
    const started = await post("start");
    assert.equal(started.body.consultation.state, "in_progress"); assert.ok(started.body.consultation.startedAt);
    assert.equal((await post("start")).body.code, "CONSULTATION_TRANSITION_INVALID", "no double start");
    assert.equal((await post("missed")).body.code, "CONSULTATION_TRANSITION_INVALID", "a started consultation is not missed");
    const done = await post("complete");
    assert.equal(done.body.consultation.state, "completed"); assert.ok(done.body.consultation.completedAt);
    assert.equal((await f.call("PUT", `${doc}/join-link`, { token: d.session.token, body: { url: LINK } })).body.code, "CONSULTATION_CLOSED");
    assert.equal(f.db.prepare("SELECT status FROM booking_appointments WHERE id=?").get(a.id).status, "CONFIRMED", "completing a consultation does not silently complete the appointment");
    // missed only after the slot ended
    const second = f.book(f.seed.d1, p), third = f.book(f.seed.d1, p, "AUDIO");
    f.confirm(second.id);
    f.at(second, 10 * 60_000);
    assert.equal((await f.call("POST", `${root(f)}/doctor/appointments/${second.id}/consultation/missed`, { token: d.session.token })).body.code, "CONSULTATION_NOT_ENDED");
    f.at(second, 31 * 60_000);
    assert.equal((await f.call("POST", `${root(f)}/doctor/appointments/${second.id}/consultation/missed`, { token: d.session.token })).body.consultation.state, "missed");
    assert.equal((await f.call("POST", `${root(f)}/doctor/appointments/${pending.id}/consultation/start`, { token: d.session.token })).status, 404, "unconfirmed appointments have no consultation");
    assert.equal((await f.call("POST", `${doc}/explode`, { token: d.session.token })).status, 404);
    const actions = f.audit().map((e) => e.action);
    for (const expected of ["consultation.in_progress", "consultation.completed", "consultation.missed"]) assert.ok(actions.includes(expected), expected);
    assert.ok(third.id);
  } finally { await f.close(); f.db.close(); }
});

test("operators may fill the slot, explicitly and audited; the record itself is tamper-proof", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001"), a = f.book(f.seed.d1, p); f.confirm(a.id);
    const path = `/site-projects/${f.A.id}/consultations/${a.id}/join-link`;
    f.setActor("member"); assert.equal((await f.call("PUT", path, { body: { url: LINK } })).status, 403);
    f.setActor("owner");
    assert.equal((await f.call("PUT", path, { body: { url: "http://insecure.example/x" } })).body.code, "CONSULTATION_JOIN_LINK_INVALID");
    assert.equal((await f.call("PUT", path, { body: {} })).status, 400);
    const ok = await f.call("PUT", path, { body: { url: LINK } });
    assert.equal(ok.status, 200); assert.equal(JSON.stringify(ok.body).includes(LINK), false, "the operator response does not echo the link");
    assert.equal(f.audit().find((e) => e.action === "consultation.join_link.set").actorKind, "operator");
    assert.equal((await f.call("PUT", path, { body: { url: null } })).status, 200); assert.equal(f.consultationOf(a.id).join_link, null);
    const c = f.consultationOf(a.id);
    for (const column of ["workspace_id", "site_project_id", "appointment_id", "provider_id", "modality"]) assert.throws(() => f.db.prepare(`UPDATE consultations SET ${column}='x' WHERE id=?`).run(c.id), /immutable/, column);
    assert.throws(() => f.db.prepare("DELETE FROM consultations WHERE id=?").run(c.id), /never deleted/);
    assert.throws(() => f.db.prepare("INSERT INTO consultations(id,workspace_id,site_project_id,appointment_id,provider_id,modality,created_at,updated_at) VALUES('x','ws-1',?,?,?,'AUDIO','x','x')").run(f.A.id, a.id, f.seed.d1), /match its remote appointment/, "modality must match the appointment");
    assert.equal((await f.call("PUT", `/site-projects/${f.A.id}/consultations/missing/join-link`, { body: { url: LINK } })).status, 404);
  } finally { await f.close(); f.db.close(); }
});
