import test from "node:test";
import assert from "node:assert/strict";
import { createInventoryState, reserveInventory } from "../app/commerce/v2/inventory-reservation-engine.mjs";
import { createCart, addLine } from "../app/commerce/v2/cart-engine.mjs";
import { checkoutCart } from "../app/commerce/v2/checkout-engine.mjs";
import { transitionOrder } from "../app/commerce/v2/order-core.mjs";
import {
  createFulfillment,
  transitionFulfillment,
  recordTrackingEvent,
  summarizeOrderFulfillment,
} from "../app/commerce/v2/fulfillment-engine.mjs";

const selector = {
  workspaceId: "w1",
  storeId: "s1",
  variantId: "v1",
  locationId: "default",
};
const address = {
  name: "Test Buyer",
  phone: "09120000000",
  city: "Tehran",
  address1: "Street 1",
  country: "IR",
};

function orderFixture({ quantity = 2 } = {}) {
  let inventory = createInventoryState([{ ...selector, onHand: 10 }]);
  inventory = reserveInventory(inventory, selector, quantity).state;
  let cart = createCart({ id: "cart-fulfill", workspaceId: "w1", storeId: "s1", currency: "IRT" });
  cart = addLine(cart, {
    id: "line-1",
    workspaceId: "w1",
    storeId: "s1",
    productId: "p1",
    variantId: "v1",
    sku: "SKU-1",
    name: "Phone",
    quantity,
    unitPriceMinor: 100000,
    currency: "IRT",
    reservationId: "res-fulfill",
  });
  const { order } = checkoutCart({
    cart,
    inventoryState: inventory,
    orderId: "order-fulfill",
    shippingAddress: address,
    createdAt: "2026-09-05T00:00:00.000Z",
  });
  return transitionOrder(order, "CONFIRMED");
}

const ship = (fulfillment, at = "2026-09-05T01:00:00.000Z") =>
  transitionFulfillment(
    transitionFulfillment(fulfillment, "PACKING", { occurredAt: at }),
    "SHIPPED",
    {
      occurredAt: at,
      carrier: "POST",
      trackingNumber: `TRK-${fulfillment.id}`,
    }
  );

test("partial fulfillments derive PARTIAL then FULFILLED without over-fulfilling order lines", () => {
  const order = orderFixture({ quantity: 2 });
  const firstPending = createFulfillment({
    id: "f-1",
    order,
    lines: [{ orderLineId: "line-1", quantity: 1 }],
    createdAt: "2026-09-05T00:10:00.000Z",
  });

  const allocatedOnly = summarizeOrderFulfillment(order, [firstPending]);
  assert.equal(allocatedOnly.status, "UNFULFILLED");
  assert.equal(allocatedOnly.allocatedQuantity, 1);
  assert.equal(allocatedOnly.fulfilledQuantity, 0);
  assert.equal(allocatedOnly.lines[0].unallocatedQuantity, 1);

  const firstShipped = ship(firstPending);
  const partial = summarizeOrderFulfillment(order, [firstShipped]);
  assert.equal(partial.status, "PARTIAL");
  assert.equal(partial.fulfilledQuantity, 1);
  assert.equal(partial.lines[0].remainingQuantity, 1);

  const secondPending = createFulfillment({
    id: "f-2",
    order,
    existingFulfillments: [firstShipped],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });
  const secondShipped = ship(secondPending, "2026-09-05T02:00:00.000Z");
  const complete = summarizeOrderFulfillment(order, [firstShipped, secondShipped]);
  assert.equal(complete.status, "FULFILLED");
  assert.equal(complete.allocatedQuantity, 2);
  assert.equal(complete.fulfilledQuantity, 2);
  assert.equal(complete.lines[0].remainingQuantity, 0);

  assert.throws(
    () =>
      createFulfillment({
        id: "f-over",
        order,
        existingFulfillments: [firstShipped, secondShipped],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /FULFILLMENT_QUANTITY_EXCEEDED/
  );
});

test("cancelling an unshipped fulfillment releases its allocation for a replacement fulfillment", () => {
  const order = orderFixture({ quantity: 1 });
  const pending = createFulfillment({
    id: "f-cancel",
    order,
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });
  assert.throws(
    () =>
      createFulfillment({
        id: "f-blocked",
        order,
        existingFulfillments: [pending],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /FULFILLMENT_QUANTITY_EXCEEDED/
  );

  const cancelled = transitionFulfillment(pending, "CANCELLED", {
    occurredAt: "2026-09-05T00:30:00.000Z",
  });
  const summary = summarizeOrderFulfillment(order, [cancelled]);
  assert.equal(summary.allocatedQuantity, 0);
  assert.equal(summary.fulfilledQuantity, 0);
  assert.equal(summary.status, "UNFULFILLED");

  const replacement = createFulfillment({
    id: "f-replacement",
    order,
    existingFulfillments: [cancelled],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });
  assert.equal(replacement.status, "PENDING");
});

test("tracking is append-only and fulfillment transitions are forward-only without mutating inputs", () => {
  const order = orderFixture({ quantity: 1 });
  const pending = createFulfillment({
    id: "f-track",
    order,
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });
  const before = structuredClone(pending);
  const tracked = recordTrackingEvent(pending, {
    id: "track-1",
    status: "LABEL_CREATED",
    message: "Carrier label created",
    occurredAt: "2026-09-05T00:20:00.000Z",
  });

  assert.deepEqual(pending, before);
  assert.equal(pending.trackingEvents.length, 0);
  assert.equal(tracked.trackingEvents.length, 1);
  assert.ok(Object.isFrozen(tracked));
  assert.ok(Object.isFrozen(tracked.trackingEvents));
  assert.ok(Object.isFrozen(tracked.trackingEvents[0]));
  assert.throws(
    () => recordTrackingEvent(tracked, { id: "track-1", status: "DUPLICATE" }),
    /DUPLICATE_TRACKING_EVENT/
  );

  const shipped = ship(tracked);
  const inTransit = recordTrackingEvent(shipped, {
    id: "track-2",
    status: "IN_TRANSIT",
    location: "Tehran Hub",
  });
  const delivered = transitionFulfillment(inTransit, "DELIVERED", {
    occurredAt: "2026-09-06T09:00:00.000Z",
  });
  assert.equal(delivered.status, "DELIVERED");
  assert.equal(delivered.trackingEvents.length, 2);
  assert.throws(
    () => transitionFulfillment(delivered, "SHIPPED"),
    /INVALID_FULFILLMENT_TRANSITION/
  );

  const cancelled = transitionFulfillment(
    createFulfillment({
      id: "f-no-track",
      order,
      lines: [{ orderLineId: "line-1", quantity: 1 }],
    }),
    "CANCELLED"
  );
  assert.throws(
    () => recordTrackingEvent(cancelled, { id: "x", status: "IN_TRANSIT" }),
    /CANCELLED_FULFILLMENT_TRACKING_FORBIDDEN/
  );
});

test("fulfillment rejects wrong ownership, unknown lines and non-fulfillable order states", () => {
  const confirmed = orderFixture({ quantity: 1 });
  assert.throws(
    () =>
      createFulfillment({
        id: "unknown-line",
        order: confirmed,
        lines: [{ orderLineId: "missing", quantity: 1 }],
      }),
    /FULFILLMENT_UNKNOWN_ORDER_LINE/
  );

  const fulfillment = createFulfillment({
    id: "f-owner",
    order: confirmed,
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });
  assert.throws(
    () =>
      summarizeOrderFulfillment(confirmed, [
        { ...structuredClone(fulfillment), workspaceId: "w2" },
      ]),
    /FULFILLMENT_WORKSPACE_MISMATCH/
  );

  const cancelledOrder = transitionOrder(confirmed, "CANCELLED");
  assert.throws(
    () =>
      createFulfillment({
        id: "f-cancelled-order",
        order: cancelledOrder,
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /ORDER_NOT_FULFILLABLE/
  );
});
