import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import express from "express";
import { createOtpDelivery } from "../app/services/otp-delivery.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";

const config = { SMS_IR_API_KEY: "test-only-not-a-credential", SMS_IR_OTP_TEMPLATE_ID: "123", SMS_IR_OTP_PARAMETER: "CODE" };
const accepted = () => Response.json({ status: 1, data: { messageId: 123 } });
const input = { mobile: "09120000001", name: "Test User" };

function fixture(t, transport = async () => accepted(), env = config) {
  const db = new Database(":memory:");
  runMigrations(db, [migration001Identity, migration004WorkspaceManagementAudit]);
  t.after(() => db.close());
  let clock = Date.parse("2026-09-01T00:00:00Z");
  const calls = [];
  const delivery = createOtpDelivery(env, async (url, options) => {
    calls.push({ url, ...options, payload: JSON.parse(options.body) });
    return transport(url, options);
  });
  const service = createAuthService({ repository: createIdentityRepository(db), otpHashSecret: "fixture-secret", now: () => new Date(clock), otpDelivery: delivery });
  return { db, service, calls, advance: ms => { clock += ms; } };
}

test("provider acceptance persists hash only; invalid/replayed OTP rejected; session resolves", async t => {
  const f = fixture(t);
  const result = await f.service.sendOtp(input);
  assert.equal(result.code, undefined);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "https://api.sms.ir/v1/send/verify");
  assert.equal(f.calls[0].redirect, "error");
  assert.equal(f.calls[0].payload.templateId, 123);
  const code = f.calls[0].payload.parameters[0].value;
  const row = f.db.prepare("SELECT * FROM otp_challenges").get();
  assert.match(row.code_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(row.code_hash, code);
  assert.throws(() => f.service.verifyOtp({ ...input, code: "wrong" }), { code: "INVALID_OTP" });
  const identity = f.service.verifyOtp({ ...input, code });
  assert.ok(f.service.resolveSession(identity.sessionToken));
  assert.throws(() => f.service.verifyOtp({ ...input, code }), { code: "INVALID_OTP" });
});

test("expired accepted OTP cannot create session", async t => {
  const f = fixture(t); await f.service.sendOtp(input); f.advance(120001);
  assert.throws(() => f.service.verifyOtp({ ...input, code: f.calls[0].payload.parameters[0].value }), { code: "INVALID_OTP" });
  assert.equal(f.db.prepare("SELECT count(*) n FROM sessions").get().n, 0);
});

test("numeric wrong codes retain existing attempt limit", async t => {
  const f = fixture(t); await f.service.sendOtp(input);
  const code = f.calls[0].payload.parameters[0].value;
  const wrong = code === "10000" ? "10001" : "10000";
  for (let i = 0; i < 5; i++) assert.throws(() => f.service.verifyOtp({ ...input, code: wrong }), { code: "INVALID_OTP" });
  assert.throws(() => f.service.verifyOtp({ ...input, code }), { code: "OTP_ATTEMPTS_EXCEEDED" });
});

test("failed replacement delivery preserves prior challenge", async t => {
  let fail = false;
  const f = fixture(t, () => fail ? new Response("", { status: 503 }) : accepted());
  await f.service.sendOtp(input);
  const code = f.calls[0].payload.parameters[0].value;
  fail = true;
  await assert.rejects(f.service.sendOtp(input), { code: "OTP_DELIVERY_FAILED" });
  assert.ok(f.service.verifyOtp({ ...input, code }).sessionToken);
});

for (const [name, response] of [
  ["HTTP failure", () => new Response("secret", { status: 500 })],
  ["provider rejection", () => Response.json({ status: 10, message: "secret" })],
  ["malformed response", () => new Response("bad")],
  ["oversized response", () => new Response("x".repeat(9000))],
  ["network failure", () => { throw new Error("secret"); }],
]) test(`${name}: no challenge, sanitized failure, no retry`, async t => {
  const f = fixture(t, response);
  await assert.rejects(f.service.sendOtp(input), { code: "OTP_DELIVERY_FAILED" });
  assert.equal(f.calls.length, 1);
  assert.equal(f.db.prepare("SELECT count(*) n FROM otp_challenges").get().n, 0);
});

test("missing/invalid config never contacts provider", async t => {
  for (const env of [{}, { ...config, SMS_IR_OTP_TEMPLATE_ID: "1.5" }, { ...config, SMS_IR_OTP_PARAMETER: "bad\n" }]) {
    const f = fixture(t, undefined, env);
    await assert.rejects(f.service.sendOtp(input), { code: "OTP_DELIVERY_NOT_CONFIGURED" });
    assert.equal(f.calls.length, 0);
  }
});

test("bounded deadline aborts provider request without retry", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t, async (url, options) => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
  const result = assert.rejects(f.service.sendOtp(input), { code: "OTP_DELIVERY_FAILED" });
  t.mock.timers.tick(10000);
  await result;
  assert.equal(f.calls.length, 1);
});

test("concurrent same-mobile delivery rejected without duplicate SMS", async t => {
  let release;
  const f = fixture(t, () => new Promise(resolve => { release = () => resolve(accepted()); }));
  const first = f.service.sendOtp(input);
  await assert.rejects(f.service.sendOtp(input), { code: "OTP_DELIVERY_BUSY" });
  release(); await first;
  assert.equal(f.calls.length, 1);
});

test("production route never exposes OTP; cookie/session and rate limit preserved", async t => {
  const f = fixture(t);
  const app = express(); app.use(express.json());
  app.use(createAuthRouter({ authService: f.service, nodeEnv: "production", exposeDevelopmentOtp: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const response = await post("/send-otp", { ...input, templateId: 999, developmentOtp: true });
  assert.equal(response.status, 200);
  const payload = await response.json(); assert.equal(payload.developmentOtp, undefined);
  const login = await post("/verify-otp", { ...input, code: f.calls[0].payload.parameters[0].value });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  assert.match(login.headers.get("set-cookie"), /Secure/);
  for (let i = 0; i < 4; i++) assert.equal((await post("/send-otp", input)).status, 200);
  assert.equal((await post("/send-otp", input)).status, 429);
  assert.equal(f.calls.length, 5);
});
