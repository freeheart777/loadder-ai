import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import express from "express";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createCanonicalCommerceRouter } from "../app/routes/canonical-commerce.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

async function json(response) {
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return body;
}

function fixture() {
  const db = createSiteTestDb();
  const stamp = "2026-09-05T00:00:00.000Z";
  db.prepare(
    "INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?)"
  ).run("ws-1", "Beta Workspace", "beta-workspace", "active", stamp, stamp);

  const projectService = createSiteProjectService({
    repository: createSiteProjectRepository(db),
    businessContextService: {
      getCurrent: () => ({ activeContext: null, isStale: false }),
    },
  });
  const store = runWithWorkspace("ws-1", () =>
    projectService.create({ name: "Beta Acceptance Store", siteType: "STORE", content: {} })
  );

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.workspace = { id: "ws-1" };
    req.membership = { role: "owner" };
    req.user = { id: "beta-owner" };
    return runWithWorkspace("ws-1", next);
  });
  app.use(createCanonicalCommerceRouter({ db }));

  return { db, store, app };
}

test("canonical runtime mounts Commerce through the authenticated API chain", () => {
  const source = readFileSync(new URL("../app/routes/ai.mjs", import.meta.url), "utf8");
  assert.match(source, /import canonicalCommerceRouter from "\.\/canonical-commerce\.mjs"/);
  assert.match(source, /router\.use\(canonicalCommerceRouter\)/);
});

test("beta HTTP journey reaches checkout, capture, partial refund, full refund and financial zero", async () => {
  const { db, store, app } = fixture();
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });

  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    const productBody = await json(await fetch(`${base}/stores/${store.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Beta Product",
        sku: "BETA-001",
        basePriceMinor: 5000,
        inventoryQuantity: 3,
        currency: "USD",
        status: "ACTIVE",
      }),
    }));
    const variantId = productBody.product.variants[0].id;

    const cartBody = await json(await fetch(`${base}/stores/${store.id}/carts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: "USD", email: "beta@example.com" }),
    }));

    const cartWithItem = await json(await fetch(`${base}/commerce/carts/${cartBody.cart.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, quantity: 1 }),
    }));
    assert.equal(cartWithItem.cart.totalMinor, 5000);

    const checkout = await json(await fetch(`${base}/commerce/carts/${cartBody.cart.id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentProvider: "TEST" }),
    }));
    const orderId = checkout.order.id;

    await json(await fetch(`${base}/commerce/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "PAID", paymentReference: "capture-beta-001" }),
    }));

    const firstRefund = await json(await fetch(`${base}/commerce/orders/${orderId}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor: 2000, provider: "TEST", reason: "partial beta refund" }),
    }));
    for (const status of ["APPROVED", "PROCESSING"]) {
      await json(await fetch(`${base}/commerce/refunds/${firstRefund.refund.id}/transitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }));
    }
    await json(await fetch(`${base}/commerce/refunds/${firstRefund.refund.id}/transitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SUCCEEDED", providerReference: "refund-beta-partial-001" }),
    }));

    let order = (await json(await fetch(`${base}/commerce/orders/${orderId}`))).order;
    assert.equal(order.paymentStatus, "PARTIALLY_REFUNDED");
    let financials = (await json(await fetch(`${base}/commerce/orders/${orderId}/financials`))).financials;
    assert.equal(financials.summary.paidMinor, 5000);
    assert.equal(financials.summary.refundedMinor, 2000);
    assert.equal(financials.summary.netMinor, 3000);

    const secondRefund = await json(await fetch(`${base}/commerce/orders/${orderId}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor: 3000, provider: "TEST", reason: "complete beta refund" }),
    }));
    for (const status of ["APPROVED", "PROCESSING"]) {
      await json(await fetch(`${base}/commerce/refunds/${secondRefund.refund.id}/transitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }));
    }
    await json(await fetch(`${base}/commerce/refunds/${secondRefund.refund.id}/transitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SUCCEEDED", providerReference: "refund-beta-full-002" }),
    }));

    order = (await json(await fetch(`${base}/commerce/orders/${orderId}`))).order;
    assert.equal(order.paymentStatus, "REFUNDED");
    financials = (await json(await fetch(`${base}/commerce/orders/${orderId}/financials`))).financials;
    assert.equal(financials.summary.refundedMinor, 5000);
    assert.equal(financials.summary.netMinor, 0);

    const variant = db.prepare("SELECT inventory_quantity FROM ecommerce_variants WHERE id=?").get(variantId);
    assert.equal(variant.inventory_quantity, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ecommerce_financial_ledger WHERE order_id=?").get(orderId).n, 3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
