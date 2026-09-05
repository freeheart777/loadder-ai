import test from "node:test";
import assert from "node:assert/strict";
import { createInventoryState, reserveInventory } from "../app/commerce/v2/inventory-reservation-engine.mjs";
import { createCart, addLine } from "../app/commerce/v2/cart-engine.mjs";
import { checkoutCart } from "../app/commerce/v2/checkout-engine.mjs";
import { transitionOrder } from "../app/commerce/v2/order-core.mjs";
import { createFulfillment, transitionFulfillment } from "../app/commerce/v2/fulfillment-engine.mjs";
import {
  createReturnRequest,
  transitionReturnRequest,
  getRefundCapacity,
  createRefundRequest,
  transitionRefundRequest,
} from "../app/commerce/v2/returns-refunds-engine.mjs";

const selector = {
  workspaceId: "w1",
  storeId: "s1",
  variantId: "v1",
  locationId: "default",
};
const address = {
  name: "Return Buyer",
  phone: "09120000000",
  city: "Tehran",
  address1: "Street 1",
  country: "IR",
};

function orderFixture({ quantity = 2 } = {}) {
  let inventory = createInventoryState([{ ...selector, onHand: 10 }]);
  inventory = reserveInventory(inventory, selector, quantity).state;
  let cart = createCart({ id: "cart-return", workspaceId: "w1", storeId: "s1", currency: "IRT" });
  cart = addLine(cart, {
    id: "line-1",
    workspaceId: "w1",
    storeId: "s1",
    productId: "p1",
    variantId: "v1",
    sku: "SKU-RETURN",
    name: "Returnable Product",
    quantity,
    unitPriceMinor: 100000,
    currency: "IRT",
    reservationId: "res-return",
  });
  const { order } = checkoutCart({
    cart,
    inventoryState: inventory,
    orderId: "order-return",
    shippingAddress: address,
    createdAt: "2026-09-05T00:00:00.000Z",
  });
  return transitionOrder(order, "CONFIRMED");
}

function fulfillmentFor(order, { id = "fulfill-1", quantity = 1, delivered = true } = {}) {
  let fulfillment = createFulfillment({
    id,
    order,
    lines: [{ orderLineId: "line-1", quantity }],
    createdAt: "2026-09-05T01:00:00.000Z",
  });
  fulfillment = transitionFulfillment(fulfillment, "PACKING", {
    occurredAt: "2026-09-05T01:10:00.000Z",
  });
  fulfillment = transitionFulfillment(fulfillment, "SHIPPED", {
    occurredAt: "2026-09-05T01:20:00.000Z",
    carrier: "POST",
    trackingNumber: `TRACK-${id}`,
  });
  if (delivered) {
    fulfillment = transitionFulfillment(fulfillment, "DELIVERED", {
      occurredAt: "2026-09-06T08:00:00.000Z",
    });
  }
  return fulfillment;
}

test("returns are limited by delivered quantity, not shipped or ordered quantity", () => {
  const order = orderFixture({ quantity: 2 });
  const delivered = fulfillmentFor(order, { id: "delivered", quantity: 1, delivered: true });
  const shippedOnly = fulfillmentFor(order, { id: "shipped", quantity: 1, delivered: false });

  const request = createReturnRequest({
    id: "return-1",
    order,
    fulfillments: [delivered, shippedOnly],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
    reason: "Changed mind",
  });
  assert.equal(request.status, "REQUESTED");
  assert.equal(request.lines[0].quantity, 1);
  assert.equal(request.lines[0].unitPriceMinor, 100000);

  assert.throws(
    () =>
      createReturnRequest({
        id: "return-too-much",
        order,
        fulfillments: [delivered, shippedOnly],
        lines: [{ orderLineId: "line-1", quantity: 2 }],
      }),
    /RETURN_QUANTITY_EXCEEDS_DELIVERED/
  );
});

test("active returns consume delivered eligibility while cancelled returns release it", () => {
  const order = orderFixture({ quantity: 1 });
  const delivered = fulfillmentFor(order, { quantity: 1 });
  const first = createReturnRequest({
    id: "return-first",
    order,
    fulfillments: [delivered],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });

  assert.throws(
    () =>
      createReturnRequest({
        id: "return-blocked",
        order,
        fulfillments: [delivered],
        existingReturns: [first],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /RETURN_QUANTITY_EXCEEDS_DELIVERED/
  );

  const cancelled = transitionReturnRequest(first, "CANCELLED", {
    occurredAt: "2026-09-06T10:00:00.000Z",
  });
  const replacement = createReturnRequest({
    id: "return-replacement",
    order,
    fulfillments: [delivered],
    existingReturns: [cancelled],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });
  assert.equal(replacement.status, "REQUESTED");
});

test("return lifecycle is forward-only, frozen and tenant-bound", () => {
  const order = orderFixture({ quantity: 1 });
  const delivered = fulfillmentFor(order, { quantity: 1 });
  const requested = createReturnRequest({
    id: "return-life",
    order,
    fulfillments: [delivered],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });
  const before = structuredClone(requested);
  const approved = transitionReturnRequest(requested, "APPROVED", {
    occurredAt: "2026-09-06T11:00:00.000Z",
  });
  const received = transitionReturnRequest(approved, "RECEIVED", {
    occurredAt: "2026-09-07T11:00:00.000Z",
  });

  assert.deepEqual(requested, before);
  assert.ok(Object.isFrozen(approved));
  assert.ok(Object.isFrozen(approved.lines));
  assert.equal(received.status, "RECEIVED");
  assert.throws(() => transitionReturnRequest(received, "APPROVED"), /INVALID_RETURN_TRANSITION/);

  assert.throws(
    () =>
      createReturnRequest({
        id: "return-cross-tenant",
        order,
        fulfillments: [
          { ...structuredClone(delivered), workspaceId: "w2" },
        ],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /FULFILLMENT_WORKSPACE_MISMATCH/
  );
});

test("refund request is capped by authoritative capture capacity and returned merchandise gross", () => {
  const order = orderFixture({ quantity: 1 });
  const delivered = fulfillmentFor(order, { quantity: 1 });
  const approvedReturn = transitionReturnRequest(
    createReturnRequest({
      id: "return-refund",
      order,
      fulfillments: [delivered],
      lines: [{ orderLineId: "line-1", quantity: 1 }],
    }),
    "APPROVED"
  );

  const capacity = getRefundCapacity({ capturedMinor: 150000, refundedMinor: 20000, currency: "IRT" });
  assert.equal(capacity.refundableMinor, 130000);

  const refund = createRefundRequest({
    id: "refund-1",
    order,
    returnRequest: approvedReturn,
    amountMinor: 90000,
    financialSnapshot: capacity,
    reason: "Approved merchandise refund",
  });
  assert.equal(refund.status, "REQUESTED");
  assert.equal(refund.amountMinor, 90000);
  assert.equal(refund.currency, "IRT");
  assert.equal(refund.returnMerchandiseGrossMinor, 100000);

  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-gross-over",
        order,
        returnRequest: approvedReturn,
        amountMinor: 100001,
        financialSnapshot: capacity,
      }),
    /REFUND_AMOUNT_EXCEEDS_RETURN_MERCHANDISE/
  );
  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-capture-over",
        order,
        returnRequest: approvedReturn,
        amountMinor: 90000,
        financialSnapshot: { capturedMinor: 80000, refundedMinor: 0, currency: "IRT" },
      }),
    /REFUND_AMOUNT_EXCEEDS_CAPTURE/
  );
  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-currency",
        order,
        returnRequest: approvedReturn,
        amountMinor: 50000,
        financialSnapshot: { capturedMinor: 100000, refundedMinor: 0, currency: "USD" },
      }),
    /REFUND_CURRENCY_MISMATCH/
  );
});

test("refund success requires a provider reference and never mutates earlier request snapshots", () => {
  const order = orderFixture({ quantity: 1 });
  const delivered = fulfillmentFor(order, { quantity: 1 });
  const approvedReturn = transitionReturnRequest(
    createReturnRequest({
      id: "return-provider",
      order,
      fulfillments: [delivered],
      lines: [{ orderLineId: "line-1", quantity: 1 }],
    }),
    "APPROVED"
  );
  const requested = createRefundRequest({
    id: "refund-provider",
    order,
    returnRequest: approvedReturn,
    amountMinor: 50000,
    financialSnapshot: { capturedMinor: 100000, refundedMinor: 0, currency: "IRT" },
  });
  const before = structuredClone(requested);
  const approved = transitionRefundRequest(requested, "APPROVED");
  const processing = transitionRefundRequest(approved, "PROCESSING");

  assert.throws(
    () => transitionRefundRequest(processing, "SUCCEEDED"),
    /REFUND_PROVIDER_REFERENCE_REQUIRED/
  );
  const succeeded = transitionRefundRequest(processing, "SUCCEEDED", {
    providerReference: "provider-ref-001",
    occurredAt: "2026-09-07T12:00:00.000Z",
  });

  assert.deepEqual(requested, before);
  assert.equal(succeeded.status, "SUCCEEDED");
  assert.equal(succeeded.providerReference, "provider-ref-001");
  assert.ok(Object.isFrozen(succeeded));
  assert.throws(
    () => transitionRefundRequest(succeeded, "PROCESSING"),
    /INVALID_REFUND_TRANSITION/
  );
});

test("refund cannot be requested before the return is approved", () => {
  const order = orderFixture({ quantity: 1 });
  const delivered = fulfillmentFor(order, { quantity: 1 });
  const requestedReturn = createReturnRequest({
    id: "return-not-approved",
    order,
    fulfillments: [delivered],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });

  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-too-early",
        order,
        returnRequest: requestedReturn,
        amountMinor: 50000,
        financialSnapshot: { capturedMinor: 100000, refundedMinor: 0, currency: "IRT" },
      }),
    /RETURN_NOT_REFUNDABLE/
  );
});
