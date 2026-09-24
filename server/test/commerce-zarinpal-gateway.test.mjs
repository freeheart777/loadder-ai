import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const testDir = mkdtempSync(join(tmpdir(), "loadder-zarinpal-"));
process.env.DATABASE_PATH = join(testDir, "zarinpal.sqlite");
process.env.NODE_ENV = "test";

const [{ db }, { createAuthRouter }, { runMigrations }, { migrations }] = await Promise.all([
  import("../db/workspace-database.mjs"),
  import("../app/routes/auth.mjs"),
  import("../db/migrate.mjs"),
  import("../db/migrations/index.mjs"),
]);
runMigrations(db, migrations);

const now = "2026-09-24T10:00:00.000Z";
db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES('ws','ws','ws','active',?,?)").run(now, now);
for (const store of ["store-manual", "store-zp"]) {
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,published_at,created_at,updated_at) VALUES(?,'ws',?,'STORE',?,'PUBLISHED',?,?,?,?)")
    .run(store, store, store, JSON.stringify({ storeBuilderV16: { version: 16 } }), now, now, now);
  db.prepare("INSERT INTO site_publish_versions(id,workspace_id,site_project_id,version,content_json,manifest_json,published_at,created_at) VALUES(?,'ws',?,1,?,'{}',?,?)")
    .run(`version-${store}`, store, JSON.stringify({ storeBuilderV16: { version: 16 } }), now, now);
  db.prepare("INSERT INTO ecommerce_products(id,workspace_id,site_project_id,name,slug,status,currency,base_price_minor,metadata_json,created_at,updated_at) VALUES(?,'ws',?,'P',?,'ACTIVE','IRT',250000,'{}',?,?)")
    .run(`product-${store}`, store, `product-${store}`, now, now);
  db.prepare("INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,image_url,active,created_at,updated_at) VALUES(?,'ws',?,?,'Default',250000,100,'DENY','{}',NULL,1,?,?)")
    .run(`variant-${store}`, `product-${store}`, `SKU-${store}`, now, now);
}
const MERCHANT_ID = "00000000-0000-0000-0000-000000000000";
db.prepare("INSERT INTO ecommerce_payment_providers(id,workspace_id,site_project_id,provider_key,status,config_json,credential_reference,created_at,updated_at) VALUES('zp-config','ws','store-zp','ZARINPAL','CONNECTED',?,?,?,?)")
  .run(JSON.stringify({ sandbox: true }), MERCHANT_ID, now, now);

// Stub only ZarinPal; local test traffic goes through the real fetch.
const realFetch = globalThis.fetch;
const gateway = { requests: [], verifies: [], request: null, verify: null };
globalThis.fetch = async (url, init) => {
  const href = String(url);
  if (!href.startsWith("https://sandbox.zarinpal.com/")) return realFetch(url, init);
  const body = JSON.parse(init.body);
  if (href.endsWith("/pg/v4/payment/request.json")) { gateway.requests.push(body); return Response.json(gateway.request(body)); }
  if (href.endsWith("/pg/v4/payment/verify.json")) { gateway.verifies.push(body); return Response.json(gateway.verify(body)); }
  throw new Error(`unexpected gateway call ${href}`);
};

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter({ authService: {}, nodeEnv: "test", exposeDevelopmentOtp: false }));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api/auth`;
test.after(() => { server.close(); globalThis.fetch = realFetch; });

const post = async (path, body, capability) => {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(capability ? { "x-loadder-cart-capability": capability } : {}) }, body: JSON.stringify(body) });
  return { response, body: await response.json() };
};
async function checkout(store) {
  const cart = await post(`/storefront/${store}/carts`, { currency: "IRT" });
  await post(`/storefront/carts/${cart.body.cart.id}/items`, { variantId: `variant-${store}`, quantity: 2 }, cart.body.cartCapability);
  return post(`/storefront/carts/${cart.body.cart.id}/checkout`, { fullName: "خریدار", phone: "09120000000", shippingAddress: { address: "تهران" } }, cart.body.cartCapability);
}
const callback = (attemptId, query) => fetch(`${base}/storefront/payments/${attemptId}/callback?${new URLSearchParams(query)}`, { redirect: "manual" });
const orderRow = (id) => db.prepare("SELECT payment_status,payment_provider,payment_reference,total_minor FROM ecommerce_orders WHERE id=?").get(id);
const attemptFor = (orderId) => db.prepare("SELECT * FROM ecommerce_payment_attempts WHERE order_id=?").get(orderId);
let authoritySeq = 0;
const acceptRequest = () => ({ data: { code: 100, authority: `A${String(++authoritySeq).padStart(35, "0")}` }, errors: [] });

test("no connected provider: manual checkout is unchanged", async () => {
  const result = await checkout("store-manual");
  assert.equal(result.response.status, 201);
  assert.equal(result.body.payment, undefined);
  assert.deepEqual({ ...orderRow(result.body.order.id), total_minor: undefined }, { payment_status: "UNPAID", payment_provider: "manual", payment_reference: null, total_minor: undefined });
  assert.equal(attemptFor(result.body.order.id), undefined);
});

test("checkout -> ZarinPal redirect -> verified callback -> order PAID", async () => {
  gateway.request = acceptRequest;
  const result = await checkout("store-zp");
  assert.equal(result.response.status, 201);
  const orderId = result.body.order.id;
  const attempt = attemptFor(orderId);
  assert.equal(attempt.status, "REDIRECT_READY");
  assert.match(result.body.payment.redirectUrl, new RegExp(`^https://sandbox\\.zarinpal\\.com/pg/StartPay/${attempt.provider_attempt_reference}$`));

  const sent = gateway.requests.at(-1);
  assert.equal(sent.merchant_id, MERCHANT_ID);
  assert.equal(sent.amount, 5000); // 2 x 250000 minor = 5000 Toman
  assert.equal(sent.currency, "IRT");
  assert.equal(sent.callback_url, `${base}/storefront/payments/${attempt.id}/callback`);
  assert.equal(orderRow(orderId).payment_status, "UNPAID");

  const forged = await callback(attempt.id, { Authority: "A-forged", Status: "OK" });
  assert.equal(forged.status, 404);
  assert.equal(gateway.verifies.length, 0);

  gateway.verify = () => ({ data: { code: 100, ref_id: 987654321, card_pan: "6037****1234" }, errors: [] });
  const paid = await callback(attempt.id, { Authority: attempt.provider_attempt_reference, Status: "OK" });
  assert.equal(paid.status, 303);
  assert.equal(paid.headers.get("location"), `/store/store-zp/order-success/${orderId}?payment=paid`);
  assert.deepEqual(gateway.verifies.at(-1), { merchant_id: MERCHANT_ID, amount: 5000, authority: attempt.provider_attempt_reference });
  assert.deepEqual(orderRow(orderId), { payment_status: "PAID", payment_provider: "ZARINPAL", payment_reference: "987654321", total_minor: 500000 });
  assert.equal(attemptFor(orderId).status, "SUCCEEDED");

  // Replayed callback: no second verify, same answer.
  const replay = await callback(attempt.id, { Authority: attempt.provider_attempt_reference, Status: "OK" });
  assert.equal(replay.headers.get("location"), `/store/store-zp/order-success/${orderId}?payment=paid`);
  assert.equal(gateway.verifies.length, 1);
});

test("customer cancels at the gateway: attempt CANCELLED, order stays UNPAID", async () => {
  gateway.request = acceptRequest;
  const orderId = (await checkout("store-zp")).body.order.id;
  const attempt = attemptFor(orderId);
  const verifiesBefore = gateway.verifies.length;
  const back = await callback(attempt.id, { Authority: attempt.provider_attempt_reference, Status: "NOK" });
  assert.equal(back.headers.get("location"), `/store/store-zp/order-success/${orderId}?payment=failed`);
  assert.equal(attemptFor(orderId).status, "CANCELLED");
  assert.equal(orderRow(orderId).payment_status, "UNPAID");
  assert.equal(gateway.verifies.length, verifiesBefore);
});

test("gateway verify rejects a Status=OK callback: attempt FAILED, order stays UNPAID", async () => {
  gateway.request = acceptRequest;
  const orderId = (await checkout("store-zp")).body.order.id;
  const attempt = attemptFor(orderId);
  gateway.verify = () => ({ data: [], errors: { code: -51, message: "Session is not valid" } });
  const back = await callback(attempt.id, { Authority: attempt.provider_attempt_reference, Status: "OK" });
  assert.equal(back.headers.get("location"), `/store/store-zp/order-success/${orderId}?payment=failed`);
  assert.equal(attemptFor(orderId).status, "FAILED");
  assert.equal(orderRow(orderId).payment_status, "UNPAID");
});

test("gateway refuses the payment request: checkout still succeeds as manual", async () => {
  gateway.request = () => ({ data: [], errors: { code: -9, message: "validation error" } });
  const result = await checkout("store-zp");
  assert.equal(result.response.status, 201);
  assert.equal(result.body.payment, undefined);
  assert.equal(attemptFor(result.body.order.id).status, "FAILED");
  assert.deepEqual({ ...orderRow(result.body.order.id), total_minor: undefined }, { payment_status: "UNPAID", payment_provider: "manual", payment_reference: null, total_minor: undefined });
});
