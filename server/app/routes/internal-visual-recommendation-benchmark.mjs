import express from "express";

export function createInternalVisualRecommendationBenchmarkRouter({
  registry,
  run,
}) {
  const router = express.Router();
  router.get("/internal/visual-recommendation-benchmark/summary", (_req, res) =>
    res.json({ success: true, ...registry.summary(), scorecard: run().scorecard }),
  );
  router.get("/internal/visual-recommendation-benchmark/cases", (_req, res) =>
    res.json({ success: true, cases: registry.list() }),
  );
  router.post("/internal/visual-recommendation-benchmark/run", (_req, res) =>
    res.json({ success: true, ...run() }),
  );
  return router;
}
