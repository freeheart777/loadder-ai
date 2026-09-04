export const migration071BusinessBuilderCommerceOutboxTriggers={version:71,name:"business_builder_commerce_outbox_triggers",up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_order_created_outbox
AFTER INSERT ON ecommerce_orders
WHEN EXISTS(SELECT 1 FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active')
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at)
  SELECT 'outbox:order.created:'||NEW.id,NEW.workspace_id,NEW.site_project_id,b.business_builder_project_id,'commerce:order.created:'||NEW.id,'commerce.order.created',NEW.id,
    json_object('contract','loadder.commerce-event.v1','id','commerce:order.created:'||NEW.id,'type','commerce.order.created','workspaceId',NEW.workspace_id,'projectId',b.business_builder_project_id,'orderId',NEW.id,'occurredAt',NEW.created_at,'payload',json_object('siteProjectId',NEW.site_project_id,'currency',NEW.currency,'totalMinor',NEW.total_minor,'paymentStatus',NEW.payment_status,'fulfillmentStatus',NEW.fulfillment_status)),
    'pending',0,NEW.created_at,NEW.created_at
  FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active';
END;

CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_payment_captured_outbox
AFTER UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>NEW.payment_status AND NEW.payment_status='PAID' AND EXISTS(SELECT 1 FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active')
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at)
  SELECT 'outbox:payment.captured:'||NEW.id,NEW.workspace_id,NEW.site_project_id,b.business_builder_project_id,'commerce:payment.captured:'||NEW.id,'commerce.payment.captured',NEW.id,
    json_object('contract','loadder.commerce-event.v1','id','commerce:payment.captured:'||NEW.id,'type','commerce.payment.captured','workspaceId',NEW.workspace_id,'projectId',b.business_builder_project_id,'orderId',NEW.id,'occurredAt',NEW.updated_at,'payload',json_object('siteProjectId',NEW.site_project_id,'currency',NEW.currency,'totalMinor',NEW.total_minor,'paymentStatus',NEW.payment_status,'fulfillmentStatus',NEW.fulfillment_status)),
    'pending',0,NEW.updated_at,NEW.updated_at
  FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active';
END;

CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_payment_refunded_outbox
AFTER UPDATE OF payment_status ON ecommerce_orders
WHEN OLD.payment_status<>NEW.payment_status AND NEW.payment_status='REFUNDED' AND EXISTS(SELECT 1 FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active')
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at)
  SELECT 'outbox:payment.refunded:'||NEW.id,NEW.workspace_id,NEW.site_project_id,b.business_builder_project_id,'commerce:payment.refunded:'||NEW.id,'commerce.payment.refunded',NEW.id,
    json_object('contract','loadder.commerce-event.v1','id','commerce:payment.refunded:'||NEW.id,'type','commerce.payment.refunded','workspaceId',NEW.workspace_id,'projectId',b.business_builder_project_id,'orderId',NEW.id,'occurredAt',NEW.updated_at,'payload',json_object('siteProjectId',NEW.site_project_id,'currency',NEW.currency,'totalMinor',NEW.total_minor,'paymentStatus',NEW.payment_status,'fulfillmentStatus',NEW.fulfillment_status)),
    'pending',0,NEW.updated_at,NEW.updated_at
  FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active';
END;

CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_order_cancelled_outbox
AFTER UPDATE OF status ON ecommerce_orders
WHEN OLD.status<>NEW.status AND NEW.status='CANCELLED' AND EXISTS(SELECT 1 FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active')
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at)
  SELECT 'outbox:order.cancelled:'||NEW.id,NEW.workspace_id,NEW.site_project_id,b.business_builder_project_id,'commerce:order.cancelled:'||NEW.id,'commerce.order.cancelled',NEW.id,
    json_object('contract','loadder.commerce-event.v1','id','commerce:order.cancelled:'||NEW.id,'type','commerce.order.cancelled','workspaceId',NEW.workspace_id,'projectId',b.business_builder_project_id,'orderId',NEW.id,'occurredAt',NEW.updated_at,'payload',json_object('siteProjectId',NEW.site_project_id,'currency',NEW.currency,'totalMinor',NEW.total_minor,'paymentStatus',NEW.payment_status,'fulfillmentStatus',NEW.fulfillment_status)),
    'pending',0,NEW.updated_at,NEW.updated_at
  FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active';
END;

CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_fulfilled_outbox
AFTER UPDATE OF fulfillment_status ON ecommerce_orders
WHEN OLD.fulfillment_status<>NEW.fulfillment_status AND NEW.fulfillment_status='FULFILLED' AND EXISTS(SELECT 1 FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active')
BEGIN
  INSERT OR IGNORE INTO business_builder_commerce_outbox(id,workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,status,attempts,available_at,created_at)
  SELECT 'outbox:fulfillment.completed:'||NEW.id,NEW.workspace_id,NEW.site_project_id,b.business_builder_project_id,'commerce:fulfillment.completed:'||NEW.id,'commerce.fulfillment.completed',NEW.id,
    json_object('contract','loadder.commerce-event.v1','id','commerce:fulfillment.completed:'||NEW.id,'type','commerce.fulfillment.completed','workspaceId',NEW.workspace_id,'projectId',b.business_builder_project_id,'orderId',NEW.id,'occurredAt',NEW.updated_at,'payload',json_object('siteProjectId',NEW.site_project_id,'currency',NEW.currency,'totalMinor',NEW.total_minor,'paymentStatus',NEW.payment_status,'fulfillmentStatus',NEW.fulfillment_status)),
    'pending',0,NEW.updated_at,NEW.updated_at
  FROM business_builder_commerce_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.status='active';
END;
`);}};
