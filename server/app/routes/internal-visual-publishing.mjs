import express from "express";

export function createInternalVisualPublishingRouter({ contract }) {
  const router = express.Router();
  router.get("/internal/visual-publishing/contract", (_req, res) => res.json({ success: true, contract: contract.policy }));
  router.get("/internal/visual-publishing/compatibility/:componentId/:componentVersion", (req, res) => {
    if (!/^\d{1,4}$/.test(req.params.componentVersion)) return res.status(404).json({ success: false, code: "VISUAL_COMPONENT_NOT_FOUND" });
    return res.json({ success: true, compatibility: contract.compatibility(req.params.componentId, Number(req.params.componentVersion)) });
  });
  return router;
}
