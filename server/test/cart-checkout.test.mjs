import assert from"node:assert/strict";
import test from"node:test";
import Database from"better-sqlite3";
import{runMigrations}from"../db/migrate.mjs";
import{migration059CommerceCatalogFoundation}from"../db/migrations/059_commerce_catalog_foundation.mjs";
import{migration060CartCheckoutFoundation}from"../db/migrations/060_cart_checkout_foundation.mjs";
import{createCartCheckoutRepository}from"../app/repositories/cart-checkout-repository.mjs";
import{createCartCheckoutService}from"../app/services/cart-checkout-service.mjs";
import{commerceShippingRegistry}from"../app/commerce/commerce-shipping-registry.mjs";

function fixture(){const db=new Database(":memory:");
db.pragma("foreign_keys=ON");
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);
CREATE TABLE workspaces(id TEXT PRIMARY KEY,status TEXT);
CREATE TABLE workspace_memberships(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,role TEXT,status TEXT);
CREATE TABLE content_assets(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,media_type TEXT);
CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,applied_at TEXT);
INSERT INTO users VALUES('user','active');
INSERT INTO workspaces VALUES('w','active'),('x','active');
INSERT INTO workspace_memberships VALUES('m','w','user','owner','active');
`);
runMigrations(db,[migration059CommerceCatalogFoundation,migration060CartCheckoutFoundation]);
db.prepare("INSERT INTO workspace_memberships VALUES('m2','x','user','owner','active')").run();
db.exec(`INSERT INTO commerce_catalogs VALUES('cat','w','user','فروشگاه','store','GENERAL_COMMERCE',1,'IRR','ACTIVE',1,'k',lower(hex(randomblob(32))),'2026-01-01','2026-01-01');
INSERT INTO commerce_catalogs VALUES('foreign','x','user','Foreign','foreign','GENERAL_COMMERCE',1,'IRR','ACTIVE',1,'k2',lower(hex(randomblob(32))),'2026-01-01','2026-01-01');
INSERT INTO commerce_products(id,workspace_id,catalog_id,created_by_user_id,name,slug,short_description,description,status,base_price,currency,availability_status,revision,idempotency_key,request_hash,created_at,updated_at)VALUES('p','w','cat','user','کفش مدل X','shoe','کفش','کفش نمونه','ACTIVE',1200000,'IRR','IN_STOCK',1,'p',lower(hex(randomblob(32))),'2026-01-01','2026-01-01'),('out','w','cat','user','ناموجود','out','ناموجود','ناموجود','ACTIVE',10,'IRR','OUT_OF_STOCK',1,'o',lower(hex(randomblob(32))),'2026-01-01','2026-01-01'),('fp','x','foreign','user','Foreign','fp','foreign','foreign','ACTIVE',1,'IRR','IN_STOCK',1,'f',lower(hex(randomblob(32))),'2026-01-01','2026-01-01');
INSERT INTO commerce_product_variants(id,workspace_id,catalog_id,product_id,created_by_user_id,sku,title,price_override,availability_status,sort_order,status,revision,idempotency_key,request_hash,created_at,updated_at)VALUES('v','w','cat','p','user','SKU-X','سایز ۴۲',1300000,'IN_STOCK',1,'ACTIVE',1,'v',lower(hex(randomblob(32))),'2026-01-01','2026-01-01');
`);
let now=new Date("2026-08-23T12:00:00Z");
const repository=createCartCheckoutRepository(db),service=createCartCheckoutService({repository,shippingRegistry:commerceShippingRegistry,now:()=>now});
return{db,repository,service,advance(hours){now=new Date(now.getTime()+hours*3600000);
}};
}function cart(f){return f.service.createCart({catalogId:"cat",customerScopeKey:null});
}function add(f,c,productId="p",variantId=null,quantity=1){return f.service.addItem(c.cartToken,{revision:c.cart.revision,productId,variantId,quantity});
}function ready(f,c,mode="DIGITAL_OR_SERVICE"){const ch=f.service.createCheckout(c.cartToken,{fulfillmentMode:mode},"checkout").checkout;
return f.service.updateCheckout(c.cartToken,ch.id,{revision:ch.revision,fulfillmentMode:mode,shippingMethod:mode==="DIGITAL_OR_SERVICE"?"NONE":"STANDARD",contactName:"علی رضایی",contactMobile:"09121234567",contactEmail:null,recipientName:mode==="PHYSICAL_DELIVERY"?"علی رضایی":null,recipientMobile:mode==="PHYSICAL_DELIVERY"?"09121234567":null,province:mode==="PHYSICAL_DELIVERY"?"تهران":null,city:mode==="PHYSICAL_DELIVERY"?"تهران":null,postalAddress:mode==="PHYSICAL_DELIVERY"?"خیابان نمونه، پلاک ۱":null,postalCode:null}).checkout;
}
test("Cart Checkout Foundation v1",async t=>{
 await t.test("migration 060 adds exactly five tables and is idempotent",()=>{const f=fixture();
runMigrations(f.db,[migration060CartCheckoutFoundation]);
assert.equal(f.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name IN('commerce_carts','commerce_cart_items','commerce_checkout_sessions','commerce_pending_orders','commerce_pending_order_items')").get().n,5);
assert.deepEqual(f.db.prepare("SELECT COUNT(*) c,MAX(version) m FROM schema_migrations").get(),{c:2,m:60});
});

 await t.test("anonymous capability token stores only its hash",()=>{const f=fixture(),c=cart(f);
assert.ok(c.cartToken.length>=32);
assert.equal(f.db.prepare("SELECT token_hash FROM commerce_carts").get().token_hash.includes(c.cartToken),false);
assert.throws(()=>f.service.getCart(c.cartToken+"x"),e=>e.code==="CART_NOT_FOUND");
});

 await t.test("adds and merges current product with server price",()=>{const f=fixture(),c=cart(f),a=add(f,c),b=f.service.addItem(c.cartToken,{revision:a.cart.revision,productId:"p",variantId:null,quantity:2});
assert.equal(b.items.length,1);
assert.equal(b.items[0].quantity,3);
assert.equal(b.totals.subtotal,3600000);
});

 await t.test("variant price is authoritative",()=>{const f=fixture(),c=cart(f),r=add(f,c,"p","v",2);
assert.equal(r.totals.subtotal,2600000);
});

 await t.test("quantity bounds and client money injection fail",()=>{const f=fixture(),c=cart(f);
for(const quantity of [-1,0,100])assert.throws(()=>add(f,c,"p",null,quantity),e=>e.code==="CART_ITEM_INVALID");
assert.throws(()=>f.service.addItem(c.cartToken,{revision:1,productId:"p",variantId:null,quantity:1,unitPrice:1}),e=>e.code==="CART_ITEM_INVALID");
});

 await t.test("foreign and unavailable products fail",()=>{const f=fixture(),c=cart(f);
assert.throws(()=>add(f,c,"fp"),e=>e.code==="PRODUCT_NOT_PURCHASABLE");
assert.throws(()=>add(f,c,"out"),e=>e.code==="PRODUCT_NOT_PURCHASABLE");
});

 await t.test("stale cart revision conflicts",()=>{const f=fixture(),c=cart(f);
add(f,c);
assert.throws(()=>add(f,c),e=>e.code==="CART_REVISION_CONFLICT");
});

 await t.test("cart expires lazily",()=>{const f=fixture(),c=cart(f);
f.advance(24*31);
assert.throws(()=>f.service.getCart(c.cartToken),e=>e.code==="CART_EXPIRED");
});

 await t.test("checkout requires nonempty cart and is idempotent",()=>{const f=fixture(),c=cart(f);
assert.throws(()=>f.service.createCheckout(c.cartToken,{fulfillmentMode:"DIGITAL_OR_SERVICE"},"x"),e=>e.code==="CART_EMPTY");
add(f,c);
const a=f.service.createCheckout(c.cartToken,{fulfillmentMode:"DIGITAL_OR_SERVICE"},"x"),b=f.service.createCheckout(c.cartToken,{fulfillmentMode:"DIGITAL_OR_SERVICE"},"x");
assert.equal(a.checkout.id,b.checkout.id);
});

 await t.test("bounded contact and physical address validation",()=>{const f=fixture(),c=cart(f);
add(f,c);
const ch=f.service.createCheckout(c.cartToken,{fulfillmentMode:"PHYSICAL_DELIVERY"},"x").checkout;
assert.throws(()=>f.service.updateCheckout(c.cartToken,ch.id,{revision:1,fulfillmentMode:"PHYSICAL_DELIVERY",shippingMethod:"STANDARD",contactName:"علی",contactMobile:"09121234567",contactEmail:null,recipientName:null,recipientMobile:null,province:null,city:null,postalAddress:null,postalCode:null}),e=>e.code==="CHECKOUT_INVALID");
assert.equal(ready(f,c,"PHYSICAL_DELIVERY").status,"READY");
});

 await t.test("checkout revision conflicts",()=>{const f=fixture(),c=cart(f);
add(f,c);
const ch=ready(f,c);
assert.throws(()=>f.service.updateCheckout(c.cartToken,ch.id,{revision:1,fulfillmentMode:"DIGITAL_OR_SERVICE",shippingMethod:"NONE",contactName:"علی",contactMobile:"09121234567",contactEmail:null,recipientName:null,recipientMobile:null,province:null,city:null,postalAddress:null,postalCode:null}),e=>e.code==="CHECKOUT_REVISION_CONFLICT");
});

 await t.test("confirm atomically snapshots immutable commercial truth",()=>{const f=fixture(),c=cart(f);
add(f,c,"p","v",2);
const ch=ready(f,c),o=f.service.confirm(c.cartToken,ch.id,{revision:ch.revision},"confirm").pendingOrder;
assert.equal(o.status,"AWAITING_PAYMENT");
assert.equal(o.grandTotal,2600000);
const item=f.db.prepare("SELECT * FROM commerce_pending_order_items").get();
assert.equal(item.product_name,"کفش مدل X");
assert.equal(item.sku,"SKU-X");
assert.equal(f.db.prepare("SELECT status FROM commerce_carts").get().status,"CHECKED_OUT");
assert.equal(f.db.prepare("SELECT status FROM commerce_checkout_sessions").get().status,"COMPLETED");
assert.throws(()=>f.db.prepare("UPDATE commerce_pending_order_items SET unit_price=1").run());
assert.throws(()=>f.db.prepare("UPDATE commerce_pending_orders SET status='CANCELLED',grand_total=1").run());
});

 await t.test("product mutation cannot alter order snapshot",()=>{const f=fixture(),c=cart(f);
add(f,c);
const ch=ready(f,c),o=f.service.confirm(c.cartToken,ch.id,{revision:ch.revision},"confirm").pendingOrder;
f.db.prepare("UPDATE commerce_products SET name='جدید',base_price=5 WHERE id='p'").run();
const got=f.service.getOrder(c.cartToken,o.publicReference);
assert.equal(got.items[0].productName,"کفش مدل X");
assert.equal(got.items[0].unitPrice,1200000);
});

 await t.test("confirm retry converges and changed key fails",()=>{const f=fixture(),c=cart(f);
add(f,c);
const ch=ready(f,c),a=f.service.confirm(c.cartToken,ch.id,{revision:ch.revision},"confirm");
const b=f.service.confirm(c.cartToken,ch.id,{revision:ch.revision},"confirm");
assert.equal(a.pendingOrder.id,b.pendingOrder.id);
assert.throws(()=>f.service.confirm(c.cartToken,ch.id,{revision:ch.revision},"other"),e=>e.code==="ORDER_ALREADY_CREATED");
assert.equal(f.db.prepare("SELECT COUNT(*) n FROM commerce_pending_orders").get().n,1);
});

 await t.test("schema excludes providers inventory payments refunds and tracking PII",()=>{const f=fixture(),sql=f.db.prepare("SELECT group_concat(sql,' ') sql FROM sqlite_master WHERE name LIKE 'commerce_%'").get().sql.toLowerCase();
for(const word of ["payment_provider","zarinpal","stripe","inventory_reservation","shipment_provider","refund","coupon","wallet","attribution_touch"])assert.equal(sql.includes(word),false);
assert.equal(f.db.pragma("integrity_check",{simple:true}),"ok");
assert.deepEqual(f.db.pragma("foreign_key_check"),[]);
});

});
