import express from "express";
import { acquisitionProviderRegistry } from "../integrations/acquisition-provider-registry.mjs";
import { db } from "../../db/workspace-database.mjs";
import { createGoogleAdsDraftRepository } from "../repositories/google-ads-draft-repository.mjs";
import { createGoogleAdsDraftService, GoogleAdsDraftError } from "../services/google-ads-draft-service.mjs";

const googleAdsDrafts = createGoogleAdsDraftService({ repository: createGoogleAdsDraftRepository(db) });

export function createAcquisitionProviderRouter() {
  const router = express.Router();
  const handle = (error, res) => error instanceof GoogleAdsDraftError
    ? res.status(error.status).json({ success: false, code: error.code, message: error.message, details: error.details })
    : res.status(500).json({ success: false, code: "ACQUISITION_PROVIDER_ERROR", message: "Acquisition provider operation failed." });

  router.get("/acquisition-providers", (req, res) => {
    const providers = acquisitionProviderRegistry.list({
      region: typeof req.query.region === "string" ? req.query.region : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
    });
    return res.json({ success: true, providers });
  });

  router.get("/acquisition-providers/:providerId", (req, res) => {
    const provider = acquisitionProviderRegistry.get(req.params.providerId, Number(req.query.version || 1));
    if (!provider) return res.status(404).json({ success: false, code: "ACQUISITION_PROVIDER_NOT_FOUND", message: "Acquisition provider not found." });
    return res.json({ success: true, provider });
  });

  router.get("/google-ads/search-drafts", (req, res) => {
    try { return res.json({ success: true, drafts: googleAdsDrafts.list() }); } catch (error) { return handle(error, res); }
  });
  router.post("/google-ads/search-drafts", (req, res) => {
    try { return res.status(201).json({ success: true, draft: googleAdsDrafts.create(req.body || {}) }); } catch (error) { return handle(error, res); }
  });
  router.get("/google-ads/search-drafts/:id", (req, res) => {
    try { return res.json({ success: true, draft: googleAdsDrafts.get(req.params.id) }); } catch (error) { return handle(error, res); }
  });
  router.put("/google-ads/search-drafts/:id", (req, res) => {
    try { return res.json({ success: true, draft: googleAdsDrafts.update(req.params.id, req.body || {}) }); } catch (error) { return handle(error, res); }
  });
  router.post("/google-ads/search-drafts/:id/validate", (req, res) => {
    try { return res.json({ success: true, draft: googleAdsDrafts.validate(req.params.id) }); } catch (error) { return handle(error, res); }
  });
  router.post("/google-ads/search-drafts/:id/prepare", (req, res) => {
    try { return res.json({ success: true, ...googleAdsDrafts.prepareForGoogle(req.params.id) }); } catch (error) { return handle(error, res); }
  });
  router.delete("/google-ads/search-drafts/:id", (req, res) => {
    try { googleAdsDrafts.remove(req.params.id); return res.json({ success: true }); } catch (error) { return handle(error, res); }
  });

  return router;
}
