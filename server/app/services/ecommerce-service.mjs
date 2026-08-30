import crypto from "crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

export class EcommerceError extends Error {
  constructor(message, code = "ECOMMERCE_ERROR", status = 400) {
    super(message);
    this.name = "EcommerceError";
    this.code = code;
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const json = (value, fallback = {}) => {
  try { return JSON.parse(value || ""); } catch { return fallback; }
};
const slugify = (value) => String(value || "")
  .trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
const currency = (value) => String(value || "USD").trim().toUpperCase().slice(0, 8) || "USD";
const nonNegativeInt = (value, field) => {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0) throw new EcommerceError(`${field} must be a non-negative integer.`, "INVALID_AMOUNT");
  return n;
};
const productImageUrl = (value, { nullable = false } = {}) => {
  if (value == null || value === "") {
    if (nullable) return null;
    throw new EcommerceError("Product image URL is required.", "PRODUCT_IMAGE_URL_REQUIRED");
  }
  const url = String(value).trim();
  if (url.length > 8 * 1024 * 1024) throw new EcommerceError("Product image URL is too large.", "PRODUCT_IMAGE_URL_TOO_LARGE", 413);
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return url;
  } catch {}
  throw new EcommerceError("Product image URL must use HTTPS or a supported image data URL.", "PRODUCT_IMAGE_URL_INVALID");
};
const productMetadata = (value, fallback = "{}") => {
  const next = value === undefined ? json(fallback) : (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  if (next.gallery === undefined) return next;
  if (!Array.isArray(next.gallery) || next.gallery.length > 12) throw new EcommerceError("Product gallery must contain at most 12 images.", "PRODUCT_GALLERY_INVALID");
  return { ...next, gallery: [...new Set(next.gallery.map((url) => productImageUrl(url)))].slice(0, 12) };
};

export function createEcommerceService({ db }) {
  const workspaceId = () => requireWorkspaceId();
  const ownedSite = (siteProjectId) => db.prepare("SELECT id,site_type AS siteType,name FROM site_projects WHERE id=? AND workspace_id=?").get(siteProjectId, workspaceId());
  const requireSite = (siteProjectId) => {
    const site = ownedSite(siteProjectId);
    if (!site) throw new EcommerceError("Store project not found in the active workspace.", "STORE_NOT_FOUND", 404);
    if (site.siteType !== "STORE") throw new EcommerceError("Ecommerce is only available for STORE projects.", "NOT_STORE_PROJECT", 409);
    return site;
  };
  const requireProduct = (productId) => {
    const row = db.prepare("SELECT * FROM ecommerce_products WHERE id=? AND workspace_id=?").get(productId, workspaceId());
    if (!row) throw new EcommerceError("Product not found.", "PRODUCT_NOT_FOUND", 404);
    return row;
  };
  const requireVariant = (variantId) => {
    const row = db.prepare("SELECT v.*,p.site_project_id,p.name AS product_name,p.base_price_minor,p.currency FROM ecommerce_variants v JOIN ecommerce_products p ON p.id=v.product_id WHERE v.id=? AND v.workspace_id=? AND p.workspace_id=?").get(variantId, workspaceId(), workspaceId());
    if (!row) throw new EcommerceError("Variant not found.", "VARIANT_NOT_FOUND", 404);
    return row;
  };
  const requireCart = (cartId) => {
    const row = db.prepare("SELECT * FROM ecommerce_carts WHERE id=? AND workspace_id=?").get(cartId, workspaceId());
    if (!row) throw new EcommerceError("Cart not found.", "CART_NOT_FOUND", 404);
    return row;
  };
  const productMap = (row) => ({
    id: row.id, siteProjectId: row.site_project_id, name: row.name, slug: row.slug,
    description: row.description, category: row.category, brand: row.brand, status: row.status,
    currency: row.currency, basePriceMinor: row.base_price_minor, compareAtPriceMinor: row.compare_at_price_minor,
    featured: Boolean(row.featured), seoTitle: row.seo_title, seoDescription: row.seo_description,
    metadata: json(row.metadata_json), createdAt: row.created_at, updatedAt: row.updated_at,
  });
  const variantMap = (row) => ({
    id: row.id, productId: row.product_id, sku: row.sku, title: row.title,
    priceMinor: row.price_minor, inventoryQuantity: row.inventory_quantity,
    inventoryPolicy: row.inventory_policy, options: json(row.options_json), imageUrl: row.image_url,
    active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at,
  });
  const cartItems = (cartId) => db.prepare(`
    SELECT i.*,p.name AS product_name,v.sku,v.title AS variant_title
    FROM ecommerce_cart_items i
    JOIN ecommerce_products p ON p.id=i.product_id
    JOIN ecommerce_variants v ON v.id=i.variant_id
    WHERE i.workspace_id=? AND i.cart_id=? ORDER BY i.created_at
  `).all(workspaceId(), cartId).map((r) => ({
    id:r.id,productId:r.product_id,variantId:r.variant_id,productName:r.product_name,sku:r.sku,
    variantTitle:r.variant_title,quantity:r.quantity,unitPriceMinor:r.unit_price_minor,
    lineTotalMinor:r.quantity*r.unit_price_minor,
  }));
  const recalcCart = (cartId) => {
    const cart = requireCart(cartId);
    const items = cartItems(cartId);
    const subtotal = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
    let discount = 0;
    if (cart.coupon_code) {
      const coupon = db.prepare(`SELECT * FROM ecommerce_coupons WHERE workspace_id=? AND site_project_id=? AND upper(code)=upper(?) AND active=1`).get(workspaceId(), cart.site_project_id, cart.coupon_code);
      if (coupon) {
        const ts = Date.now();
        const validTime = (!coupon.starts_at || Date.parse(coupon.starts_at) <= ts) && (!coupon.ends_at || Date.parse(coupon.ends_at) >= ts);
        const validUsage = coupon.usage_limit == null || coupon.usage_count < coupon.usage_limit;
        if (validTime && validUsage) discount = coupon.discount_type === "PERCENT" ? Math.floor(subtotal * Math.min(coupon.discount_value, 100) / 100) : Math.min(subtotal, coupon.discount_value);
      }
    }
    const total = Math.max(0, subtotal - discount + cart.shipping_minor);
    const stamp = now();
    db.prepare("UPDATE ecommerce_carts SET subtotal_minor=?,discount_minor=?,total_minor=?,updated_at=? WHERE id=? AND workspace_id=?")
      .run(subtotal, discount, total, stamp, cartId, workspaceId());
    return { ...cart, subtotal_minor:subtotal, discount_minor:discount, total_minor:total, items };
  };
  const cartMap = (row) => ({
    id:row.id,siteProjectId:row.site_project_id,customerId:row.customer_id,email:row.email,currency:row.currency,
    status:row.status,couponCode:row.coupon_code,subtotalMinor:row.subtotal_minor,discountMinor:row.discount_minor,
    shippingMinor:row.shipping_minor,totalMinor:row.total_minor,items:row.items || cartItems(row.id),createdAt:row.created_at,updatedAt:row.updated_at,
  });

  return Object.freeze({
    listProducts(siteProjectId) {
      requireSite(siteProjectId);
      const products = db.prepare("SELECT * FROM ecommerce_products WHERE workspace_id=? AND site_project_id=? ORDER BY updated_at DESC").all(workspaceId(), siteProjectId);
      return products.map((p) => ({ ...productMap(p), variants: db.prepare("SELECT * FROM ecommerce_variants WHERE workspace_id=? AND product_id=? ORDER BY created_at").all(workspaceId(), p.id).map(variantMap) }));
    },
    getProduct(productId) {
      const p = requireProduct(productId);
      requireSite(p.site_project_id);
      return { ...productMap(p), variants: db.prepare("SELECT * FROM ecommerce_variants WHERE workspace_id=? AND product_id=? ORDER BY created_at").all(workspaceId(), productId).map(variantMap) };
    },
    createProduct(siteProjectId, input = {}) {
      requireSite(siteProjectId);
      const name = String(input.name || "").trim();
      if (!name) throw new EcommerceError("Product name is required.", "PRODUCT_NAME_REQUIRED");
      const productId = id("prod"), stamp = now();
      const productCurrency = currency(input.currency);
      const slug = slugify(input.slug || name) || productId.toLowerCase();
      const price = nonNegativeInt(input.basePriceMinor, "basePriceMinor");
      db.prepare(`INSERT INTO ecommerce_products(id,workspace_id,site_project_id,name,slug,description,category,brand,status,currency,base_price_minor,compare_at_price_minor,featured,seo_title,seo_description,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(productId,workspaceId(),siteProjectId,name,slug,String(input.description||""),input.category||null,input.brand||null,input.status||"DRAFT",productCurrency,price,input.compareAtPriceMinor==null?null:nonNegativeInt(input.compareAtPriceMinor,"compareAtPriceMinor"),input.featured?1:0,input.seoTitle||null,input.seoDescription||null,JSON.stringify(input.metadata||{}),stamp,stamp);
      const sku = String(input.sku || `${slug}-${crypto.randomBytes(3).toString("hex")}`).trim();
      const variantId = id("var");
      db.prepare(`INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,image_url,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(variantId,workspaceId(),productId,sku,String(input.variantTitle||"Default"),input.variantPriceMinor==null?null:nonNegativeInt(input.variantPriceMinor,"variantPriceMinor"),nonNegativeInt(input.inventoryQuantity,"inventoryQuantity"),input.inventoryPolicy||"DENY",JSON.stringify(input.options||{}),input.imageUrl||null,1,stamp,stamp);
      return this.getProduct(productId);
    },
    updateProduct(productId, input = {}) {
      const p = requireProduct(productId); requireSite(p.site_project_id);
      const next = {
        name: input.name === undefined ? p.name : String(input.name).trim(),
        slug: input.slug === undefined ? p.slug : slugify(input.slug),
        description: input.description === undefined ? p.description : String(input.description),
        category: input.category === undefined ? p.category : input.category || null,
        brand: input.brand === undefined ? p.brand : input.brand || null,
        status: input.status === undefined ? p.status : input.status,
        currency: input.currency === undefined ? p.currency : currency(input.currency),
        basePrice: input.basePriceMinor === undefined ? p.base_price_minor : nonNegativeInt(input.basePriceMinor,"basePriceMinor"),
        compareAt: input.compareAtPriceMinor === undefined ? p.compare_at_price_minor : (input.compareAtPriceMinor==null?null:nonNegativeInt(input.compareAtPriceMinor,"compareAtPriceMinor")),
        featured: input.featured === undefined ? p.featured : (input.featured?1:0),
        seoTitle: input.seoTitle === undefined ? p.seo_title : input.seoTitle || null,
        seoDescription: input.seoDescription === undefined ? p.seo_description : input.seoDescription || null,
        metadata: input.metadata === undefined ? p.metadata_json : JSON.stringify(productMetadata(input.metadata)),
      };
      if (!next.name || !next.slug) throw new EcommerceError("Product name and slug are required.", "INVALID_PRODUCT");
      db.prepare(`UPDATE ecommerce_products SET name=?,slug=?,description=?,category=?,brand=?,status=?,currency=?,base_price_minor=?,compare_at_price_minor=?,featured=?,seo_title=?,seo_description=?,metadata_json=?,updated_at=? WHERE id=? AND workspace_id=?`)
        .run(next.name,next.slug,next.description,next.category,next.brand,next.status,next.currency,next.basePrice,next.compareAt,next.featured,next.seoTitle,next.seoDescription,next.metadata,now(),productId,workspaceId());
      return this.getProduct(productId);
    },
    addVariant(productId, input = {}) {
      const p = requireProduct(productId); requireSite(p.site_project_id);
      const sku = String(input.sku || "").trim();
      if (!sku) throw new EcommerceError("SKU is required.", "SKU_REQUIRED");
      const stamp=now(), variantId=id("var");
      db.prepare(`INSERT INTO ecommerce_variants(id,workspace_id,product_id,sku,title,price_minor,inventory_quantity,inventory_policy,options_json,image_url,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(variantId,workspaceId(),productId,sku,String(input.title||"Variant"),input.priceMinor==null?null:nonNegativeInt(input.priceMinor,"priceMinor"),nonNegativeInt(input.inventoryQuantity,"inventoryQuantity"),input.inventoryPolicy||"DENY",JSON.stringify(input.options||{}),input.imageUrl||null,input.active===false?0:1,stamp,stamp);
      return variantMap(requireVariant(variantId));
    },
    updateVariant(variantId, input = {}) {
      const variant = requireVariant(variantId); requireSite(variant.site_project_id);
      const imageUrl = input.imageUrl === undefined ? variant.image_url : productImageUrl(input.imageUrl, { nullable:true });
      db.prepare("UPDATE ecommerce_variants SET image_url=?,updated_at=? WHERE id=? AND workspace_id=?")
        .run(imageUrl,now(),variantId,workspaceId());
      return variantMap(requireVariant(variantId));
    },
    adjustInventory(variantId, delta) {
      const v = requireVariant(variantId); requireSite(v.site_project_id);
      const d = Number(delta); if (!Number.isInteger(d)) throw new EcommerceError("Inventory delta must be an integer.", "INVALID_INVENTORY_DELTA");
      const next = v.inventory_quantity + d; if (next < 0) throw new EcommerceError("Inventory cannot become negative.", "INSUFFICIENT_INVENTORY", 409);
      db.prepare("UPDATE ecommerce_variants SET inventory_quantity=?,updated_at=? WHERE id=? AND workspace_id=?").run(next,now(),variantId,workspaceId());
      return variantMap(requireVariant(variantId));
    },
    createCart(siteProjectId, input = {}) {
      requireSite(siteProjectId); const cartId=id("cart"), stamp=now();
      db.prepare(`INSERT INTO ecommerce_carts(id,workspace_id,site_project_id,customer_id,email,currency,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'ACTIVE',?,?)`)
        .run(cartId,workspaceId(),siteProjectId,input.customerId||null,input.email||null,currency(input.currency),stamp,stamp);
      return cartMap(recalcCart(cartId));
    },
    getCart(cartId) { return cartMap(recalcCart(cartId)); },
    addCartItem(cartId, input = {}) {
      const cart = requireCart(cartId); requireSite(cart.site_project_id);
      if (cart.status !== "ACTIVE") throw new EcommerceError("Cart is not active.", "CART_NOT_ACTIVE", 409);
      const variant = requireVariant(input.variantId);
      if (variant.site_project_id !== cart.site_project_id) throw new EcommerceError("Variant belongs to another store.", "CROSS_STORE_VARIANT", 409);
      const quantity = Number(input.quantity || 1); if (!Number.isInteger(quantity) || quantity <= 0) throw new EcommerceError("Quantity must be a positive integer.", "INVALID_QUANTITY");
      if (variant.inventory_policy === "DENY" && variant.inventory_quantity < quantity) throw new EcommerceError("Not enough inventory.", "INSUFFICIENT_INVENTORY", 409);
      const price = variant.price_minor == null ? variant.base_price_minor : variant.price_minor;
      const existing = db.prepare("SELECT * FROM ecommerce_cart_items WHERE workspace_id=? AND cart_id=? AND variant_id=?").get(workspaceId(),cartId,variant.id);
      if (existing) {
        const nextQty = existing.quantity + quantity;
        if (variant.inventory_policy === "DENY" && variant.inventory_quantity < nextQty) throw new EcommerceError("Not enough inventory.", "INSUFFICIENT_INVENTORY", 409);
        db.prepare("UPDATE ecommerce_cart_items SET quantity=?,unit_price_minor=?,updated_at=? WHERE id=? AND workspace_id=?").run(nextQty,price,now(),existing.id,workspaceId());
      } else {
        const stamp=now(); db.prepare(`INSERT INTO ecommerce_cart_items(id,workspace_id,cart_id,product_id,variant_id,quantity,unit_price_minor,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(id("item"),workspaceId(),cartId,variant.product_id,variant.id,quantity,price,stamp,stamp);
      }
      return cartMap(recalcCart(cartId));
    },
    setCartItemQuantity(cartId, variantId, quantity) {
      const cart=requireCart(cartId); requireSite(cart.site_project_id); const q=Number(quantity);
      if (!Number.isInteger(q) || q < 0) throw new EcommerceError("Quantity must be zero or a positive integer.", "INVALID_QUANTITY");
      if (q===0) db.prepare("DELETE FROM ecommerce_cart_items WHERE workspace_id=? AND cart_id=? AND variant_id=?").run(workspaceId(),cartId,variantId);
      else {
        const v=requireVariant(variantId); if(v.inventory_policy==="DENY"&&v.inventory_quantity<q) throw new EcommerceError("Not enough inventory.","INSUFFICIENT_INVENTORY",409);
        db.prepare("UPDATE ecommerce_cart_items SET quantity=?,updated_at=? WHERE workspace_id=? AND cart_id=? AND variant_id=?").run(q,now(),workspaceId(),cartId,variantId);
      }
      return cartMap(recalcCart(cartId));
    },
    applyCoupon(cartId, code) {
      const cart=requireCart(cartId); requireSite(cart.site_project_id);
      const c=String(code||"").trim();
      if (!c) throw new EcommerceError("Coupon code is required.","COUPON_REQUIRED");
      const coupon=db.prepare("SELECT * FROM ecommerce_coupons WHERE workspace_id=? AND site_project_id=? AND upper(code)=upper(?) AND active=1").get(workspaceId(),cart.site_project_id,c);
      if(!coupon) throw new EcommerceError("Coupon is not valid.","INVALID_COUPON",404);
      db.prepare("UPDATE ecommerce_carts SET coupon_code=?,updated_at=? WHERE id=? AND workspace_id=?").run(coupon.code,now(),cartId,workspaceId());
      return cartMap(recalcCart(cartId));
    },
    createCoupon(siteProjectId,input={}) {
      requireSite(siteProjectId); const code=String(input.code||"").trim().toUpperCase(); if(!code) throw new EcommerceError("Coupon code is required.","COUPON_REQUIRED");
      const type=input.discountType||"PERCENT", value=nonNegativeInt(input.discountValue,"discountValue"); if(type==="PERCENT"&&value>100) throw new EcommerceError("Percent discount cannot exceed 100.","INVALID_COUPON");
      const stamp=now(),couponId=id("coupon"); db.prepare(`INSERT INTO ecommerce_coupons(id,workspace_id,site_project_id,code,discount_type,discount_value,active,starts_at,ends_at,usage_limit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(couponId,workspaceId(),siteProjectId,code,type,value,input.active===false?0:1,input.startsAt||null,input.endsAt||null,input.usageLimit==null?null:nonNegativeInt(input.usageLimit,"usageLimit"),stamp,stamp);
      return {id:couponId,code,discountType:type,discountValue:value};
    },
    createShippingMethod(siteProjectId,input={}) {
      requireSite(siteProjectId); const name=String(input.name||"").trim(); if(!name) throw new EcommerceError("Shipping method name is required.","SHIPPING_NAME_REQUIRED");
      const methodId=id("ship"),stamp=now(); db.prepare(`INSERT INTO ecommerce_shipping_methods(id,workspace_id,site_project_id,name,provider,currency,price_minor,active,config_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(methodId,workspaceId(),siteProjectId,name,String(input.provider||"MANUAL"),currency(input.currency),nonNegativeInt(input.priceMinor,"priceMinor"),input.active===false?0:1,JSON.stringify(input.config||{}),stamp,stamp);
      return {id:methodId,name,provider:input.provider||"MANUAL",currency:currency(input.currency),priceMinor:nonNegativeInt(input.priceMinor,"priceMinor")};
    },
    setCartShipping(cartId, shippingMethodId) {
      const cart=requireCart(cartId); requireSite(cart.site_project_id);
      const method=db.prepare("SELECT * FROM ecommerce_shipping_methods WHERE id=? AND workspace_id=? AND site_project_id=? AND active=1").get(shippingMethodId,workspaceId(),cart.site_project_id);
      if(!method) throw new EcommerceError("Shipping method not found.","SHIPPING_NOT_FOUND",404);
      if(method.currency!==cart.currency) throw new EcommerceError("Shipping currency does not match cart currency.","CURRENCY_MISMATCH",409);
      db.prepare("UPDATE ecommerce_carts SET shipping_minor=?,updated_at=? WHERE id=? AND workspace_id=?").run(method.price_minor,now(),cartId,workspaceId());
      return cartMap(recalcCart(cartId));
    },
    configurePaymentProvider(siteProjectId,input={}) {
      requireSite(siteProjectId); const key=String(input.providerKey||"").trim().toUpperCase(); if(!key) throw new EcommerceError("providerKey is required.","PROVIDER_KEY_REQUIRED");
      const existing=db.prepare("SELECT id FROM ecommerce_payment_providers WHERE workspace_id=? AND site_project_id=? AND provider_key=?").get(workspaceId(),siteProjectId,key); const stamp=now();
      if(existing) db.prepare("UPDATE ecommerce_payment_providers SET status=?,config_json=?,credential_reference=?,updated_at=? WHERE id=? AND workspace_id=?").run(input.status||"PENDING",JSON.stringify(input.config||{}),input.credentialReference||null,stamp,existing.id,workspaceId());
      else db.prepare(`INSERT INTO ecommerce_payment_providers(id,workspace_id,site_project_id,provider_key,status,config_json,credential_reference,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(id("pay"),workspaceId(),siteProjectId,key,input.status||"PENDING",JSON.stringify(input.config||{}),input.credentialReference||null,stamp,stamp);
      return {providerKey:key,status:input.status||"PENDING"};
    },
    checkout(cartId,input={}) {
      const execute=db.transaction(() => {
        const cart=recalcCart(cartId); requireSite(cart.site_project_id);
        if(cart.status!=="ACTIVE") throw new EcommerceError("Cart is not active.","CART_NOT_ACTIVE",409);
        if(!cart.items.length) throw new EcommerceError("Cart is empty.","EMPTY_CART",409);
        for(const item of cart.items){ const v=requireVariant(item.variantId); if(v.inventory_policy==="DENY"&&v.inventory_quantity<item.quantity) throw new EcommerceError(`Insufficient inventory for ${item.sku}.`,"INSUFFICIENT_INVENTORY",409); }
        const orderId=id("order"),stamp=now();
        db.prepare(`INSERT INTO ecommerce_orders(id,workspace_id,site_project_id,cart_id,customer_id,email,currency,status,payment_status,fulfillment_status,payment_provider,payment_reference,shipping_method,shipping_address_json,subtotal_minor,discount_minor,shipping_minor,total_minor,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(orderId,workspaceId(),cart.site_project_id,cart.id,input.customerId||cart.customer_id||null,input.email||cart.email||null,cart.currency,"PENDING","UNPAID","UNFULFILLED",input.paymentProvider||null,null,input.shippingMethod||null,JSON.stringify(input.shippingAddress||{}),cart.subtotal_minor,cart.discount_minor,cart.shipping_minor,cart.total_minor,stamp,stamp);
        for(const item of cart.items){ const v=requireVariant(item.variantId); db.prepare(`INSERT INTO ecommerce_order_items(id,workspace_id,order_id,product_id,variant_id,product_name,sku,quantity,unit_price_minor,line_total_minor,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id("oi"),workspaceId(),orderId,item.productId,item.variantId,item.productName,item.sku,item.quantity,item.unitPriceMinor,item.lineTotalMinor,stamp); if(v.inventory_policy==="DENY") db.prepare("UPDATE ecommerce_variants SET inventory_quantity=inventory_quantity-?,updated_at=? WHERE id=? AND workspace_id=?").run(item.quantity,stamp,item.variantId,workspaceId()); }
        if(cart.coupon_code) db.prepare("UPDATE ecommerce_coupons SET usage_count=usage_count+1,updated_at=? WHERE workspace_id=? AND site_project_id=? AND upper(code)=upper(?)").run(stamp,workspaceId(),cart.site_project_id,cart.coupon_code);
        db.prepare("UPDATE ecommerce_carts SET status='CONVERTED',updated_at=? WHERE id=? AND workspace_id=?").run(stamp,cartId,workspaceId());
        return this.getOrder(orderId);
      });
      return execute();
    },
    getOrder(orderId){
      const order=db.prepare("SELECT * FROM ecommerce_orders WHERE id=? AND workspace_id=?").get(orderId,workspaceId()); if(!order) throw new EcommerceError("Order not found.","ORDER_NOT_FOUND",404); requireSite(order.site_project_id);
      const items=db.prepare("SELECT * FROM ecommerce_order_items WHERE workspace_id=? AND order_id=? ORDER BY created_at").all(workspaceId(),orderId).map(r=>({id:r.id,productId:r.product_id,variantId:r.variant_id,productName:r.product_name,sku:r.sku,quantity:r.quantity,unitPriceMinor:r.unit_price_minor,lineTotalMinor:r.line_total_minor}));
      return {id:order.id,siteProjectId:order.site_project_id,cartId:order.cart_id,customerId:order.customer_id,email:order.email,currency:order.currency,status:order.status,paymentStatus:order.payment_status,fulfillmentStatus:order.fulfillment_status,paymentProvider:order.payment_provider,paymentReference:order.payment_reference,shippingMethod:order.shipping_method,shippingAddress:json(order.shipping_address_json),subtotalMinor:order.subtotal_minor,discountMinor:order.discount_minor,shippingMinor:order.shipping_minor,totalMinor:order.total_minor,items,createdAt:order.created_at,updatedAt:order.updated_at};
    },
    listOrders(siteProjectId){ requireSite(siteProjectId); return db.prepare("SELECT id FROM ecommerce_orders WHERE workspace_id=? AND site_project_id=? ORDER BY created_at DESC").all(workspaceId(),siteProjectId).map(r=>this.getOrder(r.id)); },
    setOrderStatus(orderId,input={}){
      const order=this.getOrder(orderId); const status=input.status||order.status,paymentStatus=input.paymentStatus||order.paymentStatus,fulfillmentStatus=input.fulfillmentStatus||order.fulfillmentStatus;
      db.prepare("UPDATE ecommerce_orders SET status=?,payment_status=?,fulfillment_status=?,payment_reference=COALESCE(?,payment_reference),updated_at=? WHERE id=? AND workspace_id=?").run(status,paymentStatus,fulfillmentStatus,input.paymentReference||null,now(),orderId,workspaceId()); return this.getOrder(orderId);
    },
  });
}
