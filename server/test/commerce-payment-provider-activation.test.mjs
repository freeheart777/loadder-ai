import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const testDir = mkdtempSync(join(tmpdir(), "loadder-provider-activation-"));
process.env.DATABASE_PATH = join(testDir, "activation.sqlite");
process.env.NODE_ENV = "test";

const [{ db }, { createAuthRouter }, { mountSiteBuilderControlPlane }, { runWithWorkspace }, { runMigrations }, { migrations }] = await Promise.all([
  import("../db/workspace-database.mjs"),
  import("../app/routes/auth.mjs"),
  import("../app/site-builder-control-plane.mjs"),
  import("../app/tenant-context.mjs"),
  import("../db/migrate.mjs"),
  import("../db/migrations/index.mjs"),
]);
runMigrations(db, migrations);

const now = "2026-09-24T10:00:00.000Z";
for (const [store, ws] of [["store-a", "ws-a"], ["store-b", "ws-b"]]) {
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
const MERCHANT_ID = "1344b5d4-0048-11e8-94db-005056a205be";

// Stub both ZarinPal hosts; everything else uses the real fetch.
const realFetch = globalThis.fetch;
const gateway = { calls: [], reply: () => ({ data: { code: 100, authority: "S0000000000000000000000000000000probe" }, errors: [] }) };
globalThis.fetch = async (url, init) => {
  const href = String(url);
  if (!/^https:\/\/(sandbox|payment)\.zarinpal\.com\//.test(href)) return realFetch(url, init);
  const body = JSON.parse(init.body);
  gateway.calls.push({ href, body });
  return Response.json(gateway.reply(body));
};

const app = express();
app.use(express.json());
// Stand-in for the real auth/workspace middleware in front of the control plane.
app.use("/api", (req, res, next) => (req.get("x-test-workspace") ? runWithWorkspace(req.get("x-test-workspace"), next) : next()));
app.use("/api/auth", createAuthRouter({ authService: {}, nodeEnv: "test", exposeDevelopmentOtp: false }));
mountSiteBuilderControlPlane({ app, db, businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx" }, isStale: false }) }, basePath: "/api" });
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api`;
test.after(() => { server.close(); globalThis.fetch = realFetch; });

const call = async (method, path, body, headers = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};
const merchant = (method, path, body, ws = "ws-a") => call(method, path, body, { "x-test-workspace": ws });
const save = (body, key = "ZARINPAL") => merchant("PUT", `/stores/store-a/payment-providers/${key}`, body);
const activate = (key = "ZARINPAL", store = "store-a", ws = "ws-a") => merchant("POST", `/stores/${store}/payment-providers/${key}/activate`, {}, ws);
const statusOf = (key = "ZARINPAL") => db.prepare("SELECT status FROM ecommerce_payment_providers WHERE site_project_id='store-a' AND provider_key=?").get(key)?.status;
async function publicCheckout() {
  const cart = await call("POST", "/auth/storefront/store-a/carts", { currency: "IRT" });
  const cap = { "x-loadder-cart-capability": cart.body.cartCapability };
  await call("POST", `/auth/storefront/carts/${cart.body.cart.id}/items`, { variantId: "variant-store-a", quantity: 1 }, cap);
  return call("POST", `/auth/storefront/carts/${cart.body.cart.id}/checkout`, { fullName: "خریدار", phone: "09120000000", shippingAddress: { address: "تهران" } }, cap);
}

test("client-supplied CONNECTED is ignored and invalid status no longer 500s", async () => {
  const forced = await save({ status: "CONNECTED", credentialReference: MERCHANT_ID });
  assert.equal(forced.status, 200);
  assert.equal(forced.body.provider.status, "PENDING");
  assert.equal(statusOf(), "PENDING");
  assert.equal((await save({ status: "BOGUS", credentialReference: MERCHANT_ID })).status, 200);
  assert.equal(statusOf(), "PENDING");
  assert.equal((await publicCheckout()).body.payment, undefined);
});

test("ZarinPal merchant ID must be a UUID", async () => {
  const bad = await save({ credentialReference: "not-a-merchant" });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, "PAYMENT_PROVIDER_CREDENTIAL_INVALID");
});

test("unknown provider or missing merchant ID cannot activate and never calls the gateway", async () => {
  await save({ credentialReference: "anything" }, "OTHERPAY");
  assert.equal((await activate("OTHERPAY")).body.code, "PAYMENT_PROVIDER_UNSUPPORTED");
  await save({ config: { sandbox: true } });
  const missing = await activate();
  assert.equal(missing.status, 422);
  assert.equal(missing.body.code, "PAYMENT_PROVIDER_CREDENTIAL_REQUIRED");
  assert.equal(gateway.calls.length, 0);
});

test("gateway rejection -> ERROR, checkout stays manual", async () => {
  await save({ credentialReference: MERCHANT_ID });
  gateway.reply = () => ({ data: [], errors: { code: -10, message: "Terminal is not valid" } });
  const rejected = await activate();
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.code, "PAYMENT_PROVIDER_ACTIVATION_FAILED");
  assert.equal(statusOf(), "ERROR");
  assert.equal(gateway.calls.at(-1).href, "https://payment.zarinpal.com/pg/v4/payment/request.json"); // live row -> live minimal request
  assert.equal((await publicCheckout()).body.payment, undefined);
});

test("save -> sandbox activation -> CONNECTED -> checkout redirects; re-save disconnects", async () => {
  gateway.reply = (body) => ({ data: { code: 100, authority: body.amount === 1000 ? "S00000000000000000000000000000probe" : "S000000000000000000000000000checkout" }, errors: [] });
  await save({ credentialReference: MERCHANT_ID, config: { sandbox: true } });
  const activated = await activate();
  assert.equal(activated.status, 200);
  assert.deepEqual(activated.body.provider, { providerKey: "ZARINPAL", status: "CONNECTED", sandbox: true });
  const probe = gateway.calls.at(-1);
  assert.equal(probe.href, "https://sandbox.zarinpal.com/pg/v4/payment/request.json");
  assert.deepEqual({ merchant: probe.body.merchant_id, amount: probe.body.amount, currency: probe.body.currency }, { merchant: MERCHANT_ID, amount: 1000, currency: "IRR" });

  const listed = await merchant("GET", "/stores/store-a/payment-providers");
  const zp = listed.body.providers.find((p) => p.providerKey === "ZARINPAL");
  assert.deepEqual({ status: zp.status, sandbox: zp.sandbox, hint: zp.credentialHint }, { status: "CONNECTED", sandbox: true, hint: "…05be" });
  assert.equal(JSON.stringify(listed.body).includes(MERCHANT_ID), false);

  const paying = await publicCheckout();
  assert.equal(paying.status, 201);
  assert.equal(paying.body.payment.redirectUrl, "https://sandbox.zarinpal.com/pg/StartPay/S000000000000000000000000000checkout");

  await save({ credentialReference: MERCHANT_ID, config: { sandbox: true } });
  assert.equal(statusOf(), "PENDING");
  assert.equal((await publicCheckout()).body.payment, undefined);
});

test("credentials changed while the probe is in flight -> not CONNECTED", async () => {
  await save({ credentialReference: MERCHANT_ID, config: { sandbox: true } });
  gateway.reply = () => {
    db.prepare("UPDATE ecommerce_payment_providers SET credential_reference='00000000-0000-0000-0000-000000000000' WHERE site_project_id='store-a' AND provider_key='ZARINPAL'").run();
    return { data: { code: 100, authority: "S000000000000000000000000000000race" }, errors: [] };
  };
  const raced = await activate();
  assert.equal(raced.status, 409);
  assert.equal(statusOf(), "PENDING");
});

test("another workspace cannot read or activate the store's provider", async () => {
  assert.equal((await merchant("GET", "/stores/store-a/payment-providers", undefined, "ws-b")).status, 404);
  assert.equal((await activate("ZARINPAL", "store-a", "ws-b")).status, 404);
});
