import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import {
  createSmsIrOtpDelivery,
  OtpDeliveryError,
} from "../app/auth/sms-ir-otp-delivery.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { AuthError, createAuthService } from "../app/services/auth-service.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";

const API_KEY = "sms-test-key-not-a-real-secret";
const response = (status, payload, jsonError = false) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    if (jsonError) throw new SyntaxError("invalid json");
    return payload;
  },
});

function provider(fetchImpl, extra = {}) {
  return createSmsIrOtpDelivery({
    apiKey: API_KEY,
    templateId: 850415,
    parameterName: "CODE",
    fetchImpl,
    ...extra,
  });
}

test("SMS.ir Verify request is server-authoritative and minimal without claiming receipt", async () => {
  let call;
  const delivery = provider(async (url, options) => {
    call = { url, options };
    return response(200, { status: 1, message: "ok", data: { messageId: 1, cost: 2 } });
  });
  assert.equal(delivery.readiness().state, "CODE_READY_LIVE_VALIDATION_PENDING");
  assert.deepEqual(
    await delivery.sendOtp({ mobile: "09120000001", code: "12345" }),
    { provider: "SMS_IR", delivered: true },
  );
  assert.equal(call.url, "https://api.sms.ir/v1/send/verify");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.headers["x-api-key"], API_KEY);
  assert.deepEqual(JSON.parse(call.options.body), {
    mobile: "09120000001",
    templateId: 850415,
    parameters: [{ name: "CODE", value: "12345" }],
  });
  assert.equal(delivery.readiness().state, "CODE_READY_LIVE_VALIDATION_PENDING");
  assert.equal(delivery.readiness().productionReady, false);
});

test("SMS.ir configuration fails closed", async () => {
  for (const options of [
    { apiKey: "", templateId: 850415, parameterName: "CODE" },
    { apiKey: API_KEY, templateId: null, parameterName: "CODE" },
    { apiKey: API_KEY, templateId: -1, parameterName: "CODE" },
    { apiKey: API_KEY, templateId: 850415, parameterName: "bad-name" },
  ]) {
    const delivery = createSmsIrOtpDelivery({ ...options, fetchImpl: async () => response(200, { status: 1 }) });
    assert.equal(delivery.readiness().configured, false);
    await assert.rejects(
      delivery.sendOtp({ mobile: "09120000001", code: "12345" }),
      (error) => error instanceof OtpDeliveryError && error.code === "OTP_DELIVERY_UNAVAILABLE",
    );
  }
});

test("SMS.ir HTTP and provider failures are bounded and never retried", async () => {
  for (const [status, expected] of [
    [400, "OTP_DELIVERY_REJECTED"],
    [401, "OTP_DELIVERY_UNAUTHORIZED"],
    [403, "OTP_DELIVERY_UNAUTHORIZED"],
    [429, "OTP_DELIVERY_RATE_LIMITED"],
    [500, "OTP_DELIVERY_UNAVAILABLE"],
  ]) {
    let calls = 0;
    const delivery = provider(async () => {
      calls += 1;
      return response(status, { status: 0, message: "provider detail must not escape" });
    });
    await assert.rejects(
      delivery.sendOtp({ mobile: "09120000001", code: "12345" }),
      (error) => error instanceof OtpDeliveryError && error.code === expected,
    );
    assert.equal(calls, 1);
  }
});

test("SMS.ir malformed and HTTP-success/provider-failure responses fail closed", async () => {
  for (const fetchImpl of [
    async () => response(200, null, true),
    async () => response(200, { status: 0, message: "rejected" }),
    async () => response(200, { data: {} }),
    async () => { throw new Error("network detail"); },
  ]) {
    await assert.rejects(
      provider(fetchImpl).sendOtp({ mobile: "09120000001", code: "12345" }),
      (error) => error instanceof OtpDeliveryError && ["OTP_DELIVERY_PROVIDER_ERROR", "OTP_DELIVERY_REJECTED"].includes(error.code),
    );
  }
});

test("SMS.ir timeout aborts once without retry", async () => {
  let calls = 0;
  const delivery = provider((_url, options) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  }, { timeoutMs: 5 });
  await assert.rejects(
    delivery.sendOtp({ mobile: "09120000001", code: "12345" }),
    (error) => error instanceof OtpDeliveryError && error.code === "OTP_DELIVERY_TIMEOUT",
  );
  assert.equal(calls, 1);
});

test("real Auth Service flow sends exact OTP, stores only hash, verifies, and invalidates failed delivery", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-sms-otp-"));
  const db = new Database(join(directory, "auth.sqlite"));
  db.pragma("foreign_keys=ON");
  runMigrations(db, [migration001Identity, migration004WorkspaceManagementAudit]);
  const repository = createIdentityRepository(db);
  let deliveredCode = null;
  let shouldFail = false;
  const delivery = provider(async (_url, options) => {
    if (shouldFail) return response(500, { status: 0 });
    deliveredCode = JSON.parse(options.body).parameters[0].value;
    return response(200, { status: 1 });
  });
  const auth = createAuthService({ repository, otpHashSecret: "test-auth-secret", otpDelivery: delivery });
  const requested = await auth.requestOtp({ mobile: "09120000001", name: "کاربر تست" });
  assert.match(deliveredCode, /^\d{5}$/);
  assert.equal(requested.code, deliveredCode);
  const stored = db.prepare("SELECT code_hash FROM otp_challenges WHERE id=?").get(requested.challenge.id);
  assert.equal(stored.code_hash.length, 64);
  assert.notEqual(stored.code_hash, deliveredCode);
  const identity = auth.verifyOtp({ mobile: "09120000001", code: deliveredCode });
  assert.equal(identity.user.mobile, "09120000001");
  assert.ok(identity.sessionToken);
  assert.equal(delivery.readiness().state, "LIVE_VALIDATED");

  shouldFail = true;
  await assert.rejects(
    auth.requestOtp({ mobile: "09120000002", name: "کاربر دوم" }),
    (error) => error instanceof AuthError && error.code === "OTP_DELIVERY_UNAVAILABLE" && error.status === 503,
  );
  assert.ok(db.prepare("SELECT consumed_at FROM otp_challenges WHERE mobile=?").get("09120000002").consumed_at);

  await t.test("no provider detail, OTP, or API key is exposed by AuthError", async () => {
    try {
      await auth.requestOtp({ mobile: "09120000003", name: "کاربر سوم" });
      assert.fail("delivery should fail");
    } catch (error) {
      assert.equal(String(error).includes(API_KEY), false);
      assert.equal(String(error).includes(deliveredCode), false);
      assert.equal(String(error).includes("provider detail"), false);
    }
  });

  db.close();
  rmSync(directory, { recursive: true, force: true });
});

test("production Auth route never exposes OTP and preserves request throttling", async () => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-sms-route-"));
  const db = new Database(join(directory, "auth.sqlite"));
  db.pragma("foreign_keys=ON");
  runMigrations(db, [migration001Identity, migration004WorkspaceManagementAudit]);
  let sends = 0;
  const delivery = provider(async () => {
    sends += 1;
    return response(200, { status: 1 });
  });
  const authService = createAuthService({
    repository: createIdentityRepository(db),
    otpHashSecret: "route-test-secret",
    otpDelivery: delivery,
  });
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter({ authService, nodeEnv: "production", exposeDevelopmentOtp: false }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sent = await fetch(`${base}/api/auth/send-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mobile: "09120000009", name: "کاربر مسیر" }),
      });
      assert.equal(sent.status, 200);
      const body = await sent.json();
      assert.equal(body.success, true);
      assert.equal(Object.hasOwn(body, "developmentOtp"), false);
    }
    const limited = await fetch(`${base}/api/auth/send-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile: "09120000009", name: "کاربر مسیر" }),
    });
    assert.equal(limited.status, 429);
    assert.equal(sends, 5);
    const status = await (await fetch(`${base}/api/auth/status`)).json();
    assert.equal(status.otpDelivery, "CODE_READY_LIVE_VALIDATION_PENDING");
    assert.equal(status.productionReady, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
