export const migration072CommerceFinancialLedger={version:72,name:"commerce_financial_ledger",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS ecommerce_financial_ledger(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN('ORDER_PAYMENT','ORDER_REFUND','ADJUSTMENT')),
  source_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK(entry_type IN('PAYMENT_CAPTURED','REFUND','ADJUSTMENT')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK(length(trim(currency))>0),
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE RESTRICT,
  FOREIGN KEY(order_id) REFERENCES ecommerce_orders(id) ON DELETE RESTRICT,
  UNIQUE(workspace_id,source_type,source_id,entry_type)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_financial_ledger_order ON ecommerce_financial_ledger(workspace_id,order_id,occurred_at,id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_financial_ledger_type ON ecommerce_financial_ledger(workspace_id,entry_type,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecommerce_financial_ledger_source ON ecommerce_financial_ledger(workspace_id,source_type,source_id);

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_financial_ledger_workspace_guard
BEFORE INSERT ON ecommerce_financial_ledger
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_orders o
    WHERE o.id=NEW.order_id
      AND o.workspace_id=NEW.workspace_id
      AND o.site_project_id=NEW.site_project_id
  ) THEN RAISE(ABORT,'commerce ledger order context mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_financial_ledger_immutable_update
BEFORE UPDATE ON ecommerce_financial_ledger
BEGIN
  SELECT RAISE(ABORT,'commerce ledger entries are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_financial_ledger_immutable_delete
BEFORE DELETE ON ecommerce_financial_ledger
BEGIN
  SELECT RAISE(ABORT,'commerce ledger entries are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_captured_ledger
AFTER UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>'PAID' AND NEW.payment_status='PAID'
BEGIN
  INSERT OR IGNORE INTO ecommerce_financial_ledger(
    id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,
    amount_minor,currency,occurred_at,metadata_json,created_at
  ) VALUES(
    'ledger:payment-captured:' || NEW.id,
    NEW.workspace_id,
    NEW.site_project_id,
    NEW.id,
    'ORDER_PAYMENT',
    NEW.id,
    'PAYMENT_CAPTURED',
    NEW.total_minor,
    NEW.currency,
    NEW.updated_at,
    json_object(
      'paymentReference',NEW.payment_reference,
      'paymentProvider',NEW.payment_provider,
      'subtotalMinor',NEW.subtotal_minor,
      'discountMinor',NEW.discount_minor,
      'shippingMinor',NEW.shipping_minor,
      'totalMinor',NEW.total_minor,
      'paymentStatus',NEW.payment_status
    ),
    NEW.updated_at
  );
END;
`);}};
