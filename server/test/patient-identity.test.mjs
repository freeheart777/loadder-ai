import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createBusinessBuilderRepository } from "../app/repositories/business-builder-repository.mjs";
import { LoadderAppUserAuth } from "../app/business-builder/app-user-auth.mjs";
import { createPatientIdentityService, normalizeMobile } from "../app/services/patient-identity-service.mjs";
import { otpDeliveryConfigured } from "../app/services/patient-otp-delivery.mjs";
import { createPatientIdentityRouter, createPatientIdentityAdminRouter } from "../app/routes/patient-identity.mjs";
import { createSensitiveAccessAudit } from "../app/services/sensitive-access-audit.mjs";

function fixture(options = {}) {
  const db = createSiteTestDb();
  let clock = new Date("2026-10-03T08:00:00.000Z"), delivered = [];
  const service = createPatientIdentityService({ db, hashSecret: "test-secret", deliver: async (message) => { if (options.failDelivery) throw new Error("boom"); delivered.push(message); }, deliveryConfigured: options.deliveryConfigured || (() => true), now: () => clock, ...options.service });
  const projects = createSiteProjectService({ repository: createSiteProjectRepository(db) });
  const make = (ws, name, siteType = "MEDICAL") => runWithWorkspace(ws, () => projects.create({ name, siteType, content: {} }));
  const a = make("ws-1", "A"), b = make("ws-1", "B"), edu = make("ws-1", "Edu", "EDUCATION"), foreign = make("ws-2", "F");
  const as = (ws, fn) => runWithWorkspace(ws, fn);
  const enable = (site, ws = "ws-1") => as(ws, () => service.enableForSite(site.id, { actorUserId: "op" }));
  return { db, service, a, b, edu, foreign, as, enable, delivered: () => delivered, last: () => delivered.at(-1), tick: (ms) => { clock = new Date(clock.getTime() + ms); }, now: () => clock };
}
const signIn = async (f, site, mobile = "09120000000", name = "بیمار") => {
  await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: site.id, mobile }));
  const { code } = f.last();
  f.tick(61_000);
  return f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: site.id, mobile, code, name }));
};
const fails = (code, status) => (error) => error.code === code && (status === undefined || error.status === status);

test("mobile numbers normalize from Persian digits and international forms", () => {
  assert.equal(normalizeMobile("۰۹۱۲۰۰۰۰۰۰۰"), "09120000000");
  assert.equal(normalizeMobile("+98 912 000 0000"), "09120000000");
  assert.equal(normalizeMobile("00989120000000"), "09120000000");
  for (const bad of ["", "0912", "08120000000", "abc", null]) assert.equal(normalizeMobile(bad), null);
});

test("enabling creates one hidden system auth project per Medical site, only for Medical, only in its workspace", () => {
  const f = fixture();
  const first = f.enable(f.a);
  assert.equal(first.created, true);
  assert.equal(f.enable(f.a).created, false, "idempotent");
  assert.equal(f.enable(f.a).authProjectId, first.authProjectId);
  assert.notEqual(f.enable(f.b).authProjectId, first.authProjectId, "each site has its own identity project");
  assert.throws(() => f.enable(f.edu), fails("PATIENT_IDENTITY_SITE_TYPE_UNSUPPORTED", 422));
  assert.throws(() => f.enable(f.a, "ws-2"), fails("SITE_PROJECT_NOT_FOUND", 404), "another workspace cannot reach the site");
  assert.deepEqual(f.as("ws-1", () => createBusinessBuilderRepository(f.db).listProjects()).filter((p) => p.name?.startsWith("site-identity")), [], "system projects never appear in Business Builder lists");
  f.db.close();
});

test("sign-up and sign-in through the existing app-user session; no passwords, placeholder email never exposed", async () => {
  const f = fixture(); const binding = f.enable(f.a);
  const first = await signIn(f, f.a, "۰۹۱۲۰۰۰۰۰۰۰", "سارا");
  assert.equal(first.created, true); assert.equal(first.patient.displayName, "سارا");
  const auth = new LoadderAppUserAuth(f.db);
  const principal = f.as("ws-1", () => auth.resolve(first.session.token, binding.authProjectId));
  assert.equal(principal.role, "customer"); assert.equal(principal.id, first.patient.id);
  assert.equal(f.as("ws-1", () => f.service.resolve(f.a.id, first.session.token)).id, first.patient.id);
  assert.equal(f.as("ws-1", () => f.service.resolve(f.b.id, first.session.token)), null, "a session is bound to its site");
  const second = await signIn(f, f.a, "09120000000", "نام دیگر");
  assert.equal(second.created, false); assert.equal(second.patient.id, first.patient.id, "the mobile identifies the same patient");
  assert.equal(second.patient.displayName, "سارا", "a later name never overwrites the account");
  assert.equal(/\.invalid|@/.test(JSON.stringify([first, second])), false, "the placeholder email is never returned");
  const identifier = f.db.prepare("SELECT * FROM app_user_identifiers").get();
  assert.equal(identifier.value_normalized, "09120000000"); assert.equal(identifier.kind, "mobile"); assert.ok(identifier.verified_at);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM business_builder_app_users").get().n, 1);
  f.db.close();
});

test("codes are hashed at rest, single-use, expiring and attempt-limited", async () => {
  const f = fixture(); f.enable(f.a);
  const mobile = "09120000000";
  await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile }));
  const { code } = f.last();
  const challenge = f.db.prepare("SELECT * FROM app_user_otp_challenges").get();
  assert.notEqual(challenge.code_hash, code); assert.equal(JSON.stringify(f.db.prepare("SELECT * FROM app_user_otp_challenges").all()).includes(code), false);
  const verify = (c) => f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: f.a.id, mobile, code: c }));
  const wrong = code === "000000" ? "111111" : "000000";
  assert.throws(() => verify(wrong), fails("PATIENT_OTP_INVALID", 400));
  const ok = verify(code);
  assert.ok(ok.session.token);
  assert.throws(() => verify(code), fails("PATIENT_OTP_INVALID", 400), "replay of a used code");
  // expiry
  f.tick(61_000);
  await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile }));
  const stale = f.last().code; f.tick(5 * 60_000 + 1);
  assert.throws(() => verify(stale), fails("PATIENT_OTP_INVALID", 400), "expired");
  // lockout after repeated wrong guesses, even if the right code follows
  f.tick(61_000);
  await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile }));
  const real = f.last().code, bad = real === "123456" ? "654321" : "123456";
  for (let i = 0; i < 5; i += 1) assert.throws(() => verify(bad), fails("PATIENT_OTP_INVALID", 400));
  assert.throws(() => verify(real), fails("PATIENT_OTP_INVALID"), "the challenge is burned after max attempts");
  f.db.close();
});

test("requests are rate limited per mobile and site: cooldown and rolling window", async () => {
  const f = fixture(); f.enable(f.a);
  const ask = (mobile = "09120000000") => f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile }));
  await ask();
  await assert.rejects(ask(), (e) => e.code === "PATIENT_OTP_RATE_LIMITED" && e.status === 429 && e.retryAfterSeconds > 0, "resend cooldown");
  for (let i = 0; i < 4; i += 1) { f.tick(61_000); await ask(); }
  f.tick(61_000);
  await assert.rejects(ask(), (e) => e.code === "PATIENT_OTP_RATE_LIMITED" && e.retryAfterSeconds > 60, "five codes per window");
  await ask("09121111111");
  f.db.close();
});

test("sites and workspaces are isolated: a code never crosses sites, and the same mobile is a separate patient per site", async () => {
  const f = fixture(); f.enable(f.a); f.enable(f.b);
  await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile: "09120000000" }));
  const { code } = f.last();
  assert.throws(() => f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: f.b.id, mobile: "09120000000", code })), fails("PATIENT_OTP_INVALID", 400), "A's code does not sign in to B");
  assert.throws(() => f.as("ws-2", () => f.service.verifyOtp({ siteProjectId: f.a.id, mobile: "09120000000", code })), fails("PATIENT_SIGNUP_NOT_ENABLED", 404), "another workspace has no binding for the site");
  await assert.rejects(f.as("ws-2", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile: "09120000000" })), fails("PATIENT_SIGNUP_NOT_ENABLED", 404));
  const onA = f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: f.a.id, mobile: "09120000000", code }));
  const onB = await signIn(f, f.b, "09120000000");
  assert.notEqual(onA.patient.id, onB.patient.id); assert.notEqual(onA.authProjectId, onB.authProjectId);
  await assert.rejects(f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.edu.id, mobile: "09120000000" })), fails("PATIENT_SIGNUP_NOT_ENABLED", 404));
  f.db.close();
});

test("disabled patients cannot sign in or use a live session; identifiers are unique per project", async () => {
  const f = fixture(); const binding = f.enable(f.a);
  const session = await signIn(f, f.a);
  const auth = new LoadderAppUserAuth(f.db);
  f.as("ws-1", () => auth.setStatus(session.patient.id, "disabled"));
  assert.equal(f.as("ws-1", () => f.service.resolve(f.a.id, session.session.token)), null, "existing sessions die with the account");
  f.tick(61_000);
  await f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile: "09120000000" }));
  const attempt = f.last();
  assert.throws(() => f.as("ws-1", () => f.service.verifyOtp({ siteProjectId: f.a.id, mobile: "09120000000", code: attempt.code })), fails("PATIENT_OTP_INVALID", 400), "same answer as any other failure");
  const other = f.as("ws-1", () => auth.createUser({ projectId: binding.authProjectId, email: "x@patients.invalid", role: "customer" }));
  assert.throws(() => f.db.prepare("INSERT INTO app_user_identifiers(id,workspace_id,project_id,app_user_id,kind,value_normalized,is_primary,verified_at,status,created_at,updated_at) VALUES('i2','ws-1',?,?,'mobile','09120000000',0,'x','active','x','x')").run(binding.authProjectId, other.id), /UNIQUE/, "one mobile, one patient");
  assert.throws(() => f.db.prepare("INSERT INTO app_user_identifiers(id,workspace_id,project_id,app_user_id,kind,value_normalized,is_primary,status,created_at,updated_at) VALUES('i3','ws-1','wrong-project',?,'email','a@b.c',0,'active','x','x')").run(other.id), /must belong to an app user/);
  f.db.close();
});

test("production fails closed without a real SMS provider; development may use the simulator", async () => {
  assert.equal(otpDeliveryConfigured({ nodeEnv: "production", status: { sms: { provider: "simulator", configured: true } } }), false);
  assert.equal(otpDeliveryConfigured({ nodeEnv: "production", status: { sms: { provider: "kavenegar", configured: false } } }), false);
  assert.equal(otpDeliveryConfigured({ nodeEnv: "production", status: { sms: { provider: "kavenegar", configured: true } } }), true);
  assert.equal(otpDeliveryConfigured({ nodeEnv: "development", status: { sms: { provider: "simulator", configured: true } } }), true);
  const f = fixture({ deliveryConfigured: () => false }); f.enable(f.a);
  await assert.rejects(f.as("ws-1", () => f.service.requestOtp({ siteProjectId: f.a.id, mobile: "09120000000" })), fails("OTP_DELIVERY_NOT_CONFIGURED", 503));
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM app_user_otp_challenges").get().n, 0, "no usable challenge is created");
  assert.equal(f.delivered().length, 0);
  const failing = fixture({ failDelivery: true }); failing.enable(failing.a);
  await assert.rejects(failing.as("ws-1", () => failing.service.requestOtp({ siteProjectId: failing.a.id, mobile: "09120000000" })), fails("OTP_DELIVERY_FAILED", 502));
  assert.equal(failing.db.prepare("SELECT count(*) AS n FROM app_user_otp_challenges WHERE consumed_at IS NULL").get().n, 0, "a code that was never delivered is unusable");
  f.db.close(); failing.db.close();
});

test("authentication events are audited without codes or full mobile numbers", async () => {
  const f = fixture(); f.enable(f.a);
  const session = await signIn(f, f.a);
  await f.as("ws-1", () => f.service.signOut({ siteProjectId: f.a.id, token: session.session.token }));
  const events = f.as("ws-1", () => createSensitiveAccessAudit(f.db).list());
  const actions = events.map((e) => e.action);
  for (const expected of ["patient.identity.enabled", "patient.otp.requested", "patient.signed_up", "patient.signed_out"]) assert.ok(actions.includes(expected), expected);
  const dump = JSON.stringify(events), code = f.delivered()[0].code;
  assert.equal(dump.includes(code), false); assert.equal(dump.includes("09120000000"), false); assert.equal(dump.includes(session.session.token), false);
  assert.equal(f.as("ws-1", () => f.service.resolve(f.a.id, session.session.token)), null, "logout revokes the session");
  f.db.close();
});

test("HTTP: identical answers for known and unknown mobiles, no-store, dev code only when exposed, logout and operator switch", async () => {
  const f = fixture({ service: { exposeDevelopmentCode: false } });
  f.db.prepare("INSERT INTO workspace_memberships(id,workspace_id,user_id,status,role) VALUES('m1','ws-1','owner','active','owner'),('m2','ws-1','member','active','member')").run();
  let actor = "owner";
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: actor }; runWithWorkspace("ws-1", next); });
  app.use(createPatientIdentityAdminRouter({ service: f.service, db: f.db }));
  app.use("/api/auth", createPatientIdentityRouter({ service: f.service, siteLookup: (id) => (id === f.a.id ? { id, workspaceId: "ws-1" } : null) }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, headers = {}) => { const res = await fetch(`${origin}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, headers: res.headers, body: await res.json() }; };
  const site = `/api/auth/site/${f.a.id}/patient`;
  try {
    assert.equal((await call("POST", `${site}/otp`, { mobile: "09120000000" })).status, 404, "disabled until an operator enables it");
    actor = "member"; assert.equal((await call("POST", `/site-projects/${f.a.id}/patient-identity`)).status, 403);
    actor = "owner"; assert.equal((await call("POST", `/site-projects/${f.a.id}/patient-identity`)).status, 201);
    assert.equal((await call("POST", `/site-projects/${f.edu.id}/patient-identity`)).status, 422);
    const config = await call("GET", `${site}/config`); assert.equal(config.body.enabled, true);

    const unknown = await call("POST", `${site}/otp`, { mobile: "09125550000" });
    f.tick(61_000);
    const issued = f.last().code; assert.ok(issued);
    await call("POST", `${site}/verify`, { mobile: "09125550000", code: issued });
    f.tick(61_000);
    const known = await call("POST", `${site}/otp`, { mobile: "09125550000" });
    assert.equal(unknown.status, 202); assert.equal(known.status, 202);
    assert.deepEqual(Object.keys(unknown.body).sort(), Object.keys(known.body).sort(), "known and unknown mobiles get the same shape");
    assert.equal(unknown.body.developmentOtp, undefined, "the code is not exposed unless explicitly enabled for development");
    assert.equal(unknown.headers.get("cache-control"), "no-store");
    const wrongUnknown = await call("POST", `${site}/verify`, { mobile: "09129999999", code: "123456" });
    const wrongKnown = await call("POST", `${site}/verify`, { mobile: "09125550000", code: f.last().code === "123456" ? "654321" : "123456" });
    assert.deepEqual([wrongUnknown.status, wrongUnknown.body.code, wrongUnknown.body.message], [wrongKnown.status, wrongKnown.body.code, wrongKnown.body.message], "failures are indistinguishable");
    assert.equal((await call("POST", `${site}/otp`, { mobile: "123" })).status, 400);

    f.tick(61_000);
    await call("POST", `${site}/otp`, { mobile: "09127770000" });
    const verified = await call("POST", `${site}/verify`, { mobile: "09127770000", code: f.last().code, name: "علی" });
    assert.equal(verified.status, 200); assert.equal(verified.body.patient.displayName, "علی");
    assert.equal(/\.invalid|@/.test(JSON.stringify(verified.body)), false);
    const token = verified.body.session.token;
    assert.equal((await call("GET", `${site}/me`)).status, 401);
    assert.equal((await call("GET", `${site}/me`, null, { "X-Loadder-App-Token": token })).status, 200);
    assert.equal((await call("POST", `${site}/logout`, null, { "X-Loadder-App-Token": token })).body.signedOut, true);
    assert.equal((await call("GET", `${site}/me`, null, { "X-Loadder-App-Token": token })).status, 401);
    assert.equal((await call("POST", `/api/auth/site/${f.b.id}/patient/otp`, { mobile: "09120000000" })).status, 404, "unpublished/unknown site");
  } finally { await new Promise((resolve) => server.close(resolve)); f.db.close(); }
});
