import express from "express";
import rateLimit from "express-rate-limit";
import { ContentAssetError } from "../services/content-asset-service.mjs";
import { ContentAssetStoreError } from "../content-assets/content-asset-store.mjs";

export function createContentAssetRouter({ service }) {
  const router = express.Router();
  const limiter = (max) => rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false });
  const actor = (request) => ({ userId: request.user.id, membershipId: request.membership.id, role: request.membership.role });
  const idempotency = (request) => { const value = request.headers["idempotency-key"]; if (typeof value !== "string" || !value.trim()) throw new ContentAssetError("CONTENT_ASSET_INVALID", 400); return value; };
  const handle = (error, response) => {
    if (error instanceof ContentAssetError || error instanceof ContentAssetStoreError || error?.code?.startsWith("CONTENT_ASSET_")) return response.status(error.status || 400).json({ success: false, code: error.code, message: "Asset operation could not be completed." });
    return response.status(500).json({ success: false, code: "CONTENT_ASSET_INVALID", message: "Asset operation could not be completed." });
  };
  router.post("/content/assets/upload-intents", limiter(20), async (request, response) => { try { const result = await service.createUploadIntent(request.body, actor(request), idempotency(request)); return response.status(result.reusedResult ? 200 : 201).json({ success: true, assetId: result.assetId, method: result.method, url: result.url, requiredHeaders: result.requiredHeaders, expiresAt: result.expiresAt, reusedResult: result.reusedResult }); } catch (error) { return handle(error, response); } });
  router.post("/content/assets/:id/complete", limiter(30), async (request, response) => { try { idempotency(request); return response.json({ success: true, asset: await service.complete(request.params.id, actor(request)) }); } catch (error) { return handle(error, response); } });
  router.get("/content/assets/:id", async (request, response) => { try { return response.json({ success: true, asset: service.get(request.params.id) }); } catch (error) { return handle(error, response); } });
  router.post("/content/assets/:id/access", limiter(60), async (request, response) => { try { return response.json({ success: true, access: await service.access(request.params.id, actor(request)) }); } catch (error) { return handle(error, response); } });
  router.delete("/content/assets/:id", limiter(20), async (request, response) => { try { return response.json({ success: true, asset: await service.delete(request.params.id, actor(request)) }); } catch (error) { return handle(error, response); } });
  return router;
}
