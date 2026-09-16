export const migration088CommerceInventoryReservations = {
  version: 88,
  name: "commerce_inventory_reservations",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS ecommerce_inventory_reservations(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  state TEXT NOT NULL CHECK(state IN('HELD','COMMITTED','RELEASED')),
  expires_at TEXT NOT NULL CHECK(length(trim(expires_at)) BETWEEN 1 AND 40),
  release_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  settled_at TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE RESTRICT,
  FOREIGN KEY(order_id) REFERENCES ecommerce_orders(id) ON DELETE RESTRICT,
  FOREIGN KEY(variant_id) REFERENCES ecommerce_variants(id) ON DELETE RESTRICT,
  UNIQUE(workspace_id,order_id,variant_id)
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_inventory_reservations_variant
  ON ecommerce_inventory_reservations(workspace_id,variant_id,state,expires_at);
CREATE INDEX IF NOT EXISTS idx_ecommerce_inventory_reservations_order
  ON ecommerce_inventory_reservations(workspace_id,order_id,state);
CREATE INDEX IF NOT EXISTS idx_ecommerce_inventory_reservations_expiry
  ON ecommerce_inventory_reservations(workspace_id,state,expires_at);

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_inventory_reservation_context_guard
BEFORE INSERT ON ecommerce_inventory_reservations
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_orders o
    WHERE o.id=NEW.order_id AND o.workspace_id=NEW.workspace_id AND o.site_project_id=NEW.site_project_id
  ) THEN RAISE(ABORT,'commerce inventory reservation order context mismatch') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_variants v JOIN ecommerce_products p
      ON p.id=v.product_id AND p.workspace_id=v.workspace_id
    WHERE v.id=NEW.variant_id AND v.workspace_id=NEW.workspace_id
      AND p.site_project_id=NEW.site_project_id
  ) THEN RAISE(ABORT,'commerce inventory reservation variant context mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_inventory_reservation_identity_immutable
BEFORE UPDATE ON ecommerce_inventory_reservations
WHEN OLD.workspace_id<>NEW.workspace_id OR OLD.site_project_id<>NEW.site_project_id
  OR OLD.order_id<>NEW.order_id OR OLD.variant_id<>NEW.variant_id
  OR OLD.quantity<>NEW.quantity OR OLD.created_at<>NEW.created_at
  OR OLD.expires_at<>NEW.expires_at
BEGIN
  SELECT RAISE(ABORT,'commerce inventory reservation identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_inventory_reservation_transition_guard
BEFORE UPDATE OF state ON ecommerce_inventory_reservations
WHEN OLD.state<>NEW.state AND NOT (OLD.state='HELD' AND NEW.state IN('COMMITTED','RELEASED'))
BEGIN
  SELECT RAISE(ABORT,'commerce inventory reservation transition invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_inventory_reservation_settled_required
BEFORE UPDATE OF state ON ecommerce_inventory_reservations
WHEN NEW.state IN('COMMITTED','RELEASED') AND OLD.state='HELD' AND NEW.settled_at IS NULL
BEGIN
  SELECT RAISE(ABORT,'commerce inventory reservation settlement timestamp required');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_inventory_reservation_terminal_immutable
BEFORE UPDATE ON ecommerce_inventory_reservations
WHEN OLD.state IN('COMMITTED','RELEASED') AND (
  OLD.state<>NEW.state
  OR COALESCE(OLD.settled_at,'')<>COALESCE(NEW.settled_at,'')
  OR COALESCE(OLD.release_reason,'')<>COALESCE(NEW.release_reason,'')
)
BEGIN
  SELECT RAISE(ABORT,'terminal commerce inventory reservation is immutable');
END;
`);
  },
};
