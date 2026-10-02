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
import { createMedicalDocumentService } from "../app/services/medical-document-service.mjs";
import { createMemoryMedicalStorage, createUnconfiguredMedicalStorage } from "../app/services/medical-document-storage.mjs";
import { createMedicalDocumentAdminRouter, createMedicalDocumentRouter } from "../app/routes/medical-documents.mjs";
import { createSensitiveAccessAudit } from "../app/services/sensitive-access-audit.mjs";
import { MAX_DOCUMENT_BYTES, validateDocumentBody } from "../app/services/medical-document-policy.mjs";

const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const weekday = new Date(`${future}T00:00:00.000Z`).getUTCDay();
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x20, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(24, 3)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function fixture({ nodeEnv = "development", scanner = null, storage = createMemoryMedicalStorage() } = {}) {
  const db = createSiteTestDb();
  let clock = new Date(), delivered = [];
  const identity = createPatientIdentityService({ db, hashSecret: "s", deliver: async (m) => { delivered.push(m); }, now: () => clock });
  const booking = createBookingRepository(db);
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const documents = createMedicalDocumentService({ db, storage, scanner, nodeEnv });
  const as = (ws, fn) => runWithWorkspace(ws, fn);
  const A = as("ws-1", () => projects.create({ name: "A", siteType: "MEDICAL", content: {} })), B = as("ws-1", () => projects.create({ name: "B", siteType: "MEDICAL", content: {} }));
  as("ws-1", () => { identity.enableForSite(A.id); identity.enableForSite(B.id); });
  const scope = bookingScopeForSite(A);
  const seed = as("ws-1", () => {
    const s = booking.createService({ name: "ویزیت", durationMinutes: 30, modalities: ["IN_PERSON"], scope }), mk = (name) => { const p = booking.createProvider({ name, scope }); booking.associate(p.id, s.id, scope); booking.addAvailability({ providerId: p.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 9, scope }); return p.id; };
    return { serviceId: s.id, d1: mk("دکتر یک"), d2: mk("دکتر دو") };
  });
  const patient = async (mobile) => {
    await as("ws-1", () => identity.requestOtp({ siteProjectId: A.id, mobile }));
    const out = as("ws-1", () => identity.verifyOtp({ siteProjectId: A.id, mobile, code: delivered.at(-1).code })); clock = new Date(clock.getTime() + 61_000);
    return { ...out, principal: { id: out.patient.id, authProjectId: out.authProjectId } };
  };
  const book = (providerId, p) => as("ws-1", () => booking.createCustomerAppointment({ serviceId: seed.serviceId, providerId, date: future, startsAt: "10:00", customerName: "بیمار", customerContact: "09120000000", modality: "IN_PERSON", scope, identity: p ? { appUserId: p.patient.id, authProjectId: p.authProjectId } : null })).appointment;
  const doctor = async (providerId, mobile) => {
    as("ws-1", () => identity.linkDoctor({ siteProjectId: A.id, providerId, mobile, actorUserId: "owner" }));
    await as("ws-1", () => identity.requestOtp({ siteProjectId: A.id, mobile, audience: "doctor" }));
    const out = as("ws-1", () => identity.verifyOtp({ siteProjectId: A.id, mobile, code: delivered.at(-1).code, audience: "doctor" })); clock = new Date(clock.getTime() + 61_000); return out;
  };
  db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role) VALUES('m1','ws-1','owner','active','owner'),('m2','ws-1','member','active','member')").run();
  let actor = "owner", workspace = "ws-1";
  const sites = { [A.id]: { id: A.id, workspaceId: "ws-1", siteType: "MEDICAL" }, [B.id]: { id: B.id, workspaceId: "ws-1", siteType: "MEDICAL" } };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: actor }; runWithWorkspace("ws-1", next); });
  app.use(createMedicalDocumentAdminRouter({ service: documents, db }));
  app.use("/api/auth", createMedicalDocumentRouter({ service: documents, identity, siteLookup: (id) => (sites[id] ? { ...sites[id], workspaceId: workspace } : null) }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = async (method, path, { token, body, headers = {} } = {}) => {
    const res = await fetch(`${origin}${path}`, { method, headers: { ...(token ? { "X-Loadder-App-Token": token } : {}), ...headers }, body });
    const raw = Buffer.from(await res.arrayBuffer());
    let json = null; try { json = JSON.parse(raw.toString("utf8")); } catch { /* binary */ }
    return { status: res.status, headers: res.headers, raw, json };
  };
  const upload = (p, appointmentId, { body = PDF, mime = "application/pdf", title = "نتیجه آزمایش", name = "lab.pdf", site = A } = {}) =>
    send("POST", `/api/auth/site/${site.id}/patient/appointments/${appointmentId}/documents`, { token: p.session.token, body, headers: { "Content-Type": mime, "X-Document-Title": encodeURIComponent(title), "X-Document-Filename": encodeURIComponent(name) } });
  return { db, A, B, seed, storage, documents, identity, booking, as, patient, doctor, book, send, upload, audit: () => as("ws-1", () => createSensitiveAccessAudit(db).list()), setActor: (u) => { actor = u; }, setWorkspace: (w) => { workspace = w; }, close: () => new Promise((r) => server.close(r)) };
}
const root = (f) => `/api/auth/site/${f.A.id}`;

test("only a strict allow-list of verified types is accepted; SVG, mismatches, active PDFs and bad sizes are refused", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001"), a = f.book(f.seed.d1, p);
    for (const [label, body, mime] of [["pdf", PDF, "application/pdf"], ["png", PNG, "image/png"], ["jpeg", JPEG, "image/jpeg"], ["webp", WEBP, "image/webp"]]) assert.equal((await f.upload(p, a.id, { body, mime, name: `x.${label}` })).status, 201, label);
    const refuse = async (label, args, status, code) => { const r = await f.upload(p, a.id, args); assert.equal(r.status, status, label); assert.equal(r.json.code, code, label); };
    await refuse("svg declared as svg", { body: SVG, mime: "image/svg+xml" }, 415, "MEDICAL_DOCUMENT_TYPE_NOT_ALLOWED");
    await refuse("svg disguised as png", { body: SVG, mime: "image/png" }, 415, "MEDICAL_DOCUMENT_CONTENT_MISMATCH");
    await refuse("html", { body: Buffer.from("<html><script>1</script>"), mime: "text/html" }, 415, "MEDICAL_DOCUMENT_TYPE_NOT_ALLOWED");
    await refuse("pdf declared as png", { body: PDF, mime: "image/png" }, 415, "MEDICAL_DOCUMENT_CONTENT_MISMATCH");
    await refuse("pdf with javascript", { body: Buffer.from("%PDF-1.4\n/JavaScript (app.alert(1))\n"), mime: "application/pdf" }, 415, "MEDICAL_DOCUMENT_ACTIVE_CONTENT");
    await refuse("empty", { body: Buffer.alloc(0), mime: "application/pdf" }, 400, "MEDICAL_DOCUMENT_EMPTY");
    await refuse("no title", { title: "  " }, 400, "MEDICAL_DOCUMENT_TITLE_REQUIRED");
    const big = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_DOCUMENT_BYTES + 100)]);
    assert.equal((await f.upload(p, a.id, { body: big })).status, 413, "just over the limit");
    assert.equal((await f.upload(p, a.id, { body: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_DOCUMENT_BYTES + 5000)]) })).status, 413, "far over the limit");
    assert.throws(() => validateDocumentBody({ body: PDF, declaredMime: "application/pdf; charset=binary" }) && validateDocumentBody({ body: SVG, declaredMime: "application/pdf" }), (e) => e.code === "MEDICAL_DOCUMENT_CONTENT_MISMATCH");
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM medical_documents").get().n, 4, "refused files leave no trace");
    assert.equal(f.storage._keys().length, 4, "nor in storage");
  } finally { await f.close(); f.db.close(); }
});

test("a document belongs to the patient's own appointment: no other patient, anonymous booking, site or workspace can reach it", async () => {
  const f = await fixture();
  try {
    const p1 = await f.patient("09120000001"), p2 = await f.patient("09120000002");
    const own = f.book(f.seed.d1, p1), other = f.book(f.seed.d1, p2), anonymous = f.book(f.seed.d1, null);
    const doc = (await f.upload(p1, own.id)).json.document;
    assert.equal((await f.send("GET", `${root(f)}/patient/appointments/${own.id}/documents`, { token: p1.session.token })).json.documents.length, 1);
    assert.equal((await f.send("GET", `${root(f)}/patient/appointments/${own.id}/documents`, { token: p2.session.token })).status, 404, "another patient cannot list");
    assert.equal((await f.upload(p2, own.id)).status, 404, "nor upload to it");
    assert.equal((await f.send("GET", `${root(f)}/patient/documents/${doc.id}/file`, { token: p2.session.token })).status, 404, "nor read");
    assert.equal((await f.send("DELETE", `${root(f)}/patient/documents/${doc.id}`, { token: p2.session.token })).status, 404, "nor delete");
    assert.equal((await f.upload(p1, anonymous.id)).status, 404, "an anonymous booking is not the patient's, even with the same name and phone");
    assert.equal((await f.upload(p1, other.id)).status, 404);
    assert.equal((await f.send("GET", `${root(f)}/patient/documents/${doc.id}/file`)).status, 401);
    assert.equal((await f.send("GET", `/api/auth/site/${f.B.id}/patient/documents/${doc.id}/file`, { token: p1.session.token })).status, 401, "a session never crosses sites");
    f.setWorkspace("ws-2");
    assert.equal((await f.send("GET", `${root(f)}/patient/documents/${doc.id}/file`, { token: p1.session.token })).status, 401, "nor workspaces");
    f.setWorkspace("ws-1");
    f.as("ws-1", () => f.booking.transitionAppointment({ id: own.id, to: "CANCELLED", actor: { kind: "operator", id: "owner" }, scope: bookingScopeForSite(f.A) }));
    assert.equal((await f.upload(p1, own.id)).status, 404, "no uploads to a cancelled appointment");
  } finally { await f.close(); f.db.close(); }
});

test("no storage key or internal id ever leaves the server; downloads are no-store, nosniff, attachment, sandboxed", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001"), a = f.book(f.seed.d1, p);
    const up = await f.upload(p, a.id, { name: "آزمایش خون.pdf" });
    const list = await f.send("GET", `${root(f)}/patient/appointments/${a.id}/documents`, { token: p.session.token });
    const row = f.db.prepare("SELECT * FROM medical_documents").get();
    for (const body of [JSON.stringify(up.json), JSON.stringify(list.json)]) {
      assert.equal(body.includes(row.storage_ref), false); assert.equal(f.storage._keys().some((key) => body.includes(key)), false);
      assert.equal(/storage|sha256|owner_app|auth_project|workspace/i.test(body), false);
    }
    assert.deepEqual(Object.keys(up.json.document).sort(), ["appointmentId", "createdAt", "fileName", "id", "mimeType", "scanState", "sizeBytes", "title"]);
    const file = await f.send("GET", `${root(f)}/patient/documents/${row.id}/file`, { token: p.session.token });
    assert.equal(file.status, 200); assert.ok(file.raw.equals(PDF));
    assert.equal(file.headers.get("cache-control"), "no-store"); assert.equal(file.headers.get("x-content-type-options"), "nosniff");
    assert.match(file.headers.get("content-disposition"), /^attachment; filename\*=UTF-8''/); assert.equal(file.headers.get("content-type"), "application/pdf");
    assert.match(file.headers.get("content-security-policy"), /sandbox/);
    assert.notEqual(row.storage_ref, row.id); assert.equal(up.json.document.scanState, "not_scanned", "development is honest that nothing scanned it");
    assert.equal(f.storage._keys().length, 1);
  } finally { await f.close(); f.db.close(); }
});

test("a doctor reaches only documents of their own appointments, and every read is audited", async () => {
  const f = await fixture();
  try {
    const p1 = await f.patient("09120000001"), p2 = await f.patient("09120000002");
    const a1 = f.book(f.seed.d1, p1), a2 = f.book(f.seed.d2, p2);
    const d1 = await f.doctor(f.seed.d1, "09125550001"), d2 = await f.doctor(f.seed.d2, "09125550002");
    const doc1 = (await f.upload(p1, a1.id, { title: "نتیجه" })).json.document; await f.upload(p2, a2.id, { body: PNG, mime: "image/png", name: "x.png" });
    const list = await f.send("GET", `${root(f)}/doctor/appointments/${a1.id}/documents`, { token: d1.session.token });
    assert.deepEqual(list.json.documents.map((d) => d.id), [doc1.id]);
    assert.equal((await f.send("GET", `${root(f)}/doctor/appointments/${a1.id}/documents`, { token: d2.session.token })).status, 404, "another doctor's appointment");
    assert.equal((await f.send("GET", `${root(f)}/doctor/documents/${doc1.id}/file`, { token: d2.session.token })).status, 404);
    const file = await f.send("GET", `${root(f)}/doctor/documents/${doc1.id}/file`, { token: d1.session.token });
    assert.ok(file.status === 200 && file.raw.equals(PDF));
    assert.equal((await f.send("GET", `${root(f)}/doctor/documents/${doc1.id}/file`, { token: p1.session.token })).status, 401, "a patient session is not a doctor session");
    assert.equal((await f.send("GET", `${root(f)}/patient/documents/${doc1.id}/file`, { token: d1.session.token })).status, 401, "nor the reverse");
    assert.equal((await f.send("DELETE", `${root(f)}/doctor/documents/${doc1.id}`, { token: d1.session.token })).status, 404, "doctors cannot delete");
    const events = f.audit().filter((e) => e.action.startsWith("medical_document."));
    const read = events.find((e) => e.action === "medical_document.read" && e.resourceId === doc1.id);
    assert.equal(read.actorKind, "app_user"); assert.equal(read.actorId, d1.doctor.id);
    assert.ok(events.some((e) => e.action === "medical_document.listed" && e.actorId === d1.doctor.id && e.metadata.count === 1));
    assert.ok(events.some((e) => e.action === "medical_document.uploaded" && e.actorId === p1.patient.id));
    const dump = JSON.stringify(events);
    assert.equal(/نتیجه|lab\.pdf|%PDF/.test(dump), false, "audit stores neither titles, names nor content");
  } finally { await f.close(); f.db.close(); }
});

test("deleting is a state change: the object is gone, access stops, the row is evidence and cannot be tampered with", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001"), a = f.book(f.seed.d1, p), d = await f.doctor(f.seed.d1, "09125550001");
    const doc = (await f.upload(p, a.id)).json.document;
    assert.equal((await f.send("DELETE", `${root(f)}/patient/documents/${doc.id}`, { token: p.session.token })).status, 200);
    assert.equal(f.storage._keys().length, 0);
    assert.equal((await f.send("GET", `${root(f)}/patient/documents/${doc.id}/file`, { token: p.session.token })).status, 404);
    assert.equal((await f.send("GET", `${root(f)}/doctor/documents/${doc.id}/file`, { token: d.session.token })).status, 404);
    assert.deepEqual((await f.send("GET", `${root(f)}/patient/appointments/${a.id}/documents`, { token: p.session.token })).json.documents, []);
    assert.equal((await f.send("DELETE", `${root(f)}/patient/documents/${doc.id}`, { token: p.session.token })).status, 404, "idempotent denial");
    const row = f.db.prepare("SELECT * FROM medical_documents").get();
    assert.equal(row.lifecycle_state, "deleted"); assert.ok(row.deleted_at);
    assert.throws(() => f.db.prepare("DELETE FROM medical_documents WHERE id=?").run(doc.id), /never deleted/);
    for (const column of ["owner_app_user_id", "site_project_id", "appointment_id", "storage_ref", "mime_type", "title"]) assert.throws(() => f.db.prepare(`UPDATE medical_documents SET ${column}='x' WHERE id=?`).run(doc.id), /immutable/, column);
    assert.throws(() => f.db.prepare("INSERT INTO medical_documents(id,workspace_id,site_project_id,auth_project_id,owner_app_user_id,appointment_id,title,mime_type,size_bytes,sha256,storage_ref,created_at,updated_at) VALUES('x','ws-1',?,?,?,?,'t','application/pdf',1,'h','k','x','x')").run(f.A.id, p.authProjectId, "someone-else", a.id), /own appointment/);
    assert.ok(f.audit().some((e) => e.action === "medical_document.deleted"));
  } finally { await f.close(); f.db.close(); }
});

test("operators never browse patient files: metadata only, and opening a file needs an owner, a reason and leaves evidence", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001"), a = f.book(f.seed.d1, p);
    const doc = (await f.upload(p, a.id, { title: "عنوان حساس", name: "secret-name.pdf" })).json.document;
    const base = `/site-projects/${f.A.id}/medical-documents`;
    const listed = await f.send("GET", base); assert.equal(listed.status, 200);
    assert.equal(/عنوان حساس|secret-name/.test(JSON.stringify(listed.json)), false, "no titles or file names in the operator list");
    f.setActor("member");
    assert.equal((await f.send("GET", base)).status, 403); assert.equal((await f.send("POST", `${base}/${doc.id}/access`, { body: JSON.stringify({ reason: "قابل قبول است ولی نقش ندارد" }), headers: { "content-type": "application/json" } })).status, 403);
    f.setActor("owner");
    const post = (body) => f.send("POST", `${base}/${doc.id}/access`, { body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    assert.equal((await post({})).status, 400); assert.equal((await post({ reason: "کوتاه" })).status, 400);
    const opened = await post({ reason: "درخواست پشتیبانی بیمار شماره ۱۲۳" });
    assert.equal(opened.status, 200); assert.ok(opened.raw.equals(PDF)); assert.equal(opened.headers.get("cache-control"), "no-store");
    const read = f.audit().find((e) => e.action === "medical_document.read" && e.actorKind === "operator");
    assert.equal(read.actorId, "owner"); assert.match(read.metadata.reason, /پشتیبانی/);
    assert.ok(f.audit().some((e) => e.action === "medical_document.listed_operator"));
    const other = await fixture(); other.close(); other.db.close();
  } finally { await f.close(); f.db.close(); }
});

test("scanner contract and production gate: nothing is faked, unscanned files are unreadable in production", async () => {
  const verdictScanner = (verdict) => ({ scan: async () => ({ verdict }) });
  const infected = await fixture({ scanner: verdictScanner("infected") });
  try {
    const p = await infected.patient("09120000001"), a = infected.book(infected.seed.d1, p);
    const r = await infected.upload(p, a.id);
    assert.equal(r.status, 422); assert.equal(r.json.code, "MEDICAL_DOCUMENT_REJECTED");
    assert.equal(infected.db.prepare("SELECT count(*) AS n FROM medical_documents").get().n, 0); assert.equal(infected.storage._keys().length, 0);
    assert.ok(infected.audit().some((e) => e.action === "medical_document.rejected"));
  } finally { await infected.close(); infected.db.close(); }
  const broken = await fixture({ scanner: { scan: async () => { throw new Error("down"); } } });
  try {
    const p = await broken.patient("09120000001"), a = broken.book(broken.seed.d1, p);
    assert.equal((await broken.upload(p, a.id)).json.code, "MEDICAL_DOCUMENT_SCAN_UNAVAILABLE", "a failing scanner fails closed");
    assert.equal(broken.storage._keys().length, 0);
  } finally { await broken.close(); broken.db.close(); }
  const clean = await fixture({ scanner: verdictScanner("clean") });
  try {
    const p = await clean.patient("09120000001"), a = clean.book(clean.seed.d1, p);
    assert.equal((await clean.upload(p, a.id)).json.document.scanState, "clean");
  } finally { await clean.close(); clean.db.close(); }
  const noScanner = await fixture({ nodeEnv: "production" });
  try {
    const p = await noScanner.patient("09120000001"), a = noScanner.book(noScanner.seed.d1, p);
    const r = await noScanner.upload(p, a.id);
    assert.equal(r.status, 503); assert.equal(r.json.code, "MEDICAL_DOCUMENTS_NOT_PRODUCTION_READY", "production without a scanner refuses to store anything");
    assert.equal(noScanner.storage._keys().length, 0);
  } finally { await noScanner.close(); noScanner.db.close(); }
  const unconfigured = await fixture({ nodeEnv: "production", scanner: verdictScanner("clean"), storage: createUnconfiguredMedicalStorage() });
  try {
    const p = await unconfigured.patient("09120000001"), a = unconfigured.book(unconfigured.seed.d1, p);
    assert.equal((await unconfigured.upload(p, a.id)).json.code, "MEDICAL_DOCUMENTS_NOT_PRODUCTION_READY", "production without private storage refuses too");
  } finally { await unconfigured.close(); unconfigured.db.close(); }
  const prod = await fixture({ nodeEnv: "production", scanner: verdictScanner("clean") });
  try {
    const p = await prod.patient("09120000001"), a = prod.book(prod.seed.d1, p);
    const doc = (await prod.upload(p, a.id)).json.document;
    assert.equal((await prod.send("GET", `${root(prod)}/patient/documents/${doc.id}/file`, { token: p.session.token })).status, 200);
    prod.db.prepare("UPDATE medical_documents SET scan_state='not_scanned' WHERE id=?").run(doc.id);
    assert.equal((await prod.send("GET", `${root(prod)}/patient/documents/${doc.id}/file`, { token: p.session.token })).status, 404, "production serves only files a scanner called clean");
  } finally { await prod.close(); prod.db.close(); }
});

test("an appointment holds a bounded number of documents", async () => {
  const f = await fixture();
  try {
    const p = await f.patient("09120000001"), a = f.book(f.seed.d1, p);
    for (let i = 0; i < 20; i += 1) assert.equal((await f.upload(p, a.id, { title: `d${i}` })).status, 201);
    const r = await f.upload(p, a.id, { title: "extra" });
    assert.equal(r.status, 409); assert.equal(r.json.code, "MEDICAL_DOCUMENT_LIMIT_REACHED");
  } finally { await f.close(); f.db.close(); }
});
