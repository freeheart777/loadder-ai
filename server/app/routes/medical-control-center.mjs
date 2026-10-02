import express from "express";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { isWorkspaceOperator } from "../workspace-authorization.mjs";
import { MedicalControlCenterError } from "../services/medical-control-center-service.mjs";

// Owner/admin only: the clinic's own backstage over canonical data.
export function createMedicalControlCenterRouter({ service, db }) {
  const router = express.Router();
  const operatorOnly = (req, res, next) => isWorkspaceOperator(db, requireWorkspaceId(), req.user?.id)
    ? next()
    : res.status(403).json({ success: false, code: "MEDICAL_OPERATOR_REQUIRED", message: "Workspace owner or admin access is required." });
  const run = (fn) => (req, res) => {
    try { return res.json({ success: true, ...fn(req) }); }
    catch (error) {
      if (error instanceof MedicalControlCenterError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      throw error;
    }
  };
  router.use("/site-projects/:id/medical", operatorOnly);
  router.get("/site-projects/:id/medical/summary", run((req) => ({ summary: service.summary(req.params.id) })));
  router.get("/site-projects/:id/medical/patients", run((req) => ({ patients: service.listPatients(req.params.id, { operatorId: req.user?.id || null }) })));
  router.get("/site-projects/:id/medical/settings", run((req) => ({ settings: service.settings(req.params.id) })));
  return router;
}
