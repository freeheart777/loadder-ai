import express from "express";

import { BrandBookError } from "../services/brand-book-service.mjs";

export function createBrandBookRouter({ brandBookService }) {
  const router = express.Router();
  function handle(error, res) {
    if (error instanceof BrandBookError) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Brand Book error:", error);
    return res.status(500).json({ success: false, message: "Unable to process Brand Book." });
  }
  router.get("/", (req, res) => {
    try { return res.json({ success: true, ...brandBookService.getCurrent() }); }
    catch (error) { return handle(error, res); }
  });
  router.get("/versions", (req, res) => {
    try { return res.json({ success: true, versions: brandBookService.listVersions() }); }
    catch (error) { return handle(error, res); }
  });
  router.post("/versions", (req, res) => {
    try { return res.status(201).json({ success: true, version: brandBookService.createDraft(req.body, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  router.patch("/versions/:id", (req, res) => {
    try { return res.json({ success: true, version: brandBookService.updateDraft(req.params.id, req.body, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  router.post("/versions/:id/activate", (req, res) => {
    try { return res.json({ success: true, version: brandBookService.activateVersion(req.params.id, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  router.post("/versions/:id/archive", (req, res) => {
    try { return res.json({ success: true, version: brandBookService.archiveDraft(req.params.id, req.user.id) }); }
    catch (error) { return handle(error, res); }
  });
  return router;
}
