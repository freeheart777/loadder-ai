export const migration077CommerceLifecycleOutboxTriggers={version:77,name:"commerce_lifecycle_outbox_triggers",up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_ecommerce_payment_refunded_outbox
AFTER UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>'REFUNDED' AND NEW.payment_status='REFUNDED'
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(
    id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
  )
  SELECT
    'outbox:payment-refunded:' || NEW.id,
    NEW.workspace_id,
    NEW.site_project_id,
    b.business_builder_project_id,
    'commerce:payment-refunded:' || NEW.id,
    'commerce.payment.refunded',
    NEW.id,
    json_object(
      'contract','loadder.commerce-event.v1',
      'id','commerce:payment-refunded:' || NEW.id,
      'type','commerce.payment.refunded',
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

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_order_cancelled_outbox
AFTER UPDATE OF status ON ecommerce_orders
WHEN OLD.status<>'CANCELLED' AND NEW.status='CANCELLED'
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(
    id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
  )
  SELECT
    'outbox:order-cancelled:' || NEW.id,
    NEW.workspace_id,
    NEW.site_project_id,
    b.business_builder_project_id,
    'commerce:order-cancelled:' || NEW.id,
    'commerce.order.cancelled',
    NEW.id,
    json_object(
      'contract','loadder.commerce-event.v1',
      'id','commerce:order-cancelled:' || NEW.id,
      'type','commerce.order.cancelled',
      'workspaceId',NEW.workspace_id,
      'projectId',b.business_builder_project_id,
      'orderId',NEW.id,
      'occurredAt',NEW.updated_at,
      'payload',json_object(
        'siteProjectId',NEW.site_project_id,
        'currency',NEW.currency,
        'totalMinor',NEW.total_minor,
        'paymentStatus',NEW.payment_status,
        'fulfillmentStatus',NEW.fulfillment_status
      )
    ),
    'pending',0,NEW.updated_at,NEW.updated_at
  FROM business_builder_commerce_bindings b
  WHERE b.workspace_id=NEW.workspace_id
    AND b.site_project_id=NEW.site_project_id
    AND b.status='active';
END;

CREATE TRIGGER IF NOT EXISTS trg_ecommerce_fulfillment_completed_outbox
AFTER UPDATE OF fulfillment_status ON ecommerce_orders
WHEN OLD.fulfillment_status<>'FULFILLED' AND NEW.fulfillment_status='FULFILLED'
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(
    id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at
  )
  SELECT
    'outbox:fulfillment-completed:' || NEW.id,
    NEW.workspace_id,
    NEW.site_project_id,
    b.business_builder_project_id,
    'commerce:fulfillment-completed:' || NEW.id,
    'commerce.fulfillment.completed',
    NEW.id,
    json_object(
      'contract','loadder.commerce-event.v1',
      'id','commerce:fulfillment-completed:' || NEW.id,
      'type','commerce.fulfillment.completed',
      'workspaceId',NEW.workspace_id,
      'projectId',b.business_builder_project_id,
      'orderId',NEW.id,
      'occurredAt',NEW.updated_at,
      'payload',json_object(
        'siteProjectId',NEW.site_project_id,
        'currency',NEW.currency,
        'totalMinor',NEW.total_minor,
        'paymentStatus',NEW.payment_status,
        'fulfillmentStatus',NEW.fulfillment_status
      )
    ),
    'pending',0,NEW.updated_at,NEW.updated_at
  FROM business_builder_commerce_bindings b
  WHERE b.workspace_id=NEW.workspace_id
    AND b.site_project_id=NEW.site_project_id
    AND b.status='active';
END;
`);}};
