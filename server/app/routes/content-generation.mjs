import express from "express";
import { ContentGenerationError } from "../services/content-generation-service.mjs";

export function createContentGenerationRouter({ service }) {
  const router = express.Router();
  const handle = (error, response) => {
    if (error instanceof ContentGenerationError) {
      if (error.retryAfter) response.set("Retry-After", String(error.retryAfter));
      return response.status(error.status).json({ success: false, code: error.code, message: "Content generation request could not be completed." });
    }
    return response.status(500).json({ success: false, code: "CONTENT_GENERATION_FAILED", message: "Content generation request could not be completed." });
  };
  router.post("/content/generate", async (request, response) => {
    try {
      const result = await service.generate(request.body, { userId: request.user.id }, request.headers["idempotency-key"]);
      const generation = result.generation;
      return response.status(result.reusedResult ? 200 : 201).json({ success: true, generation: { generationId: generation.generationId, status: generation.status, mediaType: generation.mediaType, contractId: generation.contractId, contractVersion: generation.contractVersion, placementId: generation.placementId, placementVersion: generation.placementVersion, contextVersionId: generation.contextVersionId, variants: generation.variants, createdAt: generation.createdAt }, reusedResult: result.reusedResult });
    } catch (error) { return handle(error, response); }
  });
  router.get("/content/generations", (request, response) => {
    try {
      const page = service.list(request.query);
      const generations = page.items.map((item) => ({ generationId: item.generationId, status: item.status, mediaType: item.mediaType, contractId: item.contractId, contractVersion: item.contractVersion, placementId: item.placementId, placementVersion: item.placementVersion, contextVersionId: item.contextVersionId, variants: item.variants, errorCode: item.errorCode, createdAt: item.createdAt }));
      return response.json({ success: true, generations, nextCursor: page.nextCursor });
    } catch (error) { return handle(error, response); }
  });
  return router;
}
