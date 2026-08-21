import express from "express";

import { FeatureQueryError } from "../services/feature-query-service.mjs";

export function createFeatureValueRouter({ featureQueryService }) {
  const router = express.Router();
  function handle(error, res) {
    if (error instanceof FeatureQueryError) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Feature query error:", error);
    return res.status(500).json({ success: false, message: "Unable to query Feature Values." });
  }
  router.get("/features", (req, res) => {
    try {
      const page = featureQueryService.listPage(req.query);
      return res.json({ success: true, features: page.items, nextCursor: page.nextCursor });
    }
    catch (error) { return handle(error, res); }
  });
  router.get("/features/:id", (req, res) => {
    try { return res.json({ success: true, feature: featureQueryService.get(req.params.id) }); }
    catch (error) { return handle(error, res); }
  });
  router.get("/feature-set/:subjectType/:subjectId", (req, res) => {
    try {
      return res.json({
        success: true,
        featureSet: featureQueryService.getFeatureSet(req.params.subjectType, req.params.subjectId),
      });
    } catch (error) { return handle(error, res); }
  });
  return router;
}
