import express from "express";

import { AuthError } from "../services/auth-service.mjs";

export function createWorkspaceRouter({ authService }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    return res.json({
      success: true,
      memberships: req.auth.memberships,
      workspaces: req.auth.memberships.map(
        (membership) => membership.workspace
      ),
      activeWorkspace: req.auth.activeWorkspace,
    });
  });

  router.post("/active", (req, res) => {
    try {
      const identity = authService.switchWorkspace(
        req.auth,
        req.body?.workspaceId
      );
      return res.json({
        success: true,
        memberships: identity.memberships,
        workspaces: identity.memberships.map(
          (membership) => membership.workspace
        ),
        activeWorkspace: identity.activeWorkspace,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }
      console.error("Workspace selection error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to select workspace.",
      });
    }
  });

  return router;
}
