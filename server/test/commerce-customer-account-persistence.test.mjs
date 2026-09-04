import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration042SiteBuilderControlPlane } from "../db/migrations/042_site_builder_control_plane.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration057BusinessBuilderAppUsers } from "../db/migrations/057_business_builder_app_users.mjs";
import { migration069BusinessBuilderCommerceBindings } from "../db/migrations/069_business_builder_commerce_bindings.mjs";
import { migration049EcommerceCore } from "../db/migrations/049_ecommerce_core.mjs";
import { migration073CommerceCustomerAccounts } from "../db/migrations/073_commerce_customer_accounts.mjs";
import { createCustomerAccountRepository } from "../app/commerce/v2/customer-account-repository.mjs";
import { createCustomerAccountService } from "../app/commerce/v2/customer-account-service.mjs";

function fixture() {
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
  const now="2026-09-05T10:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,created_at,updated_at) VALUES('w1','W','w',?,?)").run(now,now);
  db.prepare("INSERT INTO users(id,email,password_hash,created_at,updated_at) VALUES('owner','o@example.com','x',?,?)").run(now,now);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,slug,status,created_at,updated_at) VALUES('s1','w1','Store','store','draft',?,?)").run(now,now);
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,locale,status,created_at,updated_at) VALUES('p1','w1','App','fa-IR','active',?,?)").run(now,now);
  db.prepare("INSERT INTO business_builder_app_users(id,workspace_id,project_id,email,display_name,role,status,created_at,updated_at) VALUES('u1','w1','p1','buyer@example.com','Buyer','customer','active',?,?)").run(now,now);
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_at,updated_at) VALUES('b1','w1','s1','p1','active',?,?)").run(now,now);
  const repository=createCustomerAccountRepository(db);
  let tick=0;
  const service=createCustomerAccountService({repository,clock:()=>`2026-09-05T10:${String(tick++).padStart(2,'0')}:00.000Z`,idFactory:()=>`id-${tick}`});
  const principal={id:"u1",projectId:"p1",role:"customer",status:"active",displayName:"Buyer"};
  return {db,repository,service,principal};
}

test("getOrCreate is identity-idempotent and DB uniqueness is final boundary",()=>{
  const {db,service,principal}=fixture();
  const first=service.getOrCreate({workspaceId:"w1",siteProjectId:"s1",principal});
  const second=service.getOrCreate({workspaceId:"w1",siteProjectId:"s1",principal});
  assert.equal(first.id,second.id);
  assert.equal(db.prepare("SELECT count(*) c FROM ecommerce_customer_accounts").get().c,1);
});

test("store/auth binding and customer app-user relationship fail closed at DB boundary",()=>{
  const {db}=fixture();
  assert.throws(()=>db.prepare("INSERT INTO ecommerce_customer_accounts(id,workspace_id,site_project_id,auth_project_id,app_user_id,metadata_json,revision,created_at,updated_at) VALUES('x','w1','s1','wrong','u1','{}',1,'t','t')").run(),/customer account commerce binding mismatch|FOREIGN KEY/);
});

test("profile and address writes use optimistic revision and preserve one default",()=>{
  const {service,principal}=fixture();
  let account=service.getOrCreate({workspaceId:"w1",siteProjectId:"s1",principal});
  account=service.updateProfile({workspaceId:"w1",siteProjectId:"s1",principal,expectedRevision:account.revision,patch:{phone:"0912"}});
  assert.equal(account.revision,2);
  assert.throws(()=>service.updateProfile({workspaceId:"w1",siteProjectId:"s1",principal,expectedRevision:1,patch:{phone:"x"}}),/changed concurrently/);
  account=service.addAddress({workspaceId:"w1",siteProjectId:"s1",principal,expectedRevision:account.revision,address:{id:"a1",name:"Buyer",phone:"0912",city:"Tehran",address1:"One"},makeDefaultShipping:true});
  account=service.addAddress({workspaceId:"w1",siteProjectId:"s1",principal,expectedRevision:account.revision,address:{id:"a2",name:"Buyer",phone:"0912",city:"Tehran",address1:"Two"},makeDefaultShipping:true});
  assert.equal(account.defaultShippingAddressId,"a2");
});

test("checkout ownership link is immutable and customer order history is account-scoped",()=>{
  const {db,service,principal}=fixture();
  const account=service.getOrCreate({workspaceId:"w1",siteProjectId:"s1",principal});
  db.prepare("INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,currency,status,payment_status,fulfillment_status,shipping_address_json,total_minor,created_at,updated_at) VALUES('o1','w1','s1','IRT','CONFIRMED','PAID','UNFULFILLED','{}',1000,'2026-09-05T11:00:00.000Z','2026-09-05T11:00:00.000Z')").run();
  service.linkCheckoutOrder({workspaceId:"w1",siteProjectId:"s1",principal,order:{id:"o1",workspaceId:"w1",storeId:"s1",createdAt:"2026-09-05T11:00:00.000Z"}});
  const orders=service.listOrders({workspaceId:"w1",siteProjectId:"s1",principal});
  assert.equal(orders.length,1);assert.equal(orders[0].id,"o1");
  assert.throws(()=>db.prepare("DELETE FROM ecommerce_customer_order_links WHERE order_id='o1'").run(),/immutable/);
  assert.throws(()=>db.prepare("UPDATE ecommerce_customer_order_links SET source='CHECKOUT' WHERE order_id='o1'").run(),/immutable/);
});
