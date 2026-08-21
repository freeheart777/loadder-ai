import express from "express";

import { BusinessContextError } from "../services/business-context-service.mjs";

export function createBusinessContextRouter({ businessContextService }) {
  const router = express.Router();
  function handle(error, res) {
    if (error instanceof BusinessContextError) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Business Context error:", error);
    return res.status(500).json({ success: false, message: "Unable to process Business Context." });
  }
  router.get("/", (req, res) => {
    try { return res.json({ success: true, ...businessContextService.getCurrent() }); }
    catch (error) { return handle(error, res); }
  });
  router.get("/versions", (req, res) => {
    try { return res.json({ success: true, versions: businessContextService.listVersions() }); }
    catch (error) { return handle(error, res); }
  });
  router.post("/versions", (req, res) => {
    try { return res.status(201).json({ success: true, version: businessContextService.createDraft(req.body || {}, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  router.post("/versions/:id/activate", (req, res) => {
    try { return res.json({ success: true, version: businessContextService.activateVersion(req.params.id, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  router.post("/versions/:id/archive", (req, res) => {
    try { return res.json({ success: true, version: businessContextService.archiveDraft(req.params.id, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  return router;
}
