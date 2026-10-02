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
import { createMedicalDocumentService } from "../app/services/medical-document-service.mjs";
import { createMemoryMedicalStorage } from "../app/services/medical-document-storage.mjs";
import { createMedicalControlCenterService } from "../app/services/medical-control-center-service.mjs";
import { createMedicalControlCenterRouter } from "../app/routes/medical-control-center.mjs";
import { createSensitiveAccessAudit } from "../app/services/sensitive-access-audit.mjs";

const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n");

async function fixture() {
  const db = createSiteTestDb();
  let clock = new Date(), delivered = [];
  const identity = createPatientIdentityService({ db, hashSecret: "s", deliver: async (m) => { delivered.push(m); }, now: () => clock });
  const booking = createBookingRepository(db);
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const docs = createMedicalDocumentService({ db, storage: createMemoryMedicalStorage() });
  const as = (ws, fn) => runWithWorkspace(ws, fn);
  const make = (ws, name, type = "MEDICAL") => as(ws, () => projects.create({ name, siteType: type, content: {} }));
  const A = make("ws-1", "A"), B = make("ws-1", "B"), edu = make("ws-1", "Edu", "EDUCATION"), foreign = make("ws-2", "F");
  as("ws-1", () => { identity.enableForSite(A.id); identity.enableForSite(B.id); });
  const empty = make("ws-1", "Empty");
  const readiness = () => ({ otpDelivery: { configured: false, provider: "simulator", simulator: true }, documents: { productionReady: false, scannerConfigured: false, storage: "memory" }, environment: "test" });
  const service = createMedicalControlCenterService({ db, readiness, now: () => clock });
  db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role) VALUES('m1','ws-1','owner','active','owner'),('m2','ws-1','member','active','member')").run();
  let actor = "owner";
  const app = express();
  app.use((req, _res, next) => { req.user = { id: actor }; runWithWorkspace("ws-1", next); });
  app.use(createMedicalControlCenterRouter({ service, db }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const get = async (path) => { const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`); return { status: res.status, body: await res.json() }; };
  const patient = async (site, mobile, name) => {
    await as("ws-1", () => identity.requestOtp({ siteProjectId: site.id, mobile }));
    const out = as("ws-1", () => identity.verifyOtp({ siteProjectId: site.id, mobile, code: delivered.at(-1).code, name })); clock = new Date(clock.getTime() + 61_000); return out;
  };
  return { db, A, B, edu, foreign, empty, as, identity, booking, docs, service, patient, get, setActor: (u) => { actor = u; }, close: () => new Promise((r) => server.close(r)) };
}

test("an empty Medical site reports honest zeros, never invented metrics", async () => {
  const f = await fixture();
  try {
    const { status, body } = await f.get(`/site-projects/${f.empty.id}/medical/summary`);
    assert.equal(status, 200);
    assert.deepEqual({ ...body.summary, site: undefined }, { site: undefined, patients: 0, providers: 0, doctorIdentities: 0, services: 0, appointments: { total: 0, PENDING: 0, CONFIRMED: 0, CANCELLED: 0, COMPLETED: 0 }, upcoming: 0, documents: 0 });
    assert.deepEqual((await f.get(`/site-projects/${f.empty.id}/medical/patients`)).body.patients, []);
  } finally { await f.close(); f.db.close(); }
});

test("counts are real, strictly this site's, and exclude legacy, deleted and other-site rows", async () => {
  const f = await fixture();
  try {
    const scopeA = bookingScopeForSite(f.A), scopeB = bookingScopeForSite(f.B);
    const seed = (scope, label) => f.as("ws-1", () => {
      const s = f.booking.createService({ name: `س ${label}`, durationMinutes: 30, modalities: ["IN_PERSON"], scope }), p = f.booking.createProvider({ name: `پ ${label}`, scope });
      f.booking.associate(p.id, s.id, scope); f.booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 9, scope }); f.booking.addAvailability({ providerId: p.id, weekday, startsAt: "12:00", endsAt: "13:00", capacity: 9, scope });
      return { serviceId: s.id, providerId: p.id };
    });
    const a = seed(scopeA, "A"), b = seed(scopeB, "B");
    f.as("ws-1", () => { f.booking.createService({ name: "قدیمی", durationMinutes: 10, scope: LEGACY_BOOKING_SCOPE }); f.booking.createProvider({ name: "قدیمی", scope: LEGACY_BOOKING_SCOPE }); });
    const p1 = await f.patient(f.A, "09120000001", "بیمار یک"), p2 = await f.patient(f.A, "09120000002", "بیمار دو"), pb = await f.patient(f.B, "09120000003", "بیمار ب");
    const book = (ids, scope, startsAt, p) => f.as("ws-1", () => f.booking.createCustomerAppointment({ ...ids, date: future, startsAt, customerName: "ن", customerContact: "09120000000", modality: "IN_PERSON", scope, identity: p ? { appUserId: p.patient.id, authProjectId: p.authProjectId } : null })).appointment;
    const x1 = book(a, scopeA, "10:00", p1), x2 = book(a, scopeA, "12:00", p1), x3 = book(a, scopeA, "10:00", null); book(b, scopeB, "10:00", pb);
    f.as("ws-1", () => f.booking.transitionAppointment({ id: x2.id, to: "CANCELLED", actor: { kind: "operator", id: "owner" }, scope: scopeA }));
    f.as("ws-1", () => f.booking.transitionAppointment({ id: x3.id, to: "CONFIRMED", actor: { kind: "operator", id: "owner" }, scope: scopeA }));
    f.as("ws-1", () => f.identity.linkDoctor({ siteProjectId: f.A.id, providerId: a.providerId, mobile: "09125550001", actorUserId: "owner" }));
    const patient = { id: p1.patient.id, authProjectId: p1.authProjectId };
    const doc1 = await f.as("ws-1", () => f.docs.upload({ siteProjectId: f.A.id, patient, appointmentId: x1.id, title: "t", fileName: "a.pdf", mimeType: "application/pdf", body: PDF }));
    const doc2 = await f.as("ws-1", () => f.docs.upload({ siteProjectId: f.A.id, patient, appointmentId: x1.id, title: "t2", fileName: "b.pdf", mimeType: "application/pdf", body: PDF }));
    await f.as("ws-1", () => f.docs.deleteForPatient({ siteProjectId: f.A.id, patient, documentId: doc2.id }));
    const summary = (await f.get(`/site-projects/${f.A.id}/medical/summary`)).body.summary;
    assert.equal(summary.patients, 2, "patients of this site only (not the doctor, not site B)");
    assert.equal(summary.providers, 1); assert.equal(summary.doctorIdentities, 1); assert.equal(summary.services, 1);
    assert.deepEqual(summary.appointments, { total: 3, PENDING: 1, CONFIRMED: 1, CANCELLED: 1, COMPLETED: 0 });
    assert.equal(summary.upcoming, 2, "pending + confirmed in the future");
    assert.equal(summary.documents, 1, "deleted documents are not counted");
    const other = (await f.get(`/site-projects/${f.B.id}/medical/summary`)).body.summary;
    assert.equal(other.patients, 1); assert.equal(other.appointments.total, 1); assert.equal(other.documents, 0); assert.equal(other.doctorIdentities, 0);
    assert.ok(doc1.id);
  } finally { await f.close(); f.db.close(); }
});

test("patients: masked, this site's customers only, with real activity counts, and the listing is audited", async () => {
  const f = await fixture();
  try {
    const scope = bookingScopeForSite(f.A);
    const ids = f.as("ws-1", () => { const s = f.booking.createService({ name: "س", durationMinutes: 30, modalities: ["IN_PERSON"], scope }), p = f.booking.createProvider({ name: "پ", scope }); f.booking.associate(p.id, s.id, scope); f.booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 9, scope }); return { serviceId: s.id, providerId: p.id }; });
    const p1 = await f.patient(f.A, "09120000001", "سارا"); await f.patient(f.B, "09120000002", "علی");
    f.as("ws-1", () => f.booking.createCustomerAppointment({ ...ids, date: future, startsAt: "10:00", customerName: "سارا", customerContact: "09120000001", modality: "IN_PERSON", scope, identity: { appUserId: p1.patient.id, authProjectId: p1.authProjectId } }));
    f.as("ws-1", () => f.identity.linkDoctor({ siteProjectId: f.A.id, providerId: ids.providerId, mobile: "09125550001", actorUserId: "owner" }));
    const { body } = await f.get(`/site-projects/${f.A.id}/medical/patients`);
    assert.equal(body.patients.length, 1, "no doctors, no other site's patients");
    assert.deepEqual([body.patients[0].displayName, body.patients[0].appointments], ["سارا", 1]);
    assert.match(body.patients[0].mobile, /^0912\*\*\*01$/);
    assert.equal(/\.invalid|09120000001/.test(JSON.stringify(body)), false, "no placeholder email and no full number");
    assert.ok(f.as("ws-1", () => createSensitiveAccessAudit(f.db).list()).some((e) => e.action === "medical.patients.listed" && e.actorId === "owner" && e.metadata.count === 1));
  } finally { await f.close(); f.db.close(); }
});

test("access: owner/admin only, Medical sites only, own workspace only; settings tell the truth", async () => {
  const f = await fixture();
  try {
    f.setActor("member");
    for (const path of ["summary", "patients", "settings"]) assert.equal((await f.get(`/site-projects/${f.A.id}/medical/${path}`)).status, 403, path);
    f.setActor("owner");
    assert.equal((await f.get(`/site-projects/${f.edu.id}/medical/summary`)).body.code, "MEDICAL_SITE_REQUIRED");
    assert.equal((await f.get(`/site-projects/${f.foreign.id}/medical/summary`)).status, 404, "another workspace's site");
    const settings = (await f.get(`/site-projects/${f.A.id}/medical/settings`)).body.settings;
    assert.equal(settings.patientIdentity.enabled, true); assert.equal((await f.get(`/site-projects/${f.empty.id}/medical/settings`)).body.settings.patientIdentity.enabled, false);
    assert.equal(settings.otpDelivery.configured, false); assert.equal(settings.documents.productionReady, false); assert.equal(settings.documents.scannerConfigured, false);
  } finally { await f.close(); f.db.close(); }
});
