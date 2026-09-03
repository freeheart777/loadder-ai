import express from "express";
import { db } from "../../db/workspace-database.mjs";
import { loadderBusinessBuilderService } from "../business-builder/business-builder-service.mjs";
import { createContractPreviewAdapter } from "../business-builder/contract-preview-adapter.mjs";
import { createBusinessBuilderProjectService } from "../business-builder/project-service.mjs";
import { createBusinessBuilderRepository } from "../repositories/business-builder-repository.mjs";

export function createBusinessBuilderRouter({ service = loadderBusinessBuilderService, projects = null, previewAdapter = null } = {}) {
  const router = express.Router();

  router.post("/business-builder/preview", (req, res) => {
    try {
      const intent = String(req.body?.intent || "").trim();
      if (!intent) return res.status(400).json({ success: false, code: "BUSINESS_INTENT_REQUIRED", message: "Business intent is required." });
      const preview = service.preview({ intent, name: typeof req.body?.name === "string" ? req.body.name : undefined, locale: typeof req.body?.locale === "string" ? req.body.locale : "fa-IR" });
      return res.status(201).json({ success: true, preview });
    } catch (error) {
      return res.status(400).json({ success: false, code: error?.code || "BUSINESS_BUILDER_PREVIEW_FAILED", message: error instanceof Error ? error.message : "Business Builder preview failed." });
    }
  });

  if (!projects) return router;

  router.get("/business-builder/projects", (req, res) => res.json({ success: true, projects: projects.listProjects() }));
  router.get("/business-builder/projects/:id", (req, res) => {
    const project = projects.getProject(req.params.id);
    return project ? res.json({ success: true, project }) : res.status(404).json({ success: false, code: "PROJECT_NOT_FOUND" });
  });
  router.post("/business-builder/projects", (req, res) => {
    try {
      const intent = String(req.body?.intent || "").trim();
      if (!intent) return res.status(400).json({ success: false, code: "BUSINESS_INTENT_REQUIRED" });
      return res.status(201).json({ success: true, ...projects.createProject({ intent, name: req.body?.name, locale: req.body?.locale || "fa-IR" }, req.user?.id || null) });
    } catch (error) { return res.status(400).json({ success: false, code: error?.code || "PROJECT_CREATE_FAILED", message: error?.message }); }
  });
  router.put("/business-builder/projects/:id", (req, res) => {
    try {
      const result = projects.saveProject(req.params.id, req.body || {}, req.user?.id || null);
      return result ? res.json({ success: true, ...result }) : res.status(404).json({ success: false, code: "PROJECT_NOT_FOUND" });
    } catch (error) { return res.status(400).json({ success: false, code: error?.code || "PROJECT_SAVE_FAILED", message: error?.message }); }
  });
  router.post("/business-builder/projects/:id/versions/:versionId/restore", (req, res) => {
    const result = projects.restoreVersion(req.params.id, req.params.versionId, req.user?.id || null);
    return result ? res.status(201).json({ success: true, ...result }) : res.status(404).json({ success: false, code: "VERSION_NOT_FOUND" });
  });
  router.post("/business-builder/projects/:id/preview-sessions", async (req, res) => {
    try {
      const result = await projects.startPreview(req.params.id);
      return result ? res.status(201).json({ success: true, ...result }) : res.status(404).json({ success: false, code: "ACTIVE_VERSION_NOT_FOUND" });
    } catch (error) { return res.status(409).json({ success: false, code: error?.code || "PREVIEW_START_FAILED", message: error?.message }); }
  });
  router.get("/business-builder/projects/:id/preview/document", (req, res) => {
    const project = projects.getProject(req.params.id);
    if (!project?.activeVersionId || !previewAdapter) return res.status(404).send("Preview not available");
    const version = project.versions.find((item) => item.id === project.activeVersionId);
    if (!version) return res.status(404).send("Preview version not found");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; frame-ancestors 'self'");
    return res.send(previewAdapter.render({ version }));
  });
  router.post("/business-builder/projects/:id/approvals", (req, res) => {
    const stage = req.body?.stage, decision = req.body?.decision, versionId = req.body?.versionId;
    if (!["preview","production"].includes(stage) || !["approved","rejected"].includes(decision) || !versionId) return res.status(400).json({ success: false, code: "INVALID_APPROVAL" });
    const approval = projects.decide({ projectId: req.params.id, versionId, stage, decision, actorId: req.user?.id || null, note: req.body?.note || null });
    return res.status(201).json({ success: true, approval, productionDeploymentAllowed: projects.canDeployProduction(req.params.id) });
  });

  return router;
}

const defaultPreviewAdapter = createContractPreviewAdapter();
const defaultRepository = createBusinessBuilderRepository(db);
const defaultProjectService = createBusinessBuilderProjectService({ repository: defaultRepository, builder: loadderBusinessBuilderService, previewAdapter: defaultPreviewAdapter });
export default createBusinessBuilderRouter({ projects: defaultProjectService, previewAdapter: defaultPreviewAdapter });
