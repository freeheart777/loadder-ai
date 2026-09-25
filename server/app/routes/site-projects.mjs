import express from "express";
import { SiteProjectError } from "../services/site-project-service.mjs";
import { SitePatchError } from "../services/site-document-patch-service.mjs";
import { InstructionTranslatorError } from "../services/v16-instruction-translator.mjs";
import { environment } from "../config/environment.mjs";
import { previewSiteUrl, projectPublicUrl } from "../services/public-site-urls.mjs";

export function createSiteProjectsRouter({ service, publicSiteBaseUrl = environment.publicSiteBaseUrl }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof SiteProjectError || error instanceof SitePatchError || error instanceof InstructionTranslatorError) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Site project error:", error);
    const development = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      success: false,
      message: development && error instanceof Error ? error.message : "Unable to process site project.",
      code: "SITE_PROJECT_INTERNAL_ERROR",
      ...(development && error instanceof Error ? { details: error.stack } : {}),
    });
  };
  const optional = (loader, fallback, label) => {
    try { return loader(); }
    catch (error) { console.error(`Site project optional ${label} error:`, error); return fallback; }
  };
  router.get("/site-projects", (req, res) => { try { return res.json({ success: true, projects: service.list() }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects", (req, res) => { try { return res.status(201).json({ success: true, project: service.create(req.body || {}) }); } catch (e) { return handle(e, res); } });
  router.get("/site-projects/:id", (req, res) => {
    try {
      const project = service.get(req.params.id);
      return res.json({
        success: true,
        project,
        // User-facing address of the live site (PUBLIC_SITE_BASE_URL/s/:slug); null until published.
        publicUrl: projectPublicUrl(publicSiteBaseUrl, project),
        assets: optional(() => service.assets(req.params.id), [], "assets"),
        versions: optional(() => service.versions(req.params.id), [], "versions"),
        domains: optional(() => service.domains(req.params.id), [], "domains"),
        // The draft revision the editor is loading, so its first save carries a
        // base revision and cannot silently overwrite newer work.
        draftRevision: optional(() => service.currentDocumentRevision(req.params.id)?.revision ?? null, null, "draftRevision"),
      });
    } catch (e) { return handle(e, res); }
  });
  router.get("/site-projects/:id/versions", (req, res) => { try { return res.json({ success: true, versions: service.versions(req.params.id) }); } catch (e) { return handle(e, res); } });
  router.get("/site-projects/:id/domains", (req, res) => { try { return res.json({ success: true, domains: service.domains(req.params.id) }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects/:id/domains", (req, res) => { try { return res.status(201).json({ success: true, domain: service.addDomain(req.params.id, req.body?.domain) }); } catch (e) { return handle(e, res); } });
  router.delete("/site-projects/:id/domains", (req, res) => { try { return res.json({ success: true, removed: service.removeDomain(req.params.id, req.body?.domain) }); } catch (e) { return handle(e, res); } });
  // A V16 document mutation is TRACKED: it may not change content_json without
  // recording an immutable revision. Metadata-only changes (name, slug, status,
  // context) keep the ordinary update path — they do not alter document truth.
  router.patch("/site-projects/:id", (req, res) => {
    try {
      const body = req.body || {};
      if (body.content === undefined) return res.json({ success: true, project: service.update(req.params.id, body) });
      const result = service.saveDraft(req.params.id, {
        content: body.content,
        idempotencyKey: body.idempotencyKey,
        expectedRevision: body.expectedRevision ?? null,
        actorUserId: req.user?.id || null,
      });
      if (result.conflict) {
        return res.status(409).json({
          success: false,
          code: "SITE_REVISION_CONFLICT",
          message: "این نسخه پیش‌نویس قدیمی است؛ نسخه جدیدتری ذخیره شده است.",
          currentRevision: result.currentRevision,
          project: result.project,
        });
      }
      return res.json({ success: true, project: result.project, revision: result.revision.revision, applied: result.applied, superseded: Boolean(result.superseded) });
    } catch (e) { return handle(e, res); }
  });
  // ---------------------------------------------------------------- documents
  // Revision history is read-only over HTTP: revisions are produced by tracked
  // mutations, never posted directly.
  router.get("/site-projects/:id/document-revisions", (req, res) => {
    try {
      return res.json({
        success: true,
        revisions: service.documentRevisions(req.params.id).map(({ document: _document, ...rest }) => rest),
        current: service.currentDocumentRevision(req.params.id)?.revision ?? null,
      });
    } catch (e) { return handle(e, res); }
  });
  router.get("/site-projects/:id/document-revisions/:revision", (req, res) => {
    try {
      const revision = service.documentRevision(req.params.id, Number(req.params.revision));
      if (!revision) return res.status(404).json({ success: false, code: "SITE_REVISION_NOT_FOUND", message: "Site document revision not found." });
      return res.json({ success: true, revision });
    } catch (e) { return handle(e, res); }
  });
  // Undo: an exact forward restore. Revision N is replayed as a NEW revision;
  // nothing in history is deleted or mutated, and the pointer never moves
  // backward. Idempotent like every other tracked write.
  router.post("/site-projects/:id/document-revisions/:revision/restore", (req, res) => {
    try {
      const result = service.restoreDraftRevision(req.params.id, {
        revision: Number(req.params.revision),
        idempotencyKey: req.body?.idempotencyKey,
        actorUserId: req.user?.id || null,
      });
      return res.json({
        success: true,
        project: result.project,
        revision: result.revision.revision,
        applied: result.applied,
        superseded: Boolean(result.superseded),
        restoredFrom: result.restoredFrom ?? null,
      });
    } catch (e) { return handle(e, res); }
  });

  // Ask Loadder: translate one natural-language instruction, scoped to a
  // single already-selected section, into structured patch operations. Pure
  // and side-effect free — the caller still proposes/previews/applies through
  // the ordinary patch pipeline below, so an AI-authored patch gets exactly
  // the same policy and revision guarantees as any other.
  router.post("/site-projects/:id/ask-loadder/translate", (req, res) => {
    try {
      const result = service.translateAskLoadderInstruction(req.params.id, {
        target: req.body?.target,
        instruction: req.body?.instruction,
      });
      return res.json({ success: true, operations: result.operations, matches: result.matches, warnings: result.warnings });
    } catch (e) { return handle(e, res); }
  });

  // A structured patch is proposed, previewed and applied as three separate
  // steps. Only the last one mutates the draft.
  router.get("/site-projects/:id/document-patches", (req, res) => {
    try { return res.json({ success: true, patches: service.documentPatches(req.params.id) }); } catch (e) { return handle(e, res); }
  });
  router.post("/site-projects/:id/document-patches", (req, res) => {
    try {
      const result = service.proposePatch(req.params.id, {
        operations: req.body?.operations,
        idempotencyKey: req.body?.idempotencyKey,
        actorUserId: req.user?.id || null,
      });
      return res.status(result.created ? 201 : 200).json({ success: true, patch: result.patch, created: result.created });
    } catch (e) { return handle(e, res); }
  });
  router.post("/site-projects/:id/document-patches/:patchId/preview", (req, res) => {
    try {
      const result = service.previewPatch(req.params.id, req.params.patchId);
      return res.json({ success: true, proposed: result.proposed, proposedHash: result.proposedHash, results: result.results, accepted: result.accepted, patch: result.patch });
    } catch (e) { return handle(e, res); }
  });
  router.post("/site-projects/:id/document-patches/:patchId/apply", (req, res) => {
    try {
      const result = service.applyPatch(req.params.id, { patchId: req.params.patchId });
      if (result.conflict) {
        return res.status(409).json({
          success: false,
          code: "SITE_REVISION_CONFLICT",
          message: "این پچ بر پایه نسخه قدیمی ساخته شده است؛ نسخه جدیدتری ذخیره شده است.",
          currentRevision: result.currentRevision,
          patch: result.patch,
        });
      }
      return res.json({
        success: true,
        project: result.project,
        patch: result.patch,
        revision: result.revision ? result.revision.revision : null,
        applied: result.applied,
        superseded: Boolean(result.superseded),
        rejected: Boolean(result.rejected),
        results: result.results ?? result.patch.validation,
      });
    } catch (e) { return handle(e, res); }
  });
  router.post("/site-projects/:id/preview-token", (req, res) => { try { const token = service.createPreviewToken(req.params.id); return res.status(201).json({ success: true, previewUrl: previewSiteUrl(publicSiteBaseUrl, req.params.id, token) }); } catch (e) { return handle(e, res); } });
  router.delete("/site-projects/:id/preview-token", (req, res) => { try { return res.json({ success: true, revoked: service.revokePreviewToken(req.params.id) }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects/:id/publish", (req, res) => { try { const project = service.publish(req.params.id); return res.json({ success: true, project, publicUrl: projectPublicUrl(publicSiteBaseUrl, project) }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects/:id/publish-rollback", (req, res) => { try { return res.json({ success: true, ...service.rollbackPublishVersion(req.params.id, req.body?.targetVersionId) }); } catch (e) { return handle(e, res); } });
  router.delete("/site-projects/:id", (req, res) => { try { service.remove(req.params.id); return res.json({ success: true }); } catch (e) { return handle(e, res); } });
  router.post("/site-projects/:id/assets", (req, res) => { try { return res.status(201).json({ success: true, asset: service.addAsset(req.params.id, req.body || {}) }); } catch (e) { return handle(e, res); } });
  router.delete("/site-projects/:id/assets/:assetId", (req, res) => { try { service.removeAsset(req.params.id, req.params.assetId); return res.json({ success: true }); } catch (e) { return handle(e, res); } });
  return router;
}
