import express from "express";

export function createInternalVisualComponentsRouter({ registry }) {
  const router = express.Router();
  router.get("/internal/visual-components", (_req, res) => res.json({ success: true, policyVersion: registry.policyVersion, components: registry.list() }));
  router.get("/internal/visual-components/:componentId/:componentVersion", (req, res) => {
    if (!/^\d{1,4}$/.test(req.params.componentVersion)) return res.status(404).json({ success: false, code: "VISUAL_COMPONENT_NOT_FOUND" });
    const entry = registry.get(req.params.componentId, Number(req.params.componentVersion));
    return entry ? res.json({ success: true, component: entry }) : res.status(404).json({ success: false, code: "VISUAL_COMPONENT_NOT_FOUND" });
  });
  return router;
}
