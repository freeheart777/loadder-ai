export const migration087CommercePaymentAttempts = {
  version: 87,
  name: "commerce_payment_attempts",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS ecommerce_payment_attempts(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(length(trim(provider)) BETWEEN 1 AND 100),
  provider_config_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL CHECK(length(trim(currency)) BETWEEN 1 AND 8),
  status TEXT NOT NULL CHECK(status IN('CREATED','REDIRECT_READY','PENDING_VERIFICATION','SUCCEEDED','FAILED','CANCELLED','RECONCILIATION_REQUIRED')),
  idempotency_key TEXT NOT NULL CHECK(length(trim(idempotency_key)) BETWEEN 1 AND 200),
  input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
  provider_attempt_reference TEXT,
  provider_transaction_id TEXT,
  verification_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  verified_at TEXT,
  terminal_at TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE RESTRICT,
  FOREIGN KEY(order_id) REFERENCES ecommerce_orders(id) ON DELETE RESTRICT,
  FOREIGN KEY(provider_config_id) REFERENCES ecommerce_payment_providers(id) ON DELETE RESTRICT,
  UNIQUE(workspace_id,order_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_payment_attempts_order
  ON ecommerce_payment_attempts(workspace_id,order_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_ecommerce_payment_attempts_status
  ON ecommerce_payment_attempts(workspace_id,status,updated_at DESC,id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_payment_attempts_provider_transaction
  ON ecommerce_payment_attempts(provider,provider_config_id,provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_attempt_workspace_guard
BEFORE INSERT ON ecommerce_payment_attempts
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_orders o
    WHERE o.id=NEW.order_id AND o.workspace_id=NEW.workspace_id AND o.site_project_id=NEW.site_project_id
  ) THEN RAISE(ABORT,'commerce payment attempt order context mismatch') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_payment_providers p
    WHERE p.id=NEW.provider_config_id AND p.workspace_id=NEW.workspace_id
      AND p.site_project_id=NEW.site_project_id AND upper(p.provider_key)=upper(NEW.provider)
  ) THEN RAISE(ABORT,'commerce payment attempt provider context mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_attempt_identity_immutable
BEFORE UPDATE ON ecommerce_payment_attempts
WHEN OLD.workspace_id<>NEW.workspace_id OR OLD.site_project_id<>NEW.site_project_id
  OR OLD.order_id<>NEW.order_id OR OLD.provider<>NEW.provider
  OR OLD.provider_config_id<>NEW.provider_config_id OR OLD.amount_minor<>NEW.amount_minor
  OR OLD.currency<>NEW.currency OR OLD.idempotency_key<>NEW.idempotency_key
  OR OLD.input_hash<>NEW.input_hash OR OLD.created_at<>NEW.created_at
BEGIN
  SELECT RAISE(ABORT,'commerce payment attempt identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_attempt_transition_guard
BEFORE UPDATE OF status ON ecommerce_payment_attempts
WHEN OLD.status<>NEW.status AND NOT (
  (OLD.status='CREATED' AND NEW.status IN('REDIRECT_READY','PENDING_VERIFICATION','SUCCEEDED','FAILED','CANCELLED','RECONCILIATION_REQUIRED')) OR
  (OLD.status='REDIRECT_READY' AND NEW.status IN('PENDING_VERIFICATION','SUCCEEDED','FAILED','CANCELLED','RECONCILIATION_REQUIRED')) OR
  (OLD.status='PENDING_VERIFICATION' AND NEW.status IN('SUCCEEDED','FAILED','CANCELLED','RECONCILIATION_REQUIRED')) OR
  (OLD.status='RECONCILIATION_REQUIRED' AND NEW.status IN('PENDING_VERIFICATION','SUCCEEDED','FAILED','CANCELLED'))
)
BEGIN
  SELECT RAISE(ABORT,'commerce payment attempt transition invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_attempt_success_guard
BEFORE UPDATE OF status ON ecommerce_payment_attempts
WHEN NEW.status='SUCCEEDED' AND OLD.status<>'SUCCEEDED'
BEGIN
  SELECT CASE WHEN NEW.provider_transaction_id IS NULL OR length(trim(NEW.provider_transaction_id))=0
    THEN RAISE(ABORT,'verified provider transaction required') END;
  SELECT CASE WHEN NEW.verified_at IS NULL
    THEN RAISE(ABORT,'verified timestamp required') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_attempt_terminal_immutable
BEFORE UPDATE ON ecommerce_payment_attempts
WHEN OLD.status IN('SUCCEEDED','FAILED','CANCELLED') AND (
  OLD.status<>NEW.status OR COALESCE(OLD.provider_attempt_reference,'')<>COALESCE(NEW.provider_attempt_reference,'')
  OR COALESCE(OLD.provider_transaction_id,'')<>COALESCE(NEW.provider_transaction_id,'')
  OR COALESCE(OLD.verification_code,'')<>COALESCE(NEW.verification_code,'')
  OR COALESCE(OLD.verified_at,'')<>COALESCE(NEW.verified_at,'')
  OR COALESCE(OLD.terminal_at,'')<>COALESCE(NEW.terminal_at,'')
)
BEGIN
  SELECT RAISE(ABORT,'terminal commerce payment attempt is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_verified_payment_required
BEFORE UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>'PAID' AND NEW.payment_status='PAID'
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_payment_attempts a
    WHERE a.workspace_id=NEW.workspace_id AND a.site_project_id=NEW.site_project_id
      AND a.order_id=NEW.id AND a.status='SUCCEEDED'
      AND a.amount_minor=NEW.total_minor AND a.currency=NEW.currency
      AND a.provider=NEW.payment_provider
      AND a.provider_transaction_id=NEW.payment_reference
  ) THEN RAISE(ABORT,'verified commerce payment attempt required') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_verified_refund_required
BEFORE UPDATE OF payment_status ON ecommerce_orders
WHEN NEW.payment_status IN('PARTIALLY_REFUNDED','REFUNDED') AND OLD.payment_status<>NEW.payment_status
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_refunds r
    WHERE r.workspace_id=NEW.workspace_id AND r.order_id=NEW.id
      AND r.status='SUCCEEDED' AND r.provider_reference IS NOT NULL
  ) THEN RAISE(ABORT,'verified commerce refund required') END;
END;
`);
  },
};
