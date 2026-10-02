import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { bookingScopeForSite } from "../app/services/booking-scope.mjs";
import { createPatientIdentityService } from "../app/services/patient-identity-service.mjs";
import { createPatientIdentityRouter } from "../app/routes/patient-identity.mjs";
import { LoadderAppUserAuth } from "../app/business-builder/app-user-auth.mjs";

const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();

async function fixture() {
  const db = createSiteTestDb();
  let clock = new Date(), delivered = [];
  const patients = createPatientIdentityService({ db, hashSecret: "s", deliver: async (m) => { delivered.push(m); }, now: () => clock });
  const booking = createBookingRepository(db);
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const as = (ws, fn) => runWithWorkspace(ws, fn);
  const A = as("ws-1", () => projects.create({ name: "A", siteType: "MEDICAL", content: {} })), B = as("ws-1", () => projects.create({ name: "B", siteType: "MEDICAL", content: {} }));
  const sites = { [A.id]: { id: A.id, workspaceId: "ws-1", siteType: "MEDICAL" }, [B.id]: { id: B.id, workspaceId: "ws-1", siteType: "MEDICAL" } };
  for (const site of [A, B]) as("ws-1", () => patients.enableForSite(site.id, { actorUserId: "op" }));
  const seed = (site) => as("ws-1", () => {
    const scope = bookingScopeForSite(site);
    const s = booking.createService({ name: `ویزیت ${site.name}`, durationMinutes: 30, modalities: ["IN_PERSON"], scope }), p = booking.createProvider({ name: `دکتر ${site.name}`, scope });
    booking.associate(p.id, s.id, scope); booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 9, scope }); booking.addAvailability({ providerId: p.id, weekday, startsAt: "12:00", endsAt: "13:00", capacity: 9, scope });
    return { serviceId: s.id, providerId: p.id, scope };
  });
  const ids = { [A.id]: seed(A), [B.id]: seed(B) };
  const signIn = async (site, mobile, name) => {
    await as("ws-1", () => patients.requestOtp({ siteProjectId: site.id, mobile }));
    const out = as("ws-1", () => patients.verifyOtp({ siteProjectId: site.id, mobile, code: delivered.at(-1).code, name }));
    clock = new Date(clock.getTime() + 61_000);
    return out;
  };
  const book = (site, startsAt, identity, extra = {}) => as("ws-1", () => booking.createCustomerAppointment({ ...ids[site.id], date: future, startsAt, customerName: "علی رضایی", customerContact: "09120000000", modality: "IN_PERSON", identity, ...extra })).appointment;
  const identityOf = (session) => ({ appUserId: session.patient.id, authProjectId: session.authProjectId });
  let lookupWorkspace = "ws-1";
  const app = express();
  app.use("/api/auth", createPatientIdentityRouter({ service: patients, bookingRepository: booking, siteLookup: (id) => (sites[id] ? { ...sites[id], workspaceId: lookupWorkspace } : null) }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = () => `http://127.0.0.1:${server.address().port}`;
  const get = async (site, token) => { const res = await fetch(`${origin()}/api/auth/site/${site.id}/patient/appointments`, { headers: token ? { "X-Loadder-App-Token": token } : {} }); const text = await res.text(); return { status: res.status, body: JSON.parse(text), text }; };
  const call = async (method, path, token) => (await fetch(`${origin()}${path}`, { method, headers: token ? { "X-Loadder-App-Token": token } : {} })).status;
  return { db, as, A, B, ids, call, signIn, book, identityOf, get, booking, patients, setWorkspace: (ws) => { lookupWorkspace = ws; }, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("a patient sees only their own appointments, split into upcoming and history, with truthful fields", async () => {
  const f = await fixture();
  try {
    const p1 = await f.signIn(f.A, "09120000001", "علی رضایی"), p2 = await f.signIn(f.A, "09120000002", "علی رضایی");
    const next = f.book(f.A, "10:00", f.identityOf(p1)), old = f.book(f.A, "12:00", f.identityOf(p1)), cancelled = f.book(f.A, "12:00", f.identityOf(p1)), other = f.book(f.A, "10:00", f.identityOf(p2));
    const anonymous = f.book(f.A, "10:00", null);
    f.db.prepare("UPDATE booking_appointments SET starts_at='2020-01-06T12:00:00.000Z',status='COMPLETED' WHERE id=?").run(old.id);
    f.db.prepare("UPDATE booking_appointments SET status='CANCELLED' WHERE id=?").run(cancelled.id);

    assert.equal((await f.get(f.A)).status, 401); assert.equal((await f.get(f.A, "garbage")).status, 401);
    const mine = await f.get(f.A, p1.session.token);
    assert.equal(mine.status, 200);
    assert.deepEqual(mine.body.upcoming.map((x) => x.id), [next.id]);
    assert.deepEqual(mine.body.past.map((x) => x.id).sort(), [old.id, cancelled.id].sort());
    const all = [...mine.body.upcoming, ...mine.body.past];
    assert.equal(all.some((x) => x.id === other.id || x.id === anonymous.id), false, "neither another patient's nor an anonymous booking with the same name and phone");
    assert.deepEqual(mine.body.upcoming[0].service, { name: "ویزیت A", durationMinutes: 30 });
    assert.equal(mine.body.upcoming[0].provider.name, "دکتر A"); assert.equal(mine.body.upcoming[0].modality, "IN_PERSON"); assert.equal(mine.body.upcoming[0].status, "PENDING"); assert.match(mine.body.upcoming[0].reference, /^BK-/);
    assert.equal(mine.body.past.find((x) => x.id === old.id).status, "COMPLETED", "stored statuses are shown as they are");
    assert.equal(/09120000000|علی رضایی|customer|app_user|auth_project|workspace|storage/i.test(mine.text), false, "no contact or internals in the projection");
    const theirs = await f.get(f.A, p2.session.token);
    assert.deepEqual(theirs.body.upcoming.map((x) => x.id), [other.id]); assert.deepEqual(theirs.body.past, []);
  } finally { await f.close(); f.db.close(); }
});

test("sessions are bound to their site and workspace; revoked or disabled patients are denied", async () => {
  const f = await fixture();
  try {
    const onA = await f.signIn(f.A, "09120000001", "الف"), onB = await f.signIn(f.B, "09120000001", "ب");
    const apptA = f.book(f.A, "10:00", f.identityOf(onA)), apptB = f.book(f.B, "10:00", f.identityOf(onB));
    assert.equal((await f.get(f.B, onA.session.token)).status, 401, "a site A session never opens site B");
    assert.deepEqual((await f.get(f.B, onB.session.token)).body.upcoming.map((x) => x.id), [apptB.id], "site B shows only its own scope");
    assert.deepEqual((await f.get(f.A, onA.session.token)).body.upcoming.map((x) => x.id), [apptA.id]);
    f.setWorkspace("ws-2");
    assert.equal((await f.get(f.A, onA.session.token)).status, 401, "another workspace has no binding for the site");
    f.setWorkspace("ws-1");
    f.as("ws-1", () => f.patients.signOut({ siteProjectId: f.A.id, token: onA.session.token }));
    assert.equal((await f.get(f.A, onA.session.token)).status, 401, "logout revokes");
    f.as("ws-1", () => new LoadderAppUserAuth(f.db).setStatus(onB.patient.id, "disabled"));
    assert.equal((await f.get(f.B, onB.session.token)).status, 401, "a disabled patient's live session stops working");
  } finally { await f.close(); f.db.close(); }
});

test("the portal exposes no cancel, reschedule, payment, message or document endpoints that have no canonical contract", async () => {
  const f = await fixture();
  try {
    const p = await f.signIn(f.A, "09120000001", "الف"), a = f.book(f.A, "10:00", f.identityOf(p));
    const root = `/api/auth/site/${f.A.id}/patient`;
    for (const [method, path] of [["POST", `/appointments/${a.id}/cancel`], ["POST", `/appointments/${a.id}/reschedule`], ["DELETE", `/appointments/${a.id}`], ["PATCH", `/appointments/${a.id}`], ["GET", "/payments"], ["GET", "/messages"], ["GET", "/documents"]]) {
      assert.equal(await f.call(method, `${root}${path}`, p.session.token), 404, `${method} ${path}`);
    }
    assert.equal(f.db.prepare("SELECT status FROM booking_appointments WHERE id=?").get(a.id).status, "PENDING", "no patient route changes an appointment");
  } finally { await f.close(); f.db.close(); }
});
