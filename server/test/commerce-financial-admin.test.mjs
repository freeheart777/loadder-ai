import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createEcommerceService } from "../app/services/ecommerce-service.mjs";
import {
  createFinancialLedgerService,
  getOrderFinancialTimeline,
} from "../app/commerce/v2/financial-ledger.mjs";
import { createEcommerceRouter } from "../app/routes/ecommerce.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

function fixture() {
  const db = createSiteTestDb();
  const projectService = createSiteProjectService({
    repository: createSiteProjectRepository(db),
    businessContextService: {
      getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }),
    },
  });
  const store = runWithWorkspace("ws-1", () =>
    projectService.create({ name: "Finance Store", siteType: "STORE", content: {} })
  );
  const ecommerceService = createEcommerceService({ db });
  const audits = [];
  const auditRepository = {
    createAuditLog(entry) {
      audits.push(entry);
      return `audit-${audits.length}`;
    },
  };
  const financialLedgerService = createFinancialLedgerService({
    db,
    auditRepository,
    clock: () => "2026-09-05T00:00:00.000Z",
  });

  return {
    db,
    store,
    ecommerceService,
    financialLedgerService,
    audits,
  };
}

function createOrder({ store, ecommerceService, sku = "FIN-1", amount = 1250 }) {
  return runWithWorkspace("ws-1", () => {
    const product = ecommerceService.createProduct(store.id, {
      name: `Finance Product ${sku}`,
      sku,
      basePriceMinor: amount,
      inventoryQuantity: 3,
      currency: "USD",
      status: "ACTIVE",
    });
    let cart = ecommerceService.createCart(store.id, { currency: "USD" });
    cart = ecommerceService.addCartItem(cart.id, {
      variantId: product.variants[0].id,
      quantity: 1,
    });
    return ecommerceService.checkout(cart.id, { paymentProvider: "TEST" });
  });
}

test("financial timeline exposes immutable capture summary inside workspace scope", () => {
  const { db, store, ecommerceService } = fixture();
  const order = createOrder({ store, ecommerceService });

  runWithWorkspace("ws-1", () => {
    ecommerceService.setOrderStatus(order.id, {
      paymentStatus: "PAID",
      paymentReference: "capture-001",
    });
  });

  const financials = getOrderFinancialTimeline(db, {
    workspaceId: "ws-1",
    orderId: order.id,
  });
  assert.equal(financials.summary.paymentStatus, "PAID");
  assert.equal(financials.summary.paidMinor, order.totalMinor);
  assert.equal(financials.summary.netMinor, order.totalMinor);
  assert.equal(financials.entries.length, 1);
  assert.equal(financials.entries[0].entryType, "PAYMENT_CAPTURED");
  assert.equal(financials.entries[0].metadata.paymentReference, "capture-001");
  assert.equal(
    getOrderFinancialTimeline(db, { workspaceId: "ws-2", orderId: order.id }),
    null
  );

  db.close();
});

test("financial reconciliation repairs a missing capture once and records operator audit", () => {
  const { db, store, ecommerceService, financialLedgerService, audits } = fixture();
  const order = createOrder({ store, ecommerceService, sku: "FIN-REPAIR" });

  db.exec("DROP TRIGGER trg_ecommerce_payment_captured_ledger");
  runWithWorkspace("ws-1", () => {
    ecommerceService.setOrderStatus(order.id, {
      paymentStatus: "PAID",
      paymentReference: "repair-001",
    });
  });

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM ecommerce_financial_ledger WHERE order_id=?").get(order.id).count,
    0
  );

  const repaired = financialLedgerService.reconcile({
    workspaceId: "ws-1",
    orderId: order.id,
    userId: "user-1",
    actorRole: "owner",
  });
  assert.equal(repaired.status, "repaired");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM ecommerce_financial_ledger WHERE order_id=?").get(order.id).count,
    1
  );

  const repeated = financialLedgerService.reconcile({
    workspaceId: "ws-1",
    orderId: order.id,
    userId: "user-1",
    actorRole: "admin",
  });
  assert.equal(repeated.status, "already_consistent");
  assert.equal(audits.length, 2);
  assert.equal(audits[0].action, "commerce.financial.reconcile");
  assert.equal(audits[0].resourceType, "ecommerce_order");
  assert.equal(audits[0].metadata.result.status, "repaired");
  assert.equal(audits[1].metadata.result.status, "already_consistent");

  assert.throws(
    () =>
      financialLedgerService.reconcile({
        workspaceId: "ws-1",
        orderId: order.id,
        userId: "user-2",
        actorRole: "member",
      }),
    (error) => error.code === "FINANCIAL_ADMIN_REQUIRED" && error.status === 403
  );

  db.close();
});

test("financial HTTP surface rejects members and serves owner/admin scoped data", async () => {
  const { db, store, ecommerceService, financialLedgerService, audits } = fixture();
  const order = createOrder({ store, ecommerceService, sku: "FIN-HTTP" });
  runWithWorkspace("ws-1", () => {
    ecommerceService.setOrderStatus(order.id, {
      paymentStatus: "PAID",
      paymentReference: "http-001",
    });
  });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.workspace = { id: "ws-1" };
    req.membership = { role: String(req.headers["x-test-role"] || "member") };
    req.user = { id: "user-http" };
    return runWithWorkspace("ws-1", next);
  });
  app.use(
    createEcommerceRouter({
      service: ecommerceService,
      financialLedgerService,
    })
  );

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });

  try {
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;

    const denied = await fetch(`${base}/stores/${store.id}/financial-ledger`, {
      headers: { "x-test-role": "member" },
    });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, "FINANCIAL_ADMIN_REQUIRED");

    const ledger = await fetch(`${base}/stores/${store.id}/financial-ledger`, {
      headers: { "x-test-role": "owner" },
    });
    assert.equal(ledger.status, 200);
    const ledgerBody = await ledger.json();
    assert.equal(ledgerBody.success, true);
    assert.equal(ledgerBody.entries.length, 1);
    assert.equal(ledgerBody.entries[0].orderId, order.id);

    const financials = await fetch(`${base}/commerce/orders/${order.id}/financials`, {
      headers: { "x-test-role": "admin" },
    });
    assert.equal(financials.status, 200);
    const financialsBody = await financials.json();
    assert.equal(financialsBody.financials.summary.paidMinor, order.totalMinor);

    const reconcile = await fetch(
      `${base}/commerce/orders/${order.id}/financials/reconcile`,
      {
        method: "POST",
        headers: { "x-test-role": "admin" },
      }
    );
    assert.equal(reconcile.status, 200);
    assert.equal((await reconcile.json()).reconciliation.status, "already_consistent");
    assert.equal(audits.at(-1).userId, "user-http");
    assert.equal(audits.at(-1).metadata.actorRole, "admin");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
