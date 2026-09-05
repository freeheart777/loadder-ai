import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
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
import { createRefundService } from "../app/commerce/v2/refund-service.mjs";
import { createEcommerceRouter } from "../app/routes/ecommerce.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

function fixture(){
  const db=new Database(":memory:");db.pragma("foreign_keys=OFF");migration001Identity.up(db);db.exec("CREATE TABLE IF NOT EXISTS business_context_versions(id TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY)");
  for(const migration of [migration042SiteBuilderControlPlane,migration049EcommerceCore,migration050BusinessBuilderProjects,migration069BusinessBuilderCommerceBindings,migration070BusinessBuilderCommerceOutbox,migration072CommerceFinancialLedger,migration077CommerceLifecycleOutboxTriggers,migration078CommerceFullRefundFinancialLedger,migration079CommerceRefundRecords])migration.up(db);
  db.pragma("foreign_keys=ON");const t="2026-09-05T00:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("w1","W1","w1","active",t,t);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run("s1","w1","Store","STORE","store","PUBLISHED","{}",t,t);
  db.prepare("INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,email,currency,status,payment_status,fulfillment_status,payment_provider,total_minor,shipping_address_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("o1","w1","s1","buyer@example.com","USD","CONFIRMED","PAID","FULFILLED","TEST",10000,"{}",t,t);
  db.prepare("INSERT INTO ecommerce_financial_ledger(id,workspace_id,site_project_id,order_id,source_type,source_id,entry_type,amount_minor,currency,occurred_at,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("ledger:payment-captured:o1","w1","s1","o1","ORDER_PAYMENT","o1","PAYMENT_CAPTURED",10000,"USD",t,"{}",t);
  let tick=1;const refundService=createRefundService({db,clock:()=>`2026-09-05T00:0${tick++}:00.000Z`});return{db,refundService};
}

test("refund service enforces lifecycle and derives partial/full order payment status",()=>{
  const{db,refundService}=fixture();runWithWorkspace("w1",()=>{
    const refund=refundService.create("o1",{amountMinor:4000,provider:"TEST",reason:"partial"});assert.equal(refund.status,"REQUESTED");
    assert.throws(()=>refundService.transition(refund.id,"SUCCEEDED",{providerReference:"x"}),error=>error.code==="REFUND_TRANSITION_INVALID");
    refundService.transition(refund.id,"APPROVED");refundService.transition(refund.id,"PROCESSING");const done=refundService.transition(refund.id,"SUCCEEDED",{providerReference:"provider-r1"});assert.equal(done.status,"SUCCEEDED");
    assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id='o1'").get().payment_status,"PARTIALLY_REFUNDED");
    const second=refundService.create("o1",{amountMinor:6000,provider:"TEST"});refundService.transition(second.id,"APPROVED");refundService.transition(second.id,"PROCESSING");refundService.transition(second.id,"SUCCEEDED",{providerReference:"provider-r2"});
    assert.equal(db.prepare("SELECT payment_status FROM ecommerce_orders WHERE id='o1'").get().payment_status,"REFUNDED");
    assert.throws(()=>refundService.create("o1",{amountMinor:1}),error=>error.code==="REFUND_ORDER_NOT_PAID");
  });db.close();
});

test("refund HTTP surface rejects members and lets admin drive a refund to success",async()=>{
  const{db,refundService}=fixture();const service={listProducts(){return[];}};const financialLedgerService={list(){return[];},getOrderFinancials(){return null;},reconcile(){return{status:"missing_order"};}};
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.workspace={id:"w1"};req.membership={role:String(req.headers["x-test-role"]||"member")};req.user={id:"u1"};return runWithWorkspace("w1",next);});app.use(createEcommerceRouter({service,financialLedgerService,refundService}));
  const server=await new Promise(resolve=>{const listener=app.listen(0,"127.0.0.1",()=>resolve(listener));});
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const denied=await fetch(`${base}/commerce/orders/o1/refunds`,{method:"POST",headers:{"content-type":"application/json","x-test-role":"member"},body:JSON.stringify({amountMinor:2500})});assert.equal(denied.status,403);
    const createdResponse=await fetch(`${base}/commerce/orders/o1/refunds`,{method:"POST",headers:{"content-type":"application/json","x-test-role":"admin"},body:JSON.stringify({amountMinor:2500,provider:"TEST"})});assert.equal(createdResponse.status,201);const created=(await createdResponse.json()).refund;
    for(const status of ["APPROVED","PROCESSING"]){const response=await fetch(`${base}/commerce/refunds/${created.id}/transitions`,{method:"POST",headers:{"content-type":"application/json","x-test-role":"admin"},body:JSON.stringify({status})});assert.equal(response.status,200);}
    const succeeded=await fetch(`${base}/commerce/refunds/${created.id}/transitions`,{method:"POST",headers:{"content-type":"application/json","x-test-role":"admin"},body:JSON.stringify({status:"SUCCEEDED",providerReference:"api-refund-1"})});assert.equal(succeeded.status,200);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM ecommerce_financial_ledger WHERE source_id=? AND entry_type='REFUND'").get(created.id).c,1);
  }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
