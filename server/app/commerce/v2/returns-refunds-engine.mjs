import { summarizeOrderFulfillment } from "./fulfillment-engine.mjs";

const text = (value, max = 500) => {
  const normalized = String(value ?? "").trim();
  if (normalized.length > max) throw new RangeError("TEXT_TOO_LONG");
  return normalized;
};

const clone = (value) => structuredClone(value);
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

const positiveInt = (value, code) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(code);
  return number;
};

const nonNegativeInt = (value, code) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(code);
  return number;
};

const timestamp = (value) => text(value, 80) || new Date().toISOString();

const activeReturnStatuses = new Set(["REQUESTED", "APPROVED", "RECEIVED"]);
const returnStatuses = new Set(["REQUESTED", "APPROVED", "RECEIVED", "REJECTED", "CANCELLED"]);
const refundableReturnStatuses = new Set(["APPROVED", "RECEIVED"]);
const refundStatuses = new Set([
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

const assertOrder = (order) => {
  if (!order || typeof order !== "object") throw new TypeError("RETURN_ORDER_REQUIRED");
  if (!text(order.id)) throw new TypeError("RETURN_ORDER_ID_REQUIRED");
  if (!text(order.workspaceId)) throw new TypeError("RETURN_WORKSPACE_REQUIRED");
  if (!text(order.storeId)) throw new TypeError("RETURN_STORE_REQUIRED");
  if (!text(order.currency)) throw new TypeError("RETURN_CURRENCY_REQUIRED");
  if (!Array.isArray(order.lines) || order.lines.length === 0) throw new Error("RETURN_ORDER_LINES_REQUIRED");
};

const assertReturnOwnership = (order, returnRequest) => {
  if (returnRequest.orderId !== order.id) throw new Error("RETURN_ORDER_MISMATCH");
  if (returnRequest.workspaceId !== order.workspaceId) throw new Error("RETURN_WORKSPACE_MISMATCH");
  if (returnRequest.storeId !== order.storeId) throw new Error("RETURN_STORE_MISMATCH");
};

const returnedByLine = (order, existingReturns = []) => {
  const totals = new Map(order.lines.map((line) => [line.id, 0]));
  for (const returnRequest of existingReturns) {
    assertReturnOwnership(order, returnRequest);
    if (!returnStatuses.has(returnRequest.status)) throw new Error("RETURN_INVALID_STATUS");
    if (!activeReturnStatuses.has(returnRequest.status)) continue;
    for (const line of returnRequest.lines || []) {
      if (!totals.has(line.orderLineId)) throw new Error("RETURN_UNKNOWN_ORDER_LINE");
      totals.set(line.orderLineId, totals.get(line.orderLineId) + line.quantity);
    }
  }
  return totals;
};

export function createReturnRequest({
  id,
  order,
  fulfillments = [],
  existingReturns = [],
  lines,
  reason = "",
  createdAt,
  metadata = {},
} = {}) {
  assertOrder(order);
  const returnId = text(id, 200);
  if (!returnId) throw new TypeError("RETURN_ID_REQUIRED");
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("RETURN_LINES_REQUIRED");

  const fulfillment = summarizeOrderFulfillment(order, fulfillments);
  const delivered = new Map(
    fulfillment.lines.map((line) => [line.orderLineId, line.deliveredQuantity])
  );
  const alreadyReturned = returnedByLine(order, existingReturns);

  const normalizedLines = lines.map((rawLine) => {
    const orderLineId = text(rawLine?.orderLineId ?? rawLine?.lineId, 200);
    if (!orderLineId) throw new Error("RETURN_ORDER_LINE_REQUIRED");
    const orderLine = order.lines.find((line) => line.id === orderLineId);
    if (!orderLine) throw new Error("RETURN_UNKNOWN_ORDER_LINE");
    const quantity = positiveInt(rawLine?.quantity, "RETURN_INVALID_QUANTITY");
    const deliveredQuantity = delivered.get(orderLineId) || 0;
    const consumedQuantity = alreadyReturned.get(orderLineId) || 0;
    if (quantity > deliveredQuantity - consumedQuantity) {
      throw new Error("RETURN_QUANTITY_EXCEEDS_DELIVERED");
    }
    return {
      orderLineId,
      productId: orderLine.productId,
      variantId: orderLine.variantId,
      sku: orderLine.sku,
      name: orderLine.name,
      quantity,
      unitPriceMinor: orderLine.unitPriceMinor,
      currency: orderLine.currency,
    };
  });

  if (new Set(normalizedLines.map((line) => line.orderLineId)).size !== normalizedLines.length) {
    throw new Error("RETURN_DUPLICATE_ORDER_LINE");
  }

  const now = timestamp(createdAt);
  return deepFreeze({
    id: returnId,
    workspaceId: order.workspaceId,
    storeId: order.storeId,
    orderId: order.id,
    status: "REQUESTED",
    reason: text(reason, 1000),
    lines: normalizedLines,
    metadata: clone(metadata || {}),
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    receivedAt: null,
    rejectedAt: null,
    cancelledAt: null,
  });
}

export function transitionReturnRequest(returnRequest, nextStatus, { occurredAt } = {}) {
  if (!returnRequest || typeof returnRequest !== "object") throw new TypeError("RETURN_REQUIRED");
  const current = text(returnRequest.status, 40).toUpperCase();
  const next = text(nextStatus, 40).toUpperCase();
  const allowed = {
    REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["RECEIVED", "CANCELLED"],
    RECEIVED: [],
    REJECTED: [],
    CANCELLED: [],
  };
  if (!(allowed[current] || []).includes(next)) throw new Error("INVALID_RETURN_TRANSITION");

  const at = timestamp(occurredAt);
  const result = { ...clone(returnRequest), status: next, updatedAt: at };
  if (next === "APPROVED") result.approvedAt = at;
  if (next === "RECEIVED") result.receivedAt = at;
  if (next === "REJECTED") result.rejectedAt = at;
  if (next === "CANCELLED") result.cancelledAt = at;
  return deepFreeze(result);
}

export function getRefundCapacity({ capturedMinor, refundedMinor = 0, currency } = {}) {
  const captured = nonNegativeInt(capturedMinor, "REFUND_INVALID_CAPTURED_AMOUNT");
  const refunded = nonNegativeInt(refundedMinor, "REFUND_INVALID_REFUNDED_AMOUNT");
  const normalizedCurrency = text(currency, 20).toUpperCase();
  if (!normalizedCurrency) throw new Error("REFUND_CURRENCY_REQUIRED");
  if (refunded > captured) throw new Error("REFUND_FINANCIAL_SNAPSHOT_INVALID");
  return deepFreeze({
    capturedMinor: captured,
    refundedMinor: refunded,
    refundableMinor: captured - refunded,
    currency: normalizedCurrency,
  });
}

export function createRefundRequest({
  id,
  order,
  returnRequest,
  amountMinor,
  financialSnapshot,
  reason = "",
  createdAt,
  metadata = {},
} = {}) {
  assertOrder(order);
  if (!returnRequest || typeof returnRequest !== "object") throw new TypeError("REFUND_RETURN_REQUIRED");
  assertReturnOwnership(order, returnRequest);
  if (!refundableReturnStatuses.has(returnRequest.status)) {
    throw new Error("RETURN_NOT_REFUNDABLE");
  }

  const refundId = text(id, 200);
  if (!refundId) throw new TypeError("REFUND_ID_REQUIRED");
  const amount = positiveInt(amountMinor, "REFUND_INVALID_AMOUNT");
  const capacity = getRefundCapacity(financialSnapshot || {});
  if (capacity.currency !== String(order.currency).toUpperCase()) {
    throw new Error("REFUND_CURRENCY_MISMATCH");
  }
  if (amount > capacity.refundableMinor) throw new Error("REFUND_AMOUNT_EXCEEDS_CAPTURE");

  const merchandiseGrossMinor = (returnRequest.lines || []).reduce(
    (sum, line) => sum + line.quantity * line.unitPriceMinor,
    0
  );
  if (amount > merchandiseGrossMinor) {
    throw new Error("REFUND_AMOUNT_EXCEEDS_RETURN_MERCHANDISE");
  }

  const now = timestamp(createdAt);
  return deepFreeze({
    id: refundId,
    workspaceId: order.workspaceId,
    storeId: order.storeId,
    orderId: order.id,
    returnId: returnRequest.id,
    status: "REQUESTED",
    amountMinor: amount,
    currency: capacity.currency,
    reason: text(reason, 1000),
    financialSnapshot: clone(capacity),
    returnMerchandiseGrossMinor: merchandiseGrossMinor,
    providerReference: null,
    metadata: clone(metadata || {}),
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    processingAt: null,
    succeededAt: null,
    failedAt: null,
    rejectedAt: null,
    cancelledAt: null,
  });
}

export function transitionRefundRequest(
  refundRequest,
  nextStatus,
  { occurredAt, providerReference = undefined } = {}
) {
  if (!refundRequest || typeof refundRequest !== "object") throw new TypeError("REFUND_REQUIRED");
  const current = text(refundRequest.status, 40).toUpperCase();
  const next = text(nextStatus, 40).toUpperCase();
  if (!refundStatuses.has(current) || !refundStatuses.has(next)) {
    throw new Error("REFUND_INVALID_STATUS");
  }
  const allowed = {
    REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SUCCEEDED", "FAILED"],
    SUCCEEDED: [],
    FAILED: [],
    REJECTED: [],
    CANCELLED: [],
  };
  if (!(allowed[current] || []).includes(next)) throw new Error("INVALID_REFUND_TRANSITION");

  const at = timestamp(occurredAt);
  const result = { ...clone(refundRequest), status: next, updatedAt: at };
  if (providerReference !== undefined) {
    result.providerReference = text(providerReference, 300) || null;
  }
  if (next === "SUCCEEDED" && !result.providerReference) {
    throw new Error("REFUND_PROVIDER_REFERENCE_REQUIRED");
  }
  if (next === "APPROVED") result.approvedAt = at;
  if (next === "PROCESSING") result.processingAt = at;
  if (next === "SUCCEEDED") result.succeededAt = at;
  if (next === "FAILED") result.failedAt = at;
  if (next === "REJECTED") result.rejectedAt = at;
  if (next === "CANCELLED") result.cancelledAt = at;
  return deepFreeze(result);
}
