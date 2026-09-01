const qty = (value, field, { positive = false } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (positive ? 1 : 0)) throw new TypeError(`${field} must be ${positive ? "a positive" : "a non-negative"} integer`);
  return n;
};

const keyOf = ({ workspaceId, storeId, variantId, locationId = "default" }) => {
  for (const [field, value] of Object.entries({ workspaceId, storeId, variantId, locationId })) {
    if (!String(value || "").trim()) throw new TypeError(`${field} is required`);
  }
  return `${workspaceId}::${storeId}::${variantId}::${locationId}`;
};

const clone = (x) => structuredClone(x);

export function createInventoryState(items = []) {
  const state = new Map();
  for (const raw of items) {
    const key = keyOf(raw);
    if (state.has(key)) throw new Error("DUPLICATE_INVENTORY_KEY");
    const onHand = qty(raw.onHand ?? 0, "onHand");
    const reserved = qty(raw.reserved ?? 0, "reserved");
    const committed = qty(raw.committed ?? 0, "committed");
    if (reserved + committed > onHand) throw new Error("INVALID_INVENTORY_TOTALS");
    state.set(key, Object.freeze({
      workspaceId: String(raw.workspaceId), storeId: String(raw.storeId), variantId: String(raw.variantId), locationId: String(raw.locationId || "default"),
      onHand, reserved, committed,
    }));
  }
  return state;
}

export function inventorySnapshot(state) {
  return [...state.values()].map(clone).sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

export function availability(state, selector) {
  const row = state.get(keyOf(selector));
  if (!row) return { onHand: 0, reserved: 0, committed: 0, available: 0 };
  return { ...clone(row), available: row.onHand - row.reserved - row.committed };
}

function replace(state, selector, next) {
  const copy = new Map(state);
  copy.set(keyOf(selector), Object.freeze(next));
  return copy;
}

export function reserveInventory(state, selector, quantity, { policy = "DENY" } = {}) {
  const requested = qty(quantity, "quantity", { positive: true });
  const current = availability(state, selector);
  if (policy !== "ALLOW" && current.available < requested) {
    return Object.freeze({ ok: false, code: "INSUFFICIENT_INVENTORY", requested, available: current.available, state });
  }
  const row = state.get(keyOf(selector)) || Object.freeze({ ...selector, locationId: selector.locationId || "default", onHand: 0, reserved: 0, committed: 0 });
  const nextState = replace(state, selector, { ...row, reserved: row.reserved + requested });
  return Object.freeze({ ok: true, code: "RESERVED", quantity: requested, state: nextState, availability: availability(nextState, selector) });
}

export function releaseReservation(state, selector, quantity) {
  const release = qty(quantity, "quantity", { positive: true });
  const row = state.get(keyOf(selector));
  if (!row || row.reserved < release) throw new Error("RESERVATION_UNDERFLOW");
  const nextState = replace(state, selector, { ...row, reserved: row.reserved - release });
  return Object.freeze({ ok: true, code: "RELEASED", quantity: release, state: nextState, availability: availability(nextState, selector) });
}

export function commitReservation(state, selector, quantity) {
  const commit = qty(quantity, "quantity", { positive: true });
  const row = state.get(keyOf(selector));
  if (!row || row.reserved < commit) throw new Error("RESERVATION_UNDERFLOW");
  const nextState = replace(state, selector, { ...row, reserved: row.reserved - commit, committed: row.committed + commit });
  return Object.freeze({ ok: true, code: "COMMITTED", quantity: commit, state: nextState, availability: availability(nextState, selector) });
}

export function adjustOnHand(state, selector, delta) {
  if (!Number.isInteger(Number(delta))) throw new TypeError("delta must be an integer");
  const row = state.get(keyOf(selector)) || Object.freeze({ ...selector, locationId: selector.locationId || "default", onHand: 0, reserved: 0, committed: 0 });
  const nextOnHand = row.onHand + Number(delta);
  if (nextOnHand < row.reserved + row.committed) throw new Error("ON_HAND_BELOW_ALLOCATED");
  const nextState = replace(state, selector, { ...row, onHand: nextOnHand });
  return Object.freeze({ ok: true, state: nextState, availability: availability(nextState, selector) });
}
