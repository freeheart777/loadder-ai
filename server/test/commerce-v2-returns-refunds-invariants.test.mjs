import test from "node:test";
import assert from "node:assert/strict";

import { createFulfillment, transitionFulfillment } from "../app/commerce/v2/fulfillment-engine.mjs";
import {
  createReturnRequest,
  transitionReturnRequest,
  getRefundCapacity,
  createRefundRequest,
  transitionRefundRequest,
} from "../app/commerce/v2/returns-refunds-engine.mjs";

const order = Object.freeze({
  id: "order-return-invariants",
  workspaceId: "w1",
  storeId: "s1",
  currency: "IRT",
  status: "CONFIRMED",
  lines: Object.freeze([
    Object.freeze({
      id: "line-1",
      productId: "p1",
      variantId: "v1",
      sku: "SKU-1",
      name: "Phone",
      quantity: 2,
      unitPriceMinor: 100000,
      currency: "IRT",
    }),
  ]),
});

function deliveredFulfillment(quantity = 2) {
  let fulfillment = createFulfillment({
    id: "f-return-invariants",
    order,
    lines: [{ orderLineId: "line-1", quantity }],
    createdAt: "2026-09-05T10:00:00.000Z",
  });
  fulfillment = transitionFulfillment(fulfillment, "PACKING", {
    occurredAt: "2026-09-05T10:10:00.000Z",
  });
  fulfillment = transitionFulfillment(fulfillment, "SHIPPED", {
    occurredAt: "2026-09-05T10:20:00.000Z",
  });
  return transitionFulfillment(fulfillment, "DELIVERED", {
    occurredAt: "2026-09-05T11:00:00.000Z",
  });
}

function approvedReturn({ id = "return-approved", quantity = 2 } = {}) {
  return transitionReturnRequest(
    createReturnRequest({
      id,
      order,
      fulfillments: [deliveredFulfillment()],
      lines: [{ orderLineId: "line-1", quantity }],
      createdAt: "2026-09-05T12:00:00.000Z",
    }),
    "APPROVED",
    { occurredAt: "2026-09-05T12:10:00.000Z" }
  );
}

test("return lifecycle timestamps are valid and monotonic", () => {
  const requested = createReturnRequest({
    id: "return-time",
    order,
    fulfillments: [deliveredFulfillment(1)],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
    createdAt: "2026-09-05T12:00:00.000Z",
  });

  assert.throws(
    () => transitionReturnRequest(requested, "APPROVED", { occurredAt: "not-a-date" }),
    /RETURN_INVALID_TIMESTAMP/
  );
  assert.throws(
    () =>
      transitionReturnRequest(requested, "APPROVED", {
        occurredAt: "2026-09-05T11:59:59.000Z",
      }),
    /RETURN_TIMESTAMP_REGRESSION/
  );

  const approved = transitionReturnRequest(requested, "APPROVED", {
    occurredAt: "2026-09-05T12:10:00.000Z",
  });
  assert.throws(
    () =>
      transitionReturnRequest(approved, "RECEIVED", {
        occurredAt: "2026-09-05T12:09:59.000Z",
      }),
    /RETURN_TIMESTAMP_REGRESSION/
  );
});

test("existing return history is revalidated and cannot release eligibility with malformed quantities", () => {
  const delivered = deliveredFulfillment(2);
  const malformed = {
    id: "return-malformed",
    workspaceId: "w1",
    storeId: "s1",
    orderId: order.id,
    status: "APPROVED",
    lines: [{ orderLineId: "line-1", quantity: -1 }],
  };

  assert.throws(
    () =>
      createReturnRequest({
        id: "return-next",
        order,
        fulfillments: [delivered],
        existingReturns: [malformed],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /RETURN_INVALID_QUANTITY/
  );

  const fractional = {
    ...malformed,
    id: "return-fractional",
    lines: [{ orderLineId: "line-1", quantity: 0.5 }],
  };
  assert.throws(
    () =>
      createReturnRequest({
        id: "return-next-2",
        order,
        fulfillments: [delivered],
        existingReturns: [fractional],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /RETURN_INVALID_QUANTITY/
  );
});

test("return IDs are unique within supplied return history", () => {
  const delivered = deliveredFulfillment(1);
  const existing = createReturnRequest({
    id: "return-duplicate",
    order,
    fulfillments: [delivered],
    lines: [{ orderLineId: "line-1", quantity: 1 }],
  });

  assert.throws(
    () =>
      createReturnRequest({
        id: "return-duplicate",
        order,
        fulfillments: [delivered],
        existingReturns: [existing],
        lines: [{ orderLineId: "line-1", quantity: 1 }],
      }),
    /RETURN_DUPLICATE_ID/
  );
});

test("refund financial snapshot rejects inconsistent declared refundable amount", () => {
  assert.throws(
    () =>
      getRefundCapacity({
        capturedMinor: 100000,
        refundedMinor: 20000,
        refundableMinor: 90000,
        currency: "IRT",
      }),
    /REFUND_FINANCIAL_SNAPSHOT_INVALID/
  );
});

test("in-flight refunds reserve capture capacity and prevent concurrent over-refund", () => {
  const returned = approvedReturn({ quantity: 2 });
  const first = createRefundRequest({
    id: "refund-first",
    order,
    returnRequest: returned,
    amountMinor: 70000,
    financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
  });

  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-second",
        order,
        returnRequest: returned,
        amountMinor: 140000,
        financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
        existingRefunds: [first],
      }),
    /REFUND_AMOUNT_EXCEEDS_AVAILABLE_CAPACITY/
  );
});

test("multiple refunds for the same return cannot exceed returned merchandise value", () => {
  const returned = approvedReturn({ quantity: 1 });
  const first = createRefundRequest({
    id: "refund-merch-first",
    order,
    returnRequest: returned,
    amountMinor: 60000,
    financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
  });

  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-merch-second",
        order,
        returnRequest: returned,
        amountMinor: 50000,
        financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
        existingRefunds: [first],
      }),
    /REFUND_AMOUNT_EXCEEDS_RETURN_REMAINING/
  );
});

test("failed or cancelled refund requests release reserved financial capacity", () => {
  const returned = approvedReturn({ quantity: 2 });
  const requested = createRefundRequest({
    id: "refund-release",
    order,
    returnRequest: returned,
    amountMinor: 120000,
    financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
    createdAt: "2026-09-05T12:20:00.000Z",
  });
  const approved = transitionRefundRequest(requested, "APPROVED", {
    occurredAt: "2026-09-05T13:00:00.000Z",
  });
  const cancelled = transitionRefundRequest(approved, "CANCELLED", {
    occurredAt: "2026-09-05T13:10:00.000Z",
  });

  const replacement = createRefundRequest({
    id: "refund-replacement",
    order,
    returnRequest: returned,
    amountMinor: 120000,
    financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
    existingRefunds: [cancelled],
  });
  assert.equal(replacement.amountMinor, 120000);
});

test("known succeeded refunds require a financial snapshot that has caught up", () => {
  const returned = approvedReturn({ quantity: 2 });
  let succeeded = createRefundRequest({
    id: "refund-succeeded-known",
    order,
    returnRequest: returned,
    amountMinor: 50000,
    financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
    createdAt: "2026-09-05T12:20:00.000Z",
  });
  succeeded = transitionRefundRequest(succeeded, "APPROVED", {
    occurredAt: "2026-09-05T13:00:00.000Z",
  });
  succeeded = transitionRefundRequest(succeeded, "PROCESSING", {
    occurredAt: "2026-09-05T13:10:00.000Z",
  });
  succeeded = transitionRefundRequest(succeeded, "SUCCEEDED", {
    occurredAt: "2026-09-05T13:20:00.000Z",
    providerReference: "provider-success-1",
  });

  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-after-stale-success",
        order,
        returnRequest: returned,
        amountMinor: 10000,
        financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
        existingRefunds: [succeeded],
      }),
    /REFUND_FINANCIAL_SNAPSHOT_STALE/
  );
});

test("refund request revalidates immutable return snapshots before using merchandise value", () => {
  const returned = approvedReturn({ quantity: 1 });
  const tampered = {
    ...structuredClone(returned),
    lines: [{ ...structuredClone(returned.lines[0]), unitPriceMinor: 999999 }],
  };

  assert.throws(
    () =>
      createRefundRequest({
        id: "refund-tampered-return",
        order,
        returnRequest: tampered,
        amountMinor: 100000,
        financialSnapshot: { capturedMinor: 200000, refundedMinor: 0, currency: "IRT" },
      }),
    /RETURN_SNAPSHOT_MISMATCH/
  );
});

test("refund lifecycle timestamps are valid and monotonic", () => {
  const returned = approvedReturn({ quantity: 1 });
  const requested = createRefundRequest({
    id: "refund-time",
    order,
    returnRequest: returned,
    amountMinor: 50000,
    financialSnapshot: { capturedMinor: 100000, refundedMinor: 0, currency: "IRT" },
    createdAt: "2026-09-05T14:00:00.000Z",
  });

  assert.throws(
    () => transitionRefundRequest(requested, "APPROVED", { occurredAt: "bad-time" }),
    /REFUND_INVALID_TIMESTAMP/
  );
  assert.throws(
    () =>
      transitionRefundRequest(requested, "APPROVED", {
        occurredAt: "2026-09-05T13:59:59.000Z",
      }),
    /REFUND_TIMESTAMP_REGRESSION/
  );
});
