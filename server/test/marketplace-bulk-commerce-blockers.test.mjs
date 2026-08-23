import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migration059CommerceCatalogFoundation } from "../db/migrations/059_commerce_catalog_foundation.mjs";
import { migration060CartCheckoutFoundation } from "../db/migrations/060_cart_checkout_foundation.mjs";
import { migration061PaymentOrderLifecycle } from "../db/migrations/061_payment_order_lifecycle.mjs";
import { migration062InventoryFulfillmentFoundation } from "../db/migrations/062_inventory_fulfillment_foundation.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createCommerceCatalogRepository } from "../app/repositories/commerce-catalog-repository.mjs";
import { createMarketplaceCommerceRepository } from "../app/repositories/marketplace-commerce-repository.mjs";
import { createInventoryFulfillmentRepository } from "../app/repositories/inventory-fulfillment-repository.mjs";
import { createCommerceCatalogService } from "../app/services/commerce-catalog-service.mjs";
import { createCommerceBulkService } from "../app/services/commerce-bulk-service.mjs";
import { createInventoryFulfillmentService } from "../app/services/inventory-fulfillment-service.mjs";
import { createMarketplaceCommerceService } from "../app/services/marketplace-commerce-service.mjs";
import { createMarketplacePublicRouter } from "../app/routes/marketplace-commerce.mjs";
import { createTestShippingProvider } from "../app/shipping/shipping-providers.mjs";
import { marketplaceProviderRegistry } from "../app/marketplaces/marketplace-provider-registry.mjs";
import { storeArchetypeRegistry } from "../app/commerce/store-archetype-registry.mjs";

const actor = (workspaceId) => ({ userId: "user", role: "owner", workspaceId });
const within = (workspaceId, operation) => runWithWorkspace(workspaceId, operation);

function fixture({ productUrl = () => null, assetUrl = () => null } = {}) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE workspaces(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,role TEXT,status TEXT);CREATE TABLE content_assets(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,media_type TEXT);CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at TEXT);INSERT INTO users VALUES('user','active');INSERT INTO workspaces VALUES('w','active'),('x','active');INSERT INTO workspace_memberships VALUES('mw','w','user','owner','active'),('mx','x','user','owner','active');INSERT INTO content_assets VALUES('image','w','READY','IMAGE');");
  runMigrations(db, [migration059CommerceCatalogFoundation, migration060CartCheckoutFoundation, migration061PaymentOrderLifecycle, migration062InventoryFulfillmentFoundation]);
  const catalogRepository = createCommerceCatalogRepository(db);
  const repository = createMarketplaceCommerceRepository(db);
  const catalogService = createCommerceCatalogService({
    repository: catalogRepository,
    assetRepository: { findById: (id) => id === "image" ? { id, status: "READY", mediaType: "IMAGE" } : null },
    archetypeRegistry: storeArchetypeRegistry,
    now: () => new Date("2026-08-23T20:00:00.000Z"),
  });
  const inventoryRepository = createInventoryFulfillmentRepository(db);
  const inventoryService = createInventoryFulfillmentService({ repository: inventoryRepository, provider: createTestShippingProvider(), now: () => new Date("2026-08-23T20:00:00.000Z") });
  const bulk = createCommerceBulkService({ repository, catalogService, inventoryService, now: () => new Date("2026-08-23T20:00:00.000Z") });
  const marketplace = createMarketplaceCommerceService({ repository, registry: marketplaceProviderRegistry, publicUrlResolver: productUrl, assetUrlResolver: assetUrl });
  return { db, repository, catalogService, inventoryService, bulk, marketplace };
}

function seed(fixtureValue, workspaceId = "w", suffix = "") {
  const currentActor = actor(workspaceId);
  return within(workspaceId, () => {
    const catalog = fixtureValue.catalogService.createCatalog({ name: `فروشگاه${suffix}`, slug: `shop${suffix}`, archetype: "GENERAL_COMMERCE", currency: "IRR" }, currentActor, `catalog${suffix}`).catalog;
    const category = fixtureValue.catalogService.createCategory(catalog.id, { parentCategoryId: null, name: `کالا${suffix}`, slug: `goods${suffix}`, displayOrder: 0 }, currentActor, `category${suffix}`).category;
    const collection = fixtureValue.catalogService.createCollection(catalog.id, { name: `مجموعه${suffix}`, slug: `collection${suffix}`, description: null, coverAssetId: null }, currentActor, `collection${suffix}`).collection;
    const product = fixtureValue.catalogService.createProduct(catalog.id, { primaryCategoryId: category.id, brandId: null, name: `محصول${suffix}`, slug: `product${suffix}`, shortDescription: "توضیح", description: "توضیح کامل", basePrice: 1000, compareAtPrice: null, availabilityStatus: "IN_STOCK", primaryAssetId: workspaceId === "w" ? "image" : null, seoTitle: null, seoDescription: null, warrantySummary: null, returnsSummary: null, shippingSummary: null }, currentActor, `product${suffix}`).product;
    fixtureValue.catalogService.updateProduct(product.id, { revision: product.revision, name: product.name, shortDescription: product.shortDescription, description: product.description, status: "ACTIVE", basePrice: product.basePrice, compareAtPrice: product.compareAtPrice, availabilityStatus: product.availabilityStatus, seoTitle: product.seoTitle, seoDescription: product.seoDescription, warrantySummary: product.warrantySummary, returnsSummary: product.returnsSummary, shippingSummary: product.shippingSummary }, currentActor);
    return { catalog, category, collection, product };
  });
}

const importInput = (csv) => ({ csv, mapping: { name: "name", slug: "slug", basePrice: "price", sku: "sku", stock: "stock", inventoryTrackingMode: "inventory_tracking_mode" } });

test("Sales Channel and Bulk Commerce checkpoint blocker corrections", async (t) => {
  await t.test("CSV byte row column and cell limits fail early with stable codes", () => {
    const f = fixture(), { catalog } = seed(f);
    const cases = [
      ["name,slug,price\n" + "x".repeat(1048577), "COMMERCE_IMPORT_TOO_LARGE"],
      ["name,slug,price\n" + Array.from({ length: 1001 }, (_, i) => `n${i},s${i},1`).join("\n"), "COMMERCE_IMPORT_TOO_MANY_ROWS"],
      [Array.from({ length: 41 }, (_, i) => `h${i}`).join(",") + "\n" + Array.from({ length: 41 }, () => "x").join(","), "COMMERCE_IMPORT_TOO_MANY_COLUMNS"],
      ["name,slug,price\n" + "x".repeat(4001) + ",long,1", "COMMERCE_IMPORT_CELL_TOO_LARGE"],
    ];
    for (const [csv, code] of cases) assert.throws(() => within("w", () => f.bulk.preview(catalog.id, { csv, mapping: { name: "name", slug: "slug", basePrice: "price" } }, actor("w"))), (error) => error.code === code);
    assert.equal(f.db.prepare("SELECT COUNT(*) count FROM commerce_products WHERE catalog_id=?").get(catalog.id).count, 1);
  });

  await t.test("foreign catalog category product collection variant and attribute IDs fail closed", () => {
    const f = fixture(), own = seed(f), foreign = seed(f, "x", "x");
    assert.throws(() => within("w", () => f.bulk.preview(foreign.catalog.id, { csv: "name,slug,price\na,b,1", mapping: { name: "name", slug: "slug", basePrice: "price" } }, actor("w"))), (error) => error.code === "CATALOG_NOT_FOUND" && error.status === 404);
    for (const [operation, value] of [["DEACTIVATE", null], ["ASSIGN_CATEGORY", foreign.category.id], ["ASSIGN_COLLECTION", foreign.collection.id]]) {
      const productIds = operation === "DEACTIVATE" ? [foreign.product.id] : [own.product.id];
      assert.throws(() => within("w", () => f.bulk.bulkEdit(own.catalog.id, { productIds, operation, value }, actor("w"))), (error) => error.code === "COMMERCE_BULK_TARGET_NOT_FOUND" && error.status === 404);
    }
    for (const forbidden of ["variantId", "attributeDefinitionId"]) assert.throws(() => within("w", () => f.bulk.preview(own.catalog.id, { csv: "name,slug,price,id\na,b,1,foreign", mapping: { name: "name", slug: "slug", basePrice: "price", [forbidden]: "id" } }, actor("w"))), (error) => error.code === "COMMERCE_IMPORT_MAPPING_INVALID");
    const categoryInput = { csv: `name,slug,price,category\nمحصول جدید,new-product,1,${foreign.category.name}`, mapping: { name: "name", slug: "slug", basePrice: "price", category: "category" } };
    const categoryPreview = within("w", () => f.bulk.preview(own.catalog.id, categoryInput, actor("w")));
    const categoryApply = within("w", () => f.bulk.apply(own.catalog.id, { ...categoryInput, previewHash: categoryPreview.previewHash }, actor("w"), "foreign-category"));
    assert.equal(categoryApply.failed, 1);
    assert.deepEqual(categoryApply.failures[0].issues, ["COMMERCE_IMPORT_REFERENCE_NOT_FOUND"]);
    assert.ok(within("w", () => f.repository.findProductBySlug(own.catalog.id, "new-product")) == null);
    assert.equal(within("w", () => f.repository.findProductBySlug(own.catalog.id, own.product.slug)).status, "ACTIVE");
  });

  await t.test("public marketplace limiter is deterministic and isolated per provider", async () => {
    const app = express();
    app.use(createMarketplacePublicRouter({ marketplaceService: { publicFeed(provider) { return { provider }; } }, maxRequests: 2 }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}/api/public/commerce/marketplaces`;
      assert.equal((await fetch(`${base}/TOROB/catalogs/shop/products`)).status, 200);
      assert.equal((await fetch(`${base}/TOROB/catalogs/shop/products`)).status, 200);
      const limited = await fetch(`${base}/TOROB/catalogs/shop/products`);
      assert.equal(limited.status, 429);
      assert.deepEqual(await limited.json(), { success: false, code: "MARKETPLACE_RATE_LIMITED", message: "Marketplace request limit exceeded." });
      assert.equal((await fetch(`${base}/EMALLS/catalogs/shop/products`)).status, 200);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });

  await t.test("unsafe public and media URL schemes hosts and credentials fail closed", () => {
    const unsafe = ["javascript:alert(1)", "data:text/plain,x", "http://localhost/file", "https://user:secret@example.com/file"];
    for (const value of unsafe) {
      const f = fixture({ productUrl: () => value, assetUrl: () => value }), { catalog } = seed(f);
      const projection = within("w", () => f.marketplace.products(catalog.id, "TOROB", { limit: 10 }, actor("w"))).products[0].projection;
      assert.equal(projection.publicProductUrl, null);
      assert.equal(projection.primaryImage, null);
    }
  });

  await t.test("TRACKED product and variant stock import through inventory domain", () => {
    const f = fixture(), { catalog, product } = seed(f);
    let input = importInput(`name,slug,price,sku,stock,inventory_tracking_mode\n${product.name},${product.slug},1000,,12,TRACKED`);
    let preview = within("w", () => f.bulk.preview(catalog.id, input, actor("w")));
    assert.equal(preview.rows[0].data.inventoryEffect, "CREATE_TRACKED_INVENTORY");
    assert.equal(within("w", () => f.bulk.apply(catalog.id, { ...input, previewHash: preview.previewHash }, actor("w"), "product-stock")).updated, 1);
    assert.deepEqual(f.db.prepare("SELECT tracking_mode mode,stock_on_hand stock FROM commerce_inventory_items WHERE product_id=? AND variant_id IS NULL").get(product.id), { mode: "TRACKED", stock: 12 });
    input = importInput(`name,slug,price,sku,stock,inventory_tracking_mode\n${product.name},${product.slug},1000,SKU-NEW,7,TRACKED`);
    preview = within("w", () => f.bulk.preview(catalog.id, input, actor("w")));
    assert.equal(within("w", () => f.bulk.apply(catalog.id, { ...input, previewHash: preview.previewHash }, actor("w"), "variant-stock")).updated, 1);
    assert.deepEqual(f.db.prepare("SELECT tracking_mode mode,stock_on_hand stock FROM commerce_inventory_items WHERE product_id=? AND variant_id IS NOT NULL").get(product.id), { mode: "TRACKED", stock: 7 });
  });

  await t.test("negative fractional invalid mode and UNTRACKED stock combinations are rejected", () => {
    const f = fixture(), { catalog } = seed(f);
    for (const [stock, mode, issue] of [["-1", "TRACKED", "INVALID_STOCK"], ["1.5", "TRACKED", "INVALID_STOCK"], ["1", "BROKEN", "INVALID_TRACKING_MODE"], ["1", "UNTRACKED", "INVENTORY_MODE_CONFLICT"]]) {
      const row = within("w", () => f.bulk.preview(catalog.id, importInput(`name,slug,price,sku,stock,inventory_tracking_mode\nNew,new-${stock.replace(/\W/g, "x")}-${mode.toLowerCase()},1,,${stock},${mode}`), actor("w"))).rows[0];
      assert.equal(row.action, "INVALID"); assert.ok(row.issues.includes(issue));
    }
  });

  await t.test("UNTRACKED import has no operational stock and repeated import is idempotent", () => {
    const f = fixture(), { catalog } = seed(f), input = importInput("name,slug,price,sku,stock,inventory_tracking_mode\nنامحدود,unlimited,5,,,UNTRACKED");
    let preview = within("w", () => f.bulk.preview(catalog.id, input, actor("w")));
    assert.equal(within("w", () => f.bulk.apply(catalog.id, { ...input, previewHash: preview.previewHash }, actor("w"), "untracked-1")).created, 1);
    preview = within("w", () => f.bulk.preview(catalog.id, input, actor("w")));
    assert.equal(preview.rows[0].data.inventoryEffect, "KEEP_UNTRACKED");
    assert.equal(within("w", () => f.bulk.apply(catalog.id, { ...input, previewHash: preview.previewHash }, actor("w"), "untracked-2")).skipped, 1);
    assert.deepEqual(f.db.prepare("SELECT COUNT(*) count FROM commerce_inventory_items").get(), { count: 0 });
  });

  await t.test("reserved stock cannot be reduced and failed apply leaves inventory unchanged", () => {
    const f = fixture(), { catalog, product } = seed(f);
    f.inventoryService.setInventory(product.id, { variantId: null, trackingMode: "TRACKED", stockOnHand: 10, lowStockThreshold: null, revision: 0 }, actor("w"));
    f.db.prepare("UPDATE commerce_inventory_items SET stock_reserved=4 WHERE product_id=?").run(product.id);
    const input = importInput(`name,slug,price,sku,stock,inventory_tracking_mode\n${product.name},${product.slug},1000,,3,TRACKED`), preview = within("w", () => f.bulk.preview(catalog.id, input, actor("w")));
    assert.ok(preview.rows[0].issues.includes("INVENTORY_RESERVED_CONFLICT"));
    const applied = within("w", () => f.bulk.apply(catalog.id, { ...input, previewHash: preview.previewHash }, actor("w"), "reserved"));
    assert.equal(applied.failed, 1);
    assert.deepEqual(f.db.prepare("SELECT stock_on_hand stock,stock_reserved reserved FROM commerce_inventory_items WHERE product_id=?").get(product.id), { stock: 10, reserved: 4 });
  });
});
