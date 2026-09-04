import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration042SiteBuilderControlPlane } from "../db/migrations/042_site_builder_control_plane.mjs";
import { migration049EcommerceCore } from "../db/migrations/049_ecommerce_core.mjs";
import { migration050BusinessBuilderProjects } from "../db/migrations/050_business_builder_projects.mjs";
import { migration057BusinessBuilderAppUsers } from "../db/migrations/057_business_builder_app_users.mjs";
import { migration069BusinessBuilderCommerceBindings } from "../db/migrations/069_business_builder_commerce_bindings.mjs";
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

  const stamp = "2026-09-05T10:00:00.000Z";
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES('w1','Workspace','workspace','active',?,?)").run(stamp,stamp);
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES('s1','w1','Store','STORE','store','DRAFT','{}',?,?)").run(stamp,stamp);
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES('p1','w1','Store App','فروشگاه','fa-IR','ready',?,?)").run(stamp,stamp);
  db.prepare("INSERT INTO business_builder_app_users(id,workspace_id,project_id,email,display_name,role,status,created_at,updated_at) VALUES('u1','w1','p1','buyer@example.com','Buyer','customer','active',?,?)").run(stamp,stamp);
  db.prepare("INSERT INTO business_builder_commerce_bindings(id,workspace_id,site_project_id,business_builder_project_id,status,created_at,updated_at) VALUES('b1','w1','s1','p1','active',?,?)").run(stamp,stamp);

  const repository = createCustomerAccountRepository(db);
  let tick = 0;
  const service = createCustomerAccountService({
    repository,
    clock: () => `2026-09-05T10:${String(tick++).padStart(2,"0")}:00.000Z`,
    idFactory: () => `id-${tick}`,
  });
  const principal = { id:"u1", projectId:"p1", role:"customer", status:"active", displayName:"Buyer" };
  return { db, repository, service, principal };
}

function createCart(db, id="cart-1") {
  const stamp="2026-09-05T11:00:00.000Z";
  db.prepare(`INSERT INTO ecommerce_carts(id,workspace_id,site_project_id,currency,status,subtotal_minor,discount_minor,shipping_minor,total_minor,created_at,updated_at) VALUES(?,?,?,'IRT','ACTIVE',0,0,0,0,?,?)`).run(id,"w1","s1",stamp,stamp);
  return id;
}

function insertOrderFromCart(db, orderId, cartId) {
  const stamp="2026-09-05T11:10:00.000Z";
  db.prepare(`INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,cart_id,currency,status,payment_status,fulfillment_status,shipping_address_json,total_minor,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING','UNPAID','UNFULFILLED','{}',0,?,?)`).run(orderId,"w1","s1",cartId,"IRT",stamp,stamp);
}

test("getOrCreate is identity-idempotent and DB uniqueness is the final boundary", () => {
  const { db, service, principal } = fixture();
  const first = service.getOrCreate({ workspaceId:"w1", siteProjectId:"s1", principal });
  const second = service.getOrCreate({ workspaceId:"w1", siteProjectId:"s1", principal });
  assert.equal(first.id, second.id);
  assert.equal(db.prepare("SELECT count(*) c FROM ecommerce_customer_accounts").get().c, 1);
});

test("store/auth binding and active customer app-user relationship fail closed at DB boundary", () => {
  const { db } = fixture();
  assert.throws(
    () => db.prepare("INSERT INTO ecommerce_customer_accounts(id,workspace_id,site_project_id,auth_project_id,app_user_id,metadata_json,revision,created_at,updated_at) VALUES('x','w1','s1','wrong','u1','{}',1,'t','t')").run(),
    /customer account commerce binding mismatch|FOREIGN KEY/
  );
  db.prepare("UPDATE business_builder_app_users SET status='disabled' WHERE id='u1'").run();
  assert.throws(
    () => db.prepare("INSERT INTO ecommerce_customer_accounts(id,workspace_id,site_project_id,auth_project_id,app_user_id,metadata_json,revision,created_at,updated_at) VALUES('x2','w1','s1','p1','u1','{}',1,'t','t')").run(),
    /customer account app user mismatch/
  );
});

test("profile and address writes use optimistic revision and preserve one default", () => {
  const { service, principal } = fixture();
  let account = service.getOrCreate({ workspaceId:"w1", siteProjectId:"s1", principal });
  account = service.updateProfile({ workspaceId:"w1", siteProjectId:"s1", principal, expectedRevision:account.revision, patch:{phone:"0912"} });
  assert.equal(account.revision, 2);
  assert.throws(
    () => service.updateProfile({ workspaceId:"w1", siteProjectId:"s1", principal, expectedRevision:1, patch:{phone:"x"} }),
    /changed concurrently/
  );
  account = service.addAddress({ workspaceId:"w1", siteProjectId:"s1", principal, expectedRevision:account.revision, address:{id:"a1",name:"Buyer",phone:"0912",city:"Tehran",address1:"One"}, makeDefaultShipping:true });
  account = service.addAddress({ workspaceId:"w1", siteProjectId:"s1", principal, expectedRevision:account.revision, address:{id:"a2",name:"Buyer",phone:"0912",city:"Tehran",address1:"Two"}, makeDefaultShipping:true });
  assert.equal(account.defaultShippingAddressId, "a2");
  assert.equal(account.addresses.length, 2);
});

test("authenticated cart binding is idempotent and cannot move to another customer", () => {
  const { db, service, principal } = fixture();
  const account = service.getOrCreate({ workspaceId:"w1", siteProjectId:"s1", principal });
  const cartId = createCart(db);
  const first = service.bindCart({ workspaceId:"w1", siteProjectId:"s1", principal, cartId });
  const second = service.bindCart({ workspaceId:"w1", siteProjectId:"s1", principal, cartId });
  assert.equal(first.customerAccountId, account.id);
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(db.prepare("SELECT commerce_customer_account_id id FROM ecommerce_carts WHERE id=?").get(cartId).id, account.id);
});

test("order ownership is created automatically in the same transaction as checkout order insert", () => {
  const { db, service, principal } = fixture();
  const account = service.getOrCreate({ workspaceId:"w1", siteProjectId:"s1", principal });
  const cartId = createCart(db,"cart-linked");
  service.bindCart({ workspaceId:"w1", siteProjectId:"s1", principal, cartId });

  insertOrderFromCart(db,"o-linked",cartId);

  const link = db.prepare("SELECT * FROM ecommerce_customer_order_links WHERE order_id='o-linked'").get();
  assert.equal(link.customer_account_id, account.id);
  assert.equal(link.app_user_id, principal.id);
  assert.equal(link.auth_project_id, principal.projectId);
  assert.equal(link.source, "CHECKOUT");
  assert.equal(link.id, "customer-order:o-linked");

  const orders = service.listOrders({ workspaceId:"w1", siteProjectId:"s1", principal });
  assert.equal(orders.length, 1);
  assert.equal(orders[0].id, "o-linked");
  assert.throws(() => db.prepare("DELETE FROM ecommerce_customer_order_links WHERE order_id='o-linked'").run(), /immutable/);
});

test("checkout rollback also rolls back automatic customer order ownership link", () => {
  const { db, service, principal } = fixture();
  service.getOrCreate({ workspaceId:"w1", siteProjectId:"s1", principal });
  const cartId = createCart(db,"cart-rollback");
  service.bindCart({ workspaceId:"w1", siteProjectId:"s1", principal, cartId });

  const tx = db.transaction(() => {
    insertOrderFromCart(db,"o-rollback",cartId);
    assert.equal(db.prepare("SELECT count(*) c FROM ecommerce_customer_order_links WHERE order_id='o-rollback'").get().c, 1);
    throw new Error("rollback");
  });
  assert.throws(() => tx(), /rollback/);
  assert.equal(db.prepare("SELECT count(*) c FROM ecommerce_orders WHERE id='o-rollback'").get().c, 0);
  assert.equal(db.prepare("SELECT count(*) c FROM ecommerce_customer_order_links WHERE order_id='o-rollback'").get().c, 0);
});

test("unbound guest cart creates no customer ownership link", () => {
  const { db } = fixture();
  const cartId = createCart(db,"cart-guest");
  insertOrderFromCart(db,"o-guest",cartId);
  assert.equal(db.prepare("SELECT count(*) c FROM ecommerce_customer_order_links WHERE order_id='o-guest'").get().c, 0);
});
