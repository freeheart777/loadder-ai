import express from "express";
import rateLimit from "express-rate-limit";

import {
  AuthError,
  SESSION_COOKIE_NAME,
} from "../services/auth-service.mjs";
import { getSessionToken } from "../middleware/auth.mjs";
import { db } from "../../db/workspace-database.mjs";
import { createSiteProjectRepository } from "../repositories/site-project-repository.mjs";
import { renderPublishedSite } from "./public-sites.mjs";
import { createEcommerceService } from "../services/ecommerce-service.mjs";
import { runWithWorkspace } from "../tenant-context.mjs";

export function createAuthRouter({
  authService,
  nodeEnv = "development",
  exposeDevelopmentOtp = false,
}) {
  const router = express.Router();
  const publicSiteRepository = createSiteProjectRepository(db);
  const ecommerceService = createEcommerceService({ db });
  const sendOtpLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
    },
  });

  function handleAuthError(error, res) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    console.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "خطای داخلی احراز هویت.",
    });
  }

  function publicStore(siteProjectId) {
    return db.prepare(`
      SELECT id, workspace_id AS workspaceId, name, site_type AS siteType
      FROM site_projects
      WHERE id=? AND site_type='STORE'
    `).get(siteProjectId);
  }

  function publicProduct(product) {
    if (!product || product.status !== "ACTIVE") return null;
    const gallery = Array.isArray(product.metadata?.gallery)
      ? product.metadata.gallery.filter((item) => typeof item === "string").slice(0, 12)
      : [];
    return {
      id: product.id,
      siteProjectId: product.siteProjectId,
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      category: product.category || null,
      brand: product.brand || null,
      currency: product.currency,
      basePriceMinor: product.basePriceMinor,
      compareAtPriceMinor: product.compareAtPriceMinor ?? null,
      featured: Boolean(product.featured),
      seoTitle: product.seoTitle || null,
      seoDescription: product.seoDescription || null,
      gallery,
      variants: (product.variants || [])
        .filter((variant) => variant.active)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          title: variant.title,
          priceMinor: variant.priceMinor,
          inventoryQuantity: variant.inventoryQuantity,
          inventoryPolicy: variant.inventoryPolicy,
          options: variant.options || {},
          imageUrl: variant.imageUrl || null,
        })),
    };
  }

  function storefrontError(error, res) {
    console.error("Public storefront error:", error);
    const status = Number(error?.status) || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      code: error?.code || "STOREFRONT_ERROR",
      message: status === 500 ? "Unable to process storefront request." : error.message,
    });
  }

  router.get("/status", (req, res) => {
    res.json({
      success: true,
      mode: "persistent-session",
      productionReady: false,
      otpDelivery: "not-connected",
      developmentOtpExposed:
        nodeEnv !== "production" && exposeDevelopmentOtp,
    });
  });

  // Compatibility public-site route. This endpoint is intentionally public and
  // therefore MUST NOT depend on tenant/workspace AsyncLocalStorage context.
  router.get("/sites/:id", (req, res) => {
    try {
      const published = publicSiteRepository.getPublishedPublic(req.params.id);
      if (!published) return res.status(404).send("Site not found");
      res.set({
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      return res.type("html").send(renderPublishedSite(published.project, published.version, published.assets));
    } catch (error) {
      console.error("Published site error:", error);
      return res.status(500).send("Unable to render site");
    }
  });

  // Public ecommerce surface. The store id is used only to resolve its owning
  // workspace. Returned product data is explicitly whitelisted and only ACTIVE
  // products/variants are exposed.
  router.get("/storefront/:siteProjectId", (req, res) => {
    try {
      const store = publicStore(req.params.siteProjectId);
      if (!store) return res.status(404).json({ success: false, message: "Store not found." });
      const products = runWithWorkspace(store.workspaceId, () => ecommerceService.listProducts(store.id))
        .map(publicProduct)
        .filter(Boolean);
      return res.json({
        success: true,
        store: { id: store.id, name: store.name },
        categories: [...new Set(products.map((p) => p.category).filter(Boolean))],
        brands: [...new Set(products.map((p) => p.brand).filter(Boolean))],
        productCount: products.length,
      });
    } catch (error) {
      return storefrontError(error, res);
    }
  });

  router.get("/storefront/:siteProjectId/products", (req, res) => {
    try {
      const store = publicStore(req.params.siteProjectId);
      if (!store) return res.status(404).json({ success: false, message: "Store not found." });
      const q = String(req.query.q || "").trim().toLocaleLowerCase("fa");
      const category = String(req.query.category || "").trim();
      const brand = String(req.query.brand || "").trim();
      const onlyInStock = String(req.query.inStock || "") === "1";
      const onlyFeatured = String(req.query.featured || "") === "1";
      const sort = String(req.query.sort || "newest");
      let products = runWithWorkspace(store.workspaceId, () => ecommerceService.listProducts(store.id))
        .map(publicProduct)
        .filter(Boolean);
      if (q) products = products.filter((p) => [p.name, p.description, p.category, p.brand, ...p.variants.map((v) => v.sku)].filter(Boolean).join(" ").toLocaleLowerCase("fa").includes(q));
      if (category) products = products.filter((p) => p.category === category);
      if (brand) products = products.filter((p) => p.brand === brand);
      if (onlyFeatured) products = products.filter((p) => p.featured);
      if (onlyInStock) products = products.filter((p) => p.variants.some((v) => v.inventoryPolicy !== "DENY" || v.inventoryQuantity > 0));
      if (sort === "price-asc") products.sort((a, b) => a.basePriceMinor - b.basePriceMinor);
      if (sort === "price-desc") products.sort((a, b) => b.basePriceMinor - a.basePriceMinor);
      return res.json({ success: true, products });
    } catch (error) {
      return storefrontError(error, res);
    }
  });

  router.get("/storefront/:siteProjectId/products/:slug", (req, res) => {
    try {
      const store = publicStore(req.params.siteProjectId);
      if (!store) return res.status(404).json({ success: false, message: "Store not found." });
      const product = runWithWorkspace(store.workspaceId, () => ecommerceService.listProducts(store.id))
        .map(publicProduct)
        .find((item) => item?.slug === req.params.slug);
      if (!product) return res.status(404).json({ success: false, message: "Product not found." });
      return res.json({ success: true, store: { id: store.id, name: store.name }, product });
    } catch (error) {
      return storefrontError(error, res);
    }
  });

  router.post("/storefront/:siteProjectId/carts", (req, res) => {
    try {
      const store = publicStore(req.params.siteProjectId);
      if (!store) return res.status(404).json({ success: false, message: "Store not found." });
      const cart = runWithWorkspace(store.workspaceId, () => ecommerceService.createCart(store.id, {
        email: req.body?.email || null,
        currency: req.body?.currency || "IRT",
      }));
      return res.status(201).json({ success: true, cart });
    } catch (error) {
      return storefrontError(error, res);
    }
  });

  router.get("/storefront/carts/:cartId", (req, res) => {
    try {
      const cartRow = db.prepare("SELECT id, workspace_id AS workspaceId FROM ecommerce_carts WHERE id=?").get(req.params.cartId);
      if (!cartRow) return res.status(404).json({ success: false, message: "Cart not found." });
      const cart = runWithWorkspace(cartRow.workspaceId, () => ecommerceService.getCart(cartRow.id));
      return res.json({ success: true, cart });
    } catch (error) {
      return storefrontError(error, res);
    }
  });

  router.post("/storefront/carts/:cartId/items", (req, res) => {
    try {
      const cartRow = db.prepare("SELECT id, workspace_id AS workspaceId, site_project_id AS siteProjectId FROM ecommerce_carts WHERE id=?").get(req.params.cartId);
      if (!cartRow) return res.status(404).json({ success: false, message: "Cart not found." });
      const variant = db.prepare(`
        SELECT v.id, p.status, p.site_project_id AS siteProjectId
        FROM ecommerce_variants v
        JOIN ecommerce_products p ON p.id=v.product_id
        WHERE v.id=? AND v.workspace_id=? AND p.workspace_id=?
      `).get(req.body?.variantId, cartRow.workspaceId, cartRow.workspaceId);
      if (!variant || variant.status !== "ACTIVE" || variant.siteProjectId !== cartRow.siteProjectId) {
        return res.status(404).json({ success: false, message: "Product variant not available." });
      }
      const cart = runWithWorkspace(cartRow.workspaceId, () => ecommerceService.addCartItem(cartRow.id, {
        variantId: variant.id,
        quantity: req.body?.quantity || 1,
      }));
      return res.status(201).json({ success: true, cart });
    } catch (error) {
      return storefrontError(error, res);
    }
  });

  router.put("/storefront/carts/:cartId/items/:variantId", (req, res) => {
    try {
      const cartRow = db.prepare("SELECT id, workspace_id AS workspaceId FROM ecommerce_carts WHERE id=?").get(req.params.cartId);
      if (!cartRow) return res.status(404).json({ success: false, message: "Cart not found." });
      const cart = runWithWorkspace(cartRow.workspaceId, () => ecommerceService.setCartItemQuantity(cartRow.id, req.params.variantId, req.body?.quantity));
      return res.json({ success: true, cart });
    } catch (error) {
      return storefrontError(error, res);
    }
  });

  router.post("/send-otp", sendOtpLimiter, (req, res) => {
    try {
      const result = authService.requestOtp(req.body || {});
      const response = {
        success: true,
        message: "کد تأیید ایجاد شد.",
        expiresAt: result.challenge.expiresAt,
      };

      if (nodeEnv !== "production" && exposeDevelopmentOtp) {
        response.developmentOtp = result.code;
      }

      return res.json(response);
    } catch (error) {
      return handleAuthError(error, res);
    }
  });

  router.post("/verify-otp", (req, res) => {
    try {
      const result = authService.verifyOtp(req.body || {});
      res.cookie(
        SESSION_COOKIE_NAME,
        result.sessionToken,
        authService.sessionCookieOptions(nodeEnv)
      );

      return res.json({
        success: true,
        user: result.user,
        memberships: result.memberships,
        activeWorkspace: result.activeWorkspace,
      });
    } catch (error) {
      return handleAuthError(error, res);
    }
  });

  router.get("/me", (req, res) => {
    const identity = authService.resolveSession(getSessionToken(req));

    if (!identity) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    return res.json({
      success: true,
      user: identity.user,
      memberships: identity.memberships,
      activeWorkspace: identity.activeWorkspace,
    });
  });

  router.post("/logout", (req, res) => {
    authService.revokeSession(getSessionToken(req));
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: nodeEnv === "production",
      sameSite: "lax",
      path: "/",
    });
    return res.json({ success: true });
  });

  return router;
}
