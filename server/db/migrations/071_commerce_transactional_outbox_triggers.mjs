export const migration071CommerceTransactionalOutboxTriggers={version:71,name:"commerce_transactional_outbox_triggers",up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_order_created_outbox
AFTER INSERT ON ecommerce_orders
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(
    id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
  )
  SELECT
    lower(hex(randomblob(16))),
    NEW.workspace_id,
    NEW.site_project_id,
    b.business_builder_project_id,
    'commerce:order-created:' || NEW.id,
    'commerce.order.created',
    NEW.id,
    json_object(
      'contract','loadder.commerce-event.v1',
      'id','commerce:order-created:' || NEW.id,
      'type','commerce.order.created',
      'workspaceId',NEW.workspace_id,
      'projectId',b.business_builder_project_id,
      'orderId',NEW.id,
      'occurredAt',NEW.created_at,
      'payload',json_object(
        'siteProjectId',NEW.site_project_id,
        'currency',NEW.currency,
        'totalMinor',NEW.total_minor,
        'paymentStatus',NEW.payment_status,
        'fulfillmentStatus',NEW.fulfillment_status
      )
    ),
    'pending',0,NEW.created_at,NEW.created_at
  FROM business_builder_commerce_bindings b
  WHERE b.workspace_id=NEW.workspace_id
    AND b.site_project_id=NEW.site_project_id
    AND b.status='active';
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_captured_outbox
AFTER UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>'PAID' AND NEW.payment_status='PAID'
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(
    id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
  )
  SELECT
    lower(hex(randomblob(16))),
    NEW.workspace_id,
    NEW.site_project_id,
    b.business_builder_project_id,
    'commerce:payment-captured:' || NEW.id,
    'commerce.payment.captured',
    NEW.id,
    json_object(
      'contract','loadder.commerce-event.v1',
      'id','commerce:payment-captured:' || NEW.id,
      'type','commerce.payment.captured',
      'workspaceId',NEW.workspace_id,
      'projectId',b.business_builder_project_id,
      'orderId',NEW.id,
      'occurredAt',NEW.updated_at,
      'payload',json_object(
        'siteProjectId',NEW.site_project_id,
        'currency',NEW.currency,
        'totalMinor',NEW.total_minor,
        'paymentStatus',NEW.payment_status,
        'fulfillmentStatus',NEW.fulfillment_status,
        'paymentReference',NEW.payment_reference
      )
    ),
    'pending',0,NEW.updated_at,NEW.updated_at
  FROM business_builder_commerce_bindings b
  WHERE b.workspace_id=NEW.workspace_id
    AND b.site_project_id=NEW.site_project_id
    AND b.status='active';
END;
`);}};
