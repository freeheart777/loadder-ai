import { createEcommerceService } from "../services/ecommerce-service.mjs";
import { assertCommerceProvider, commerceProviderDescriptor } from "./commerce-provider-contract.mjs";

export function createLoadderCommerceProvider({ db }) {
  const service = createEcommerceService({ db });
  const provider = {
    descriptor: commerceProviderDescriptor({ key: "loadder-native", version: "1" }),
    listProducts: (...args) => service.listProducts(...args),
    getProduct: (...args) => service.getProduct(...args),
    createProduct: (...args) => service.createProduct(...args),
    updateProduct: (...args) => service.updateProduct(...args),
    addVariant: (...args) => service.addVariant(...args),
    updateVariant: (...args) => service.updateVariant(...args),
    adjustInventory: (...args) => service.adjustInventory(...args),
    createCart: (...args) => service.createCart(...args),
    getCart: (...args) => service.getCart(...args),
    addCartItem: (...args) => service.addCartItem(...args),
    setCartItemQuantity: (...args) => service.setCartItemQuantity(...args),
    applyCoupon: (...args) => service.applyCoupon(...args),
    setCartShipping: (...args) => service.setCartShipping(...args),
    checkout: (...args) => service.checkout(...args),
    getOrder: (...args) => service.getOrder(...args),
  };
  return Object.freeze(assertCommerceProvider(provider));
}
