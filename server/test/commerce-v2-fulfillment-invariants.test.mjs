import test from "node:test";
import assert from "node:assert/strict";

import {
  createFulfillment,
  transitionFulfillment,
  summarizeOrderFulfillment,
} from "../app/commerce/v2/fulfillment-engine.mjs";

const order = Object.freeze({
  id: "order-invariants",
  workspaceId: "w1",
  storeId: "s1",
  status: "CONFIRMED",
  lines: Object.freeze([
    Object.freeze({
      id: "line-1",
      productId: "p1",
      variantId: "v1",
      sku: "SKU-1",
      name: "Phone",
      quantity: 2,
    }),
  ]),
});

test("fulfillment lifecycle timestamps cannot move backwards", () => {
  const pending = createFulfillment({
    id: "f-time",
    order,
    lines: [{ orderLineId: "line-1", quantity: 1 }],
    createdAt: "2026-09-05T10:00:00.000Z",
  });

  assert.throws(
    () =>
      transitionFulfillment(pending, "PACKING", {
        occurredAt: "2026-09-05T09:59:59.000Z",
      }),
    /FULFILLMENT_TIMESTAMP_REGRESSION/
  );

  const packing = transitionFulfillment(pending, "PACKING", {
    occurredAt: "2026-09-05T10:10:00.000Z",
  });
  assert.throws(
    () =>
      transitionFulfillment(packing, "SHIPPED", {
        occurredAt: "2026-09-05T10:09:59.000Z",
      }),
    /FULFILLMENT_TIMESTAMP_REGRESSION/
  );

  const shipped = transitionFulfillment(packing, "SHIPPED", {
    occurredAt: "2026-09-05T10:20:00.000Z",
  });
  assert.throws(
    () =>
      transitionFulfillment(shipped, "DELIVERED", {
        occurredAt: "2026-09-05T10:19:59.000Z",
      }),
    /FULFILLMENT_TIMESTAMP_REGRESSION/
  );

  assert.throws(
    () => transitionFulfillment(pending, "PACKING", { occurredAt: "not-a-date" }),
    /FULFILLMENT_INVALID_TIMESTAMP/
  );
});

test("malformed existing fulfillment quantities cannot corrupt allocation or summaries", () => {
  const malformed = {
    id: "f-malformed",
    workspaceId: "w1",
    storeId: "s1",
    orderId: order.id,
    status: "SHIPPED",
    lines: [{ orderLineId: "line-1", quantity: -1 }],
  };

  assert.throws(
    () =>
      createFulfillment({
        id: "f-next",
        order,
        existingFulfillments: [malformed],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /FULFILLMENT_INVALID_QUANTITY/
  );

  assert.throws(
    () => summarizeOrderFulfillment(order, [malformed]),
    /FULFILLMENT_INVALID_QUANTITY/
  );

  const fractional = {
    ...malformed,
    id: "f-fractional",
    lines: [{ orderLineId: "line-1", quantity: 0.5 }],
  };
  assert.throws(
    () => summarizeOrderFulfillment(order, [fractional]),
    /FULFILLMENT_INVALID_QUANTITY/
  );
});
