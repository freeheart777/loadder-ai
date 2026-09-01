export const COMMERCE_PROVIDER_CAPABILITIES = Object.freeze([
  "products.list",
  "products.get",
  "products.create",
  "products.update",
  "variants.create",
  "variants.update",
  "inventory.adjust",
  "carts.create",
  "carts.get",
  "carts.addItem",
  "carts.setQuantity",
  "coupons.apply",
  "shipping.set",
  "checkout.createOrder",
  "orders.get",
]);

const REQUIRED_METHODS = Object.freeze([
  "listProducts",
  "getProduct",
  "createProduct",
  "updateProduct",
  "addVariant",
  "updateVariant",
  "adjustInventory",
  "createCart",
  "getCart",
  "addCartItem",
  "setCartItemQuantity",
  "applyCoupon",
  "setCartShipping",
  "checkout",
  "getOrder",
]);

export class CommerceProviderContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "CommerceProviderContractError";
    this.code = "COMMERCE_PROVIDER_CONTRACT_INVALID";
  }
}

export function assertCommerceProvider(provider) {
  if (!provider || typeof provider !== "object") {
    throw new CommerceProviderContractError("Commerce provider must be an object.");
  }
  const missing = REQUIRED_METHODS.filter((method) => typeof provider[method] !== "function");
  if (missing.length) {
    throw new CommerceProviderContractError(`Commerce provider is missing methods: ${missing.join(", ")}`);
  }
  return provider;
}

export function commerceProviderDescriptor({ key, version = "1", capabilities = COMMERCE_PROVIDER_CAPABILITIES } = {}) {
  const safeKey = String(key || "").trim();
  if (!safeKey) throw new CommerceProviderContractError("Commerce provider key is required.");
  return Object.freeze({ key: safeKey, version: String(version || "1"), capabilities: Object.freeze([...capabilities]) });
}
