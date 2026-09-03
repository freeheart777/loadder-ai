import express from "express";
import { loadderBusinessBuilderService } from "../business-builder/business-builder-service.mjs";

export function createBusinessBuilderRouter({ service = loadderBusinessBuilderService } = {}) {
  const router = express.Router();

  router.post("/business-builder/preview", (req, res) => {
    try {
      const intent = String(req.body?.intent || "").trim();
      if (!intent) return res.status(400).json({ success: false, code: "BUSINESS_INTENT_REQUIRED", message: "Business intent is required." });
      const preview = service.preview({
        intent,
        name: typeof req.body?.name === "string" ? req.body.name : undefined,
        locale: typeof req.body?.locale === "string" ? req.body.locale : "fa-IR",
      });
      return res.status(201).json({ success: true, preview });
    } catch (error) {
      console.error("Business Builder preview error:", error);
      return res.status(400).json({ success: false, code: error?.code || "BUSINESS_BUILDER_PREVIEW_FAILED", message: error instanceof Error ? error.message : "Business Builder preview failed." });
    }
  });

  return router;
}

export default createBusinessBuilderRouter();
