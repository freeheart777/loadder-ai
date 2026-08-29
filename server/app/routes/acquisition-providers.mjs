import express from "express";
import { acquisitionProviderRegistry } from "../integrations/acquisition-provider-registry.mjs";
import { db } from "../../db/workspace-database.mjs";
import { createGoogleAdsDraftRepository } from "../repositories/google-ads-draft-repository.mjs";
import { createGoogleAdsConnectionRepository } from "../repositories/google-ads-connection-repository.mjs";
import { createGoogleAdsDraftService, GoogleAdsDraftError } from "../services/google-ads-draft-service.mjs";
import { createGoogleAdsOauthService, GoogleAdsOauthError } from "../services/google-ads-oauth-service.mjs";

const googleAdsDrafts = createGoogleAdsDraftService({ repository: createGoogleAdsDraftRepository(db) });
const googleAdsOauth = createGoogleAdsOauthService({ repository: createGoogleAdsConnectionRepository(db) });

export function createAcquisitionProviderRouter() {
  const router = express.Router();
  const handle = (error, res) => error instanceof GoogleAdsDraftError || error instanceof GoogleAdsOauthError
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

  router.get("/google-ads/oauth/status", (req, res) => {
    try { return res.json({ success: true, ...googleAdsOauth.status() }); } catch (error) { return handle(error, res); }
  });
  router.post("/google-ads/oauth/start", (req, res) => {
    try { return res.json({ success: true, ...googleAdsOauth.start(req.user.id) }); } catch (error) { return handle(error, res); }
  });
  router.get("/google-ads/oauth/callback", async (req, res) => {
    try {
      await googleAdsOauth.callback({ state: req.query.state, code: req.query.code }, req.user.id);
      return res.redirect("/dashboard/ads/google?googleAds=connected");
    } catch (error) { return handle(error, res); }
  });
  router.get("/google-ads/accounts", (req, res) => {
    try { return res.json({ success: true, accounts: googleAdsOauth.accounts(), connection: googleAdsOauth.status().connection }); } catch (error) { return handle(error, res); }
  });
  router.post("/google-ads/accounts/select", (req, res) => {
    try { return res.json({ success: true, connection: googleAdsOauth.selectAccount(req.body || {}) }); } catch (error) { return handle(error, res); }
  });
  router.delete("/google-ads/oauth/connection", (req, res) => {
    try { googleAdsOauth.disconnect(); return res.json({ success: true }); } catch (error) { return handle(error, res); }
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
