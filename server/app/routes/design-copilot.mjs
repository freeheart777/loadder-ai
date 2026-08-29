import express from "express";

export function createDesignCopilotRouter({ service }) {
  const router = express.Router();
  router.post("/site-projects/:id/design-copilot/propose", async (req, res) => {
    try {
      const result = await service.propose(req.params.id, req.body || {});
      return res.json({ success: true, ...result });
    } catch (error) {
      const status = Number(error?.status) || 500;
      if (status >= 500) console.error("Design Copilot error:", error);
      return res.status(status).json({ success: false, code: error?.code || "DESIGN_COPILOT_FAILED", message: error instanceof Error ? error.message : "Design Copilot failed." });
    }
  });
  return router;
}
