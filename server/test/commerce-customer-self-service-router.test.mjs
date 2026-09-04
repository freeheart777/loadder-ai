import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import express from "express";
import { once } from "node:events";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration042SiteBuilderControlPlane } from "../db/migrations/042_site_builder_control_plane.mjs";
import { migration049EcommerceCore } from "../db/migrations/049_ecommerce_core.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration057BusinessBuilderAppUsers } from "../db/migrations/057_business_builder_app_users.mjs";
import { migration069BusinessBuilderCommerceBindings } from "../db/migrations/069_business_builder_commerce_bindings.mjs";
import { migration073CommerceCustomerAccounts } from "../db/migrations/073_commerce_customer_accounts.mjs";
import { LoadderAppUserAuth } from "../app/business-builder/app-user-auth.mjs";
import { createAppUserRouter } from "../app/business-builder/app-user-router.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

function dbFixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migration001Identity.up(db);
  db.exec("CREATE TABLE IF NOT EXISTS business_context_versions(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY);");
  migration042SiteBuilderControlPlane.up(db);
  migration049EcommerceCore.up(db);
  migration050BusinessBuilderProjects.up(db);
  migration057BusinessBuilderAppUsers.up(db);
  migration069BusinessBuilderCommerceBindings.up(db);
  migration073CommerceCustomerAccounts.up(db);
  const t="2026-09-05T10:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES('w1','Workspace','workspace','active',?,?)").run(t,t);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES('s1','w1','Store','STORE','store','DRAFT','{}',?,?)").run(t,t);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES('s2','w1','Other','STORE','other','DRAFT','{}',?,?)").run(t,t);
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES('p1','w1','App','فروشگاه','fa-IR','ready',?,?)").run(t,t);
  db.prepare("INSERT INTO business_builder_app_users(id,workspace_id,project_id,email,display_name,role,status,created_at,updated_at) VALUES('u1','w1','p1','buyer@example.com','Buyer','customer','active',?,?)").run(t,t);
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_at,updated_at) VALUES('b1','w1','s1','p1','active',?,?)").run(t,t);
  const auth=new LoadderAppUserAuth(db);
  const session=runWithWorkspace("w1",()=>auth.createSession("u1"));
  return {db,token:session.token};
}

async function withServer(fn) {
  const {db,token}=dbFixture();
  const app=express();
  app.use(express.json());
  app.use((req,res,next)=>runWithWorkspace("w1",next));
  const projects={getProject:(id)=>id==="p1"?{id:"p1"}:null};
  app.use(createAppUserRouter({db,projects}));
  const server=app.listen(0,"127.0.0.1");
  await once(server,"listening");
  const {port}=server.address();
  try { await fn({base:`http://127.0.0.1:${port}`,token,db}); }
  finally { await new Promise((resolve)=>server.close(resolve)); db.close(); }
}

const request=(base,path,{token,method="GET",body,headers={}}={})=>fetch(`${base}${path}`,{
  method,
  headers:{...(body?{"content-type":"application/json"}:{}),...(token?{"X-Loadder-App-Token":token}:{}),...headers},
  body:body?JSON.stringify(body):undefined,
}).then(async r=>({status:r.status,body:await r.json()}));

test("self-service requires a valid customer app session",async()=>withServer(async({base})=>{
  const r=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me");
  assert.equal(r.status,401);
  assert.equal(r.body.code,"APP_CUSTOMER_AUTH_REQUIRED");
}));

test("customer can create/read own account but cannot cross an unbound store",async()=>withServer(async({base,token})=>{
  const created=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me",{token,method:"POST"});
  assert.equal(created.status,201);
  assert.equal(created.body.account.identitySubjectId,"u1");
  assert.equal(created.body.account.storeId,"s1");
  const read=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me",{token});
  assert.equal(read.status,200);
  assert.equal(read.body.account.id,created.body.account.id);
  const cross=await request(base,"/business-builder/projects/p1/commerce/stores/s2/me",{token,method:"POST"});
  assert.equal(cross.status,403);
  assert.equal(cross.body.code,"CUSTOMER_STORE_AUTH_BINDING_REQUIRED");
}));

test("profile/address mutations require If-Match and stale revisions return conflict",async()=>withServer(async({base,token})=>{
  const created=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me",{token,method:"POST"});
  const account=created.body.account;
  const noRevision=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me",{token,method:"PATCH",body:{profile:{phone:"0912"}}});
  assert.equal(noRevision.status,428);
  assert.equal(noRevision.body.code,"CUSTOMER_REVISION_REQUIRED");
  const updated=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me",{token,method:"PATCH",headers:{"If-Match":String(account.revision)},body:{profile:{phone:"0912"}}});
  assert.equal(updated.status,200);
  assert.equal(updated.body.account.revision,account.revision+1);
  const stale=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me",{token,method:"PATCH",headers:{"If-Match":String(account.revision)},body:{profile:{phone:"0935"}}});
  assert.equal(stale.status,409);
  assert.equal(stale.body.code,"CUSTOMER_REVISION_CONFLICT");
}));

test("authenticated customer can bind only its active same-store cart",async()=>withServer(async({base,token,db})=>{
  const created=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me",{token,method:"POST"});
  const t="2026-09-05T11:00:00.000Z";
  db.prepare("INSERT INTO ecommerce_carts(id,workspace_id,site_project_id,currency,status,subtotal_minor,discount_minor,shipping_minor,total_minor,created_at,updated_at) VALUES('cart1','w1','s1','IRT','ACTIVE',0,0,0,0,?,?)").run(t,t);
  const bound=await request(base,"/business-builder/projects/p1/commerce/stores/s1/me/carts/cart1/binding",{token,method:"PUT"});
  assert.equal(bound.status,200);
  assert.equal(bound.body.accountId,created.body.account.id);
  assert.equal(db.prepare("SELECT commerce_customer_account_id id FROM ecommerce_carts WHERE id='cart1'").get().id,created.body.account.id);
}));
