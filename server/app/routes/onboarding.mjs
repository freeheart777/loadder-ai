import express from "express";

import { OnboardingError } from "../services/onboarding-service.mjs";

export function createOnboardingRouter({ onboardingService }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof OnboardingError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    return res.status(500).json({
      success: false,
      code: "ONBOARDING_FINALIZATION_FAILED",
      message: "Unable to process onboarding.",
    });
  };
  router.get("/status", (_req, res) => {
    try { return res.json({ success: true, onboarding: onboardingService.status() }); }
    catch (error) { return handle(error, res); }
  });
  router.post("/finalize", (req, res) => {
    try { return res.json({ success: true, ...onboardingService.finalize(req.body, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  return router;
}
