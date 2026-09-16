import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createEcommerceService } from "../app/services/ecommerce-service.mjs";
import { createPaymentAttemptService, defineCommercePaymentProviderAdapter } from "../app/commerce/payment-attempt-service.mjs";
import { createMemoryPaymentIdempotencyStore, createPaymentRuntime } from "../app/business-builder/payment-runtime.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { migration087CommercePaymentAttempts } from "../db/migrations/087_commerce_payment_attempts.mjs";

const stamp = "2026-09-16T12:00:00.000Z";

function fixture({ beforeOrderSettlement = null } = {}) {
  const db = createSiteTestDb();
  const projects = createSiteProjectService({
    repository: createSiteProjectRepository(db),
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  const stores = {
    a: runWithWorkspace("ws-1", () => projects.create({ name: "Payment Store", siteType: "STORE", content: {} })),
    b: runWithWorkspace("ws-2", () => projects.create({ name: "Foreign Store", siteType: "STORE", content: {} })),
  };
  const ecommerce = createEcommerceService({ db });
  function order(workspaceId = "ws-1", store = stores.a, suffix = crypto.randomUUID()) {
    return runWithWorkspace(workspaceId, () => {
      const product = ecommerce.createProduct(store.id, { name: `Payment Product ${suffix}`, sku: `PAY-${suffix}`, basePriceMinor: 125000, currency: "IRT", inventoryQuantity: 5, status: "ACTIVE" });
      let cart = ecommerce.createCart(store.id, { currency: "IRT" });
      cart = ecommerce.addCartItem(cart.id, { variantId: product.variants[0].id, quantity: 1 });
      return ecommerce.checkout(cart.id, { paymentProvider: "manual" });
    });
  }
  function provider(workspaceId = "ws-1", store = stores.a, key = "TEST_PSP") {
    return runWithWorkspace(workspaceId, () => {
      ecommerce.configurePaymentProvider(store.id, { providerKey: key, status: "PENDING", credentialReference: "env:TEST_PSP_KEY" });
      return db.prepare("SELECT id FROM ecommerce_payment_providers WHERE workspace_id=? AND site_project_id=? AND provider_key=?").get(workspaceId, store.id, key).id;
    });
  }
  return { db, ecommerce, stores, order, provider, payment: createPaymentAttemptService({ db, clock: () => stamp, beforeOrderSettlement }) };
}

function verification(attempt, transaction = "txn-1", overrides = {}) {
  return { provider: attempt.provider, providerConfigId: attempt.providerConfigId, providerTransactionId: transaction, amountMinor: attempt.amountMinor, currency: attempt.currency, verificationCode: "VERIFIED_SUCCESS", ...overrides };
}

test("generic order mutation cannot manufacture payment or refund truth but ordinary order and fulfillment updates remain available", () => {
  const { db, ecommerce, order } = fixture();
  const created = order();
  runWithWorkspace("ws-1", () => {
    for (const role of ["owner", "admin"]) {
      assert.throws(() => ecommerce.setOrderStatus(created.id, { paymentStatus: "PAID", paymentReference: `${role}-fake` }), (error) => error.code === "FINANCIAL_STATE_AUTHORITY_REQUIRED");
    }
    assert.throws(() => ecommerce.setOrderStatus(created.id, { paymentStatus: "REFUNDED" }), (error) => error.code === "FINANCIAL_STATE_AUTHORITY_REQUIRED");
    assert.throws(() => ecommerce.setOrderStatus(created.id, { paymentStatus: "PARTIALLY_REFUNDED" }), (error) => error.code === "FINANCIAL_STATE_AUTHORITY_REQUIRED");
    assert.throws(() => ecommerce.setOrderStatus(created.id, { status: "REFUNDED" }), (error) => error.code === "FINANCIAL_STATE_AUTHORITY_REQUIRED");
    const updated = ecommerce.setOrderStatus(created.id, { status: "CONFIRMED", fulfillmentStatus: "FULFILLED" });
    assert.equal(updated.status, "CONFIRMED");
    assert.equal(updated.fulfillmentStatus, "FULFILLED");
    assert.equal(updated.paymentStatus, "UNPAID");
  });
  assert.equal(db.prepare("SELECT COUNT(*) count FROM ecommerce_financial_ledger").get().count, 0);
  db.close();
});

test("attempt snapshots canonical money, rejects browser money, enforces tenant and initiation idempotency", () => {
  const { db, order, provider, payment, stores } = fixture();
  const created = order(), configId = provider(), otherConfigId = provider("ws-1", stores.a, "OTHER");
  runWithWorkspace("ws-1", () => {
    assert.throws(() => payment.create({ orderId: created.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "idem-money", amountMinor: 1 }), (error) => error.code === "PAYMENT_CLIENT_MONEY_REJECTED");
    const first = payment.create({ orderId: created.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "idem-1" });
    const replay = payment.create({ orderId: created.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "idem-1" });
    assert.equal(replay.id, first.id);
    assert.equal(first.amountMinor, created.totalMinor);
    assert.equal(first.currency, created.currency);
    assert.throws(() => payment.create({ orderId: created.id, provider: "OTHER", providerConfigId: otherConfigId, idempotencyKey: "idem-1" }), (error) => error.code === "PAYMENT_IDEMPOTENCY_CONFLICT");
  });
  runWithWorkspace("ws-2", () => {
    assert.throws(() => payment.create({ orderId: created.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "foreign" }), (error) => error.code === "PAYMENT_ORDER_NOT_FOUND");
    assert.throws(() => payment.create({ orderId: order("ws-2", stores.b).id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "foreign-config" }), (error) => error.code === "PAYMENT_PROVIDER_CONFIG_NOT_FOUND");
  });
  db.close();
});

test("verified settlement validates every authority input and creates one atomic capture", () => {
  const { db, order, provider, payment } = fixture();
  const created = order(), configId = provider();
  runWithWorkspace("ws-1", () => {
    const attempt = payment.create({ orderId: created.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "settle-1" });
    assert.throws(() => payment.settleVerified(attempt.id, verification(attempt, "txn-wrong-amount", { amountMinor: attempt.amountMinor + 1 })), (error) => error.code === "PAYMENT_AMOUNT_MISMATCH");
    assert.throws(() => payment.settleVerified(attempt.id, verification(attempt, "txn-wrong-currency", { currency: "USD" })), (error) => error.code === "PAYMENT_CURRENCY_MISMATCH");
    assert.throws(() => payment.settleVerified(attempt.id, verification(attempt, "txn-wrong-provider", { provider: "OTHER" })), (error) => error.code === "PAYMENT_PROVIDER_MISMATCH");
    assert.throws(() => payment.settleVerified(attempt.id, verification(attempt, "txn-wrong-config", { providerConfigId: "wrong" })), (error) => error.code === "PAYMENT_PROVIDER_MISMATCH");
    const settled = payment.settleVerified(attempt.id, verification(attempt));
    assert.equal(settled.status, "SUCCEEDED");
    assert.equal(payment.settleVerified(attempt.id, verification(attempt)).id, attempt.id);
  });
  const orderRow = db.prepare("SELECT payment_status,payment_provider,payment_reference FROM ecommerce_orders WHERE id=?").get(created.id);
  assert.deepEqual(orderRow, { payment_status: "PAID", payment_provider: "TEST_PSP", payment_reference: "txn-1" });
  assert.equal(db.prepare("SELECT COUNT(*) count FROM ecommerce_financial_ledger WHERE order_id=? AND entry_type='PAYMENT_CAPTURED'").get(created.id).count, 1);
  db.close();
});

test("provider transaction cannot settle another attempt or order", () => {
  const { db, order, provider, payment } = fixture();
  const firstOrder = order(), secondOrder = order(), configId = provider();
  runWithWorkspace("ws-1", () => {
    const first = payment.create({ orderId: firstOrder.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "first" });
    const second = payment.create({ orderId: secondOrder.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "second" });
    payment.settleVerified(first.id, verification(first, "txn-shared"));
    assert.throws(() => payment.settleVerified(second.id, verification(second, "txn-shared")), (error) => error.code === "PAYMENT_PROVIDER_TRANSACTION_CONFLICT");
  });
  assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id=?").get(secondOrder.id).payment_status, "UNPAID");
  assert.equal(db.prepare("SELECT status FROM ecommerce_payment_attempts WHERE order_id=?").get(secondOrder.id).status, "CREATED");
  db.close();
});

test("forced failure between verified attempt and order transition rolls back attempt, order, and ledger", () => {
  const simulated = new Error("SIMULATED_SETTLEMENT_FAILURE");
  const { db, order, provider, payment } = fixture({ beforeOrderSettlement: () => { throw simulated; } });
  const created = order(), configId = provider();
  runWithWorkspace("ws-1", () => {
    const attempt = payment.create({ orderId: created.id, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: "rollback" });
    assert.throws(() => payment.settleVerified(attempt.id, verification(attempt)), /SIMULATED_SETTLEMENT_FAILURE/);
    assert.equal(payment.get(attempt.id).status, "CREATED");
  });
  assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id=?").get(created.id).payment_status, "UNPAID");
  assert.equal(db.prepare("SELECT COUNT(*) count FROM ecommerce_financial_ledger WHERE order_id=?").get(created.id).count, 0);
  db.close();
});

test("database guard rejects direct paid/refunded updates without canonical evidence", () => {
  const { db, order } = fixture();
  const created = order();
  assert.throws(() => db.prepare("UPDATE ecommerce_orders SET payment_status='PAID' WHERE id=?").run(created.id), /verified commerce payment attempt required/);
  assert.throws(() => db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED' WHERE id=?").run(created.id), /verified commerce refund required/);
  db.close();
});

test("Business Builder provider runtime cannot settle a Commerce order", async () => {
  const { db, order } = fixture();
  const created = order();
  const runtime = createPaymentRuntime({
    createIntent: async () => ({ providerId: "bb-provider", checkoutUrl: "https://provider.example.test/pay" }),
    verifyEvent: async () => ({ id: "bb-event", type: "paid", reference: created.id, status: "paid", amount: created.totalMinor, currency: created.currency }),
    idempotencyStore: createMemoryPaymentIdempotencyStore(),
  });
  await runtime.start({ provider: "bb", amount: created.totalMinor, currency: created.currency, reference: created.id });
  await runtime.handleWebhook({ payload: Buffer.from("{}"), signature: "test" });
  assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id=?").get(created.id).payment_status, "UNPAID");
  assert.equal(db.prepare("SELECT COUNT(*) count FROM ecommerce_payment_attempts WHERE order_id=?").get(created.id).count, 0);
  db.close();
});

test("provider contract is explicit and complete without networking", () => {
  const adapter = defineCommercePaymentProviderAdapter({
    createPayment: async () => {}, verifyPayment: async () => {}, refundPayment: async () => {}, verifyRefund: async () => {},
  });
  assert.deepEqual(Object.keys(adapter), ["createPayment", "verifyPayment", "refundPayment", "verifyRefund"]);
  assert.throws(() => defineCommercePaymentProviderAdapter({ createPayment() {} }), (error) => error.code === "PAYMENT_ADAPTER_INCOMPLETE");
});

test("migration 087 is additive, rerunnable, indexed, and preserves existing orders", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE business_context_versions(id TEXT PRIMARY KEY, workspace_id TEXT, status TEXT, snapshot_json TEXT);
    CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, status TEXT, role TEXT);
    CREATE TABLE decision_records(id TEXT PRIMARY KEY, workspace_id TEXT, context_version_id TEXT, decision_type TEXT, supersedes_decision_id TEXT);
    CREATE TABLE marketing_campaigns(id TEXT PRIMARY KEY, workspace_id TEXT);
    CREATE TABLE customers(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),name TEXT NOT NULL DEFAULT 'Test Customer');
  `);
  db.prepare("INSERT INTO workspaces(id) VALUES('ws-1')").run();
  db.prepare("INSERT INTO business_context_versions(id) VALUES('ctx-1')").run();
  for (const table of ["feature_values","listening_aggregates","listening_topic_matches","listening_trend_signals","listening_anomaly_results"]) db.exec(`CREATE TABLE ${table}(id TEXT PRIMARY KEY,workspace_id TEXT)`);
  runMigrations(db, migrations.filter((migration) => ([14,35,38].includes(migration.version) || migration.version >= 42) && migration.version <= 86));
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES('legacy-store','ws-1','Legacy','STORE','legacy','PUBLISHED','{}',?,?)").run(stamp,stamp);
  db.prepare("INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,currency,status,payment_status,fulfillment_status,total_minor,shipping_address_json,created_at,updated_at) VALUES('legacy-order','ws-1','legacy-store','IRT','PENDING','UNPAID','UNFULFILLED',1000,'{}',?,?)").run(stamp,stamp);
  migration087CommercePaymentAttempts.up(db);
  migration087CommercePaymentAttempts.up(db);
  assert.equal(db.prepare("SELECT total_minor FROM ecommerce_orders WHERE id='legacy-order'").get().total_minor, 1000);
  assert.ok(db.prepare("PRAGMA index_list(ecommerce_payment_attempts)").all().some((row) => row.name === "idx_ecommerce_payment_attempts_provider_transaction" && row.unique === 1));
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple:true }), "ok");
  db.close();
});
