export const migration078CommerceFullRefundFinancialLedger={version:78,name:"commerce_full_refund_financial_ledger",up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_refunded_ledger
AFTER UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>'REFUNDED' AND NEW.payment_status='REFUNDED'
BEGIN
  INSERT OR IGNORE INTO ecommerce_financial_ledger(
    id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,
    amount_minor,currency,occurred_at,metadata_json,created_at
  ) VALUES(
    'ledger:payment-refunded:' || NEW.id,
    NEW.workspace_id,
    NEW.site_project_id,
    NEW.id,
    'ORDER_REFUND',
    NEW.id,
    'REFUND',
    -NEW.total_minor,
    NEW.currency,
    NEW.updated_at,
    json_object(
      'paymentReference',NEW.payment_reference,
      'paymentProvider',NEW.payment_provider,
      'totalMinor',NEW.total_minor,
      'paymentStatus',NEW.payment_status,
      'refundMode','full-order-status-transition'
    ),
    NEW.updated_at
  );
END;
`);}};
