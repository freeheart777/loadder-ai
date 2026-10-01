import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { runWithWorkspace } from "../tenant-context.mjs";
import { LoadderAppUserAuth } from "../business-builder/app-user-auth.mjs";
import { SiteProjectError } from "../services/site-project-service.mjs";
import { SiteMediaError } from "../services/site-media-service.mjs";
import { SiteMediaStorageError } from "../services/site-media-storage-adapter.mjs";
import { LearningAccessError } from "../services/learning-access-service.mjs";

const limited = (limit) => rateLimit({
  windowMs: 60_000, limit, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "unknown")}:${String(req.params.projectId || "unknown").slice(0, 128)}`,
  handler: (_req, res) => res.status(429).json({ success: false, code: "PUBLIC_EDUCATION_RATE_LIMITED" }),
});

const INLINE_TYPES = new Set(["audio", "video"]);

// Student Portal reads. Authenticated by the existing app-user session token
// (X-Loadder-App-Token); authorized by an active enrolment. Never accepts a
// storage key and never returns one.
export function createPublicEducationRouter({ db, accessService }) {
  const router = express.Router();
  const auth = new LoadderAppUserAuth(db);
  const locate = (projectId) => db.prepare("SELECT id,workspace_id AS workspaceId FROM business_builder_projects WHERE id=? AND status='ready'").get(projectId) || null;
  const fail = (res, error) => {
    if (error instanceof SiteProjectError || error instanceof SiteMediaError || error instanceof SiteMediaStorageError || error instanceof LearningAccessError) {
      return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
    }
    console.error("Public education error:", error);
    return res.status(500).json({ success: false, code: "PUBLIC_EDUCATION_ERROR" });
  };
  const withStudent = (req, res, fn) => {
    const project = locate(req.params.projectId);
    if (!project) return Promise.resolve(res.status(404).json({ success: false, code: "PUBLIC_APP_NOT_FOUND" }));
    return runWithWorkspace(project.workspaceId, async () => {
      const token = String(req.get("X-Loadder-App-Token") || "").trim();
      const principal = token ? auth.resolve(token, project.id) : null;
      if (!principal) return res.status(401).json({ success: false, code: "EDUCATION_AUTH_REQUIRED" });
      try { return await fn(principal); } catch (error) { return fail(res, error); }
    });
  };
  const base = "/public/apps/:projectId/education/sites/:siteProjectId";

  router.get(`${base}/resources`, limited(120), (req, res) => withStudent(req, res, (principal) =>
    res.json({ success: true, resources: accessService.listResourcesFor(req.params.siteProjectId, principal) })));

  router.get(`${base}/resources/:mediaId/file`, limited(60), (req, res) => withStudent(req, res, async (principal) => {
    const { asset, object } = await accessService.readResourceFor(req.params.siteProjectId, req.params.mediaId, principal);
    const inline = req.query.disposition === "inline" && INLINE_TYPES.has(asset.assetType);
    res.type(asset.mimeType || object.mimeType || "application/octet-stream");
    res.set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.metadata?.name || object.fileName || "resource")}`,
    });
    return res.send(object.body);
  }));
  return router;
}
