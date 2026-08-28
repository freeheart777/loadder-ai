import express from "express";
import { SiteProjectError } from "../services/site-project-service.mjs";

export function createSiteProjectsRouter({ service }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof SiteProjectError) return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    console.error("Site project error:", error);
    return res.status(500).json({ success: false, message: "Unable to process site project." });
  };
  router.get("/site-projects", (req, res) => { try { return res.json({ success: true, projects: service.list() }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects", (req, res) => { try { return res.status(201).json({ success: true, project: service.create(req.body || {}) }); } catch (e) { return handle(e, res); } });
  router.get("/site-projects/:id", (req, res) => { try { return res.json({ success: true, project: service.get(req.params.id), assets: service.assets(req.params.id) }); } catch (e) { return handle(e, res); } });
  router.patch("/site-projects/:id", (req, res) => { try { return res.json({ success: true, project: service.update(req.params.id, req.body || {}) }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects/:id/publish", (req, res) => { try { return res.json({ success: true, project: service.publish(req.params.id) }); } catch (e) { return handle(e, res); } });
  router.delete("/site-projects/:id", (req, res) => { try { service.remove(req.params.id); return res.json({ success: true }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects/:id/assets", (req, res) => { try { return res.status(201).json({ success: true, asset: service.addAsset(req.params.id, req.body || {}) }); } catch (e) { return handle(e, res); } });
  router.delete("/site-projects/:id/assets/:assetId", (req, res) => { try { service.removeAsset(req.params.assetId); return res.json({ success: true }); } catch (e) { return handle(e, res); } });
  return router;
}
