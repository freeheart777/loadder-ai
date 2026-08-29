import express from "express";
import { EcommerceError } from "../services/ecommerce-service.mjs";

export function createEcommerceRouter({ service }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof EcommerceError) return res.status(error.status).json({ success:false, code:error.code, message:error.message });
    if (String(error?.message || "").includes("UNIQUE constraint failed")) return res.status(409).json({ success:false, code:"DUPLICATE_COMMERCE_VALUE", message:"A unique commerce value already exists." });
    console.error("Ecommerce error:", error);
    return res.status(500).json({ success:false, code:"ECOMMERCE_INTERNAL_ERROR", message:"Unable to process ecommerce operation." });
  };
  const run = (res, fn, status=200) => { try { return res.status(status).json({ success:true, ...fn() }); } catch (e) { return handle(e,res); } };

  router.get("/stores/:siteProjectId/products", (req,res)=>run(res,()=>({products:service.listProducts(req.params.siteProjectId)})));
  router.post("/stores/:siteProjectId/products", (req,res)=>run(res,()=>({product:service.createProduct(req.params.siteProjectId,req.body||{})}),201));
  router.get("/commerce/products/:productId", (req,res)=>run(res,()=>({product:service.getProduct(req.params.productId)})));
  router.patch("/commerce/products/:productId", (req,res)=>run(res,()=>({product:service.updateProduct(req.params.productId,req.body||{})})));
  router.post("/commerce/products/:productId/variants", (req,res)=>run(res,()=>({variant:service.addVariant(req.params.productId,req.body||{})}),201));
  router.post("/commerce/variants/:variantId/inventory-adjustments", (req,res)=>run(res,()=>({variant:service.adjustInventory(req.params.variantId,req.body?.delta)})));

  router.post("/stores/:siteProjectId/carts", (req,res)=>run(res,()=>({cart:service.createCart(req.params.siteProjectId,req.body||{})}),201));
  router.get("/commerce/carts/:cartId", (req,res)=>run(res,()=>({cart:service.getCart(req.params.cartId)})));
  router.post("/commerce/carts/:cartId/items", (req,res)=>run(res,()=>({cart:service.addCartItem(req.params.cartId,req.body||{})}),201));
  router.put("/commerce/carts/:cartId/items/:variantId", (req,res)=>run(res,()=>({cart:service.setCartItemQuantity(req.params.cartId,req.params.variantId,req.body?.quantity)})));
  router.post("/commerce/carts/:cartId/coupon", (req,res)=>run(res,()=>({cart:service.applyCoupon(req.params.cartId,req.body?.code)})));
  router.post("/commerce/carts/:cartId/shipping", (req,res)=>run(res,()=>({cart:service.setCartShipping(req.params.cartId,req.body?.shippingMethodId)})));
  router.post("/commerce/carts/:cartId/checkout", (req,res)=>run(res,()=>({order:service.checkout(req.params.cartId,req.body||{})}),201));

  router.post("/stores/:siteProjectId/coupons", (req,res)=>run(res,()=>({coupon:service.createCoupon(req.params.siteProjectId,req.body||{})}),201));
  router.post("/stores/:siteProjectId/shipping-methods", (req,res)=>run(res,()=>({shippingMethod:service.createShippingMethod(req.params.siteProjectId,req.body||{})}),201));
  router.put("/stores/:siteProjectId/payment-providers/:providerKey", (req,res)=>run(res,()=>({provider:service.configurePaymentProvider(req.params.siteProjectId,{...(req.body||{}),providerKey:req.params.providerKey})})));

  router.get("/stores/:siteProjectId/orders", (req,res)=>run(res,()=>({orders:service.listOrders(req.params.siteProjectId)})));
  router.get("/commerce/orders/:orderId", (req,res)=>run(res,()=>({order:service.getOrder(req.params.orderId)})));
  router.patch("/commerce/orders/:orderId/status", (req,res)=>run(res,()=>({order:service.setOrderStatus(req.params.orderId,req.body||{})})));
  return router;
}
