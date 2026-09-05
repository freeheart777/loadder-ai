import test from "node:test";
import assert from "node:assert/strict";

import {
  createRefundRequest,
  transitionRefundRequest,
} from "../app/commerce/v2/returns-refunds-engine.mjs";

const order = Object.freeze({
  id: "order-provider-idempotency",
  workspaceId: "w1",
  storeId: "s1",
  currency: "IRT",
  lines: Object.freeze([
    Object.freeze({
      id: "line-1",
      productId: "p1",
      variantId: "v1",
      sku: "SKU-1",
      name: "Phone",
      quantity: 1,
      unitPriceMinor: 100000,
      currency: "IRT",
    }),
  ]),
});

const approvedReturn = Object.freeze({
  id: "return-provider-idempotency",
  workspaceId: "w1",
  storeId: "s1",
  orderId: order.id,
  status: "APPROVED",
  lines: Object.freeze([
    Object.freeze({
      orderLineId: "line-1",
      productId: "p1",
      variantId: "v1",
      sku: "SKU-1",
      name: "Phone",
      quantity: 1,
      unitPriceMinor: 100000,
      currency: "IRT",
    }),
  ]),
});

const snapshot = Object.freeze({ capturedMinor: 100000, refundedMinor: 0, currency: "IRT" });

function processingRefund(id, amountMinor, existingRefunds = []) {
  let refund = createRefundRequest({
    id,
    order,
    returnRequest: approvedReturn,
    amountMinor,
    financialSnapshot: snapshot,
    existingRefunds,
    createdAt: "2026-09-05T15:00:00.000Z",
  });
  refund = transitionRefundRequest(refund, "APPROVED", {
    occurredAt: "2026-09-05T15:10:00.000Z",
  });
  return transitionRefundRequest(refund, "PROCESSING", {
    occurredAt: "2026-09-05T15:20:00.000Z",
  });
}

test("refund request requires a stable return ID", () => {
  const withoutId = { ...structuredClone(approvedReturn), id: "" };
  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-no-return-id",
        order,
        returnRequest: withoutId,
        amountMinor: 10000,
        financialSnapshot: snapshot,
      }),
    /REFUND_RETURN_ID_REQUIRED/
  );
});

test("a successful provider refund reference cannot be reused by another refund request", () => {
  const firstProcessing = processingRefund("refund-provider-first", 40000);
  const firstSucceeded = transitionRefundRequest(firstProcessing, "SUCCEEDED", {
    occurredAt: "2026-09-05T15:30:00.000Z",
    providerReference: "provider-ref-shared",
  });

  const secondProcessing = processingRefund("refund-provider-second", 30000, [firstProcessing]);
  assert.throws(
    () =>
      transitionRefundRequest(secondProcessing, "SUCCEEDED", {
        occurredAt: "2026-09-05T15:40:00.000Z",
        providerReference: "provider-ref-shared",
        existingRefunds: [firstSucceeded],
      }),
    /REFUND_PROVIDER_REFERENCE_DUPLICATE/
  );
});
