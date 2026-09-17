import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import Database from "better-sqlite3";

const testDir = mkdtempSync(join(tmpdir(), "loadder-public-commerce-"));
process.env.DATABASE_PATH = join(testDir, "public-commerce.sqlite");
process.env.NODE_ENV = "test";

const [{ db }, { createAuthRouter }, { createSiteDomainService }, { createSiteProjectRepository }, { runWithWorkspace }, { runMigrations }, { migrations }, { migration086CommercePublicCapabilities }] = await Promise.all([
  import("../db/workspace-database.mjs"),
  import("../app/routes/auth.mjs"),
  import("../app/services/site-domain-service.mjs"),
  import("../app/repositories/site-project-repository.mjs"),
  import("../app/tenant-context.mjs"),
  import("../db/migrate.mjs"),
  import("../db/migrations/index.mjs"),
  import("../db/migrations/086_commerce_public_capabilities.mjs"),
]);
runMigrations(db, migrations);

const now = "2026-09-16T10:00:00.000Z";
for (const workspace of ["workspace-a", "workspace-b"]) {
  db.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)")
    .run(workspace, workspace, workspace, now, now);
}
function project(id, workspaceId, status) {
  db.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,published_at,created_at,updated_at) VALUES(?,?,?,'STORE',?,?,?, ?,?,?)")
    .run(id, workspaceId, id, id, status, JSON.stringify({ storeBuilderV16: { version: 16 } }), status === "PUBLISHED" ? now : null, now, now);
}
project("store-published", "workspace-a", "PUBLISHED");
project("store-draft", "workspace-a", "DRAFT");
project("store-foreign", "workspace-b", "PUBLISHED");
for (const [id, workspaceId] of [["store-published", "workspace-a"], ["store-foreign", "workspace-b"]]) {
  const content = id === "store-published" ? { storeBuilderV16: {
    version:16,selectedElement:{type:"product-card",id:"private-selection"},providerConfig:{secret:"must-not-leak"},unexpected:{merchantNote:"private"},
    design:{primaryColor:"#123456",privateToken:"hidden"},hero:{title:"عنوان عمومی",subtitle:"متن عمومی",internalDraft:true},
    sections:[{id:"private-section-id",type:"products",enabled:true,title:"محصولات",subtitle:"",backgroundColor:"#fff",textColor:"#111",spacingTop:20,spacingBottom:20,privateNote:"hidden",productSettings:{source:"featured",columnsDesktop:4,columnsTablet:3,columnsMobile:2,showStock:true,showCartButton:true}}],
    commerce:{cartButtonLabel:"خرید",paymentMode:"ONLINE",providerSecret:"hidden",productOverrides:{"product-a":{title:"عنوان جعلی",imageUrl:"https://evil.example/fake.png",regularPriceMinor:1,inventoryQuantity:999,promotionBadge:true,promotionBadgeText:"ویژه"}}},
  }} : { storeBuilderV16: { version:16 } };
  db.prepare("INSERT INTO site_publish_versions(id,workspace_id,site_project_id,version,content_json,manifest_json,published_at,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(`version-${id}`, workspaceId, id, 1, JSON.stringify(content), "{}", now, now);
}
function catalog(workspaceId, storeId, suffix) {
  db.prepare("INSERT INTO ecommerce_products(id,workspace_id,site_project_id,name,slug,status,currency,base_price_minor,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE','IRT',10000,?,?,?)")
    .run(`product-${suffix}`, workspaceId, storeId, `Product ${suffix}`, `product-${suffix}`, JSON.stringify({gallery:[`https://cdn.example.test/${suffix}.png`]}), now, now);
  db.prepare("INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,image_url,active,created_at,updated_at) VALUES(?,?,?,?,?,10000,10,'DENY','{}',?,1,?,?)")
    .run(`variant-${suffix}`, workspaceId, `product-${suffix}`, `SKU-${suffix}`, "Default", `https://cdn.example.test/${suffix}-main.png`, now, now);
}
catalog("workspace-a", "store-published", "a");
catalog("workspace-b", "store-foreign", "b");

const app = express();
app.use(express.json());
app.use("/api/auth", createAuthRouter({ authService: {}, nodeEnv: "test", exposeDevelopmentOtp: false }));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api/auth`;
const json = async (path, init = {}) => { const response = await fetch(`${base}${path}`, init); return { response, body: await response.json().catch(() => ({})) }; };
const post = (path, body, capability) => json(path, { method: "POST", headers: { "content-type": "application/json", ...(capability ? { "x-loadder-cart-capability": capability } : {}) }, body: JSON.stringify(body) });

test.after(() => server.close());

test("draft and missing stores share the same unavailable public posture", async () => {
  for (const storeId of ["store-draft", "missing-store"]) {
    for (const path of [`/storefront/${storeId}`, `/storefront/${storeId}/products`, `/storefront/${storeId}/checkout-options`]) {
      const result = await json(path);
      assert.equal(result.response.status, 404);
    }
    const cart = await post(`/storefront/${storeId}/carts`, { currency: "IRT" });
    assert.equal(cart.response.status, 404);
    assert.equal(cart.body.code, "PUBLIC_RESOURCE_NOT_FOUND");
  }
});

test("public presentation is a recursive allowlist and catalog truth defeats malicious snapshot overrides", async () => {
  const store = await json("/storefront/store-published");
  assert.equal(store.response.status, 200);
  assert.equal(store.body.presentation.storeBuilderV16.design.primaryColor, "#123456");
  assert.equal(store.body.presentation.storeBuilderV16.hero.title, "عنوان عمومی");
  assert.equal(store.body.presentation.storeBuilderV16.commerce.productOverrides["product-a"].promotionBadge, true);
  const serialized = JSON.stringify(store.body.presentation);
  for (const secret of ["selectedElement","private-selection","providerConfig","must-not-leak","unexpected","merchantNote","privateToken","internalDraft","private-section-id","privateNote","paymentMode","providerSecret","عنوان جعلی","evil.example","regularPriceMinor","inventoryQuantity"]) assert.equal(serialized.includes(secret), false, secret);

  const products = await json("/storefront/store-published/products");
  const product = products.body.products[0];
  assert.equal(product.name, "Product a");
  assert.equal(product.basePriceMinor, 10000);
  assert.deepEqual(product.gallery, ["https://cdn.example.test/a.png"]);
  assert.equal(product.variants[0].imageUrl, "https://cdn.example.test/a-main.png");
  assert.equal(product.variants[0].purchasable, true);
});

test("public availability uses the same canonical policy as cart authority", async () => {
  db.prepare("UPDATE ecommerce_variants SET inventory_quantity=0,inventory_policy='DENY' WHERE id='variant-a'").run();
  let products = await json("/storefront/store-published/products");
  assert.equal(products.body.products[0].variants[0].purchasable, false);
  const deniedCart = await post("/storefront/store-published/carts", { currency:"IRT" });
  const denied = await post(`/storefront/carts/${deniedCart.body.cart.id}/items`, { variantId:"variant-a",quantity:1 }, deniedCart.body.cartCapability);
  assert.equal(denied.body.code, "INSUFFICIENT_INVENTORY");

  db.prepare("UPDATE ecommerce_variants SET inventory_policy='CONTINUE' WHERE id='variant-a'").run();
  products = await json("/storefront/store-published/products");
  assert.equal(products.body.products[0].variants[0].purchasable, true);
  const allowedCart = await post("/storefront/store-published/carts", { currency:"IRT" });
  const allowed = await post(`/storefront/carts/${allowedCart.body.cart.id}/items`, { variantId:"variant-a",quantity:1 }, allowedCart.body.cartCapability);
  assert.equal(allowed.response.status, 201);
  const checkout = await post(`/storefront/carts/${allowedCart.body.cart.id}/checkout`, { fullName:"خریدار نمونه",phone:"09120000009",shippingAddress:{address:"تهران"} }, allowedCart.body.cartCapability);
  assert.equal(checkout.response.status, 201);

  db.prepare("UPDATE ecommerce_variants SET inventory_policy='DENY' WHERE id='variant-a'").run();
  db.prepare("INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,active,created_at,updated_at) VALUES('variant-mixed','workspace-a','product-a','SKU-MIXED','Backorder',10000,0,'CONTINUE','{}',1,?,?)").run(now,now);
  products = await json("/storefront/store-published/products");
  assert.deepEqual(products.body.products[0].variants.map((variant)=>variant.purchasable),[false,true]);

  db.prepare("UPDATE ecommerce_variants SET active=0 WHERE product_id='product-a'").run();
  products = await json("/storefront/store-published/products");
  assert.equal(products.body.products[0].variants.length, 0);
  db.prepare("DELETE FROM ecommerce_variants WHERE id='variant-mixed'").run();
  db.prepare("UPDATE ecommerce_variants SET active=1,inventory_quantity=10,inventory_policy='DENY' WHERE id='variant-a'").run();
});

test("published cart capability is opaque, mandatory, store-bound and persisted only as a hash", async () => {
  const created = await post("/storefront/store-published/carts", { currency: "IRT" });
  assert.equal(created.response.status, 201);
  assert.match(created.body.cartCapability, /^[A-Za-z0-9_-]{40,}$/);
  const cartId = created.body.cart.id;
  const capability = created.body.cartCapability;
  const stored = db.prepare("SELECT public_capability_hash FROM ecommerce_carts WHERE id=?").get(cartId).public_capability_hash;
  assert.notEqual(stored, capability);
  assert.match(stored, /^[a-f0-9]{64}$/);

  for (const supplied of [null, "wrong-capability"]) {
    const result = await json(`/storefront/carts/${cartId}`, { headers: supplied ? { "x-loadder-cart-capability": supplied } : {} });
    assert.equal(result.response.status, 404);
    assert.equal(result.body.code, "CART_NOT_FOUND");
  }
  const second = await post("/storefront/store-published/carts", { currency: "IRT" });
  const crossCapability = await json(`/storefront/carts/${cartId}`, { headers: { "x-loadder-cart-capability": second.body.cartCapability } });
  assert.equal(crossCapability.response.status, 404);

  const foreignVariant = await post(`/storefront/carts/${cartId}/items`, { variantId: "variant-b", quantity: 1 }, capability);
  assert.equal(foreignVariant.response.status, 404);
  const added = await post(`/storefront/carts/${cartId}/items`, { variantId: "variant-a", quantity: 1 }, capability);
  assert.equal(added.response.status, 201);
  assert.equal(added.body.cart.items.length, 1);
});

test("checkout issues an order-scoped receipt capability and order IDs alone disclose nothing", async () => {
  const created = await post("/storefront/store-published/carts", { currency: "IRT" });
  await post(`/storefront/carts/${created.body.cart.id}/items`, { variantId: "variant-a", quantity: 1 }, created.body.cartCapability);
  const checkout = await post(`/storefront/carts/${created.body.cart.id}/checkout`, { fullName: "مشتری نمونه", phone: "09120000000", shippingAddress: { address: "تهران" } }, created.body.cartCapability);
  assert.equal(checkout.response.status, 201);
  assert.equal(checkout.body.order.paymentStatus, "UNPAID");
  assert.equal(db.prepare("SELECT payment_provider FROM ecommerce_orders WHERE id=?").get(checkout.body.order.id).payment_provider, "manual");
  const orderId = checkout.body.order.id;
  const receipt = checkout.body.receiptCapability;
  const stored = db.prepare("SELECT receipt_capability_hash FROM ecommerce_orders WHERE id=?").get(orderId).receipt_capability_hash;
  assert.notEqual(stored, receipt);
  for (const supplied of [null, "wrong-receipt"]) {
    const result = await json(`/storefront/orders/${orderId}`, { headers: supplied ? { "x-loadder-order-capability": supplied } : {} });
    assert.equal(result.response.status, 404);
    assert.equal(result.body.code, "PUBLIC_RESOURCE_NOT_FOUND");
  }
  const anotherCart = await post("/storefront/store-published/carts", { currency: "IRT" });
  await post(`/storefront/carts/${anotherCart.body.cart.id}/items`, { variantId: "variant-a", quantity: 1 }, anotherCart.body.cartCapability);
  const anotherCheckout = await post(`/storefront/carts/${anotherCart.body.cart.id}/checkout`, { fullName: "مشتری دوم", phone: "09120000001" }, anotherCart.body.cartCapability);
  const crossReceipt = await json(`/storefront/orders/${orderId}`, { headers: { "x-loadder-order-capability": anotherCheckout.body.receiptCapability } });
  assert.equal(crossReceipt.response.status, 404);
  assert.deepEqual(crossReceipt.body, { success: false, code: "PUBLIC_RESOURCE_NOT_FOUND", message: "Resource not found." });
  const authorized = await json(`/storefront/orders/${orderId}`, { headers: { "x-loadder-order-capability": receipt } });
  assert.equal(authorized.response.status, 200);
  assert.equal(authorized.body.order.id, orderId);
});

test("publication withdrawal invalidates existing public cart and order capabilities", async () => {
  const cart = await post("/storefront/store-published/carts", { currency: "IRT" });
  db.prepare("UPDATE site_projects SET status='DRAFT' WHERE id='store-published'").run();
  const result = await json(`/storefront/carts/${cart.body.cart.id}`, { headers: { "x-loadder-cart-capability": cart.body.cartCapability } });
  assert.equal(result.response.status, 404);
  db.prepare("UPDATE site_projects SET status='PUBLISHED' WHERE id='store-published'").run();
});

test("publish rollback creates a new canonical version from the selected historical snapshot", () => {
  runWithWorkspace("workspace-a", () => {
    const repository = createSiteProjectRepository(db);
    const first = repository.getLatestPublishVersion("store-published");
    repository.update("store-published", { content: { storeBuilderV16: { version: 16, marker: "newer" } }, now: "2026-09-16T10:01:00.000Z" });
    repository.publish("store-published", "2026-09-16T10:02:00.000Z");
    const rollback = repository.rollbackPublishVersion("store-published", first.id, "2026-09-16T10:03:00.000Z");
    assert.equal(rollback.project.status, "PUBLISHED");
    assert.deepEqual(rollback.version.content, first.content);
    assert.equal(rollback.version.manifest.rollbackOfVersionId, first.id);
    assert.equal(rollback.version.version, 3);
  });
});

test("domain attach is idempotent for one owner and cannot rebind across workspaces", () => {
  const service = createSiteDomainService(db);
  const first = service.attach({ workspaceId: "workspace-a", siteProjectId: "store-published", domain: "shop.example.test", now });
  const replay = service.attach({ workspaceId: "workspace-a", siteProjectId: "store-published", domain: "shop.example.test", now });
  assert.equal(replay.id, first.id);
  assert.throws(() => service.attach({ workspaceId: "workspace-b", siteProjectId: "store-foreign", domain: "shop.example.test", now }), (error) => error.code === "SITE_DOMAIN_CONFLICT" && error.status === 409);
  const row = db.prepare("SELECT workspace_id,site_project_id FROM site_domains WHERE domain=?").get("shop.example.test");
  assert.deepEqual(row, { workspace_id: "workspace-a", site_project_id: "store-published" });
});

test("migration remains backward-compatible for internal legacy carts and orders", () => {
  const cartColumns = new Set(db.prepare("PRAGMA table_info(ecommerce_carts)").all().map((row) => row.name));
  const orderColumns = new Set(db.prepare("PRAGMA table_info(ecommerce_orders)").all().map((row) => row.name));
  assert.ok(cartColumns.has("public_capability_hash"));
  assert.ok(orderColumns.has("receipt_capability_hash"));
  assert.equal(db.prepare("SELECT MAX(version) AS value FROM schema_migrations").get().value, 91);
});

test("upgrade migration preserves pre-086 cart and order rows with nullable capabilities", () => {
  const upgrade = new Database(":memory:");
  upgrade.pragma("foreign_keys=ON");
  runMigrations(upgrade, migrations.filter((migration) => [1, 42, 43, 49].includes(migration.version)));
  upgrade.exec("CREATE TABLE business_context_versions(id TEXT PRIMARY KEY); CREATE TABLE customers(id TEXT PRIMARY KEY);");
  upgrade.prepare("INSERT INTO workspaces(id,name,slug,status,created_at,updated_at) VALUES('legacy-w','Legacy','legacy-w','active',?,?)").run(now, now);
  upgrade.prepare("INSERT INTO site_projects(id,workspace_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES('legacy-store','legacy-w','Legacy','STORE','legacy-store','DRAFT','{}',?,?)").run(now, now);
  upgrade.prepare("INSERT INTO ecommerce_carts(id,workspace_id,site_project_id,currency,status,created_at,updated_at) VALUES('legacy-cart','legacy-w','legacy-store','IRT','ACTIVE',?,?)").run(now, now);
  upgrade.prepare("INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,cart_id,currency,status,payment_status,fulfillment_status,shipping_address_json,created_at,updated_at) VALUES('legacy-order','legacy-w','legacy-store','legacy-cart','IRT','PENDING','UNPAID','UNFULFILLED','{}',?,?)").run(now, now);
  runMigrations(upgrade, [migration086CommercePublicCapabilities]);
  assert.deepEqual(upgrade.prepare("SELECT id,public_capability_hash FROM ecommerce_carts WHERE id='legacy-cart'").get(), { id: "legacy-cart", public_capability_hash: null });
  assert.deepEqual(upgrade.prepare("SELECT id,receipt_capability_hash FROM ecommerce_orders WHERE id='legacy-order'").get(), { id: "legacy-order", receipt_capability_hash: null });
  assert.equal(upgrade.pragma("integrity_check", { simple: true }), "ok");
  assert.deepEqual(upgrade.pragma("foreign_key_check"), []);
  upgrade.close();
});
