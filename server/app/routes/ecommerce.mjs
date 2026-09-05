import express from "express";
import { EcommerceError } from "../services/ecommerce-service.mjs";
import { FinancialLedgerError } from "../commerce/v2/financial-ledger.mjs";

export function createEcommerceRouter({ service, financialLedgerService = null }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof EcommerceError || error instanceof FinancialLedgerError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    if (String(error?.message || "").includes("UNIQUE constraint failed")) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_COMMERCE_VALUE",
        message: "A unique commerce value already exists.",
      });
    }
    console.error("Ecommerce error:", error);
    return res.status(500).json({
      success: false,
      code: "ECOMMERCE_INTERNAL_ERROR",
      message: "Unable to process ecommerce operation.",
    });
  };
  const run = (res, fn, status = 200) => {
    try {
      return res.status(status).json({ success: true, ...fn() });
    } catch (error) {
      return handle(error, res);
    }
  };
  const requireFinancialAdmin = (req, res, next) => {
    const role = String(req.membership?.role || "").toLowerCase();
    if (!new Set(["owner", "admin"]).has(role)) {
      return res.status(403).json({
        success: false,
        code: "FINANCIAL_ADMIN_REQUIRED",
        message: "Owner or admin access is required for financial operations.",
      });
    }
    return next();
  };
  const finance = () => {
    if (!financialLedgerService) {
      throw new FinancialLedgerError(
        "Financial ledger service is unavailable.",
        "FINANCIAL_LEDGER_UNAVAILABLE",
        503
      );
    }
    return financialLedgerService;
  };
  const workspaceId = (req) => {
    const value = String(req.workspace?.id || "").trim();
    if (!value) {
      throw new FinancialLedgerError(
        "Workspace context is required for financial operations.",
        "FINANCIAL_WORKSPACE_REQUIRED",
        403
      );
    }
    return value;
  };

  router.get("/stores/:siteProjectId/products", (req, res) =>
    run(res, () => ({ products: service.listProducts(req.params.siteProjectId) }))
  );
  router.post("/stores/:siteProjectId/products", (req, res) =>
    run(
      res,
      () => ({ product: service.createProduct(req.params.siteProjectId, req.body || {}) }),
      201
    )
  );
  router.get("/commerce/products/:productId", (req, res) =>
    run(res, () => ({ product: service.getProduct(req.params.productId) }))
  );
  router.patch("/commerce/products/:productId", (req, res) =>
    run(res, () => ({ product: service.updateProduct(req.params.productId, req.body || {}) }))
  );
  router.post("/commerce/products/:productId/variants", (req, res) =>
    run(
      res,
      () => ({ variant: service.addVariant(req.params.productId, req.body || {}) }),
      201
    )
  );
  router.patch("/commerce/variants/:variantId", (req, res) =>
    run(res, () => ({ variant: service.updateVariant(req.params.variantId, req.body || {}) }))
  );
  router.post("/commerce/variants/:variantId/inventory-adjustments", (req, res) =>
    run(res, () => ({ variant: service.adjustInventory(req.params.variantId, req.body?.delta) }))
  );

  router.post("/stores/:siteProjectId/carts", (req, res) =>
    run(
      res,
      () => ({ cart: service.createCart(req.params.siteProjectId, req.body || {}) }),
      201
    )
  );
  router.get("/commerce/carts/:cartId", (req, res) =>
    run(res, () => ({ cart: service.getCart(req.params.cartId) }))
  );
  router.post("/commerce/carts/:cartId/items", (req, res) =>
    run(
      res,
      () => ({ cart: service.addCartItem(req.params.cartId, req.body || {}) }),
      201
    )
  );
  router.put("/commerce/carts/:cartId/items/:variantId", (req, res) =>
    run(res, () => ({
      cart: service.setCartItemQuantity(
        req.params.cartId,
        req.params.variantId,
        req.body?.quantity
      ),
    }))
  );
  router.post("/commerce/carts/:cartId/coupon", (req, res) =>
    run(res, () => ({ cart: service.applyCoupon(req.params.cartId, req.body?.code) }))
  );
  router.post("/commerce/carts/:cartId/shipping", (req, res) =>
    run(res, () => ({
      cart: service.setCartShipping(req.params.cartId, req.body?.shippingMethodId),
    }))
  );
  router.post("/commerce/carts/:cartId/checkout", (req, res) =>
    run(
      res,
      () => ({ order: service.checkout(req.params.cartId, req.body || {}) }),
      201
    )
  );

  router.post("/stores/:siteProjectId/coupons", (req, res) =>
    run(
      res,
      () => ({ coupon: service.createCoupon(req.params.siteProjectId, req.body || {}) }),
      201
    )
  );
  router.post("/stores/:siteProjectId/shipping-methods", (req, res) =>
    run(
      res,
      () => ({ shippingMethod: service.createShippingMethod(req.params.siteProjectId, req.body || {}) }),
      201
    )
  );
  router.put("/stores/:siteProjectId/payment-providers/:providerKey", (req, res) =>
    run(res, () => ({
      provider: service.configurePaymentProvider(req.params.siteProjectId, {
        ...(req.body || {}),
        providerKey: req.params.providerKey,
      }),
    }))
  );

  router.get("/stores/:siteProjectId/orders", (req, res) =>
    run(res, () => ({ orders: service.listOrders(req.params.siteProjectId) }))
  );
  router.get("/commerce/orders/:orderId", (req, res) =>
    run(res, () => ({ order: service.getOrder(req.params.orderId) }))
  );
  router.patch("/commerce/orders/:orderId/status", (req, res) =>
    run(res, () => ({ order: service.setOrderStatus(req.params.orderId, req.body || {}) }))
  );

  router.get(
    "/stores/:siteProjectId/financial-ledger",
    requireFinancialAdmin,
    (req, res) =>
      run(res, () => ({
        entries: finance().list({
          workspaceId: workspaceId(req),
          siteProjectId: req.params.siteProjectId,
          entryType: req.query.entryType || null,
          limit: req.query.limit || 100,
        }),
      }))
  );

  router.get(
    "/commerce/orders/:orderId/financials",
    requireFinancialAdmin,
    (req, res) =>
      run(res, () => {
        const financials = finance().getOrderFinancials({
          workspaceId: workspaceId(req),
          orderId: req.params.orderId,
          limit: req.query.limit || 100,
        });
        if (!financials) {
          throw new FinancialLedgerError(
            "Order not found.",
            "FINANCIAL_ORDER_NOT_FOUND",
            404
          );
        }
        return { financials };
      })
  );

  router.post(
    "/commerce/orders/:orderId/financials/reconcile",
    requireFinancialAdmin,
    (req, res) => {
      try {
        const reconciliation = finance().reconcile({
          workspaceId: workspaceId(req),
          orderId: req.params.orderId,
          userId: req.user?.id,
          actorRole: req.membership?.role,
        });

        if (reconciliation.status === "missing_order") {
          return res.status(404).json({
            success: false,
            code: "FINANCIAL_ORDER_NOT_FOUND",
            message: "Order not found.",
            reconciliation,
          });
        }
        if (reconciliation.status === "not_paid") {
          return res.status(409).json({
            success: false,
            code: "FINANCIAL_ORDER_NOT_PAID",
            message: "Only paid orders can be reconciled into the capture ledger.",
            reconciliation,
          });
        }
        if (reconciliation.status === "conflict") {
          return res.status(409).json({
            success: false,
            code: "FINANCIAL_LEDGER_CONFLICT",
            message: "The immutable ledger conflicts with the current order payment snapshot.",
            reconciliation,
          });
        }

        return res.json({ success: true, reconciliation });
      } catch (error) {
        return handle(error, res);
      }
    }
  );

  return router;
}
