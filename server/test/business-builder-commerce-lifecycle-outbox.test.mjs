import test from"node:test";
import assert from"node:assert/strict";
import Database from"better-sqlite3";
import{migration001Identity}from"../db/migrations/001_identity.mjs";
import{migration042SiteBuilderControlPlane}from"../db/migrations/042_site_builder_control_plane.mjs";
import{migration049EcommerceCore}from"../db/migrations/049_ecommerce_core.mjs";
import{migration050BusinessBuilderProjects}from"../db/migrations/050_business_builder_projects.mjs";
import{migration069BusinessBuilderCommerceBindings}from"../db/migrations/069_business_builder_commerce_bindings.mjs";
import{migration070BusinessBuilderCommerceOutbox}from"../db/migrations/070_business_builder_commerce_outbox.mjs";
import{migration071CommerceTransactionalOutboxTriggers}from"../db/migrations/071_commerce_transactional_outbox_triggers.mjs";
import{migration077CommerceLifecycleOutboxTriggers}from"../db/migrations/077_commerce_lifecycle_outbox_triggers.mjs";

function setup(){
  const db=new Database(":memory:");
  db.pragma("foreign_keys=OFF");
  migration001Identity.up(db);
  db.exec("CREATE TABLE IF NOT EXISTS business_context_versions(id TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY)");
  for(const m of[migration042SiteBuilderControlPlane,migration049EcommerceCore,migration050BusinessBuilderProjects,migration069BusinessBuilderCommerceBindings,migration070BusinessBuilderCommerceOutbox,migration071CommerceTransactionalOutboxTriggers,migration077CommerceLifecycleOutboxTriggers])m.up(db);
  db.pragma("foreign_keys=ON");
  const t="2026-09-05T00:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("w1","W1","w1","active",t,t);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run("s1","w1","Store","STORE","store","PUBLISHED","{}",t,t);
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run("p1","w1","Ops","commerce accounting","fa-IR","draft",t,t);
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("b1","w1","s1","p1","active",t,t);
  db.prepare("INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,email,currency,status,payment_status,fulfillment_status,total_minor,shipping_address_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("o1","w1","s1","buyer@example.com","USD","PENDING","PAID","UNFULFILLED",2500,"{}",t,t);
  return db;
}

function count(db,type){return db.prepare("SELECT COUNT(*) c FROM business_builder_commerce_outbox WHERE order_id='o1' AND event_type=?").get(type).c;}
function event(db,type){const row=db.prepare("SELECT event_id,payload_json FROM business_builder_commerce_outbox WHERE order_id='o1' AND event_type=?").get(type);return{...row,payload:JSON.parse(row.payload_json)};}

test("refund transition enqueues exactly one deterministic event",()=>{
  const db=setup();
  db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',updated_at=? WHERE id='o1'").run("2026-09-05T00:01:00.000Z");
  db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',updated_at=? WHERE id='o1'").run("2026-09-05T00:02:00.000Z");
  assert.equal(count(db,"commerce.payment.refunded"),1);
  const row=event(db,"commerce.payment.refunded");
  assert.equal(row.event_id,"commerce:payment-refunded:o1");
  assert.equal(row.payload.projectId,"p1");
  assert.equal(row.payload.payload.paymentStatus,"REFUNDED");
  db.close();
});

test("cancel transition enqueues exactly one deterministic event",()=>{
  const db=setup();
  db.prepare("UPDATE ecommerce_orders SET status='CANCELLED',updated_at=? WHERE id='o1'").run("2026-09-05T00:01:00.000Z");
  db.prepare("UPDATE ecommerce_orders SET status='CANCELLED',updated_at=? WHERE id='o1'").run("2026-09-05T00:02:00.000Z");
  assert.equal(count(db,"commerce.order.cancelled"),1);
  assert.equal(event(db,"commerce.order.cancelled").event_id,"commerce:order-cancelled:o1");
  db.close();
});

test("fulfillment transition enqueues exactly one deterministic event",()=>{
  const db=setup();
  db.prepare("UPDATE ecommerce_orders SET fulfillment_status='FULFILLED',updated_at=? WHERE id='o1'").run("2026-09-05T00:01:00.000Z");
  db.prepare("UPDATE ecommerce_orders SET fulfillment_status='FULFILLED',updated_at=? WHERE id='o1'").run("2026-09-05T00:02:00.000Z");
  assert.equal(count(db,"commerce.fulfillment.completed"),1);
  assert.equal(event(db,"commerce.fulfillment.completed").event_id,"commerce:fulfillment-completed:o1");
  db.close();
});

test("lifecycle outbox rows roll back with the commerce transition",()=>{
  const db=setup();
  assert.throws(()=>db.transaction(()=>{
    db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',updated_at=? WHERE id='o1'").run("2026-09-05T00:01:00.000Z");
    throw new Error("rollback-lifecycle");
  })(),/rollback-lifecycle/);
  assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id='o1'").get().payment_status,"PAID");
  assert.equal(count(db,"commerce.payment.refunded"),0);
  db.close();
});

test("disabled binding does not enqueue lifecycle events",()=>{
  const db=setup();
  db.prepare("UPDATE business_builder_commerce_bindings SET status='disabled' WHERE id='b1'").run();
  db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',status='CANCELLED',fulfillment_status='FULFILLED',updated_at=? WHERE id='o1'").run("2026-09-05T00:01:00.000Z");
  assert.equal(count(db,"commerce.payment.refunded"),0);
  assert.equal(count(db,"commerce.order.cancelled"),0);
  assert.equal(count(db,"commerce.fulfillment.completed"),0);
  db.close();
});
