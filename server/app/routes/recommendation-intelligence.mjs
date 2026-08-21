import express from "express";
import { RecommendationIntelligenceError } from "../services/recommendation-intelligence-service.mjs";

export function createRecommendationIntelligenceRouter({ service }) {
  const router = express.Router();
  const handle = (error, response) => error instanceof RecommendationIntelligenceError
    ? response.status(error.status).json({ success: false, code: error.code, message: error.message })
    : response.status(500).json({ success: false, code: "RECOMMENDATION_INTELLIGENCE_FAILED", message: "Recommendation intelligence operation failed.", developmentDetail: process.env.NODE_ENV === "test" ? error.message : undefined });
  router.post("/intelligence/recommendations/calculate", (request, response) => {
    try { const result = service.calculate(request.body || {}, request.user.id); return response.status(result.createdCount > 0 ? 201 : 200).json({ success: true, state: result.state, recommendations: result.recommendations, skipped: result.skipped, reusedResult: result.reusedResult }); }
    catch (error) { return handle(error, response); }
  });
  router.get("/intelligence/recommendations", (request, response) => {
    try { const page = service.list(request.query); return response.json({ success: true, recommendations: page.items, nextCursor: page.nextCursor }); }
    catch (error) { return handle(error, response); }
  });
  router.get("/intelligence/recommendations/:id", (request, response) => {
    try { return response.json({ success: true, recommendation: service.get(request.params.id) }); }
    catch (error) { return handle(error, response); }
  });
  return router;
}
