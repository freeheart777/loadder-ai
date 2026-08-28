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

export function createAuthRouter({
  authService,
  nodeEnv = "development",
  exposeDevelopmentOtp = false,
}) {
  const router = express.Router();
  const publicSiteRepository = createSiteProjectRepository(db);
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

  router.get("/sites/:id", (req, res) => {
    const published = publicSiteRepository.getPublished(req.params.id);
    if (!published) return res.status(404).send("Site not found");
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.type("html").send(renderPublishedSite(published.project, published.assets));
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
