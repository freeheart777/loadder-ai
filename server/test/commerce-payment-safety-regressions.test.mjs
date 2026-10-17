import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const testDir = mkdtempSync(join(tmpdir(), "loadder-payment-safety-"));
process.env.DATABASE_PATH = join(testDir, "safety.sqlite");
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
db.prepare("INSERT INTO ecommerce_coupons(id,workspace_id,site_project_id,code,discount_type,discount_value,active,usage_count,created_at,updated_at) VALUES('coupon-a','ws-a','store-a','SAVE10','PERCENT',10,1,0,?,?)").run(now, now);
let variantSeq = 0;
// Fresh variant per test so stock assertions never depend on test order.
function addVariant(stock) {
  const id = `variant-t${++variantSeq}`;
  db.prepare("INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,image_url,active,created_at,updated_at) VALUES(?,'ws-a','product-store-a',?,'Default',250000,?,'DENY','{}',NULL,1,?,?)").run(id, `SKU-${id}`, stock, now, now);
  return id;
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
const rejectedWith = (code) => () => ({ data: [], errors: { code, message: "rejected" } });

function buildApp() {
  const app = express();
  app.set("trust proxy", 1); // distinct x-forwarded-for per call keeps the checkout rate limiter out of the way
  app.use(express.json());
  // Stand-in for the real auth/workspace/membership middleware (same as the P1a suite).
  app.use("/api", (req, res, next) => {
    req.membership = { role: req.get("x-test-role") || "owner" };
    return req.get("x-test-workspace") ? runWithWorkspace(req.get("x-test-workspace"), next) : next();
  });
  app.use("/api/auth", createAuthRouter({ authService: {}, nodeEnv: "test", exposeDevelopmentOtp: false }));
  mountSiteBuilderControlPlane({ app, db, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx" }, isStale: false }) }, basePath: "/api" });
  return app;
}
const server = buildApp().listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api`;
test.after(() => { server.close(); globalThis.fetch = realFetch; });

let ipSeq = 100;
const call = async (method, url, body, headers = {}) => {
  const response = await fetch(url, { method, redirect: "manual", headers: { "content-type": "application/json", "x-forwarded-for": `10.1.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, headers: response.headers, body: await response.text().then((t) => { try { return JSON.parse(t); } catch { return t; } }) };
};
async function newCart(variantId, quantity, coupon) {
  const cart = await call("POST", `${base}/auth/storefront/store-a/carts`, { currency: "IRT" });
  const cap = { "x-loadder-cart-capability": cart.body.cartCapability };
  const added = await call("POST", `${base}/auth/storefront/carts/${cart.body.cart.id}/items`, { variantId, quantity }, cap);
  assert.equal(added.status, 201);
  if (coupon) assert.equal((await call("POST", `${base}/auth/storefront/carts/${cart.body.cart.id}/coupon`, { code: coupon }, cap)).status, 200);
  return { id: cart.body.cart.id, cap };
}
const submit = (cart) => call("POST", `${base}/auth/storefront/carts/${cart.id}/checkout`, { fullName: "خریدار", phone: "09120000000", shippingAddress: { address: "تهران" } }, cart.cap);
async function checkout({ variantId = addVariant(100), quantity = 1, coupon } = {}) {
  const done = await submit(await newCart(variantId, quantity, coupon));
  assert.equal(done.status, 201);
  const attempt = attemptFor(done.body.order.id);
  assert.equal(attempt.status, "REDIRECT_READY");
  return { orderId: done.body.order.id, attempt, variantId };
}
const callback = (attempt, status = "OK", authority = attempt.provider_attempt_reference) =>
  call("GET", `${base}/auth/storefront/payments/${attempt.id}/callback?Authority=${authority}&Status=${status}`);
const merchant = (method, path, body, role = "owner") => call(method, `${base}${path}`, body, { "x-test-workspace": "ws-a", "x-test-role": role });
const attemptFor = (orderId) => db.prepare("SELECT * FROM ecommerce_payment_attempts WHERE order_id=? ORDER BY created_at DESC,id DESC").get(orderId);
const attemptsFor = (orderId) => db.prepare("SELECT * FROM ecommerce_payment_attempts WHERE order_id=?").all(orderId);
const attemptStatus = (id) => db.prepare("SELECT status,verification_code FROM ecommerce_payment_attempts WHERE id=?").get(id);
const order = (id) => db.prepare("SELECT status,payment_status,payment_reference FROM ecommerce_orders WHERE id=?").get(id);
const stock = (variantId) => db.prepare("SELECT inventory_quantity AS q FROM ecommerce_variants WHERE id=?").get(variantId).q;
const couponUses = () => db.prepare("SELECT usage_count AS n FROM ecommerce_coupons WHERE id='coupon-a'").get().n;
const location = (r) => r.headers.get("location");
const verifiesBefore = () => gateway.verifies.length;

// Convention for confirmed defects (Part 4A): the "KNOWN DEFECT" test pins what the code does TODAY and
// passes; the paired `todo` test states the safe behaviour and is expected to fail until a fix lands.
// Neither is weakened to hide the defect. A todo test that starts passing means the defect was fixed.

// ---------------------------------------------------------------- 1. D3: unverified NOK callback (FIXED in 4C-1)
test("D3 fixed: Status=NOK never cancels or verifies; the attempt stays open and the customer sees 'pending'", async () => {
  const { orderId, attempt } = await checkout();
  const before = verifiesBefore();
  gateway.verify = paid(700001);
  const back = await callback(attempt, "NOK");
  assert.equal(location(back), `/store/store-a/order-success/${orderId}?payment=pending`);
  assert.equal(verifiesBefore(), before, "the browser's NOK triggers no gateway call");
  assert.equal(attemptStatus(attempt.id).status, "REDIRECT_READY");
  assert.equal(order(orderId).payment_status, "UNPAID");
});

test("D3 fixed: a NOK followed by a genuinely paid transaction still settles (callback OK, or merchant reconcile)", async () => {
  const viaCallback = await checkout();
  await callback(viaCallback.attempt, "NOK");
  gateway.verify = paid(700002);
  assert.equal(location(await callback(viaCallback.attempt, "OK")), `/store/store-a/order-success/${viaCallback.orderId}?payment=paid`);
  assert.equal(order(viaCallback.orderId).payment_status, "PAID");

  const viaReconcile = await checkout();
  await callback(viaReconcile.attempt, "NOK");
  gateway.verify = paid(700003);
  assert.equal((await merchant("POST", `/commerce/payment-attempts/${viaReconcile.attempt.id}/reconcile`, {})).body.result, "paid");
  assert.equal(order(viaReconcile.orderId).payment_status, "PAID");
});

test("D3 fixed: after a NOK the customer cannot open a second charge while the first may be paid", async () => {
  const { orderId, attempt } = await checkout();
  await callback(attempt, "NOK");
  const headers = await receiptHeaders(orderId);
  const pay = () => call("POST", `${base}/auth/storefront/orders/${orderId}/pay`, {}, headers);
  // Inside the in-flight window: refused outright.
  const requests = gateway.requests.length;
  const early = await pay();
  assert.equal(early.status, 409);
  assert.equal(early.body.code, "PAYMENT_IN_PROGRESS");
  // After the window, with the gateway saying it WAS paid: settled, no second attempt, no new gateway request.
  db.prepare("UPDATE ecommerce_payment_attempts SET updated_at=? WHERE order_id=?").run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), orderId);
  gateway.verify = paid(700004);
  const late = await pay();
  assert.equal(late.body.result, "paid");
  assert.equal(attemptsFor(orderId).length, 1);
  assert.equal(gateway.requests.length, requests);
  assert.equal(order(orderId).payment_status, "PAID");
});

test("D3 fixed: a NOK that gets no answer from a real cancel is closed later by retry once the gateway confirms unpaid", async () => {
  const { orderId, attempt } = await checkout();
  await callback(attempt, "NOK");
  db.prepare("UPDATE ecommerce_payment_attempts SET updated_at=? WHERE order_id=?").run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), orderId);
  gateway.verify = rejectedWith(-51);
  const retry = await call("POST", `${base}/auth/storefront/orders/${orderId}/pay`, {}, await receiptHeaders(orderId));
  assert.equal(retry.body.result, "redirect");
  assert.deepEqual(attemptsFor(orderId).map((a) => a.status).sort(), ["FAILED", "REDIRECT_READY"]);
});

test("NOK on an attempt that is already verified-but-unsettled or settled changes nothing", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = paid(700005);
  await callback(attempt, "OK");
  const before = verifiesBefore();
  assert.equal(location(await callback(attempt, "NOK")), `/store/store-a/order-success/${orderId}?payment=paid`);
  assert.equal(verifiesBefore(), before);
  assert.equal(attemptStatus(attempt.id).status, "SUCCEEDED");
});

// The order receipt capability is only returned once at checkout; mint a known one for tests that need /pay.
async function receiptHeaders(orderId) {
  const { createPublicCapability } = await import("../app/services/public-commerce-capability.mjs");
  const cap = createPublicCapability();
  db.prepare("UPDATE ecommerce_orders SET receipt_capability_hash=? WHERE id=?").run(cap.hash, orderId);
  return { "x-loadder-order-capability": cap.value };
}

// ---------------------------------------------------------------- 2. R1: verification failure classes
// ZarinPal errorList (zarinpal.com/docs/paymentGateway/errorList): 100 success, 101 already verified, -51 "session is not
// active paid try" (the only verify code trusted as definitively unpaid). The page labels no code final/retryable except
// -12 "try again later", so every other code is treated as AMBIGUOUS and must stay recoverable. Codes are opaque numbers here.
const AMBIGUOUS_CODES = [-50, -52, -53, -54, -55, -12, -9, -10, -11, -1, 0, 7, 12345, -987654];

test("R1 fixed: definitive rejection (-51) fails the attempt; the order stays UNPAID", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = rejectedWith(-51);
  assert.equal(location(await callback(attempt, "OK")), `/store/store-a/order-success/${orderId}?payment=failed`);
  assert.deepEqual(attemptStatus(attempt.id), { status: "FAILED", verification_code: "GATEWAY_VERIFY_-51" });
  assert.equal(order(orderId).payment_status, "UNPAID");
});

test("R1 fixed: every other gateway code is ambiguous -> RECONCILIATION_REQUIRED, never terminal, never PAID", async () => {
  for (const code of AMBIGUOUS_CODES) {
    const { orderId, attempt } = await checkout();
    gateway.verify = rejectedWith(code);
    assert.equal(location(await callback(attempt, "OK")), `/store/store-a/order-success/${orderId}?payment=pending`, `code ${code}`);
    assert.deepEqual(attemptStatus(attempt.id), { status: "RECONCILIATION_REQUIRED", verification_code: `GATEWAY_VERIFY_AMBIGUOUS_${code}` }, `code ${code}`);
    assert.equal(order(orderId).payment_status, "UNPAID");
  }
});

test("R1 fixed: malformed answers (success code without ref_id, code 101 without ref_id, string code) are ambiguous", async () => {
  for (const reply of [{ data: { code: 100 }, errors: [] }, { data: { code: 101 }, errors: [] }, { data: [], errors: { code: "-51" } }]) {
    const { attempt } = await checkout();
    gateway.verify = () => reply;
    await callback(attempt, "OK");
    assert.equal(attemptStatus(attempt.id).status, "RECONCILIATION_REQUIRED", JSON.stringify(reply));
  }
});

test("R1: network failure / HTTP 5xx / empty answer leave the attempt exactly as it was (REDIRECT_READY)", async () => {
  for (const reply of [() => { throw new Error("timeout"); }, () => new Response("oops", { status: 504 }), () => ({})]) {
    const { attempt } = await checkout();
    gateway.verify = reply;
    await callback(attempt, "OK");
    assert.equal(attemptStatus(attempt.id).status, "REDIRECT_READY");
  }
});

test("R1 fixed: an ambiguous answer is recoverable -- merchant reconcile settles it once the gateway confirms payment", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = rejectedWith(-52);
  await callback(attempt, "OK");
  gateway.verify = paid(730001);
  const reconcile = await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`, {});
  assert.equal(reconcile.body.result, "paid");
  assert.deepEqual(order(orderId), { status: "PENDING", payment_status: "PAID", payment_reference: "730001" });
  assert.equal(attemptStatus(attempt.id).status, "SUCCEEDED");
});

test("R1 fixed: ambiguous then a later callback/reconcile showing payment settles exactly once", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = rejectedWith(-54);
  await callback(attempt, "OK");
  gateway.verify = paid(730002);
  assert.equal(location(await callback(attempt, "OK")), `/store/store-a/order-success/${orderId}?payment=paid`);
  const before = verifiesBefore();
  assert.equal(location(await callback(attempt, "OK")), `/store/store-a/order-success/${orderId}?payment=paid`); // replay
  assert.equal((await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`, {})).body.result, "paid"); // repeat reconcile
  assert.equal(verifiesBefore(), before, "settled attempts are not re-verified");
  assert.equal(order(orderId).payment_reference, "730002");
});

test("R1 fixed: ambiguous then a definitive -51 closes the attempt on reconcile", async () => {
  const { attempt } = await checkout();
  gateway.verify = rejectedWith(-52);
  await callback(attempt, "OK");
  gateway.verify = rejectedWith(-51);
  assert.equal((await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`, {})).body.result, "failed");
  assert.equal(attemptStatus(attempt.id).status, "FAILED");
});

test("R1 fixed: retry during uncertainty never opens a second charge (and verifies the open attempt first)", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = rejectedWith(-52);
  await callback(attempt, "OK");
  const headers = await receiptHeaders(orderId);
  const requests = gateway.requests.length;
  const refused = await call("POST", `${base}/auth/storefront/orders/${orderId}/pay`, {}, headers);
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "PAYMENT_IN_PROGRESS");
  assert.equal(gateway.requests.length, requests, "no new gateway payment request");
  assert.equal(attemptsFor(orderId).length, 1);
  // The same retry, once the gateway now confirms the money, settles instead of charging again.
  gateway.verify = paid(730003);
  const settled = await call("POST", `${base}/auth/storefront/orders/${orderId}/pay`, {}, headers);
  assert.equal(settled.body.result, "paid");
  assert.equal(attemptsFor(orderId).length, 1);
  assert.equal(order(orderId).payment_status, "PAID");
});

test("R1 fixed: repeated ambiguous callbacks stay idempotent (one attempt, still open, no settlement)", async () => {
  const { orderId, attempt } = await checkout();
  gateway.verify = rejectedWith(-52);
  for (let i = 0; i < 3; i++) assert.equal(location(await callback(attempt, "OK")), `/store/store-a/order-success/${orderId}?payment=pending`);
  assert.equal(attemptsFor(orderId).length, 1);
  assert.equal(attemptStatus(attempt.id).status, "RECONCILIATION_REQUIRED");
  assert.equal(order(orderId).payment_status, "UNPAID");
});

test("R1 + D3: NOK then an ambiguous answer then a paid answer still ends PAID", async () => {
  const { orderId, attempt } = await checkout();
  await callback(attempt, "NOK");
  gateway.verify = rejectedWith(-52);
  await callback(attempt, "OK");
  gateway.verify = paid(730004);
  assert.equal((await merchant("POST", `/commerce/payment-attempts/${attempt.id}/reconcile`, {})).body.result, "paid");
  assert.equal(order(orderId).payment_status, "PAID");
});

test("R1: a transaction id already used by another attempt cannot settle a second one (settlement conflict stays recoverable)", async () => {
  const first = await checkout(), second = await checkout();
  gateway.verify = paid(730005);
  await callback(first.attempt, "OK");
  await callback(second.attempt, "OK"); // same gateway ref_id for a different attempt
  assert.equal(order(first.orderId).payment_status, "PAID");
  assert.equal(order(second.orderId).payment_status, "UNPAID");
  assert.equal(attemptStatus(second.attempt.id).status, "RECONCILIATION_REQUIRED");
});

// ---------------------------------------------------------------- 3. D1: inventory and coupon lifecycle
test("D1 baseline: checkout deducts stock and consumes a coupon use before any payment", async () => {
  const useBefore = couponUses();
  const { orderId, variantId } = await checkout({ quantity: 3, coupon: "SAVE10" });
  assert.equal(stock(variantId), 97);
  assert.equal(couponUses(), useBefore + 1);
  assert.deepEqual(order(orderId), { status: "PENDING", payment_status: "UNPAID", payment_reference: null });
});

test("KNOWN DEFECT D1: cancelled, failed and abandoned online payments keep the stock and the coupon use", async () => {
  const useBefore = couponUses();
  const cancelled = await checkout({ quantity: 2, coupon: "SAVE10" });
  db.prepare("UPDATE ecommerce_payment_attempts SET status='CANCELLED',terminal_at=? WHERE id=?").run(now, cancelled.attempt.id); // closed by a future/other path; NOK no longer does this
  const failed = await checkout({ quantity: 2, coupon: "SAVE10" });
  gateway.verify = rejectedWith(-51);
  await callback(failed.attempt, "OK");
  const abandoned = await checkout({ quantity: 2, coupon: "SAVE10" }); // customer never returns
  for (const { orderId, attempt, variantId } of [cancelled, failed, abandoned]) {
    assert.equal(stock(variantId), 98, `${attempt.status}: stock stays deducted`);
    assert.deepEqual(order(orderId), { status: "PENDING", payment_status: "UNPAID", payment_reference: null });
  }
  assert.equal(couponUses(), useBefore + 3, "coupon uses are never released");
  assert.deepEqual([cancelled, failed, abandoned].map((x) => attemptStatus(x.attempt.id).status), ["CANCELLED", "FAILED", "REDIRECT_READY"]);
});

test("KNOWN DEFECT D1: cancelling the order through the status API does not restock or release the coupon", async () => {
  const useBefore = couponUses();
  const { orderId, variantId } = await checkout({ quantity: 2, coupon: "SAVE10" });
  const res = await merchant("PATCH", `/commerce/orders/${orderId}/status`, { status: "CANCELLED" });
  assert.equal(res.status, 200);
  assert.equal(order(orderId).status, "CANCELLED");
  assert.equal(stock(variantId), 98);
  assert.equal(couponUses(), useBefore + 1);
});

test("D1 desired: stock is returned when an online payment attempt definitively fails", { todo: "D1: no release path exists; design decision (attempt outcome vs. unpaid-order expiry) required" }, async () => {
  const { attempt, variantId } = await checkout({ quantity: 2 });
  gateway.verify = rejectedWith(-51);
  await callback(attempt, "OK"); // gateway-verified failure closes the attempt
  assert.equal(attemptStatus(attempt.id).status, "FAILED");
  assert.equal(stock(variantId), 100);
});

// ---------------------------------------------------------------- 4. D2: order status authorization
async function paidOrder() {
  const placed = await checkout({ quantity: 1 });
  gateway.verify = paid(710000 + variantSeq);
  await callback(placed.attempt, "OK");
  assert.equal(order(placed.orderId).payment_status, "PAID");
  return placed;
}

test("HELD: payment/refund fields cannot be written through the order status API, for any role", async () => {
  const { orderId } = await checkout();
  for (const body of [{ paymentStatus: "PAID" }, { paymentReference: "x" }, { paymentProvider: "ZARINPAL" }, { status: "REFUNDED" }]) {
    for (const role of ["owner", "member"]) {
      const res = await merchant("PATCH", `/commerce/orders/${orderId}/status`, body, role);
      assert.equal(res.status, 409, JSON.stringify(body));
      assert.equal(res.body.code, "FINANCIAL_STATE_AUTHORITY_REQUIRED");
    }
  }
  assert.equal(order(orderId).payment_status, "UNPAID");
});

test("HELD: an unknown order status is refused and changes nothing", async () => {
  const { orderId } = await checkout();
  const res = await merchant("PATCH", `/commerce/orders/${orderId}/status`, { status: "BOGUS" });
  assert.notEqual(res.status, 200);
  assert.equal(order(orderId).status, "PENDING");
});

test("KNOWN DEFECT D2: a plain 'member' can change order status (no financial-admin guard), including cancelling a PAID order", async () => {
  const { orderId, variantId } = await paidOrder();
  const res = await merchant("PATCH", `/commerce/orders/${orderId}/status`, { status: "CANCELLED" }, "member");
  assert.equal(res.status, 200);
  assert.deepEqual(order(orderId), { status: "CANCELLED", payment_status: "PAID", payment_reference: order(orderId).payment_reference });
  assert.equal(stock(variantId), 99, "paid-and-cancelled order: no refund, no restock");
  // The same member is correctly refused on payment attempts, so the asymmetry is real.
  const attempts = await merchant("GET", `/commerce/orders/${orderId}/payment-attempts`, undefined, "member");
  assert.equal(attempts.status, 403);
});

test("KNOWN DEFECT D2: there is no transition graph (COMPLETED -> PENDING -> SHIPPED is accepted)", async () => {
  const { orderId } = await checkout();
  for (const status of ["COMPLETED", "PENDING", "SHIPPED", "CANCELLED", "CONFIRMED"]) {
    const res = await merchant("PATCH", `/commerce/orders/${orderId}/status`, { status });
    assert.equal(res.status, 200, status);
    assert.equal(order(orderId).status, status);
  }
});

test("D2 desired: a non-financial member cannot cancel a paid order", { todo: "D2: PATCH /commerce/orders/:id/status has no role or transition guard" }, async () => {
  const { orderId } = await paidOrder();
  const res = await merchant("PATCH", `/commerce/orders/${orderId}/status`, { status: "CANCELLED" }, "member");
  assert.equal(res.status, 403);
  assert.equal(order(orderId).status, "PENDING");
});

// ---------------------------------------------------------------- 5. Concurrent checkout of the last unit
test("HELD: two simultaneous checkouts for the last unit -> exactly one order, stock 0, never negative", async () => {
  const variantId = addVariant(1);
  const [cartA, cartB] = [await newCart(variantId, 1), await newCart(variantId, 1)]; // both carts accepted while stock is 1
  const results = await Promise.all([submit(cartA), submit(cartB)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(results.find((r) => r.status === 409).body.code, "INSUFFICIENT_INVENTORY");
  assert.equal(stock(variantId), 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ecommerce_order_items WHERE variant_id=?").get(variantId).n, 1);
});

test("HELD: many simultaneous checkouts for 3 units sell exactly 3", async () => {
  const variantId = addVariant(3);
  const carts = []; for (let i = 0; i < 6; i++) carts.push(await newCart(variantId, 1));
  const results = await Promise.all(carts.map(submit));
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 3);
  assert.equal(stock(variantId), 0);
});

test("HELD: submitting one cart twice at once creates one order and one payment attempt", async () => {
  const cart = await newCart(addVariant(10), 1);
  const results = await Promise.all([submit(cart), submit(cart)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const orderId = results.find((r) => r.status === 201).body.order.id;
  assert.equal(attemptsFor(orderId).length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ecommerce_orders WHERE cart_id=?").get(cart.id).n, 1);
});

// ---------------------------------------------------------------- 6. Forged Authority
test("HELD: a valid attempt id with a wrong, empty, missing or foreign Authority never verifies, settles or cancels", async () => {
  const mine = await checkout();
  const other = await checkout();
  gateway.verify = paid(720001);
  const before = verifiesBefore();
  for (const authority of ["A-forged", "", `${mine.attempt.provider_attempt_reference}x`, other.attempt.provider_attempt_reference]) {
    for (const status of ["OK", "NOK"]) {
      const res = await callback(mine.attempt, status, authority);
      assert.equal(res.status, 404, `"${authority}" ${status}`);
    }
  }
  const noParam = await call("GET", `${base}/auth/storefront/payments/${mine.attempt.id}/callback?Status=OK`);
  assert.equal(noParam.status, 404);
  assert.equal(verifiesBefore(), before);
  assert.equal(attemptStatus(mine.attempt.id).status, "REDIRECT_READY");
  assert.equal(order(mine.orderId).payment_status, "UNPAID");
  assert.equal(order(other.orderId).payment_status, "UNPAID");
});

test("HELD: an unknown attempt id is refused", async () => {
  const res = await call("GET", `${base}/auth/storefront/payments/pay_attempt_nope/callback?Authority=x&Status=OK`);
  assert.equal(res.status, 404);
});

test("HELD: an attempt's own Authority settles only that attempt's order", async () => {
  const a = await checkout(), b = await checkout();
  gateway.verify = paid(720002);
  await callback(a.attempt, "OK");
  assert.equal(order(a.orderId).payment_status, "PAID");
  assert.equal(order(b.orderId).payment_status, "UNPAID");
  assert.equal(attemptStatus(b.attempt.id).status, "REDIRECT_READY");
});
