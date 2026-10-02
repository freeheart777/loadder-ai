import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireWorkspaceId, runWithWorkspace } from "../tenant-context.mjs";
import { isWorkspaceOperator } from "../workspace-authorization.mjs";
import { DocumentValidationError, MAX_DOCUMENT_BYTES } from "../services/medical-document-policy.mjs";
import { MedicalDocumentError } from "../services/medical-document-service.mjs";
import { MedicalStorageError } from "../services/medical-document-storage.mjs";

const limited = (limit) => rateLimit({
  windowMs: 60_000, limit, standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "unknown")}:${String(req.params.siteProjectId || req.params.id || "unknown").slice(0, 80)}`,
  handler: (_req, res) => res.status(429).json({ success: false, code: "MEDICAL_DOCUMENT_RATE_LIMITED" }),
});
const tokenOf = (req) => String(req.get("X-Loadder-App-Token") || "").trim();
const decode = (value) => { try { return decodeURIComponent(String(value ?? "")); } catch { return ""; } };

// Sensitive bytes are never cacheable, never sniffable, never renderable inline.
function sendFile(res, { body, mimeType, fileName }) {
  res.set({
    "Content-Type": mimeType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  });
  return res.send(body);
}

function failure(res, error) {
  if (error instanceof MedicalDocumentError || error instanceof DocumentValidationError || error instanceof MedicalStorageError) {
    return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
  }
  console.error("Medical document error:", error);
  return res.status(500).json({ success: false, code: "MEDICAL_DOCUMENT_ERROR" });
}

// Patient and doctor document access, always through a signed-in site session.
export function createMedicalDocumentRouter({ service, identity, siteLookup }) {
  const router = express.Router();
  const guarded = (audience, handler) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    const site = siteLookup(req.params.siteProjectId);
    if (!site) return res.status(404).json({ success: false, code: "SITE_NOT_FOUND" });
    try {
      return await runWithWorkspace(site.workspaceId, async () => {
        const principal = audience === "doctor" ? identity.resolveDoctor(req.params.siteProjectId, tokenOf(req)) : identity.resolve(req.params.siteProjectId, tokenOf(req));
        if (!principal) return res.status(401).json({ success: false, code: audience === "doctor" ? "DOCTOR_AUTH_REQUIRED" : "PATIENT_AUTH_REQUIRED" });
        return await handler(req, res, principal);
      });
    } catch (error) { return failure(res, error); }
  };
  const patient = "/site/:siteProjectId/patient", doctor = "/site/:siteProjectId/doctor";

  router.post(`${patient}/appointments/:appointmentId/documents`, limited(30), express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES + 1024 }), guarded("patient", async (req, res, principal) => {
    const created = await service.upload({ siteProjectId: req.params.siteProjectId, patient: principal, appointmentId: req.params.appointmentId, title: decode(req.get("X-Document-Title")), fileName: decode(req.get("X-Document-Filename")), mimeType: req.get("Content-Type"), body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0) });
    return res.status(201).json({ success: true, document: created });
  }));
  router.get(`${patient}/appointments/:appointmentId/documents`, limited(120), guarded("patient", (req, res, principal) => res.json({ success: true, documents: service.listForPatient({ siteProjectId: req.params.siteProjectId, patient: principal, appointmentId: req.params.appointmentId }) })));
  router.get(`${patient}/documents/:documentId/file`, limited(60), guarded("patient", async (req, res, principal) => sendFile(res, await service.readForPatient({ siteProjectId: req.params.siteProjectId, patient: principal, documentId: req.params.documentId }))));
  router.delete(`${patient}/documents/:documentId`, limited(30), guarded("patient", async (req, res, principal) => res.json({ success: true, document: await service.deleteForPatient({ siteProjectId: req.params.siteProjectId, patient: principal, documentId: req.params.documentId }) })));

  router.get(`${doctor}/appointments/:appointmentId/documents`, limited(120), guarded("doctor", (req, res, principal) => res.json({ success: true, documents: service.listForDoctor({ siteProjectId: req.params.siteProjectId, doctor: principal, appointmentId: req.params.appointmentId }) })));
  router.get(`${doctor}/documents/:documentId/file`, limited(60), guarded("doctor", async (req, res, principal) => sendFile(res, await service.readForDoctor({ siteProjectId: req.params.siteProjectId, doctor: principal, documentId: req.params.documentId }))));

  // Oversized or malformed uploads answer in JSON, never with a stack trace.
  router.use((error, _req, res, next) => {
    if (error?.type === "entity.too.large") return res.status(413).json({ success: false, code: "MEDICAL_DOCUMENT_TOO_LARGE", message: "The file is too large." });
    return next(error);
  });
  return router;
}

// Operators never browse patient files: they see metadata, and opening a file needs a recorded reason.
export function createMedicalDocumentAdminRouter({ service, db }) {
  const router = express.Router();
  const operatorOnly = (req, res, next) => isWorkspaceOperator(db, requireWorkspaceId(), req.user?.id)
    ? next()
    : res.status(403).json({ success: false, code: "MEDICAL_DOCUMENT_OPERATOR_REQUIRED", message: "Workspace owner or admin access is required." });
  router.use("/site-projects/:id/medical-documents", operatorOnly);
  router.get("/site-projects/:id/medical-documents", (req, res) => {
    try { return res.json({ success: true, documents: service.listForOperator({ siteProjectId: req.params.id, operatorId: req.user?.id || null }) }); } catch (error) { return failure(res, error); }
  });
  router.post("/site-projects/:id/medical-documents/:documentId/access", express.json({ limit: "4kb" }), async (req, res) => {
    try { return sendFile(res, await service.readForOperator({ siteProjectId: req.params.id, documentId: req.params.documentId, operatorId: req.user?.id || null, reason: req.body?.reason })); } catch (error) { return failure(res, error); }
  });
  return router;
}
