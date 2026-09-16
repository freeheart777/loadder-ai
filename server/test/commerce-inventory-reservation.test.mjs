import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createEcommerceService } from "../app/services/ecommerce-service.mjs";
import { createPaymentAttemptService } from "../app/commerce/payment-attempt-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import {
  createInventoryReservationService,
  createInventorySettlementHooks,
  InventoryReservationError,
} from "../app/commerce/inventory-reservation-service.mjs";

const AT = "2026-09-16T12:00:00.000Z";
const later = (ms) => new Date(Date.parse(AT) + ms).toISOString();

function fixture({ stock = 1, policy = "DENY", clock = () => AT, ttlMs } = {}) {
  const db = createSiteTestDb();
  const projects = createSiteProjectService({
    repository: createSiteProjectRepository(db),
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  const stores = {
    a: runWithWorkspace("ws-1", () => projects.create({ name: "Reservation Store", siteType: "STORE", content: {} })),
    b: runWithWorkspace("ws-2", () => projects.create({ name: "Foreign Store", siteType: "STORE", content: {} })),
  };
  const reservations = createInventoryReservationService({ db, clock, ttlMs });
  const ecommerce = createEcommerceService({ db, inventoryReservations: reservations });

  function variant(workspaceId = "ws-1", store = stores.a) {
    const suffix = crypto.randomUUID();
    const product = runWithWorkspace(workspaceId, () => ecommerce.createProduct(store.id, {
      name: `کالا ${suffix}`, sku: `SKU-${suffix}`, basePriceMinor: 125000, currency: "IRT", status: "ACTIVE",
    }));
    const variantId = product.variants[0].id;
    db.prepare("UPDATE ecommerce_variants SET inventory_quantity=?,inventory_policy=? WHERE id=?").run(stock, policy, variantId);
    return { variantId, storeId: store.id };
  }

  function buy({ workspaceId = "ws-1", store = stores.a, variantId, quantity = 1 }) {
    return runWithWorkspace(workspaceId, () => {
      const cart = ecommerce.createCart(store.id, { currency: "IRT" });
      ecommerce.addCartItem(cart.id, { variantId, quantity });
      return ecommerce.checkout(cart.id, { paymentProvider: "manual" });
    });
  }

  function provider(workspaceId = "ws-1", store = stores.a) {
    return runWithWorkspace(workspaceId, () => {
      ecommerce.configurePaymentProvider(store.id, { providerKey: "TEST_PSP", status: "PENDING" });
      return db.prepare("SELECT id FROM ecommerce_payment_providers WHERE workspace_id=? AND site_project_id=?").get(workspaceId, store.id).id;
    });
  }

  const physical = (variantId) => db.prepare("SELECT inventory_quantity AS q FROM ecommerce_variants WHERE id=?").get(variantId).q;
  const states = (orderId) => db.prepare("SELECT state FROM ecommerce_inventory_reservations WHERE order_id=? ORDER BY id").all(orderId).map((r) => r.state);
  return { db, stores, ecommerce, reservations, variant, buy, provider, physical, states };
}

function settle(f, orderId, configId, { workspaceId = "ws-1", hooks } = {}) {
  const payments = createPaymentAttemptService({ db: f.db, clock: () => AT, beforeOrderSettlement: hooks?.beforeOrderSettlement, onTerminal: hooks?.onTerminal });
  return runWithWorkspace(workspaceId, () => {
    const attempt = payments.create({ orderId, provider: "TEST_PSP", providerConfigId: configId, idempotencyKey: `k-${orderId}` });
    return { payments, attempt };
  });
}

test("unpaid checkout holds stock instead of decrementing it, and blocks a competing DENY cart", () => {
  const f = fixture({ stock: 1 });
  const { variantId } = f.variant();
  const order = f.buy({ variantId });

  assert.equal(f.physical(variantId), 1, "unpaid checkout must not decrement physical stock");
  assert.deepEqual(f.states(order.id), ["HELD"]);
  runWithWorkspace("ws-1", () => assert.equal(f.ecommerce.availableQuantity(variantId), 0, "the held unit is not available"));
  assert.throws(() => f.buy({ variantId }), /INSUFFICIENT_INVENTORY|Not enough inventory/, "competing cart must lose the last item");
});

test("verified payment commits exactly once; settle replay and commit replay never decrement twice", () => {
  const f = fixture({ stock: 1 });
  const { variantId } = f.variant();
  const order = f.buy({ variantId });
  const configId = f.provider();
  const hooks = createInventorySettlementHooks({ db: f.db, clock: () => AT });
  const { payments, attempt } = settle(f, order.id, configId, { hooks });

  const verification = { providerTransactionId: "tx-1", provider: "TEST_PSP", providerConfigId: configId, amountMinor: attempt.amountMinor, currency: attempt.currency };
  runWithWorkspace("ws-1", () => {
    payments.settleVerified(attempt.id, verification);
    payments.settleVerified(attempt.id, verification);
    hooks.service.commitForOrder(order.id);
  });

  assert.equal(f.physical(variantId), 0, "committed exactly once");
  assert.deepEqual(f.states(order.id), ["COMMITTED"]);
});

test("failed and cancelled payments release the hold exactly once, and release replays safely", () => {
  for (const status of ["FAILED", "CANCELLED"]) {
    const f = fixture({ stock: 1 });
    const { variantId } = f.variant();
    const order = f.buy({ variantId });
    const configId = f.provider();
    const hooks = createInventorySettlementHooks({ db: f.db, clock: () => AT });
    const { payments, attempt } = settle(f, order.id, configId, { hooks });

    runWithWorkspace("ws-1", () => {
      payments.markTerminal(attempt.id, { status });
      payments.markTerminal(attempt.id, { status });
      hooks.service.releaseForOrder(order.id, { reason: status, force: true });
    });

    assert.deepEqual(f.states(order.id), ["RELEASED"], `${status} releases exactly once`);
    assert.equal(f.physical(variantId), 1, "released stock returns to availability");
    runWithWorkspace("ws-1", () => assert.equal(f.ecommerce.availableQuantity(variantId), 1));
  }
});

test("RECONCILIATION_REQUIRED keeps holding inventory and is never blindly released", () => {
  const f = fixture({ stock: 1 });
  const { variantId } = f.variant();
  const order = f.buy({ variantId });
  const configId = f.provider();
  const { attempt } = settle(f, order.id, configId);
  f.db.prepare("UPDATE ecommerce_payment_attempts SET status='RECONCILIATION_REQUIRED',updated_at=? WHERE id=?").run(AT, attempt.id);

  runWithWorkspace("ws-1", () => {
    const outcome = f.reservations.releaseForOrder(order.id, { reason: "SWEEP" });
    assert.equal(outcome.held, true);
    assert.equal(outcome.reason, "PAYMENT_OUTCOME_UNRESOLVED");
    assert.deepEqual(outcome.released, []);
    assert.equal(f.ecommerce.availableQuantity(variantId), 0, "unknown outcome keeps the stock held");
  });
  assert.deepEqual(f.states(order.id), ["HELD"]);
});

test("expired holds stop blocking availability and are swept back idempotently", () => {
  let nowValue = AT;
  const f = fixture({ stock: 1, clock: () => nowValue, ttlMs: 1000 });
  const { variantId } = f.variant();
  const order = f.buy({ variantId });

  nowValue = later(5000);
  runWithWorkspace("ws-1", () => {
    assert.equal(f.ecommerce.availableQuantity(variantId), 1, "expiry is authoritative at read time, before any sweep");
    const released = f.reservations.releaseExpired();
    assert.equal(released.length, 1);
    assert.equal(released[0].releaseReason, "EXPIRED");
    assert.deepEqual(f.reservations.releaseExpired(), [], "sweep is idempotent");
  });
  assert.deepEqual(f.states(order.id), ["RELEASED"]);
  assert.equal(f.physical(variantId), 1);
});

test("an unresolved payment attempt protects an expired hold from the sweep", () => {
  let nowValue = AT;
  const f = fixture({ stock: 1, clock: () => nowValue, ttlMs: 1000 });
  const { variantId } = f.variant();
  const order = f.buy({ variantId });
  const configId = f.provider();
  settle(f, order.id, configId);

  nowValue = later(5000);
  runWithWorkspace("ws-1", () => {
    assert.deepEqual(f.reservations.releaseExpired(), [], "in-flight payment blocks the expiry sweep");
    assert.equal(f.ecommerce.availableQuantity(variantId), 1);
  });
  assert.deepEqual(f.states(order.id), ["HELD"], "the hold survives for the in-flight payment to commit");
});

test("a released reservation can never be committed afterwards", () => {
  const f = fixture({ stock: 1 });
  const { variantId } = f.variant();
  const order = f.buy({ variantId });
  runWithWorkspace("ws-1", () => {
    f.reservations.releaseForOrder(order.id, { reason: "CANCELLED", force: true });
    assert.throws(
      () => f.reservations.commitForOrder(order.id),
      (error) => error instanceof InventoryReservationError && error.code === "RESERVATION_ALREADY_RELEASED"
    );
  });
  assert.equal(f.physical(variantId), 1);
});

test("a paid order refuses reservation release", () => {
  const f = fixture({ stock: 1 });
  const { variantId } = f.variant();
  const order = f.buy({ variantId });
  const configId = f.provider();
  const hooks = createInventorySettlementHooks({ db: f.db, clock: () => AT });
  const { payments, attempt } = settle(f, order.id, configId, { hooks });

  runWithWorkspace("ws-1", () => {
    payments.settleVerified(attempt.id, { providerTransactionId: "tx-1", provider: "TEST_PSP", providerConfigId: configId, amountMinor: attempt.amountMinor, currency: attempt.currency });
    assert.throws(() => hooks.service.releaseForOrder(order.id, { force: true }), (error) => error.code === "ORDER_ALREADY_PAID");
  });
  assert.deepEqual(f.states(order.id), ["COMMITTED"]);
  assert.equal(f.physical(variantId), 0);
});

test("CONTINUE policy still sells at zero stock and reserves nothing", () => {
  const f = fixture({ stock: 0, policy: "CONTINUE" });
  const { variantId } = f.variant();
  const order = f.buy({ variantId, quantity: 3 });

  assert.deepEqual(f.states(order.id), [], "CONTINUE is not gated and is not reserved");
  assert.equal(f.physical(variantId), 0);
  assert.ok(f.buy({ variantId, quantity: 2 }).id, "CONTINUE keeps selling below zero stock");
});

test("checkout replay reuses the existing hold instead of holding the same stock twice", () => {
  const f = fixture({ stock: 5 });
  const { variantId, storeId } = f.variant();
  const order = f.buy({ variantId, quantity: 2 });

  runWithWorkspace("ws-1", () => {
    f.reservations.reserveForOrder({ orderId: order.id, siteProjectId: storeId, items: [{ variantId, quantity: 2 }] });
    assert.equal(f.ecommerce.availableQuantity(variantId), 3, "replayed reservation must not double-hold");
    assert.equal(f.reservations.listForOrder(order.id).length, 1);
  });
});

test("reservations are tenant isolated", () => {
  const f = fixture({ stock: 1 });
  const own = f.variant("ws-1", f.stores.a);
  const foreign = f.variant("ws-2", f.stores.b);
  const order = f.buy({ variantId: own.variantId });

  runWithWorkspace("ws-2", () => {
    assert.equal(f.reservations.listForOrder(order.id).length, 0, "a foreign workspace cannot see the reservation");
    assert.equal(f.ecommerce.availableQuantity(foreign.variantId), 1, "another tenant's hold does not consume our stock");
    assert.deepEqual(f.reservations.releaseExpired(), [], "the sweep is tenant scoped");
  });
  assert.deepEqual(f.states(order.id), ["HELD"]);
});
