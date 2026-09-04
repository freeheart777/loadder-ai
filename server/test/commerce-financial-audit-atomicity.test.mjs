import assert from "node:assert/strict";
import test from "node:test";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createEcommerceService } from "../app/services/ecommerce-service.mjs";
import { createFinancialLedgerService } from "../app/commerce/v2/financial-ledger.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

test("reconciliation repair rolls back when the required audit write fails", () => {
  const db = createSiteTestDb();
  const projectService = createSiteProjectService({
    repository: createSiteProjectRepository(db),
    businessContextService: {
      getCurrent: () => ({ activeContext: { id: "ctx-audit" }, isStale: false }),
    },
  });
  const store = runWithWorkspace("ws-1", () =>
    projectService.create({ name: "Audit Atomicity Store", siteType: "STORE", content: {} })
  );
  const ecommerceService = createEcommerceService({ db });

  const order = runWithWorkspace("ws-1", () => {
    const product = ecommerceService.createProduct(store.id, {
      name: "Audit Atomicity Product",
      sku: "FIN-AUDIT-ROLLBACK",
      basePriceMinor: 4800,
      inventoryQuantity: 2,
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

  db.exec("DROP TRIGGER trg_ecommerce_payment_captured_ledger");
  runWithWorkspace("ws-1", () => {
    ecommerceService.setOrderStatus(order.id, {
      paymentStatus: "PAID",
      paymentReference: "audit-fail-capture",
    });
  });

  const financialLedgerService = createFinancialLedgerService({
    db,
    auditRepository: {
      createAuditLog() {
        throw new Error("audit storage unavailable");
      },
    },
    clock: () => "2026-09-05T00:00:00.000Z",
  });

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM ecommerce_financial_ledger WHERE order_id=?").get(order.id).count,
    0
  );

  assert.throws(
    () =>
      financialLedgerService.reconcile({
        workspaceId: "ws-1",
        orderId: order.id,
        userId: "owner-1",
        actorRole: "owner",
      }),
    /audit storage unavailable/
  );

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM ecommerce_financial_ledger WHERE order_id=?").get(order.id).count,
    0,
    "ledger repair must rollback when the mandatory audit write fails"
  );

  db.close();
});
