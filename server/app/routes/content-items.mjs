import express from "express";
import { ContentItemError } from "../services/content-item-service.mjs";

export function createContentItemRouter({ service }) {
  const router = express.Router();
  const actor = (request) => ({ userId: request.user.id, membershipId: request.membership.id, role: request.membership.role });
  const handle = (error, response) => error instanceof ContentItemError
    ? response.status(error.status).json({ success: false, code: error.code, message: "Content Library operation could not be completed." })
    : response.status(500).json({ success: false, code: "CONTENT_ITEM_INVALID", message: "Content Library operation could not be completed." });
  router.post("/content/generations/:generationId/save", (request, response) => {
    try { const result = service.saveGeneration(request.params.generationId, request.body, actor(request), request.headers["idempotency-key"]); return response.status(result.reusedResult ? 200 : 201).json({ success: true, item: result.item, reusedResult: result.reusedResult }); } catch (error) { return handle(error, response); }
  });
  router.get("/content/items", (request, response) => { try { const page = service.list(request.query, actor(request)); return response.json({ success: true, items: page.items, nextCursor: page.nextCursor }); } catch (error) { return handle(error, response); } });
  router.get("/content/items/:id", (request, response) => { try { return response.json({ success: true, item: service.get(request.params.id, actor(request)) }); } catch (error) { return handle(error, response); } });
  router.patch("/content/items/:id", (request, response) => { try { return response.json({ success: true, item: service.update(request.params.id, request.body, actor(request)) }); } catch (error) { return handle(error, response); } });
  router.post("/content/items/:id/duplicate", (request, response) => { try { const result = service.duplicate(request.params.id, request.body, actor(request), request.headers["idempotency-key"]); return response.status(result.reusedResult ? 200 : 201).json({ success: true, item: result.item, reusedResult: result.reusedResult }); } catch (error) { return handle(error, response); } });
  return router;
}
