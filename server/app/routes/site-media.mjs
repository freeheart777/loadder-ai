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

  const acceptUpload = async (req, res) => {
    try {
      const uploaded = await service.acceptLocalUpload(req.params.token, req.body);
      return res.status(201).json({ success: true, uploaded });
    } catch (error) { return handle(error, res); }
  };

  // Canonical same-origin upload endpoint. The legacy local route remains as a
  // compatibility alias while clients migrate; both execute the exact same path.
  router.put("/site-media-upload/:token", express.raw({ type: () => true, limit: "25mb" }), acceptUpload);
  router.put("/site-media-local/upload/:token", express.raw({ type: () => true, limit: "25mb" }), acceptUpload);

  router.get("/site-media-local/object/:key", async (req, res) => {
    try {
      const asset = await service.readLocalAsset(req.params.key);
      res.type(asset.fileName);
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(asset.body);
    } catch (error) { return handle(error, res); }
  });

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
