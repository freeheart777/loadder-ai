import express from "express";
import { SiteProjectError } from "../services/site-project-service.mjs";
import { SiteMediaError } from "../services/site-media-service.mjs";
import { SiteMediaStorageError } from "../services/site-media-storage-adapter.mjs";

export function createSiteMediaRouter({ service }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof SiteProjectError || error instanceof SiteMediaError || error instanceof SiteMediaStorageError) {
      return res.status(error.status || 400).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Site media error:", error);
    return res.status(500).json({ success: false, message: "Unable to process site media." });
  };

  router.get("/site-projects/:id/media", (req, res) => {
    try { return res.json({ success: true, media: service.list(req.params.id) }); }
    catch (error) { return handle(error, res); }
  });

  router.post("/site-projects/:id/media/upload-url", async (req, res) => {
    try {
      const upload = await service.createUpload(req.params.id, req.body || {});
      return res.status(201).json({ success: true, upload });
    } catch (error) { return handle(error, res); }
  });

  router.post("/site-projects/:id/media/complete", (req, res) => {
    try {
      const media = service.completeUpload(req.params.id, req.body || {});
      return res.status(201).json({ success: true, media });
    } catch (error) { return handle(error, res); }
  });

  router.delete("/site-projects/:id/media/:mediaId", (req, res) => {
    try { service.remove(req.params.id, req.params.mediaId); return res.json({ success: true }); }
    catch (error) { return handle(error, res); }
  });

  return router;
}
