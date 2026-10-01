import express from "express";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { isWorkspaceOperator } from "../workspace-authorization.mjs";
import { SiteProjectError } from "../services/site-project-service.mjs";
import { LearningAccessError } from "../services/learning-access-service.mjs";

// Operator-side enrolment management. Only active owner/admin members may
// grant or revoke student access; plain workspace members cannot.
export function createLearningEnrollmentsRouter({ service, db }) {
  const router = express.Router();
  const handle = (error, res) => {
    if (error instanceof SiteProjectError || error instanceof LearningAccessError) return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
    console.error("Learning enrolment error:", error);
    return res.status(500).json({ success: false, message: "Unable to process learning enrolment." });
  };
  const operatorOnly = (req, res, next) => isWorkspaceOperator(db, requireWorkspaceId(), req.user?.id)
    ? next()
    : res.status(403).json({ success: false, code: "LEARNING_OPERATOR_REQUIRED", message: "Workspace owner or admin access is required." });

  router.use("/site-projects/:id/learning-enrollments", operatorOnly);
  router.get("/site-projects/:id/learning-enrollments", (req, res) => {
    try { return res.json({ success: true, enrollments: service.listEnrollments(req.params.id) }); } catch (error) { return handle(error, res); }
  });
  router.post("/site-projects/:id/learning-enrollments", (req, res) => {
    try {
      const { authProjectId, appUserId } = req.body || {};
      if (typeof authProjectId !== "string" || typeof appUserId !== "string") return res.status(400).json({ success: false, code: "LEARNING_ENROLLMENT_INPUT_INVALID", message: "authProjectId and appUserId are required." });
      return res.status(201).json({ success: true, enrollment: service.enroll(req.params.id, { authProjectId, appUserId, actorUserId: req.user?.id || null }) });
    } catch (error) { return handle(error, res); }
  });
  router.delete("/site-projects/:id/learning-enrollments/:enrollmentId", (req, res) => {
    try { return res.json({ success: true, enrollment: service.revoke(req.params.id, req.params.enrollmentId) }); } catch (error) { return handle(error, res); }
  });
  return router;
}
