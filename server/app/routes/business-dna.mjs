import express from "express";

import { BusinessDnaError } from "../services/business-dna-service.mjs";

export function createBusinessDnaRouter({ businessDnaService }) {
  const router = express.Router();

  function handleError(error, res) {
    if (error instanceof BusinessDnaError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    console.error("Business DNA error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process Business DNA.",
    });
  }

  router.get("/", (req, res) => {
    try {
      return res.json({ success: true, ...businessDnaService.getCurrent() });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.get("/versions", (req, res) => {
    try {
      return res.json({ success: true, versions: businessDnaService.listVersions() });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.post("/versions", (req, res) => {
    try {
      const version = businessDnaService.createDraft(req.body, req.user.id);
      return res.status(201).json({ success: true, version });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.patch("/versions/:id", (req, res) => {
    try {
      const version = businessDnaService.updateDraft(req.params.id, req.body, req.user.id);
      return res.json({ success: true, version });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.post("/versions/:id/activate", (req, res) => {
    try {
      const version = businessDnaService.activateVersion(req.params.id, req.user.id);
      return res.json({ success: true, version });
    } catch (error) {
      return handleError(error, res);
    }
  });

  router.post("/versions/:id/archive", (req, res) => {
    try {
      const version = businessDnaService.archiveDraft(req.params.id, req.user.id);
      return res.json({ success: true, version });
    } catch (error) {
      return handleError(error, res);
    }
  });

  return router;
}
