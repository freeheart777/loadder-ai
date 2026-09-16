import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

export class InventoryReservationError extends Error {
  constructor(message, code = "INVENTORY_RESERVATION_ERROR", status = 409) {
    super(message);
    this.name = "InventoryReservationError";
    this.code = code;
    this.status = status;
  }
}

// A checkout holds stock; it does not consume it. Physical
// ecommerce_variants.inventory_quantity is decremented exactly once, at
// verified-payment commit. Availability is therefore derived, never stored:
//
//   available = inventory_quantity - SUM(HELD reservations not yet expired)
//
// Expiry is authoritative at read time, so an abandoned checkout stops
// blocking stock even if no sweep has run yet.
export const INVENTORY_RESERVATION_TTL_MS = 30 * 60 * 1000;

const map = (row) => row && ({
  id: row.id, workspaceId: row.workspace_id, siteProjectId: row.site_project_id,
  orderId: row.order_id, variantId: row.variant_id, quantity: row.quantity,
  state: row.state, expiresAt: row.expires_at, releaseReason: row.release_reason,
  createdAt: row.created_at, updatedAt: row.updated_at, settledAt: row.settled_at,
});

export function createInventoryReservationService({
  db,
  clock = () => new Date().toISOString(),
  ttlMs = INVENTORY_RESERVATION_TTL_MS,
} = {}) {
  if (!db) throw new InventoryReservationError("Database is required.", "INVENTORY_DATABASE_REQUIRED", 500);
  const workspaceId = () => requireWorkspaceId();

  const heldQuantity = (variantId, at) => db.prepare(
    `SELECT COALESCE(SUM(quantity),0) AS held FROM ecommerce_inventory_reservations
     WHERE workspace_id=? AND variant_id=? AND state='HELD' AND expires_at > ?`
  ).get(workspaceId(), variantId, at).held;

  const variantRow = (variantId) => db.prepare(
    "SELECT id,inventory_quantity,inventory_policy,active FROM ecommerce_variants WHERE id=? AND workspace_id=?"
  ).get(variantId, workspaceId()) || null;

  // Server-authoritative. Callers never supply availability.
  function availableQuantity(variantId, at = clock()) {
    const variant = variantRow(variantId);
    if (!variant) throw new InventoryReservationError("Variant not found.", "VARIANT_NOT_FOUND", 404);
    return variant.inventory_quantity - heldQuantity(variantId, at);
  }

  function isPurchasable(variantId, quantity = 1, at = clock()) {
    const variant = variantRow(variantId);
    if (!variant || !variant.active) return false;
    // CONTINUE keeps selling at or below zero stock; only DENY is gated.
    if (variant.inventory_policy !== "DENY") return true;
    return availableQuantity(variantId, at) >= quantity;
  }

  // Idempotent per (workspace, order, variant): a replayed checkout reuses the
  // existing row instead of holding the same stock twice.
  const reserveForOrder = db.transaction(({ orderId, siteProjectId, items = [] }) => {
    const at = clock();
    const expiresAt = new Date(Date.parse(at) + ttlMs).toISOString();
    const reservations = [];
    for (const item of items) {
      const variant = variantRow(item.variantId);
      if (!variant) throw new InventoryReservationError("Variant not found.", "VARIANT_NOT_FOUND", 404);
      if (variant.inventory_policy !== "DENY") continue;
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new InventoryReservationError("Reservation quantity must be a positive integer.", "INVALID_RESERVATION_QUANTITY", 400);
      }
      const existing = db.prepare(
        "SELECT * FROM ecommerce_inventory_reservations WHERE workspace_id=? AND order_id=? AND variant_id=?"
      ).get(workspaceId(), orderId, item.variantId);
      if (existing) { reservations.push(map(existing)); continue; }
      if (availableQuantity(item.variantId, at) < quantity) {
        throw new InventoryReservationError(`Insufficient inventory for ${item.variantId}.`, "INSUFFICIENT_INVENTORY", 409);
      }
      const reservationId = `inv_hold_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO ecommerce_inventory_reservations(id,workspace_id,site_project_id,order_id,variant_id,quantity,state,expires_at,created_at,updated_at)
         VALUES(?,?,?,?,?,?,'HELD',?,?,?)`
      ).run(reservationId, workspaceId(), siteProjectId, orderId, item.variantId, quantity, expiresAt, at, at);
      reservations.push(map(db.prepare("SELECT * FROM ecommerce_inventory_reservations WHERE id=?").get(reservationId)));
    }
    return reservations;
  });

  // Called inside the verified-payment transaction. Expiry is deliberately
  // ignored: money already moved, so the hold is honoured. The sweep never
  // releases a reservation whose payment is still in flight, so an expired
  // commit cannot race a release.
  const commitForOrder = db.transaction((orderId) => {
    const at = clock();
    const rows = db.prepare(
      "SELECT * FROM ecommerce_inventory_reservations WHERE workspace_id=? AND order_id=? ORDER BY id"
    ).all(workspaceId(), orderId);
    const committed = [];
    for (const row of rows) {
      if (row.state === "COMMITTED") { committed.push(map(row)); continue; }
      if (row.state === "RELEASED") {
        throw new InventoryReservationError("Released reservation cannot be committed.", "RESERVATION_ALREADY_RELEASED", 409);
      }
      db.prepare("UPDATE ecommerce_inventory_reservations SET state='COMMITTED',settled_at=?,updated_at=? WHERE id=? AND workspace_id=? AND state='HELD'")
        .run(at, at, row.id, workspaceId());
      // CHECK(inventory_quantity>=0) is the hard oversell floor.
      db.prepare("UPDATE ecommerce_variants SET inventory_quantity=inventory_quantity-?,updated_at=? WHERE id=? AND workspace_id=?")
        .run(row.quantity, at, row.variant_id, workspaceId());
      committed.push(map(db.prepare("SELECT * FROM ecommerce_inventory_reservations WHERE id=?").get(row.id)));
    }
    return committed;
  });

  const paidOrder = (orderId) => db.prepare(
    "SELECT id FROM ecommerce_orders WHERE id=? AND workspace_id=? AND payment_status='PAID'"
  ).get(orderId, workspaceId());

  // An attempt whose outcome is unknown must never have its stock handed to
  // someone else: RECONCILIATION_REQUIRED and not-yet-terminal attempts hold.
  const unresolvedAttempt = (orderId) => db.prepare(
    `SELECT id FROM ecommerce_payment_attempts
     WHERE workspace_id=? AND order_id=? AND status IN('CREATED','REDIRECT_READY','PENDING_VERIFICATION','RECONCILIATION_REQUIRED')
     LIMIT 1`
  ).get(workspaceId(), orderId);

  const releaseForOrder = db.transaction((orderId, { reason = "RELEASED", force = false } = {}) => {
    const at = clock();
    if (paidOrder(orderId)) {
      throw new InventoryReservationError("Paid order reservations cannot be released.", "ORDER_ALREADY_PAID", 409);
    }
    if (!force && unresolvedAttempt(orderId)) {
      return { released: [], held: true, reason: "PAYMENT_OUTCOME_UNRESOLVED" };
    }
    const rows = db.prepare(
      "SELECT * FROM ecommerce_inventory_reservations WHERE workspace_id=? AND order_id=? ORDER BY id"
    ).all(workspaceId(), orderId);
    const released = [];
    for (const row of rows) {
      if (row.state !== "HELD") continue; // COMMITTED stays; RELEASED is a no-op replay.
      db.prepare("UPDATE ecommerce_inventory_reservations SET state='RELEASED',release_reason=?,settled_at=?,updated_at=? WHERE id=? AND workspace_id=? AND state='HELD'")
        .run(String(reason).slice(0, 100), at, at, row.id, workspaceId());
      released.push(map(db.prepare("SELECT * FROM ecommerce_inventory_reservations WHERE id=?").get(row.id)));
    }
    return { released, held: false, reason: null };
  });

  // Crash/retry convergence: expired holds are swept back, but only for orders
  // with no unresolved payment attempt.
  const releaseExpired = db.transaction(({ limit = 100 } = {}) => {
    const at = clock();
    const rows = db.prepare(
      `SELECT DISTINCT order_id FROM ecommerce_inventory_reservations
       WHERE workspace_id=? AND state='HELD' AND expires_at <= ? ORDER BY order_id LIMIT ?`
    ).all(workspaceId(), at, limit);
    const released = [];
    for (const row of rows) {
      if (paidOrder(row.order_id) || unresolvedAttempt(row.order_id)) continue;
      released.push(...releaseForOrder(row.order_id, { reason: "EXPIRED" }).released);
    }
    return released;
  });

  return Object.freeze({
    availableQuantity,
    isPurchasable,
    reserveForOrder: (input) => reserveForOrder(input),
    commitForOrder: (orderId) => commitForOrder(orderId),
    releaseForOrder: (orderId, options) => releaseForOrder(orderId, options),
    releaseExpired: (options) => releaseExpired(options),
    listForOrder(orderId) {
      return db.prepare("SELECT * FROM ecommerce_inventory_reservations WHERE workspace_id=? AND order_id=? ORDER BY id")
        .all(workspaceId(), orderId).map(map);
    },
  });
}

// Hooks for the payment attempt lifecycle. Commit runs inside the verified
// settlement transaction; release runs inside the terminal-failure transaction.
export function createInventorySettlementHooks({ db, clock, ttlMs } = {}) {
  const service = createInventoryReservationService({ db, clock, ttlMs });
  return Object.freeze({
    service,
    beforeOrderSettlement: ({ orderId }) => { service.commitForOrder(orderId); },
    onTerminal: ({ orderId, status }) => { service.releaseForOrder(orderId, { reason: status, force: true }); },
  });
}
