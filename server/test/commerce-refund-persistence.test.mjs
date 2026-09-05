import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration042SiteBuilderControlPlane } from "../db/migrations/042_site_builder_control_plane.mjs";
import { migration049EcommerceCore } from "../db/migrations/049_ecommerce_core.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration069BusinessBuilderCommerceBindings } from "../db/migrations/069_business_builder_commerce_bindings.mjs";
import { migration070BusinessBuilderCommerceOutbox } from "../db/migrations/070_business_builder_commerce_outbox.mjs";
import { migration072CommerceFinancialLedger } from "../db/migrations/072_commerce_financial_ledger.mjs";
import { migration077CommerceLifecycleOutboxTriggers } from "../db/migrations/077_commerce_lifecycle_outbox_triggers.mjs";
import { migration078CommerceFullRefundFinancialLedger } from "../db/migrations/078_commerce_full_refund_financial_ledger.mjs";
import { migration079CommerceRefundRecords } from "../db/migrations/079_commerce_refund_records.mjs";
import { getOrderFinancialSummary } from "../app/commerce/v2/financial-ledger.mjs";

function setup(){
  const db=new Database(":memory:");db.pragma("foreign_keys=OFF");
  migration001Identity.up(db);db.exec("CREATE TABLE IF NOT EXISTS business_context_versions(id TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY)");
  for(const migration of [migration042SiteBuilderControlPlane,migration049EcommerceCore,migration050BusinessBuilderProjects,migration069BusinessBuilderCommerceBindings,migration070BusinessBuilderCommerceOutbox,migration072CommerceFinancialLedger,migration077CommerceLifecycleOutboxTriggers,migration078CommerceFullRefundFinancialLedger,migration079CommerceRefundRecords]) migration.up(db);
  db.pragma("foreign_keys=ON");
  const t="2026-09-05T00:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("w1","W1","w1","active",t,t);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run("s1","w1","Store","STORE","store","PUBLISHED","{}",t,t);
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run("p1","w1","Ops","commerce accounting","fa-IR","draft",t,t);
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("b1","w1","s1","p1","active",t,t);
  db.prepare("INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,email,currency,status,payment_status,fulfillment_status,total_minor,shipping_address_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("o1","w1","s1","buyer@example.com","USD","CONFIRMED","PAID","FULFILLED",10000,"{}",t,t);
  db.prepare("INSERT INTO ecommerce_financial_ledger(id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,amount_minor,currency,occurred_at,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("ledger:payment-captured:o1","w1","s1","o1","ORDER_PAYMENT","o1","PAYMENT_CAPTURED",10000,"USD",t,"{}",t);
  return db;
}

function insertRefund(db,{id="r1",amount=2500,status="REQUESTED",providerReference=null}={}){
  const t="2026-09-05T00:01:00.000Z";
  db.prepare("INSERT INTO ecommerce_refunds(id,workspace_id,site_project_id,order_id,status,amount_minor,currency,provider,provider_reference,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .run(id,"w1","s1","o1",status,amount,"USD","TEST",providerReference,t,t);
}

test("partial refund success atomically creates one ledger reversal and one outbox event",()=>{
  const db=setup();insertRefund(db,{providerReference:"refund-1"});
  db.prepare("UPDATE ecommerce_refunds SET status='SUCCEEDED',succeeded_at=?,updated_at=? WHERE id='r1'").run("2026-09-05T00:02:00.000Z","2026-09-05T00:02:00.000Z");
  db.prepare("UPDATE ecommerce_refunds SET status='SUCCEEDED',updated_at=? WHERE id='r1'").run("2026-09-05T00:03:00.000Z");
  const ledger=db.prepare("SELECT source_id,amount_minor FROM ecommerce_financial_ledger WHERE entry_type='REFUND'").all();
  assert.deepEqual(ledger,[{source_id:"r1",amount_minor:-2500}]);
  const outbox=db.prepare("SELECT event_id,event_type FROM business_builder_commerce_outbox WHERE event_type='commerce.payment.refunded'").all();
  assert.deepEqual(outbox,[{event_id:"commerce:payment-refunded:r1",event_type:"commerce.payment.refunded"}]);
  const summary=getOrderFinancialSummary(db,{workspaceId:"w1",orderId:"o1"});
  assert.equal(summary.paidMinor,10000);assert.equal(summary.refundedMinor,2500);assert.equal(summary.netMinor,7500);
  db.close();
});

test("multiple succeeded partial refunds accumulate but can never exceed captured order total",()=>{
  const db=setup();insertRefund(db,{id:"r1",amount:3000,status:"SUCCEEDED",providerReference:"refund-1"});insertRefund(db,{id:"r2",amount:2000,status:"SUCCEEDED",providerReference:"refund-2"});
  assert.equal(getOrderFinancialSummary(db,{workspaceId:"w1",orderId:"o1"}).refundedMinor,5000);
  assert.throws(()=>insertRefund(db,{id:"r3",amount:6000,status:"SUCCEEDED",providerReference:"refund-3"}),/exceeds captured order total/);
  db.close();
});

test("full refund order transition does not double count when authoritative refund records already cover it",()=>{
  const db=setup();insertRefund(db,{id:"r-full",amount:10000,status:"SUCCEEDED",providerReference:"refund-full"});
  db.prepare("UPDATE ecommerce_orders SET payment_status='REFUNDED',updated_at=? WHERE id='o1'").run("2026-09-05T00:04:00.000Z");
  const rows=db.prepare("SELECT source_id,amount_minor FROM ecommerce_financial_ledger WHERE entry_type='REFUND'").all();
  assert.deepEqual(rows,[{source_id:"r-full",amount_minor:-10000}]);
  assert.equal(getOrderFinancialSummary(db,{workspaceId:"w1",orderId:"o1"}).netMinor,0);
  db.close();
});

test("refund success rollback removes ledger and outbox effects together",()=>{
  const db=setup();insertRefund(db);
  assert.throws(()=>db.transaction(()=>{db.prepare("UPDATE ecommerce_refunds SET status='SUCCEEDED',succeeded_at=?,updated_at=? WHERE id='r1'").run("2026-09-05T00:02:00.000Z","2026-09-05T00:02:00.000Z");throw new Error("rollback-refund");})(),/rollback-refund/);
  assert.equal(db.prepare("SELECT status FROM ecommerce_refunds WHERE id='r1'").get().status,"REQUESTED");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM ecommerce_financial_ledger WHERE entry_type='REFUND'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM business_builder_commerce_outbox WHERE event_type='commerce.payment.refunded'").get().c,0);
  db.close();
});

test("succeeded refund financial identity cannot be rewritten",()=>{
  const db=setup();insertRefund(db,{status:"SUCCEEDED",providerReference:"refund-1"});
  assert.throws(()=>db.prepare("UPDATE ecommerce_refunds SET amount_minor=1 WHERE id='r1'").run(),/financial identity is immutable/);
  assert.throws(()=>db.prepare("UPDATE ecommerce_refunds SET status='FAILED' WHERE id='r1'").run(),/succeeded commerce refund is immutable/);
  db.close();
});
