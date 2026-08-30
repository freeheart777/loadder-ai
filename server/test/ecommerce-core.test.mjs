import assert from "node:assert/strict";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createEcommerceService } from "../app/services/ecommerce-service.mjs";
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
