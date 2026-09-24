import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const testDir = mkdtempSync(join(tmpdir(), "loadder-payment-p1b-"));
process.env.DATABASE_PATH = join(testDir, "p1b.sqlite");
process.env.NODE_ENV = "test";

const [{ db }, { createAuthRouter }, { mountSiteBuilderControlPlane }, { runWithWorkspace }, { runMigrations }, { migrations }, { createPaymentAttemptService }, { createPaymentVerificationService }] = await Promise.all([
  import("../db/workspace-database.mjs"),
  import("../app/routes/auth.mjs"),
  import("../app/site-builder-control-plane.mjs"),
  import("../app/tenant-context.mjs"),
  import("../db/migrate.mjs"),
  import("../db/migrations/index.mjs"),
  import("../app/commerce/payment-attempt-service.mjs"),
  import("../app/commerce/payment-verification-service.mjs"),
]);
runMigrations(db, migrations);

const now = "2026-09-24T10:00:00.000Z";
const MERCHANT_ID = "1344b5d4-0048-11e8-94db-005056a205be";
for (const [store, ws] of [["store-a", "ws-a"], ["store-manual", "ws-a"]]) {
  db.prepare("INSERT OR IGNORE INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)").run(ws, ws, ws, now, now);
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

// ZarinPal stub. gateway.verify may return a body or throw (unreachable).
const realFetch = globalThis.fetch;
let authoritySeq = 0;
const gateway = { requests: [], verifies: [], verify: null };
globalThis.fetch = async (url, init) => {
  const href = String(url);
  if (!href.startsWith("https://sandbox.zarinpal.com/")) return realFetch(url, init);
  const body = JSON.parse(init.body);
  if (href.endsWith("/request.json")) { gateway.requests.push(body); return Response.json({ data: { code: 100, authority: `S${String(++authoritySeq).padStart(35, "0")}` }, errors: [] }); }
  gateway.verifies.push(body);
  return Response.json(gateway.verify(body));
};
const paidReply = (refId) => () => ({ data: { code: 100, ref_id: refId }, errors: [] });
const unpaidReply = () => ({ data: [], errors: { code: -51, message: "Session is not valid" } });
const unreachable = () => { throw new TypeError("fetch failed"); };

// Count customer SMS through the notifier's log line (messaging runs in simulator mode in tests).
const realInfo = console.info;
const smsLog = [];
console.info = (...args) => { if (String(args[0]).startsWith("Customer payment SMS")) smsLog.push(String(args[0])); return realInfo(...args); };
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use("/api", (req, res, next) => {
  req.membership = { role: "owner" };
  return req.get("x-test-workspace") ? runWithWorkspace(req.get("x-test-workspace"), next) : next();
});
app.use("/api/auth", createAuthRouter({ authService: {}, nodeEnv: "test", exposeDevelopmentOtp: false }));
mountSiteBuilderControlPlane({ app, db, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx" }, isStale: false }) }, basePath: "/api" });
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api`;
test.after(() => { server.close(); globalThis.fetch = realFetch; console.info = realInfo; });

let ipSeq = 0;
const call = async (method, path, body, headers = {}) => {
  const response = await fetch(`${base}${path}`, { method, redirect: "manual", headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${++ipSeq}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => ({})) };
};
async function checkout(store = "store-a") {
  const cart = await call("POST", `/auth/storefront/${store}/carts`, { currency: "IRT" });
  const cap = { "x-loadder-cart-capability": cart.body.cartCapability };
  await call("POST", `/auth/storefront/carts/${cart.body.cart.id}/items`, { variantId: `variant-${store}`, quantity: 1 }, cap);
  const done = await call("POST", `/auth/storefront/carts/${cart.body.cart.id}/checkout`, { fullName: "خریدار", phone: "09121112233", shippingAddress: { address: "تهران" } }, cap);
  return { orderId: done.body.order.id, receipt: done.body.receiptCapability };
}
const attempts = (orderId) => db.prepare("SELECT id,status,idempotency_key,provider_attempt_reference FROM ecommerce_payment_attempts WHERE order_id=? ORDER BY created_at,rowid").all(orderId);
const paymentStatus = (orderId) => db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id=?").get(orderId).payment_status;
const payAgain = (orderId, receipt) => call("POST", `/auth/storefront/orders/${orderId}/pay`, undefined, receipt === undefined ? {} : { "x-loadder-order-capability": receipt });
// Links older than the 15-minute in-flight window (updated_at = when the link was issued).
const age = (orderId) => db.prepare("UPDATE ecommerce_payment_attempts SET updated_at=? WHERE order_id=?").run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), orderId);
const callback = (a, status = "OK") => call("GET", `/auth/storefront/payments/${a.id}/callback?Authority=${a.provider_attempt_reference}&Status=${status}`);

test("retry after a cancelled payment starts a new attempt without re-verifying closed ones", async () => {
  const { orderId, receipt } = await checkout();
  await callback(attempts(orderId)[0], "NOK");
  const verifies = gateway.verifies.length;
  const retried = await payAgain(orderId, receipt);
  assert.equal(retried.status, 200);
  assert.equal(retried.body.result, "redirect");
  const [first, second] = attempts(orderId);
  assert.equal(first.status, "CANCELLED");
  assert.deepEqual({ status: second.status, key: second.idempotency_key }, { status: "REDIRECT_READY", key: `retry:${orderId}:1` });
  assert.equal(retried.body.redirectUrl, `https://sandbox.zarinpal.com/pg/StartPay/${second.provider_attempt_reference}`);
  assert.equal(gateway.verifies.length, verifies);
  assert.equal(paymentStatus(orderId), "UNPAID");
});

test("double-charge guard: an earlier attempt that was actually paid settles instead of charging again", async () => {
  const { orderId, receipt } = await checkout(); // customer paid but never came back
  age(orderId);
  gateway.verify = paidReply(700001);
  const requests = gateway.requests.length;
  const retried = await payAgain(orderId, receipt);
  assert.deepEqual(retried.body, { success: true, result: "paid" });
  assert.equal(gateway.requests.length, requests, "no new gateway payment request");
  assert.equal(attempts(orderId).length, 1);
  assert.equal(paymentStatus(orderId), "PAID");
  assert.deepEqual((await payAgain(orderId, receipt)).body, { success: true, result: "paid" });
});

test("double-charge guard: unknown outcome of an open attempt refuses a second charge", async () => {
  const { orderId, receipt } = await checkout();
  age(orderId);
  gateway.verify = unreachable;
  const requests = gateway.requests.length;
  const refused = await payAgain(orderId, receipt);
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "PAYMENT_IN_PROGRESS");
  assert.equal(gateway.requests.length, requests);
  assert.deepEqual(attempts(orderId).map((a) => a.status), ["REDIRECT_READY"]);
});

test("open attempt the gateway confirms unpaid is closed, then a new attempt is started", async () => {
  const { orderId, receipt } = await checkout();
  age(orderId);
  gateway.verify = unpaidReply;
  const retried = await payAgain(orderId, receipt);
  assert.equal(retried.body.result, "redirect");
  assert.deepEqual(attempts(orderId).map((a) => a.status), ["FAILED", "REDIRECT_READY"]);
});

test("a link issued moments ago is never verified or superseded (customer may be paying it)", async () => {
  const { orderId, receipt } = await checkout();
  gateway.verify = unpaidReply; // gateway says "unpaid" until the customer finishes
  const verifies = gateway.verifies.length, requests = gateway.requests.length;
  const refused = await payAgain(orderId, receipt);
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "PAYMENT_IN_PROGRESS");
  assert.equal(gateway.verifies.length, verifies);
  assert.equal(gateway.requests.length, requests);
  assert.deepEqual(attempts(orderId).map((a) => a.status), ["REDIRECT_READY"]);
});

test("concurrent retries: exactly one new charge", async () => {
  const { orderId, receipt } = await checkout();
  await callback(attempts(orderId)[0], "NOK");
  const results = await Promise.all([payAgain(orderId, receipt), payAgain(orderId, receipt)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(attempts(orderId).filter((a) => a.status === "REDIRECT_READY").length, 1);
});

test("retry needs the receipt capability and an online gateway", async () => {
  const { orderId } = await checkout();
  assert.equal((await payAgain(orderId)).status, 404);
  assert.equal((await payAgain(orderId, "not-the-receipt-capability-000000000000000")).status, 404);
  const manual = await checkout("store-manual");
  const refused = await payAgain(manual.orderId, manual.receipt);
  assert.equal(refused.status, 422);
  assert.equal(refused.body.code, "PAYMENT_PROVIDER_UNAVAILABLE");
});

test("customer SMS: exactly once per real settlement, across concurrent callbacks and reconcile", async () => {
  const { orderId } = await checkout();
  const [attempt] = attempts(orderId);
  gateway.verify = paidReply(700002);
  const before = smsLog.length;
  const [a, b] = await Promise.all([callback(attempt), callback(attempt)]);
  assert.equal(a.status, 303);
  assert.equal(b.status, 303);
  const reconciled = await call("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`, {}, { "x-test-workspace": "ws-a" });
  assert.equal(reconciled.body.result, "paid");
  await flush();
  assert.equal(paymentStatus(orderId), "PAID");
  assert.deepEqual(smsLog.slice(before), [`Customer payment SMS simulated for order ${orderId}.`]);
});

test("no SMS on failed or cancelled payments; merchant reconcile that settles also notifies", async () => {
  const cancelled = await checkout();
  await callback(attempts(cancelled.orderId)[0], "NOK");
  const failed = await checkout();
  gateway.verify = unpaidReply;
  await callback(attempts(failed.orderId)[0]);
  await flush();
  assert.equal(smsLog.filter((l) => l.includes(cancelled.orderId) || l.includes(failed.orderId)).length, 0);

  const abandoned = await checkout();
  gateway.verify = paidReply(700003);
  await call("POST", `/commerce/payment-attempts/${attempts(abandoned.orderId)[0].id}/reconcile`, {}, { "x-test-workspace": "ws-a" });
  await flush();
  assert.equal(smsLog.filter((l) => l.includes(abandoned.orderId)).length, 1);
});

test("a failing SMS hook never affects settlement", async () => {
  const { orderId } = await checkout();
  const [attempt] = attempts(orderId);
  const errors = [];
  const paymentAttemptService = createPaymentAttemptService({ db });
  const service = createPaymentVerificationService({ db, paymentAttemptService, onSettled: () => { throw new Error("SMS provider down"); }, logger: { error: (...args) => errors.push(args[0]) } });
  gateway.verify = paidReply(700004);
  const outcome = await runWithWorkspace("ws-a", () => service.verifyAndSettle(attempt.id));
  await flush();
  assert.equal(outcome.result, "paid");
  assert.equal(paymentStatus(orderId), "PAID");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Post-settlement hook failed/);
});
