import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const testDir = mkdtempSync(join(tmpdir(), "loadder-payment-p1a-"));
process.env.DATABASE_PATH = join(testDir, "p1a.sqlite");
process.env.NODE_ENV = "test";

const [{ db }, { createAuthRouter }, { mountSiteBuilderControlPlane }, { runWithWorkspace }, { runMigrations }, { migrations }, { parseTrustProxy }] = await Promise.all([
  import("../db/workspace-database.mjs"),
  import("../app/routes/auth.mjs"),
  import("../app/site-builder-control-plane.mjs"),
  import("../app/tenant-context.mjs"),
  import("../db/migrate.mjs"),
  import("../db/migrations/index.mjs"),
  import("../app/config/environment.mjs"),
]);
runMigrations(db, migrations);

const now = "2026-09-24T10:00:00.000Z";
const MERCHANT_ID = "1344b5d4-0048-11e8-94db-005056a205be";
for (const [store, ws] of [["store-a", "ws-a"], ["store-b", "ws-b"]]) {
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)").run(ws, ws, ws, now, now);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,published_at,created_at,updated_at) VALUES(?,?,?,'STORE',?,'PUBLISHED',?,?,?,?)")
    .run(store, ws, store, store, JSON.stringify({ storeBuilderV16: { version: 16 } }), now, now, now);
  db.prepare("INSERT INTO site_publish_versions(id,workspace_id,site_project_id,version,content_json,manifest_json,published_at,created_at) VALUES(?,?,?,1,?,'{}',?,?)")
    .run(`version-${store}`, ws, store, JSON.stringify({ storeBuilderV16: { version: 16 } }), now, now);
  db.prepare("INSERT INTO ecommerce_products(id,workspace_id,site_project_id,name,slug,status,currency,base_price_minor,metadata_json,created_at,updated_at) VALUES(?,?,?,'P',?,'ACTIVE','IRT',250000,'{}',?,?)")
    .run(`product-${store}`, ws, store, `product-${store}`, now, now);
  db.prepare("INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,image_url,active,created_at,updated_at) VALUES(?,?,?,?,'Default',250000,100,'DENY','{}',NULL,1,?,?)")
    .run(`variant-${store}`, ws, `product-${store}`, `SKU-${store}`, now, now);
}
db.prepare("INSERT INTO ecommerce_payment_providers(id,workspace_id,site_project_id,provider_key,status,config_json,credential_reference,created_at,updated_at) VALUES('zp-a','ws-a','store-a','ZARINPAL','CONNECTED',?,?,?,?)")
  .run(JSON.stringify({ sandbox: true }), MERCHANT_ID, now, now);

// Stub ZarinPal only. gateway.verify may return a JSON body, a Response, or throw (network/timeout).
const realFetch = globalThis.fetch;
let authoritySeq = 0;
const gateway = { requests: [], verifies: [], verify: null };
globalThis.fetch = async (url, init) => {
  const href = String(url);
  if (!href.startsWith("https://sandbox.zarinpal.com/")) return realFetch(url, init);
  const body = JSON.parse(init.body);
  if (href.endsWith("/request.json")) { gateway.requests.push(body); return Response.json({ data: { code: 100, authority: `S${String(++authoritySeq).padStart(35, "0")}` }, errors: [] }); }
  gateway.verifies.push(body);
  const reply = gateway.verify(body);
  return reply instanceof Response ? reply : Response.json(reply);
};

const paid = (refId) => () => ({ data: { code: 100, ref_id: refId }, errors: [] });
const rejected = () => ({ data: [], errors: { code: -51, message: "Session is not valid" } });

function buildApp(trustProxy) {
  const app = express();
  if (trustProxy) app.set("trust proxy", trustProxy); // same line as server/index.mjs
  app.use(express.json());
  // Stand-in for the real auth/workspace/membership middleware.
  app.use("/api", (req, res, next) => {
    req.membership = { role: req.get("x-test-role") || "owner" };
    return req.get("x-test-workspace") ? runWithWorkspace(req.get("x-test-workspace"), next) : next();
  });
  app.use("/api/auth", createAuthRouter({ authService: {}, nodeEnv: "test", exposeDevelopmentOtp: false }));
  mountSiteBuilderControlPlane({ app, db, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx" }, isStale: false }) }, basePath: "/api" });
  return app;
}
async function listen(app) { const server = app.listen(0, "127.0.0.1"); await once(server, "listening"); return server; }
const trusted = await listen(buildApp(parseTrustProxy("1")));
const untrusted = await listen(buildApp(parseTrustProxy(undefined)));
const baseOf = (server) => `http://127.0.0.1:${server.address().port}/api`;
const base = baseOf(trusted);
test.after(() => { trusted.close(); untrusted.close(); globalThis.fetch = realFetch; });

let ipSeq = 0;
const call = async (method, url, body, headers = {}) => {
  const response = await fetch(url, { method, redirect: "manual", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipSeq}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, headers: response.headers, body: await response.text().then((t) => { try { return JSON.parse(t); } catch { return t; } }) };
};
async function checkout(apiBase = base, headers = {}) {
  const cart = await call("POST", `${apiBase}/auth/storefront/store-a/carts`, { currency: "IRT" }, headers);
  const cap = { ...headers, "x-loadder-cart-capability": cart.body.cartCapability };
  await call("POST", `${apiBase}/auth/storefront/carts/${cart.body.cart.id}/items`, { variantId: "variant-store-a", quantity: 1 }, cap);
  const done = await call("POST", `${apiBase}/auth/storefront/carts/${cart.body.cart.id}/checkout`, { fullName: "خریدار", phone: "09120000000", shippingAddress: { address: "تهران" } }, cap);
  const attempt = db.prepare("SELECT * FROM ecommerce_payment_attempts WHERE order_id=?").get(done.body.order.id);
  assert.equal(attempt.status, "REDIRECT_READY");
  return { orderId: done.body.order.id, attempt };
}
const callback = (attempt, status = "OK") => call("GET", `${base}/auth/storefront/payments/${attempt.id}/callback?Authority=${attempt.provider_attempt_reference}&Status=${status}`);
const merchant = (method, path, { ws = "ws-a", role = "owner" } = {}) => call(method, `${base}${path}`, method === "POST" ? {} : undefined, { "x-test-workspace": ws, "x-test-role": role });
const attemptStatus = (id) => db.prepare("SELECT status,verification_code FROM ecommerce_payment_attempts WHERE id=?").get(id);
const paymentStatus = (orderId) => db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id=?").get(orderId).payment_status;
const location = (r) => r.headers.get("location");

test("verify timeout / unreachable gateway: customer sent to pending, attempt untouched", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); };
  const back = await callback(attempt);
  assert.equal(back.status, 303);
  assert.equal(location(back), `/store/store-a/order-success/${orderId}?payment=pending`);
  assert.equal(attemptStatus(attempt.id).status, "REDIRECT_READY");
  assert.equal(paymentStatus(orderId), "UNPAID");

  // A 5xx/HTML reply carries no ZarinPal code: also pending, never FAILED.
  gateway.verify = () => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } });
  assert.equal(location(await callback(attempt)), `/store/store-a/order-success/${orderId}?payment=pending`);
  assert.equal(attemptStatus(attempt.id).status, "REDIRECT_READY");
});

test("verify reject: attempt FAILED with the gateway code, order UNPAID", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = rejected;
  const back = await callback(attempt);
  assert.equal(location(back), `/store/store-a/order-success/${orderId}?payment=failed`);
  assert.deepEqual(attemptStatus(attempt.id), { status: "FAILED", verification_code: "GATEWAY_VERIFY_-51" });
  assert.equal(paymentStatus(orderId), "UNPAID");
});

test("callback never answers the customer with JSON", async () => {
  const unknown = await call("GET", `${base}/auth/storefront/payments/pay_attempt_missing/callback?Authority=x&Status=OK`);
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("content-type"), /text\/html/);

  // Status=NOK on a verified-but-unsettled attempt must not cancel it.
  const { orderId, attempt } = await checkout();
  runWithWorkspace("ws-a", () => db.prepare("UPDATE ecommerce_payment_attempts SET status='RECONCILIATION_REQUIRED' WHERE id=?").run(attempt.id));
  assert.equal(location(await callback(attempt, "NOK")), `/store/store-a/order-success/${orderId}?payment=pending`);
  assert.equal(attemptStatus(attempt.id).status, "RECONCILIATION_REQUIRED");
});

test("merchant reconcile of an abandoned attempt the gateway says was paid -> PAID, idempotent", async () => {
  const { orderId, attempt } = await checkout(); // customer never came back
  gateway.verify = paid(555001);
  const listed = await merchant("GET", `/commerce/orders/${orderId}/payment-attempts`);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.attempts.map((a) => [a.id, a.status]), [[attempt.id, "REDIRECT_READY"]]);
  assert.equal(JSON.stringify(listed.body).includes(MERCHANT_ID), false);

  const reconciled = await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`);
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.body.result, "paid");
  assert.equal(reconciled.body.attempt.status, "SUCCEEDED");
  assert.equal(paymentStatus(orderId), "PAID");
  const verifies = gateway.verifies.length;
  assert.equal((await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`)).body.result, "paid");
  assert.equal(gateway.verifies.length, verifies);
});

test("merchant reconcile of an attempt the gateway rejects -> FAILED", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = rejected;
  const reconciled = await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`);
  assert.equal(reconciled.body.result, "failed");
  assert.equal(attemptStatus(attempt.id).status, "FAILED");
  assert.equal(paymentStatus(orderId), "UNPAID");
});

test("workspace isolation: another workspace cannot list or reconcile", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = paid(555002);
  assert.equal((await merchant("GET", `/commerce/orders/${orderId}/payment-attempts`, { ws: "ws-b" })).status, 404);
  assert.equal((await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`, { ws: "ws-b" })).status, 404);
  assert.equal(attemptStatus(attempt.id).status, "REDIRECT_READY");
});

test("permission guard: non owner/admin gets 403, same as refunds", async () => {
  const { orderId, attempt } = await checkout();
  for (const [method, path] of [["GET", `/commerce/orders/${orderId}/payment-attempts`], ["POST", `/commerce/payment-attempts/${attempt.id}/reconcile`], ["GET", `/commerce/orders/${orderId}/refunds`]]) {
    const denied = await merchant(method, path, { role: "member" });
    assert.equal(denied.status, 403, path);
    assert.equal(denied.body.code, "FINANCIAL_ADMIN_REQUIRED");
  }
  assert.equal(attemptStatus(attempt.id).status, "REDIRECT_READY");
});

test("TRUST_PROXY: https callback URL behind TLS termination; untrusted proxy headers ignored", async () => {
  await checkout(base, { "x-forwarded-proto": "https" });
  assert.match(gateway.requests.at(-1).callback_url, /^https:\/\/127\.0\.0\.1:\d+\/api\/auth\/storefront\/payments\/pay_attempt_[\w-]+\/callback$/);
  await checkout(baseOf(untrusted), { "x-forwarded-proto": "https" });
  assert.match(gateway.requests.at(-1).callback_url, /^http:\/\//);

  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy(""), false);
  assert.equal(parseTrustProxy("0"), false);
  assert.equal(parseTrustProxy("2"), 2);
  for (const unsafe of ["true", "*", "loopback", "11", "-1", "1.5"]) assert.throws(() => parseTrustProxy(unsafe), /TRUST_PROXY/, unsafe);
});
