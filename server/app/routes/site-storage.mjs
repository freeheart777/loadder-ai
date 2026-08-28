import express from "express";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { SiteProjectError } from "../services/site-project-service.mjs";
import { SiteStorageError } from "../storage/supabase-storage-service.mjs";

export function createSiteStorageRouter({ storage, siteService }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof SiteStorageError || error instanceof SiteProjectError) return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
    console.error("Site storage error:", error);
    return res.status(500).json({ success: false, message: "Unable to process site asset storage." });
  };

  router.post("/site-projects/:id/assets/upload-url", async (req, res) => {
    try {
      const project = siteService.get(req.params.id);
      const workspaceId = requireWorkspaceId();
      const body = req.body || {};
      const upload = await storage.createUploadUrl({ workspaceId, siteProjectId: project.id, filename: body.filename, contentType: body.contentType, expiresIn: body.expiresIn, upsert: false });
      return res.status(201).json({ success: true, upload });
    } catch (error) { return handle(error, res); }
  });

  router.post("/site-projects/:id/assets/download-url", async (req, res) => {
    try {
      const project = siteService.get(req.params.id);
      const body = req.body || {};
      const path = String(body.path || "").trim();
      if (!path.startsWith(`${requireWorkspaceId()}/${project.id}/`)) throw new SiteStorageError("Asset path is outside this site project.", 403, "SITE_STORAGE_PATH_FORBIDDEN");
      const download = await storage.createDownloadUrl({ path, expiresIn: body.expiresIn });
      return res.json({ success: true, download });
    } catch (error) { return handle(error, res); }
  });

  return router;
}
