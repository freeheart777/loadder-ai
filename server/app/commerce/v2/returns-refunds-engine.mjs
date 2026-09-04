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
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(code);
  return number;
};

const nonNegativeInt = (value, code) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(code);
  return number;
};

const timestamp = (value, invalidCode) => {
  const normalized = text(value, 80) || new Date().toISOString();
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(invalidCode);
  return normalized;
};

const assertTimestampNotBefore = (candidate, baseline, invalidCode, regressionCode) => {
  if (!baseline) return;
  const baselineTimestamp = timestamp(baseline, invalidCode);
  if (Date.parse(candidate) < Date.parse(baselineTimestamp)) throw new Error(regressionCode);
};

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
const inFlightRefundStatuses = new Set(["REQUESTED", "APPROVED", "PROCESSING"]);
const merchandiseConsumingRefundStatuses = new Set([
  "REQUESTED",
  "APPROVED",
  "PROCESSING",
  "SUCCEEDED",
]);

const assertOrder = (order) => {
  if (!order || typeof order !== "object") throw new TypeError("RETURN_ORDER_REQUIRED");
  if (!text(order.id)) throw new TypeError("RETURN_ORDER_ID_REQUIRED");
  if (!text(order.workspaceId)) throw new TypeError("RETURN_WORKSPACE_REQUIRED");
  if (!text(order.storeId)) throw new TypeError("RETURN_STORE_REQUIRED");
  const orderCurrency = text(order.currency, 20).toUpperCase();
  if (!orderCurrency) throw new TypeError("RETURN_CURRENCY_REQUIRED");
  if (!Array.isArray(order.lines) || order.lines.length === 0) {
    throw new Error("RETURN_ORDER_LINES_REQUIRED");
  }

  const seen = new Set();
  for (const line of order.lines) {
    const lineId = text(line?.id, 200);
    if (!lineId || seen.has(lineId)) throw new Error("RETURN_ORDER_LINE_INVALID");
    seen.add(lineId);
    positiveInt(line.quantity, "RETURN_ORDER_LINE_INVALID");
    nonNegativeInt(line.unitPriceMinor, "RETURN_ORDER_LINE_INVALID");
    if (text(line.currency, 20).toUpperCase() !== orderCurrency) {
      throw new Error("RETURN_ORDER_LINE_CURRENCY_MISMATCH");
    }
  }
};

const assertReturnOwnership = (order, returnRequest) => {
  if (returnRequest.orderId !== order.id) throw new Error("RETURN_ORDER_MISMATCH");
  if (returnRequest.workspaceId !== order.workspaceId) throw new Error("RETURN_WORKSPACE_MISMATCH");
  if (returnRequest.storeId !== order.storeId) throw new Error("RETURN_STORE_MISMATCH");
};

const orderLineById = (order, orderLineId) => {
  const orderLine = order.lines.find((line) => line.id === orderLineId);
  if (!orderLine) throw new Error("RETURN_UNKNOWN_ORDER_LINE");
  return orderLine;
};

function normalizeReturnLine(order, rawLine, { requireSnapshot = false } = {}) {
  const orderLineId = text(rawLine?.orderLineId ?? rawLine?.lineId, 200);
  if (!orderLineId) throw new Error("RETURN_ORDER_LINE_REQUIRED");
  const orderLine = orderLineById(order, orderLineId);
  const quantity = positiveInt(rawLine?.quantity, "RETURN_INVALID_QUANTITY");

  if (requireSnapshot) {
    const matches =
      rawLine.productId === orderLine.productId &&
      rawLine.variantId === orderLine.variantId &&
      rawLine.sku === orderLine.sku &&
      rawLine.name === orderLine.name &&
      Number(rawLine.unitPriceMinor) === Number(orderLine.unitPriceMinor) &&
      text(rawLine.currency, 20).toUpperCase() === text(orderLine.currency, 20).toUpperCase();
    if (!matches) throw new Error("RETURN_SNAPSHOT_MISMATCH");
  } else {
    const optionalMatches = [
      ["productId", orderLine.productId],
      ["variantId", orderLine.variantId],
      ["sku", orderLine.sku],
      ["name", orderLine.name],
      ["unitPriceMinor", orderLine.unitPriceMinor],
      ["currency", orderLine.currency],
    ];
    for (const [key, expected] of optionalMatches) {
      if (rawLine?.[key] === undefined) continue;
      const actual = key === "currency"
        ? text(rawLine[key], 20).toUpperCase()
        : key === "unitPriceMinor"
          ? Number(rawLine[key])
          : rawLine[key];
      const normalizedExpected = key === "currency"
        ? text(expected, 20).toUpperCase()
        : key === "unitPriceMinor"
          ? Number(expected)
          : expected;
      if (actual !== normalizedExpected) throw new Error("RETURN_SNAPSHOT_MISMATCH");
    }
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
}

function validateReturnLines(order, returnRequest, { requireSnapshot = false } = {}) {
  if (!Array.isArray(returnRequest?.lines) || returnRequest.lines.length === 0) {
    throw new Error("RETURN_LINES_REQUIRED");
  }
  const seen = new Set();
  return returnRequest.lines.map((rawLine) => {
    const line = normalizeReturnLine(order, rawLine, { requireSnapshot });
    if (seen.has(line.orderLineId)) throw new Error("RETURN_DUPLICATE_ORDER_LINE");
    seen.add(line.orderLineId);
    return line;
  });
}

function validateReturnHistory(order, existingReturns = []) {
  if (!Array.isArray(existingReturns)) throw new TypeError("RETURNS_ARRAY_REQUIRED");
  const totals = new Map(order.lines.map((line) => [line.id, 0]));
  const ids = new Set();

  for (const returnRequest of existingReturns) {
    if (!returnRequest || typeof returnRequest !== "object") throw new TypeError("RETURN_REQUIRED");
    assertReturnOwnership(order, returnRequest);
    const returnId = text(returnRequest.id, 200);
    if (!returnId) throw new Error("RETURN_ID_REQUIRED");
    if (ids.has(returnId)) throw new Error("RETURN_HISTORY_DUPLICATE_ID");
    ids.add(returnId);

    const status = text(returnRequest.status, 40).toUpperCase();
    if (!returnStatuses.has(status)) throw new Error("RETURN_INVALID_STATUS");
    const lines = validateReturnLines(order, returnRequest);
    if (!activeReturnStatuses.has(status)) continue;
    for (const line of lines) {
      totals.set(line.orderLineId, totals.get(line.orderLineId) + line.quantity);
    }
  }

  return { totals, ids };
}

const assertRefundOwnership = (order, refundRequest) => {
  if (refundRequest.orderId !== order.id) throw new Error("REFUND_ORDER_MISMATCH");
  if (refundRequest.workspaceId !== order.workspaceId) throw new Error("REFUND_WORKSPACE_MISMATCH");
  if (refundRequest.storeId !== order.storeId) throw new Error("REFUND_STORE_MISMATCH");
  if (text(refundRequest.currency, 20).toUpperCase() !== text(order.currency, 20).toUpperCase()) {
    throw new Error("REFUND_CURRENCY_MISMATCH");
  }
};

function validateRefundHistory(order, existingRefunds = []) {
  if (!Array.isArray(existingRefunds)) throw new TypeError("REFUNDS_ARRAY_REQUIRED");
  const ids = new Set();
  const consumedByReturn = new Map();
  const succeededProviderReferences = new Set();
  let inFlightMinor = 0;
  let succeededMinor = 0;

  for (const refundRequest of existingRefunds) {
    if (!refundRequest || typeof refundRequest !== "object") throw new TypeError("REFUND_REQUIRED");
    assertRefundOwnership(order, refundRequest);
    const refundId = text(refundRequest.id, 200);
    if (!refundId) throw new Error("REFUND_ID_REQUIRED");
    if (ids.has(refundId)) throw new Error("REFUND_HISTORY_DUPLICATE_ID");
    ids.add(refundId);

    const status = text(refundRequest.status, 40).toUpperCase();
    if (!refundStatuses.has(status)) throw new Error("REFUND_INVALID_STATUS");
    const amount = positiveInt(refundRequest.amountMinor, "REFUND_INVALID_AMOUNT");
    const returnId = text(refundRequest.returnId, 200);
    if (!returnId) throw new Error("REFUND_RETURN_ID_REQUIRED");

    if (status === "SUCCEEDED") {
      const providerReference = text(refundRequest.providerReference, 300);
      if (!providerReference) throw new Error("REFUND_PROVIDER_REFERENCE_REQUIRED");
      if (succeededProviderReferences.has(providerReference)) {
        throw new Error("REFUND_PROVIDER_REFERENCE_DUPLICATE");
      }
      succeededProviderReferences.add(providerReference);
    }

    if (inFlightRefundStatuses.has(status)) {
      inFlightMinor += amount;
      if (!Number.isSafeInteger(inFlightMinor)) throw new Error("REFUND_AMOUNT_OVERFLOW");
    }
    if (status === "SUCCEEDED") {
      succeededMinor += amount;
      if (!Number.isSafeInteger(succeededMinor)) throw new Error("REFUND_AMOUNT_OVERFLOW");
    }
    if (merchandiseConsumingRefundStatuses.has(status)) {
      const next = (consumedByReturn.get(returnId) || 0) + amount;
      if (!Number.isSafeInteger(next)) throw new Error("REFUND_AMOUNT_OVERFLOW");
      consumedByReturn.set(returnId, next);
    }
  }

  return { ids, inFlightMinor, succeededMinor, consumedByReturn, succeededProviderReferences };
}

function merchandiseGross(order, returnLines) {
  let total = 0;
  for (const line of returnLines) {
    const orderLine = orderLineById(order, line.orderLineId);
    const gross = line.quantity * Number(orderLine.unitPriceMinor);
    if (!Number.isSafeInteger(gross)) throw new Error("RETURN_MERCHANDISE_AMOUNT_OVERFLOW");
    total += gross;
    if (!Number.isSafeInteger(total)) throw new Error("RETURN_MERCHANDISE_AMOUNT_OVERFLOW");
  }
  return total;
}

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
  const history = validateReturnHistory(order, existingReturns);
  if (history.ids.has(returnId)) throw new Error("RETURN_DUPLICATE_ID");

  const normalizedLines = lines.map((rawLine) => normalizeReturnLine(order, rawLine));
  if (new Set(normalizedLines.map((line) => line.orderLineId)).size !== normalizedLines.length) {
    throw new Error("RETURN_DUPLICATE_ORDER_LINE");
  }

  for (const line of normalizedLines) {
    const deliveredQuantity = delivered.get(line.orderLineId) || 0;
    const consumedQuantity = history.totals.get(line.orderLineId) || 0;
    if (line.quantity > deliveredQuantity - consumedQuantity) {
      throw new Error("RETURN_QUANTITY_EXCEEDS_DELIVERED");
    }
  }

  const now = timestamp(createdAt, "RETURN_INVALID_TIMESTAMP");
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

  const at = timestamp(occurredAt, "RETURN_INVALID_TIMESTAMP");
  assertTimestampNotBefore(at, returnRequest.createdAt, "RETURN_INVALID_TIMESTAMP", "RETURN_TIMESTAMP_REGRESSION");
  assertTimestampNotBefore(at, returnRequest.updatedAt, "RETURN_INVALID_TIMESTAMP", "RETURN_TIMESTAMP_REGRESSION");

  const result = { ...clone(returnRequest), status: next, updatedAt: at };
  if (next === "APPROVED") result.approvedAt = at;
  if (next === "RECEIVED") result.receivedAt = at;
  if (next === "REJECTED") result.rejectedAt = at;
  if (next === "CANCELLED") result.cancelledAt = at;
  return deepFreeze(result);
}

export function getRefundCapacity({
  capturedMinor,
  refundedMinor = 0,
  refundableMinor = undefined,
  currency,
} = {}) {
  const captured = nonNegativeInt(capturedMinor, "REFUND_INVALID_CAPTURED_AMOUNT");
  const refunded = nonNegativeInt(refundedMinor, "REFUND_INVALID_REFUNDED_AMOUNT");
  const normalizedCurrency = text(currency, 20).toUpperCase();
  if (!normalizedCurrency) throw new Error("REFUND_CURRENCY_REQUIRED");
  if (refunded > captured) throw new Error("REFUND_FINANCIAL_SNAPSHOT_INVALID");

  const derivedRefundable = captured - refunded;
  if (refundableMinor !== undefined) {
    const declared = nonNegativeInt(refundableMinor, "REFUND_FINANCIAL_SNAPSHOT_INVALID");
    if (declared !== derivedRefundable) throw new Error("REFUND_FINANCIAL_SNAPSHOT_INVALID");
  }

  return deepFreeze({
    capturedMinor: captured,
    refundedMinor: refunded,
    refundableMinor: derivedRefundable,
    currency: normalizedCurrency,
  });
}

export function createRefundRequest({
  id,
  order,
  returnRequest,
  amountMinor,
  financialSnapshot,
  existingRefunds = [],
  reason = "",
  createdAt,
  metadata = {},
} = {}) {
  assertOrder(order);
  if (!returnRequest || typeof returnRequest !== "object") throw new TypeError("REFUND_RETURN_REQUIRED");
  assertReturnOwnership(order, returnRequest);
  const returnId = text(returnRequest.id, 200);
  if (!returnId) throw new Error("REFUND_RETURN_ID_REQUIRED");
  const returnStatus = text(returnRequest.status, 40).toUpperCase();
  if (!refundableReturnStatuses.has(returnStatus)) throw new Error("RETURN_NOT_REFUNDABLE");
  const validatedReturnLines = validateReturnLines(order, returnRequest, { requireSnapshot: true });

  const refundId = text(id, 200);
  if (!refundId) throw new TypeError("REFUND_ID_REQUIRED");
  const amount = positiveInt(amountMinor, "REFUND_INVALID_AMOUNT");
  const capacity = getRefundCapacity(financialSnapshot || {});
  if (capacity.currency !== text(order.currency, 20).toUpperCase()) {
    throw new Error("REFUND_CURRENCY_MISMATCH");
  }

  const refundHistory = validateRefundHistory(order, existingRefunds);
  if (refundHistory.ids.has(refundId)) throw new Error("REFUND_DUPLICATE_ID");
  if (refundHistory.succeededMinor > capacity.refundedMinor) {
    throw new Error("REFUND_FINANCIAL_SNAPSHOT_STALE");
  }

  if (amount > capacity.refundableMinor) throw new Error("REFUND_AMOUNT_EXCEEDS_CAPTURE");
  const availableAfterReservations = capacity.refundableMinor - refundHistory.inFlightMinor;
  if (amount > availableAfterReservations) {
    throw new Error("REFUND_AMOUNT_EXCEEDS_AVAILABLE_CAPACITY");
  }

  const merchandiseGrossMinor = merchandiseGross(order, validatedReturnLines);
  if (amount > merchandiseGrossMinor) {
    throw new Error("REFUND_AMOUNT_EXCEEDS_RETURN_MERCHANDISE");
  }
  const alreadyConsumedForReturn = refundHistory.consumedByReturn.get(returnId) || 0;
  const returnRemainingMinor = merchandiseGrossMinor - alreadyConsumedForReturn;
  if (amount > returnRemainingMinor) {
    throw new Error("REFUND_AMOUNT_EXCEEDS_RETURN_REMAINING");
  }

  const now = timestamp(createdAt, "REFUND_INVALID_TIMESTAMP");
  return deepFreeze({
    id: refundId,
    workspaceId: order.workspaceId,
    storeId: order.storeId,
    orderId: order.id,
    returnId,
    status: "REQUESTED",
    amountMinor: amount,
    currency: capacity.currency,
    reason: text(reason, 1000),
    financialSnapshot: clone(capacity),
    reservationSnapshot: {
      inFlightMinor: refundHistory.inFlightMinor,
      availableBeforeRequestMinor: availableAfterReservations,
    },
    returnMerchandiseGrossMinor: merchandiseGrossMinor,
    returnRemainingBeforeRequestMinor: returnRemainingMinor,
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
  { occurredAt, providerReference = undefined, existingRefunds = [] } = {}
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

  const at = timestamp(occurredAt, "REFUND_INVALID_TIMESTAMP");
  assertTimestampNotBefore(at, refundRequest.createdAt, "REFUND_INVALID_TIMESTAMP", "REFUND_TIMESTAMP_REGRESSION");
  assertTimestampNotBefore(at, refundRequest.updatedAt, "REFUND_INVALID_TIMESTAMP", "REFUND_TIMESTAMP_REGRESSION");

  const result = { ...clone(refundRequest), status: next, updatedAt: at };
  if (providerReference !== undefined) {
    result.providerReference = text(providerReference, 300) || null;
  }
  if (next === "SUCCEEDED") {
    if (!result.providerReference) throw new Error("REFUND_PROVIDER_REFERENCE_REQUIRED");
    const peerHistory = validateRefundHistory(
      {
        id: refundRequest.orderId,
        workspaceId: refundRequest.workspaceId,
        storeId: refundRequest.storeId,
        currency: refundRequest.currency,
      },
      (existingRefunds || []).filter((candidate) => candidate?.id !== refundRequest.id)
    );
    if (peerHistory.succeededProviderReferences.has(result.providerReference)) {
      throw new Error("REFUND_PROVIDER_REFERENCE_DUPLICATE");
    }
  }
  if (next === "APPROVED") result.approvedAt = at;
  if (next === "PROCESSING") result.processingAt = at;
  if (next === "SUCCEEDED") result.succeededAt = at;
  if (next === "FAILED") result.failedAt = at;
  if (next === "REJECTED") result.rejectedAt = at;
  if (next === "CANCELLED") result.cancelledAt = at;
  return deepFreeze(result);
}
