import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";

const MOBILE = "09121234567";
const SECRET_PROVIDER_ERROR = "https://api.kavenegar.com/v1/SUPER-SECRET-KEY/sms/send.json failed";

async function harness(options) {
  const db = new Database(join(mkdtempSync(join(tmpdir(), "loadder-otp-")), "otp.sqlite"));
  db.pragma("foreign_keys = ON");
  runMigrations(db, [migration001Identity, migration004WorkspaceManagementAudit]);
  const authService = createAuthService({ repository: createIdentityRepository(db), otpHashSecret: "test-only-secret" });
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter({ authService, ...options }));
  const server = await new Promise((resolve) => { const l = app.listen(0, "127.0.0.1", () => resolve(l)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : {}, headers: res.headers };
  };
  return { post, get: async (path) => { const res = await fetch(`${base}${path}`); return { status: res.status, json: await res.json() }; }, close: () => { server.close(); db.close(); } };
}

// Capture console output so we can prove no code or provider detail is logged.
function captureLogs() {
  const lines = []; const original = { error: console.error, warn: console.warn, log: console.log };
  for (const k of Object.keys(original)) console[k] = (...a) => lines.push(a.map((x) => (x instanceof Error ? `${x.name}:${x.message}` : String(x))).join(" "));
  return { lines, restore: () => Object.assign(console, original) };
}

const production = { nodeEnv: "production", exposeDevelopmentOtp: false, otpDeliveryReady: () => true };

test("production: the code is delivered by SMS and never returned, so it is the only way in", async (t) => {
  const sent = [];
  const h = await harness({ ...production, deliverOtp: async (m) => { sent.push(m); } });
  t.after(h.close);
  const res = await h.post("/api/auth/send-otp", { mobile: MOBILE, name: "Operator" });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].mobile, MOBILE);
  assert.match(sent[0].code, /^\d{5}$/);
  assert.equal("developmentOtp" in res.json, false);
  assert.equal(res.text.includes(sent[0].code), false, "the response must not contain the code");
  const verified = await h.post("/api/auth/verify-otp", { mobile: MOBILE, code: sent[0].code });
  assert.equal(verified.status, 200, "the delivered code signs the operator in");
  const cookie = verified.headers.get("set-cookie") || "";
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /Secure/i); assert.match(cookie, /SameSite=Lax/i);
});

test("production: even with the development flag set the code is never exposed", async (t) => {
  const h = await harness({ nodeEnv: "production", exposeDevelopmentOtp: true, otpDeliveryReady: () => true, deliverOtp: async () => {} });
  t.after(h.close);
  const res = await h.post("/api/auth/send-otp", { mobile: MOBILE, name: "Operator" });
  assert.equal(res.status, 200);
  assert.equal("developmentOtp" in res.json, false);
  assert.equal((await h.get("/api/auth/status")).json.developmentOtpExposed, false);
});

test("production: SMS not configured fails closed before any code exists", async (t) => {
  let called = 0;
  const h = await harness({ ...production, otpDeliveryReady: () => false, deliverOtp: async () => { called += 1; } });
  t.after(h.close);
  const res = await h.post("/api/auth/send-otp", { mobile: MOBILE, name: "Operator" });
  assert.equal(res.status, 503);
  assert.equal(res.json.code, "OTP_DELIVERY_NOT_CONFIGURED");
  assert.equal(called, 0, "nothing is sent");
  assert.equal((await h.post("/api/auth/verify-otp", { mobile: MOBILE, code: "12345" })).status, 400, "no challenge was created");
});

test("production default readiness refuses the simulator provider", async (t) => {
  const h = await harness({ nodeEnv: "production", exposeDevelopmentOtp: false });
  t.after(h.close);
  const res = await h.post("/api/auth/send-otp", { mobile: MOBILE, name: "Operator" });
  assert.equal(res.status, 503);
  assert.equal(res.json.code, "OTP_DELIVERY_NOT_CONFIGURED");
  const status = (await h.get("/api/auth/status")).json;
  assert.equal(status.otpDelivery, "not-connected"); assert.equal(status.productionReady, false);
});

test("production: a failed send reveals nothing, logs no code or provider detail, and kills the code", async (t) => {
  let delivered = null;
  const h = await harness({ ...production, deliverOtp: async (m) => { delivered = m; throw new Error(`${SECRET_PROVIDER_ERROR} for ${m.mobile} code ${m.code}`); } });
  t.after(h.close);
  const logs = captureLogs();
  let res;
  try { res = await h.post("/api/auth/send-otp", { mobile: MOBILE, name: "Operator" }); } finally { logs.restore(); }
  assert.equal(res.status, 503);
  assert.equal(res.json.code, "OTP_DELIVERY_FAILED");
  for (const secret of [SECRET_PROVIDER_ERROR, "SUPER-SECRET-KEY", delivered.code, MOBILE]) {
    assert.equal(res.text.includes(secret), false, `response leaked ${secret === delivered.code ? "the code" : "detail"}`);
    assert.equal(logs.lines.join("\n").includes(secret), false, `logs leaked ${secret === delivered.code ? "the code" : "detail"}`);
  }
  const verify = await h.post("/api/auth/verify-otp", { mobile: MOBILE, code: delivered.code });
  assert.equal(verify.status, 400, "an undelivered code can never sign anyone in");
});

test("status reports delivery truthfully and production readiness only when delivery works", async (t) => {
  const ready = await harness({ ...production, deliverOtp: async () => {} });
  t.after(ready.close);
  const s = (await ready.get("/api/auth/status")).json;
  assert.equal(s.otpDelivery, "configured"); assert.equal(s.productionReady, true);
  const dev = await harness({ nodeEnv: "development", exposeDevelopmentOtp: true, otpDeliveryReady: () => true, deliverOtp: async () => {} });
  t.after(dev.close);
  const d = (await dev.get("/api/auth/status")).json;
  assert.equal(d.productionReady, false, "development is never production ready"); assert.equal(d.developmentOtpExposed, true);
});

test("development with the exposed code behaves as before, even when delivery fails", async (t) => {
  const h = await harness({ nodeEnv: "development", exposeDevelopmentOtp: true, otpDeliveryReady: () => false, deliverOtp: async () => { throw new Error("provider down"); } });
  t.after(h.close);
  const logs = captureLogs();
  let res;
  try { res = await h.post("/api/auth/send-otp", { mobile: MOBILE, name: "Developer" }); } finally { logs.restore(); }
  assert.equal(res.status, 200);
  assert.match(res.json.developmentOtp, /^\d{5}$/);
  assert.equal((await h.post("/api/auth/verify-otp", { mobile: MOBILE, code: res.json.developmentOtp })).status, 200, "the exposed code still signs in");
  assert.equal(logs.lines.join("\n").includes(res.json.developmentOtp), false);
});

test("development without an exposed code requires real delivery too", async (t) => {
  const h = await harness({ nodeEnv: "development", exposeDevelopmentOtp: false, otpDeliveryReady: () => false, deliverOtp: async () => {} });
  t.after(h.close);
  const res = await h.post("/api/auth/send-otp", { mobile: MOBILE, name: "Developer" });
  assert.equal(res.status, 503);
  assert.equal(res.json.code, "OTP_DELIVERY_NOT_CONFIGURED");
});
