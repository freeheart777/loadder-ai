import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createEcommerceService } from "../app/services/ecommerce-service.mjs";
import { createEcommerceRouter } from "../app/routes/ecommerce.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

function fixture() {
  const db = createSiteTestDb();
  const projectService = createSiteProjectService({
    repository: createSiteProjectRepository(db),
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  const store = runWithWorkspace("ws-1", () => projectService.create({ name:"Commerce Store", siteType:"STORE", content:{} }));
  const other = runWithWorkspace("ws-2", () => projectService.create({ name:"Other Store", siteType:"STORE", content:{} }));
  return { db, store, other, service:createEcommerceService({ db }) };
}

test("commerce core creates product, cart, discount, shipping and checkout while decrementing inventory", () => {
  const { db, store, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const product = service.createProduct(store.id, {
      name:"Premium Chair", currency:"USD", basePriceMinor:10000, sku:"CHAIR-BLACK", inventoryQuantity:5,
      options:{color:"black"}, status:"ACTIVE",
    });
    assert.equal(product.variants.length, 1);
    assert.equal(product.variants[0].inventoryQuantity, 5);

    service.createCoupon(store.id, { code:"SAVE10", discountType:"PERCENT", discountValue:10 });
    const shipping = service.createShippingMethod(store.id, { name:"Standard", currency:"USD", priceMinor:500 });
    let cart = service.createCart(store.id, { currency:"USD", email:"buyer@example.test" });
    cart = service.addCartItem(cart.id, { variantId:product.variants[0].id, quantity:2 });
    assert.equal(cart.subtotalMinor, 20000);
    cart = service.applyCoupon(cart.id, "save10");
    assert.equal(cart.discountMinor, 2000);
    cart = service.setCartShipping(cart.id, shipping.id);
    assert.equal(cart.totalMinor, 18500);

    const order = service.checkout(cart.id, { paymentProvider:"TEST", shippingAddress:{country:"US"} });
    assert.equal(order.totalMinor, 18500);
    assert.equal(order.items[0].quantity, 2);
    assert.equal(service.getCart(cart.id).status, "CONVERTED");
    assert.equal(service.getProduct(product.id).variants[0].inventoryQuantity, 3);
  });
  db.close();
});

test("commerce core enforces workspace and store boundaries", () => {
  const { db, store, other, service } = fixture();
  const product = runWithWorkspace("ws-1", () => service.createProduct(store.id, { name:"Desk", basePriceMinor:5000, sku:"DESK-1", inventoryQuantity:1 }));
  runWithWorkspace("ws-2", () => {
    assert.throws(() => service.getProduct(product.id), (error) => error.code === "PRODUCT_NOT_FOUND" && error.status === 404);
    const cart = service.createCart(other.id, { currency:"USD" });
    assert.throws(() => service.addCartItem(cart.id, { variantId:product.variants[0].id, quantity:1 }), (error) => error.code === "VARIANT_NOT_FOUND");
  });
  db.close();
});

test("commerce rejects non-store site projects and overselling", () => {
  const db=createSiteTestDb();
  const projectService=createSiteProjectService({repository:createSiteProjectRepository(db),businessContextService:{getCurrent:()=>({activeContext:{id:"ctx-1"},isStale:false})}});
  const business=runWithWorkspace("ws-1",()=>projectService.create({name:"Business",siteType:"BUSINESS",content:{}}));
  const store=runWithWorkspace("ws-1",()=>projectService.create({name:"Store",siteType:"STORE",content:{}}));
  const service=createEcommerceService({db});
  runWithWorkspace("ws-1",()=>{
    assert.throws(()=>service.createProduct(business.id,{name:"x",sku:"x",basePriceMinor:1}),(error)=>error.code==="NOT_STORE_PROJECT");
    const p=service.createProduct(store.id,{name:"Limited",sku:"LIMIT-1",basePriceMinor:100,inventoryQuantity:1});
    const cart=service.createCart(store.id,{currency:"USD"});
    assert.throws(()=>service.addCartItem(cart.id,{variantId:p.variants[0].id,quantity:2}),(error)=>error.code==="INSUFFICIENT_INVENTORY");
  });
  db.close();
});

test("commerce product media preserves ordered gallery and variant-specific image", () => {
  const { db, store, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const product = service.createProduct(store.id, { name:"Media Product", basePriceMinor:1000, sku:"MEDIA-1", inventoryQuantity:1 });
    const first = "https://cdn.example.test/products/front.webp";
    const second = "https://cdn.example.test/products/side.webp";
    const updated = service.updateProduct(product.id, { metadata:{ gallery:[first,second,first], mediaVersion:1 } });
    assert.deepEqual(updated.metadata.gallery, [first,second]);
    assert.equal(updated.metadata.mediaVersion, 1);
    const variant = service.updateVariant(product.variants[0].id, { imageUrl:second });
    assert.equal(variant.imageUrl, second);
    assert.equal(service.getProduct(product.id).variants[0].imageUrl, second);
    assert.throws(() => service.updateProduct(product.id, { metadata:{ gallery:["javascript:alert(1)"] } }), (error) => error.code === "PRODUCT_IMAGE_URL_INVALID");
    assert.throws(() => service.updateVariant(product.variants[0].id, { imageUrl:"http://unsafe.example/image.jpg" }), (error) => error.code === "PRODUCT_IMAGE_URL_INVALID");
    assert.equal(service.updateVariant(product.variants[0].id, { imageUrl:null }).imageUrl, null);
  });
  db.close();
});

test("product creation persists the complete storefront payload with URL or no image", () => {
  const { db, store, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const imageUrl = "https://cdn.example.test/products/serum.webp";
    const created = service.createProduct(store.id, {
      name:"Persian Serum", basePriceMinor:450000, compareAtPriceMinor:520000, inventoryQuantity:12,
      category:"Skin care", brand:"Loadder", description:"Hydrating serum", imageUrl, status:"ACTIVE",
      metadata:{ geoDescription:"For dry skin", contentMode:"HYBRID" },
    });
    assert.equal(created.siteProjectId, store.id);
    assert.equal(created.name, "Persian Serum");
    assert.equal(created.basePriceMinor, 450000);
    assert.equal(created.compareAtPriceMinor, 520000);
    assert.equal(created.category, "Skin care");
    assert.equal(created.description, "Hydrating serum");
    assert.equal(created.variants[0].inventoryQuantity, 12);
    assert.equal(created.variants[0].imageUrl, imageUrl);

    const withoutImage = service.createProduct(store.id, { name:"Image optional", basePriceMinor:1000, inventoryQuantity:0, status:"ACTIVE" });
    assert.equal(withoutImage.variants[0].imageUrl, null);
    const localMediaUrl = "http://localhost:3001/api/site-media-object/test-product-image";
    const localImage = service.createProduct(store.id, { name:"Local uploaded image", basePriceMinor:2000, inventoryQuantity:1, imageUrl:localMediaUrl, status:"ACTIVE" });
    assert.equal(localImage.variants[0].imageUrl, localMediaUrl);
    const withGallery = service.updateProduct(localImage.id, { metadata:{ gallery:[localMediaUrl] } });
    assert.deepEqual(withGallery.metadata.gallery, [localMediaUrl]);
    const variant = service.addVariant(localImage.id, { title:"Blue", sku:"LOCAL-BLUE", inventoryQuantity:1, imageUrl:localMediaUrl });
    assert.equal(variant.imageUrl, localMediaUrl);
    const afterRefresh = service.listProducts(store.id);
    assert.ok(afterRefresh.some((product) => product.id === created.id && product.variants[0].imageUrl === imageUrl));
    assert.ok(afterRefresh.some((product) => product.id === withoutImage.id && product.variants[0].imageUrl === null));
  });
  db.close();
});

test("product creation preserves Persian names and generates unique slugs without English input", () => {
  const { db, store, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const names = ["سرم آبرسان پوست", "کفش ورزشی مردانه", "گوشی هوشمند"];
    const created = names.map((name) => service.createProduct(store.id, {
      name,
      basePriceMinor: 45000000,
      inventoryQuantity: 2,
      status: "ACTIVE",
    }));
    const duplicate = service.createProduct(store.id, {
      name: names[0],
      basePriceMinor: 45000000,
      inventoryQuantity: 1,
      status: "ACTIVE",
    });

    assert.deepEqual(created.map((product) => product.name), names);
    assert.ok(created.every((product) => product.slug && product.slug.length <= 100));
    assert.notEqual(duplicate.slug, created[0].slug);
    assert.match(duplicate.slug, /-2$/);

    const afterRefresh = service.listProducts(store.id);
    for (const product of created) {
      const persisted = afterRefresh.find((item) => item.id === product.id);
      assert.equal(persisted?.name, product.name);
      assert.equal(persisted?.slug, product.slug);
    }
    assert.equal(afterRefresh.find((item) => item.id === duplicate.id)?.name, names[0]);
  });
  db.close();
});

test("product creation rejects unsafe image URLs and rolls back an incomplete duplicate-SKU write", () => {
  const { db, store } = fixture();
  const service = createEcommerceService({ db, env:{ NODE_ENV:"production" } });
  runWithWorkspace("ws-1", () => {
    assert.throws(
      () => service.createProduct(store.id, { name:"Unsafe image", basePriceMinor:100, imageUrl:"http://unsafe.example/image.jpg" }),
      (error) => error.code === "PRODUCT_IMAGE_URL_INVALID",
    );
    assert.throws(
      () => service.createProduct(store.id, { name:"Local image in production", basePriceMinor:100, imageUrl:"http://localhost:3001/api/site-media-object/test" }),
      (error) => error.code === "PRODUCT_IMAGE_URL_INVALID",
    );
    assert.equal(service.listProducts(store.id).length, 0);

    service.createProduct(store.id, { name:"First", basePriceMinor:100, sku:"UNIQUE-SKU" });
    const before = service.listProducts(store.id).length;
    assert.throws(() => service.createProduct(store.id, { name:"Must roll back", basePriceMinor:100, sku:"UNIQUE-SKU" }), /UNIQUE constraint failed/);
    assert.equal(service.listProducts(store.id).length, before, "variant failure must not leave an orphan product row");
  });
  db.close();
});

test("product create HTTP endpoint returns explicit success and validation errors", async (t) => {
  const { db, store, service } = fixture();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => runWithWorkspace("ws-1", next));
  app.use("/api", createEcommerceRouter({ service }));
  const { server, port } = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve({ server:listener, port:listener.address().port }));
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${port}/api/stores/${store.id}/products`;

  let response = await fetch(base, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ name:"", basePriceMinor:100 }) });
  let body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, "PRODUCT_NAME_REQUIRED");

  response = await fetch(base, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ name:"Unsafe URL", basePriceMinor:100, imageUrl:"javascript:alert(1)" }) });
  body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, "PRODUCT_IMAGE_URL_INVALID");

  response = await fetch(base, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ name:"HTTP Product", basePriceMinor:250000, inventoryQuantity:3, imageUrl:"https://cdn.example.test/http.webp", status:"ACTIVE" }) });
  body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.product.variants[0].imageUrl, "https://cdn.example.test/http.webp");

  response = await fetch(base);
  body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(body.products.some((product) => product.id === body.products[0].id && product.name === "HTTP Product"));
});

test("product create HTTP endpoint fails visibly and safely on an unexpected server error", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api", createEcommerceRouter({ service:{ createProduct() { throw new Error("simulated database detail"); } } }));
  const previousConsoleError = console.error;
  console.error = () => {};
  const { server, port } = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve({ server:listener, port:listener.address().port }));
  });
  t.after(async () => {
    console.error = previousConsoleError;
    await new Promise((resolve) => server.close(resolve));
  });

  const response = await fetch(`http://127.0.0.1:${port}/api/stores/store-test/products`, {
    method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ name:"Will fail", basePriceMinor:100 }),
  });
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.success, false);
  assert.equal(body.code, "ECOMMERCE_INTERNAL_ERROR");
  assert.equal(body.message, "Unable to process ecommerce operation.");
  assert.doesNotMatch(JSON.stringify(body), /simulated database detail/);
});
