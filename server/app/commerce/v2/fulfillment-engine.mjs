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

const timestamp = (value) => text(value, 80) || new Date().toISOString();

const fulfillmentStatuses = new Set([
  "PENDING",
  "PACKING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

const orderStatusesAllowedForNewFulfillment = new Set(["CONFIRMED", "PROCESSING"]);

const assertOrder = (order) => {
  if (!order || typeof order !== "object") throw new TypeError("FULFILLMENT_ORDER_REQUIRED");
  if (!text(order.id)) throw new TypeError("FULFILLMENT_ORDER_ID_REQUIRED");
  if (!text(order.workspaceId)) throw new TypeError("FULFILLMENT_WORKSPACE_REQUIRED");
  if (!text(order.storeId)) throw new TypeError("FULFILLMENT_STORE_REQUIRED");
  if (!Array.isArray(order.lines) || order.lines.length === 0) {
    throw new Error("FULFILLMENT_ORDER_LINES_REQUIRED");
  }
};

const assertOwnership = (order, fulfillment) => {
  if (fulfillment.orderId !== order.id) throw new Error("FULFILLMENT_ORDER_MISMATCH");
  if (fulfillment.workspaceId !== order.workspaceId) {
    throw new Error("FULFILLMENT_WORKSPACE_MISMATCH");
  }
  if (fulfillment.storeId !== order.storeId) throw new Error("FULFILLMENT_STORE_MISMATCH");
};

const activeAllocation = (fulfillment) => fulfillment.status !== "CANCELLED";
const shippedAllocation = (fulfillment) =>
  fulfillment.status === "SHIPPED" || fulfillment.status === "DELIVERED";
const deliveredAllocation = (fulfillment) => fulfillment.status === "DELIVERED";

function normalizeLineRequest(order, rawLine) {
  const orderLineId = text(rawLine?.orderLineId ?? rawLine?.lineId, 200);
  if (!orderLineId) throw new Error("FULFILLMENT_ORDER_LINE_REQUIRED");
  const orderLine = order.lines.find((line) => line.id === orderLineId);
  if (!orderLine) throw new Error("FULFILLMENT_UNKNOWN_ORDER_LINE");
  const quantity = positiveInt(rawLine?.quantity, "FULFILLMENT_INVALID_QUANTITY");
  return {
    orderLineId,
    productId: orderLine.productId,
    variantId: orderLine.variantId,
    sku: orderLine.sku,
    name: orderLine.name,
    quantity,
  };
}

function allocatedByLine(order, fulfillments = []) {
  const totals = new Map(order.lines.map((line) => [line.id, 0]));
  for (const fulfillment of fulfillments) {
    assertOwnership(order, fulfillment);
    if (!fulfillmentStatuses.has(fulfillment.status)) {
      throw new Error("FULFILLMENT_INVALID_STATUS");
    }
    if (!activeAllocation(fulfillment)) continue;
    for (const line of fulfillment.lines || []) {
      if (!totals.has(line.orderLineId)) throw new Error("FULFILLMENT_UNKNOWN_ORDER_LINE");
      totals.set(line.orderLineId, totals.get(line.orderLineId) + line.quantity);
    }
  }
  return totals;
}

export function createFulfillment({
  id,
  order,
  lines,
  existingFulfillments = [],
  carrier = null,
  trackingNumber = null,
  trackingUrl = null,
  createdAt,
  metadata = {},
} = {}) {
  assertOrder(order);
  const fulfillmentId = text(id, 200);
  if (!fulfillmentId) throw new TypeError("FULFILLMENT_ID_REQUIRED");
  if (!orderStatusesAllowedForNewFulfillment.has(String(order.status || "").toUpperCase())) {
    throw new Error("ORDER_NOT_FULFILLABLE");
  }
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("FULFILLMENT_LINES_REQUIRED");

  const normalizedLines = lines.map((line) => normalizeLineRequest(order, line));
  if (new Set(normalizedLines.map((line) => line.orderLineId)).size !== normalizedLines.length) {
    throw new Error("FULFILLMENT_DUPLICATE_ORDER_LINE");
  }

  const allocated = allocatedByLine(order, existingFulfillments);
  for (const line of normalizedLines) {
    const orderLine = order.lines.find((candidate) => candidate.id === line.orderLineId);
    const nextAllocated = allocated.get(line.orderLineId) + line.quantity;
    if (nextAllocated > orderLine.quantity) throw new Error("FULFILLMENT_QUANTITY_EXCEEDED");
  }

  const now = timestamp(createdAt);
  return deepFreeze({
    id: fulfillmentId,
    workspaceId: order.workspaceId,
    storeId: order.storeId,
    orderId: order.id,
    status: "PENDING",
    lines: normalizedLines,
    carrier: text(carrier, 160) || null,
    trackingNumber: text(trackingNumber, 240) || null,
    trackingUrl: text(trackingUrl, 1000) || null,
    trackingEvents: [],
    metadata: clone(metadata || {}),
    createdAt: now,
    updatedAt: now,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
  });
}

export function transitionFulfillment(
  fulfillment,
  nextStatus,
  { occurredAt, carrier, trackingNumber, trackingUrl } = {}
) {
  if (!fulfillment || typeof fulfillment !== "object") {
    throw new TypeError("FULFILLMENT_REQUIRED");
  }
  const current = text(fulfillment.status, 40).toUpperCase();
  const next = text(nextStatus, 40).toUpperCase();
  const allowed = {
    PENDING: ["PACKING", "CANCELLED"],
    PACKING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };
  if (!(allowed[current] || []).includes(next)) throw new Error("INVALID_FULFILLMENT_TRANSITION");

  const at = timestamp(occurredAt);
  const nextValue = {
    ...clone(fulfillment),
    status: next,
    updatedAt: at,
  };

  if (carrier !== undefined) nextValue.carrier = text(carrier, 160) || null;
  if (trackingNumber !== undefined) {
    nextValue.trackingNumber = text(trackingNumber, 240) || null;
  }
  if (trackingUrl !== undefined) nextValue.trackingUrl = text(trackingUrl, 1000) || null;
  if (next === "SHIPPED") nextValue.shippedAt = at;
  if (next === "DELIVERED") nextValue.deliveredAt = at;
  if (next === "CANCELLED") nextValue.cancelledAt = at;

  return deepFreeze(nextValue);
}

export function recordTrackingEvent(
  fulfillment,
  { id, status, message = "", location = "", occurredAt } = {}
) {
  if (!fulfillment || typeof fulfillment !== "object") {
    throw new TypeError("FULFILLMENT_REQUIRED");
  }
  if (fulfillment.status === "CANCELLED") throw new Error("CANCELLED_FULFILLMENT_TRACKING_FORBIDDEN");
  const eventId = text(id, 200);
  if (!eventId) throw new TypeError("TRACKING_EVENT_ID_REQUIRED");
  if ((fulfillment.trackingEvents || []).some((event) => event.id === eventId)) {
    throw new Error("DUPLICATE_TRACKING_EVENT");
  }
  const normalizedStatus = text(status, 80).toUpperCase();
  if (!normalizedStatus) throw new Error("TRACKING_EVENT_STATUS_REQUIRED");
  const event = {
    id: eventId,
    status: normalizedStatus,
    message: text(message, 1000),
    location: text(location, 300),
    occurredAt: timestamp(occurredAt),
  };
  return deepFreeze({
    ...clone(fulfillment),
    trackingEvents: [...(fulfillment.trackingEvents || []).map(clone), event],
    updatedAt: event.occurredAt,
  });
}

export function summarizeOrderFulfillment(order, fulfillments = []) {
  assertOrder(order);
  if (!Array.isArray(fulfillments)) throw new TypeError("FULFILLMENTS_ARRAY_REQUIRED");

  const lineState = new Map(
    order.lines.map((line) => [
      line.id,
      {
        orderLineId: line.id,
        sku: line.sku,
        orderedQuantity: line.quantity,
        allocatedQuantity: 0,
        fulfilledQuantity: 0,
        deliveredQuantity: 0,
      },
    ])
  );

  for (const fulfillment of fulfillments) {
    assertOwnership(order, fulfillment);
    if (!fulfillmentStatuses.has(fulfillment.status)) {
      throw new Error("FULFILLMENT_INVALID_STATUS");
    }
    for (const line of fulfillment.lines || []) {
      const state = lineState.get(line.orderLineId);
      if (!state) throw new Error("FULFILLMENT_UNKNOWN_ORDER_LINE");
      if (activeAllocation(fulfillment)) state.allocatedQuantity += line.quantity;
      if (shippedAllocation(fulfillment)) state.fulfilledQuantity += line.quantity;
      if (deliveredAllocation(fulfillment)) state.deliveredQuantity += line.quantity;
    }
  }

  const lines = [...lineState.values()].map((state) => {
    if (state.allocatedQuantity > state.orderedQuantity) {
      throw new Error("FULFILLMENT_QUANTITY_EXCEEDED");
    }
    return {
      ...state,
      remainingQuantity: state.orderedQuantity - state.fulfilledQuantity,
      unallocatedQuantity: state.orderedQuantity - state.allocatedQuantity,
    };
  });

  const orderedQuantity = lines.reduce((sum, line) => sum + line.orderedQuantity, 0);
  const allocatedQuantity = lines.reduce((sum, line) => sum + line.allocatedQuantity, 0);
  const fulfilledQuantity = lines.reduce((sum, line) => sum + line.fulfilledQuantity, 0);
  const deliveredQuantity = lines.reduce((sum, line) => sum + line.deliveredQuantity, 0);

  let status = "UNFULFILLED";
  if (fulfilledQuantity > 0 && fulfilledQuantity < orderedQuantity) status = "PARTIAL";
  if (fulfilledQuantity === orderedQuantity && orderedQuantity > 0) status = "FULFILLED";

  return deepFreeze({
    orderId: order.id,
    workspaceId: order.workspaceId,
    storeId: order.storeId,
    status,
    orderedQuantity,
    allocatedQuantity,
    fulfilledQuantity,
    deliveredQuantity,
    lines,
  });
}
