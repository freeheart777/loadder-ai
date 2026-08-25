import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createProductPolicy, FEATURE_EXPOSURE } from "../app/product-policy.mjs";
import {
  assertLegacyOperationEnabled,
  classifyApiRequest,
  createApiProductGate,
  createInternalAccessMiddleware,
  createProductionOriginGuard,
} from "../app/middleware/product-gating.mjs";

const environmentModuleUrl = new URL("../app/config/environment.mjs", import.meta.url).href;
const importEnvironmentScript = `import(${JSON.stringify(environmentModuleUrl)})`;

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function runGate(policy, method, path, { internal = false } = {}) {
  const req = { method, path, internalAccess: internal };
  const res = response();
  let nextCalled = false;
  createApiProductGate(policy)(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test("production product policy is closed except truthful MVP features", () => {
  const policy = createProductPolicy({ nodeEnv: "production" });
  assert.equal(policy.exposure("content_studio"), FEATURE_EXPOSURE.CUSTOMER);
  assert.equal(policy.exposure("business_setup"), FEATURE_EXPOSURE.CUSTOMER);
  assert.equal(policy.exposure("intelligence"), FEATURE_EXPOSURE.INTERNAL);
  for (const key of ["legacy_crm", "legacy_marketing", "legacy_automation", "legacy_messaging", "execution", "experimental_ai", "development_tools"]) {
    assert.equal(policy.exposure(key), FEATURE_EXPOSURE.DISABLED);
  }
  assert.equal(policy.exposure("client_supplied_unknown"), FEATURE_EXPOSURE.DISABLED);
});

test("unknown and invalid feature overrides fail closed", () => {
  assert.throws(() => createProductPolicy({ nodeEnv: "production", overrides: { surprise: "CUSTOMER" } }), /unknown feature/);
  assert.throws(() => createProductPolicy({ nodeEnv: "production", overrides: { execution: "YES" } }), /invalid exposure/);
});

test("legacy messaging and workflow routes reject before handlers", () => {
  const policy = createProductPolicy({ nodeEnv: "production" });
  for (const [method, path, feature] of [
    ["POST", "/api/customers/customer-1/message", "legacy_messaging"],
    ["POST", "/api/automations/automation-1/run", "legacy_automation"],
    ["POST", "/api/events", "legacy_automation"],
  ]) {
    const result = runGate(policy, method, path);
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
    assert.deepEqual(result.res.body, { success: false, code: "FEATURE_DISABLED", feature, message: "This operation is not available." });
  }
});

test("indirect CRM workflow entry points are disabled in production", () => {
  const policy = createProductPolicy({ nodeEnv: "production" });
  for (const path of ["/api/leads", "/api/leads/lead-1", "/api/leads/lead-1/convert", "/api/orders", "/api/carts"]) {
    assert.equal(runGate(policy, path.includes("lead-1") && !path.endsWith("convert") ? "PATCH" : "POST", path).res.body.code, "FEATURE_DISABLED");
  }
});

test("automation CRUD and campaign mutations are disabled", () => {
  const policy = createProductPolicy({ nodeEnv: "production" });
  for (const [method, path] of [
    ["POST", "/api/automations"], ["PATCH", "/api/automations/a"], ["DELETE", "/api/automations/a"],
    ["POST", "/api/marketing/campaigns"], ["POST", "/api/marketing/campaigns/c/metrics"],
    ["POST", "/api/marketing/attribution"], ["POST", "/api/marketing/campaigns/c/control-mode"],
  ]) assert.equal(runGate(policy, method, path).res.statusCode, 403);
});

test("modern execution creation and verification routes are frozen", () => {
  const policy = createProductPolicy({ nodeEnv: "production" });
  for (const path of [
    "/api/intelligence/decisions/d/action-proposals",
    "/api/execution/action-proposals/p/authorizations",
    "/api/execution/authorizations/a/requests",
    "/api/integrations/connections/c/account-identities/verify",
  ]) assert.equal(runGate(policy, "POST", path).res.body.feature, "execution");
});

test("AI endpoints follow the approved split policy", () => {
  const policy = createProductPolicy({ nodeEnv: "production" });
  assert.equal(runGate(policy, "POST", "/api/content/generate").nextCalled, true);
  assert.equal(runGate(policy, "POST", "/api/agent/run").res.body.feature, "experimental_ai");
  assert.equal(runGate(policy, "POST", "/api/ai/chat").res.body.feature, "experimental_ai");
  assert.equal(runGate(policy, "POST", "/api/business-brain/analyze").res.body.feature, "experimental_ai");
});

test("internal reads require an explicit internal entitlement", () => {
  const policy = createProductPolicy({ nodeEnv: "development" });
  assert.equal(runGate(policy, "GET", "/api/intelligence/recommendations").res.statusCode, 403);
  assert.equal(runGate(policy, "GET", "/api/intelligence/recommendations", { internal: true }).nextCalled, true);
  assert.equal(runGate(policy, "GET", "/api/database/status").res.statusCode, 403);
});

test("customer workspace roles do not grant internal access", () => {
  const middleware = createInternalAccessMiddleware({ token: "platform-secret", nodeEnv: "production" });
  const req = { headers: {}, membership: { role: "owner" } };
  middleware(req, {}, () => {});
  assert.equal(req.internalAccess, false);
});

test("provider and workflow defense-in-depth fails closed", () => {
  const policy = createProductPolicy({ nodeEnv: "production" });
  assert.throws(() => assertLegacyOperationEnabled(policy, "legacy_messaging"), (error) => error.code === "FEATURE_DISABLED");
  assert.throws(() => assertLegacyOperationEnabled(policy, "legacy_automation"), (error) => error.code === "FEATURE_DISABLED");
});

test("production configuration rejects development OTP exposure", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", importEnvironmentScript], {
    cwd: process.cwd(), encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production", AUTH_HASH_SECRET: "a-secure-production-secret-value", AUTH_EXPOSE_DEV_OTP: "true", CLIENT_ORIGINS: "https://app.loadder.example" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTH_EXPOSE_DEV_OTP must be disabled/);
  assert.doesNotMatch(result.stderr, /a-secure-production-secret-value/);
});

test("production configuration rejects demo seeding and unsafe origins", () => {
  for (const extra of [
    { LOADDER_SEED_DEMO_DATA: "true", CLIENT_ORIGINS: "https://app.loadder.example" },
    { CLIENT_ORIGINS: "*" },
    { CLIENT_ORIGINS: "http://app.loadder.example" },
  ]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", importEnvironmentScript], {
      cwd: process.cwd(), encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production", AUTH_HASH_SECRET: "valid-production-secret", AUTH_EXPOSE_DEV_OTP: "false", LOADDER_SEED_DEMO_DATA: "false", ...extra },
    });
    assert.notEqual(result.status, 0);
  }
});

test("production origin guard accepts exact origins and rejects foreign or missing origins", () => {
  const guard = createProductionOriginGuard({ nodeEnv: "production", clientOrigins: ["https://app.loadder.example"] });
  for (const origin of ["https://foreign.example", ""]) {
    const res = response(); let nextCalled = false;
    guard({ method: "POST", headers: { origin } }, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.body.code, "ORIGIN_NOT_ALLOWED");
  }
  const res = response(); let nextCalled = false;
  guard({ method: "POST", headers: { origin: "https://app.loadder.example" } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  const publicResponse = response(); let publicNext = false;
  guard({ method: "POST", path: "/api/public/landing/events", headers: {} }, publicResponse, () => { publicNext = true; });
  assert.equal(publicNext, true);
  const formResponse = response(); let formNext = false;
  guard({ method: "POST", path: "/api/public/forms/public-reference/submissions", headers: { origin: "https://publisher.example" } }, formResponse, () => { formNext = true; });
  assert.equal(formNext, true);
});

test("auth production response invariant remains code-free and readiness is provider-derived", () => {
  const source = readFileSync(new URL("../app/routes/auth.mjs", import.meta.url), "utf8");
  assert.match(source, /nodeEnv !== "production" && exposeDevelopmentOtp/);
  assert.match(source, /authService\.deliveryReadiness\(\)/);
  assert.match(source, /productionReady: delivery\.productionReady/);
  assert.doesNotMatch(source, /console\.(log|info|warn).*result\.code/);
});

test("frontend route policy exposes exactly the approved customer allowlist", () => {
  const source = readFileSync(new URL("../../src/lib/productPolicy.ts", import.meta.url), "utf8");
  for (const path of ["/", "/signup", "/dashboard", "/dashboard/content", "/dashboard/brand-book", "/dashboard/business-brain", "/dashboard/onboarding"]) assert.match(source, new RegExp(`"${path.replaceAll("/", "\\/")}"`));
  for (const path of ["/dashboard/social", "/dashboard/automation", "/dashboard/analytics"]) assert.doesNotMatch(source, new RegExp(path));
});

test("production navigation contains only truthful customer tools", () => {
  const dashboard = readFileSync(new URL("../../src/pages/DashboardPage.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /\/dashboard\/content/);
  assert.match(dashboard, /\/dashboard\/brand-book/);
  assert.match(dashboard, /\/dashboard\/business-brain/);
  assert.doesNotMatch(dashboard, /iportals\.ir|\/dashboard\/(social|ads|analytics|automation|predictive|kpi)/);
});

test("route classifier is deterministic and does not accept client feature keys", () => {
  assert.deepEqual(classifyApiRequest("POST", "/api/content/generate"), { feature: "content_studio", internal: false });
  assert.deepEqual(classifyApiRequest("POST", "/api/agent/run"), { feature: "experimental_ai", internal: true });
  assert.deepEqual(classifyApiRequest("GET", "/api/onboarding/status"), { feature: "business_setup", internal: false });
  assert.deepEqual(classifyApiRequest("POST", "/api/onboarding/finalize"), { feature: "business_setup", internal: false });
  assert.equal(classifyApiRequest("POST", "/api/client-selected-feature"), null);
});
