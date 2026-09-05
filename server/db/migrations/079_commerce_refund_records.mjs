export const migration079CommerceRefundRecords={version:79,name:"commerce_refund_records",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS ecommerce_refunds(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  return_id TEXT,
  status TEXT NOT NULL CHECK(status IN('REQUESTED','APPROVED','REJECTED','PROCESSING','SUCCEEDED','FAILED','CANCELLED')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  currency TEXT NOT NULL CHECK(length(trim(currency))>0),
  provider TEXT,
  provider_reference TEXT,
  reason TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  succeeded_at TEXT,
  failed_at TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE RESTRICT,
  FOREIGN KEY(order_id) REFERENCES ecommerce_orders(id) ON DELETE RESTRICT,
  UNIQUE(workspace_id,provider_reference)
);
CREATE INDEX IF NOT EXISTS idx_ecommerce_refunds_order ON ecommerce_refunds(workspace_id,order_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_refunds_status ON ecommerce_refunds(workspace_id,status,updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_refund_context_guard
BEFORE INSERT ON ecommerce_refunds
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ecommerce_orders o
    WHERE o.id=NEW.order_id
      AND o.workspace_id=NEW.workspace_id
      AND o.site_project_id=NEW.site_project_id
      AND o.currency=NEW.currency
  ) THEN RAISE(ABORT,'commerce refund order context mismatch') END;
  SELECT CASE WHEN COALESCE((
    SELECT SUM(r.amount_minor) FROM ecommerce_refunds r
    WHERE r.workspace_id=NEW.workspace_id
      AND r.order_id=NEW.order_id
      AND r.status='SUCCEEDED'
  ),0)+CASE WHEN NEW.status='SUCCEEDED' THEN NEW.amount_minor ELSE 0 END > (
    SELECT o.total_minor FROM ecommerce_orders o
    WHERE o.id=NEW.order_id AND o.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'commerce refund exceeds captured order total') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_refund_update_guard
BEFORE UPDATE ON ecommerce_refunds
BEGIN
  SELECT CASE WHEN OLD.workspace_id<>NEW.workspace_id OR OLD.site_project_id<>NEW.site_project_id OR OLD.order_id<>NEW.order_id OR OLD.amount_minor<>NEW.amount_minor OR OLD.currency<>NEW.currency
    THEN RAISE(ABORT,'commerce refund financial identity is immutable') END;
  SELECT CASE WHEN OLD.status='SUCCEEDED' AND NEW.status<>'SUCCEEDED'
    THEN RAISE(ABORT,'succeeded commerce refund is immutable') END;
  SELECT CASE WHEN OLD.status<>'SUCCEEDED' AND NEW.status='SUCCEEDED' AND COALESCE((
    SELECT SUM(r.amount_minor) FROM ecommerce_refunds r
    WHERE r.workspace_id=NEW.workspace_id
      AND r.order_id=NEW.order_id
      AND r.status='SUCCEEDED'
      AND r.id<>NEW.id
  ),0)+NEW.amount_minor > (
    SELECT o.total_minor FROM ecommerce_orders o
    WHERE o.id=NEW.order_id AND o.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'commerce refund exceeds captured order total') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_refund_succeeded_ledger_insert
AFTER INSERT ON ecommerce_refunds
WHEN NEW.status='SUCCEEDED'
BEGIN
  INSERT OR IGNORE INTO ecommerce_financial_ledger(
    id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,
    amount_minor,currency,occurred_at,metadata_json,created_at
  ) VALUES(
    'ledger:refund:' || NEW.id,NEW.workspace_id,NEW.site_project_id,NEW.order_id,
    'ORDER_REFUND',NEW.id,'REFUND',-NEW.amount_minor,NEW.currency,
    COALESCE(NEW.succeeded_at,NEW.updated_at),
    json_object('refundId',NEW.id,'returnId',NEW.return_id,'provider',NEW.provider,'providerReference',NEW.provider_reference,'refundMode','refund-record'),
    COALESCE(NEW.succeeded_at,NEW.updated_at)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_refund_succeeded_ledger_update
AFTER UPDATE OF status ON ecommerce_refunds
WHEN OLD.status<>'SUCCEEDED' AND NEW.status='SUCCEEDED'
BEGIN
  INSERT OR IGNORE INTO ecommerce_financial_ledger(
    id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,
    amount_minor,currency,occurred_at,metadata_json,created_at
  ) VALUES(
    'ledger:refund:' || NEW.id,NEW.workspace_id,NEW.site_project_id,NEW.order_id,
    'ORDER_REFUND',NEW.id,'REFUND',-NEW.amount_minor,NEW.currency,
    COALESCE(NEW.succeeded_at,NEW.updated_at),
    json_object('refundId',NEW.id,'returnId',NEW.return_id,'provider',NEW.provider,'providerReference',NEW.provider_reference,'refundMode','refund-record'),
    COALESCE(NEW.succeeded_at,NEW.updated_at)
  );
END;

DROP TRIGGER IF EXISTS trg_ecommerce_payment_refunded_ledger;
CREATE TRIGGER trg_ecommerce_payment_refunded_ledger
AFTER UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>'REFUNDED' AND NEW.payment_status='REFUNDED'
  AND NOT EXISTS(SELECT 1 FROM ecommerce_refunds r WHERE r.workspace_id=NEW.workspace_id AND r.order_id=NEW.id AND r.status='SUCCEEDED')
BEGIN
  INSERT OR IGNORE INTO ecommerce_financial_ledger(
    id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,
    amount_minor,currency,occurred_at,metadata_json,created_at
  ) VALUES(
    'ledger:payment-refunded:' || NEW.id,NEW.workspace_id,NEW.site_project_id,NEW.id,
    'ORDER_REFUND',NEW.id,'REFUND',-NEW.total_minor,NEW.currency,NEW.updated_at,
    json_object('paymentReference',NEW.payment_reference,'paymentProvider',NEW.payment_provider,'totalMinor',NEW.total_minor,'paymentStatus',NEW.payment_status,'refundMode','legacy-full-order-status-transition'),
    NEW.updated_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_refund_succeeded_outbox_insert
AFTER INSERT ON ecommerce_refunds
WHEN NEW.status='SUCCEEDED'
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(
    id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
  )
  SELECT
    'outbox:refund:' || NEW.id,NEW.workspace_id,NEW.site_project_id,b.business_builder_project_id,
    'commerce:payment-refunded:' || NEW.id,'commerce.payment.refunded',NEW.order_id,
    json_object('contract','loadder.commerce-event.v1','id','commerce:payment-refunded:' || NEW.id,'type','commerce.payment.refunded','workspaceId',NEW.workspace_id,'projectId',b.business_builder_project_id,'orderId',NEW.order_id,'occurredAt',COALESCE(NEW.succeeded_at,NEW.updated_at),'payload',json_object('siteProjectId',NEW.site_project_id,'refundId',NEW.id,'amountMinor',NEW.amount_minor,'currency',NEW.currency,'providerReference',NEW.provider_reference)),
    'pending',0,COALESCE(NEW.succeeded_at,NEW.updated_at),COALESCE(NEW.succeeded_at,NEW.updated_at)
  FROM business_builder_commerce_bindings b
  WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active';
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_refund_succeeded_outbox_update
AFTER UPDATE OF status ON ecommerce_refunds
WHEN OLD.status<>'SUCCEEDED' AND NEW.status='SUCCEEDED'
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(
    id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
  )
  SELECT
    'outbox:refund:' || NEW.id,NEW.workspace_id,NEW.site_project_id,b.business_builder_project_id,
    'commerce:payment-refunded:' || NEW.id,'commerce.payment.refunded',NEW.order_id,
    json_object('contract','loadder.commerce-event.v1','id','commerce:payment-refunded:' || NEW.id,'type','commerce.payment.refunded','workspaceId',NEW.workspace_id,'projectId',b.business_builder_project_id,'orderId',NEW.order_id,'occurredAt',COALESCE(NEW.succeeded_at,NEW.updated_at),'payload',json_object('siteProjectId',NEW.site_project_id,'refundId',NEW.id,'amountMinor',NEW.amount_minor,'currency',NEW.currency,'providerReference',NEW.provider_reference)),
    'pending',0,COALESCE(NEW.succeeded_at,NEW.updated_at),COALESCE(NEW.succeeded_at,NEW.updated_at)
  FROM business_builder_commerce_bindings b
  WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active';
END;
`);}};
