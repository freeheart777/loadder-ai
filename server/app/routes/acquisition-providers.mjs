import express from "express";
import { acquisitionProviderRegistry } from "../integrations/acquisition-provider-registry.mjs";

export function createAcquisitionProviderRouter() {
  const router = express.Router();

  router.get("/acquisition-providers", (req, res) => {
    const providers = acquisitionProviderRegistry.list({
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
    });
    return res.json({ success: true, providers });
  });

  router.get("/acquisition-providers/:providerId", (req, res) => {
    const provider = acquisitionProviderRegistry.get(
      req.params.providerId,
      Number(req.query.version || 1)
    );
    if (!provider) {
      return res.status(404).json({
        success: false,
        code: "ACQUISITION_PROVIDER_NOT_FOUND",
        message: "Acquisition provider not found.",
      });
    }
    return res.json({ success: true, provider });
  });

  return router;
}
