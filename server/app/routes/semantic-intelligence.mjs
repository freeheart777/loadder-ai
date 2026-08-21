import express from "express";
import { SemanticIntelligenceError } from "../services/semantic-intelligence-service.mjs";

export function createSemanticIntelligenceRouter({ service }) {
  const router = express.Router();
  const handle = (error, response) => error instanceof SemanticIntelligenceError
    ? response.status(error.status).json({ success: false, code: error.code, message: error.message })
    : response.status(500).json({ success: false, code: "SEMANTIC_INTELLIGENCE_FAILED", message: "Semantic intelligence operation failed.", developmentDetail: process.env.NODE_ENV === "test" ? error.message : undefined });
  router.post("/intelligence/semantic/calculate", (request, response) => {
    try { const result = service.calculate(request.body || {}, request.user.id); return response.status(result.reusedResult ? 200 : 201).json({ success: true, ...result }); }
    catch (error) { return handle(error, response); }
  });
  router.get("/intelligence/semantic/findings", (request, response) => {
    try { const page = service.list(request.query); return response.json({ success: true, findings: page.items, nextCursor: page.nextCursor }); }
    catch (error) { return handle(error, response); }
  });
  router.get("/intelligence/semantic/findings/:id", (request, response) => {
    try { return response.json({ success: true, finding: service.get(request.params.id) }); }
    catch (error) { return handle(error, response); }
  });
  return router;
}
