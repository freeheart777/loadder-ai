import express from "express";

import { BusinessProfileError } from "../services/business-profile-service.mjs";

export function createBusinessProfileRouter({ businessProfileService }) {
  const router = express.Router();

  function handleError(error, res) {
    if (error instanceof BusinessProfileError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    console.error("Business profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process business profile.",
    });
  }

  router.get("/", (req, res) => {
    try {
      return res.json({
        success: true,
        profile: businessProfileService.getBusinessProfile(),
      });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.post("/", (req, res) => {
    try {
      const profile = businessProfileService.createBusinessProfile(
        req.body,
        req.user.id
      );
      return res.status(201).json({ success: true, profile });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.patch("/", (req, res) => {
    try {
      const profile = businessProfileService.updateBusinessProfile(
        req.body,
        req.user.id
      );
      return res.json({ success: true, profile });
    } catch (error) {
      return handleError(error, res);
    }
  });

  return router;
}
