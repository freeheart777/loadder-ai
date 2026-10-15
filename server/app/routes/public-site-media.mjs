import express from "express";
import { SiteMediaStorageError } from "../services/site-media-storage-adapter.mjs";

// Image assets a customer placed on their website must load for anonymous
// visitors of the published (or privately previewed) site. This route serves
// ONLY rows that are site imagery: an image asset type, an image MIME type and
// not workspace-private. Documents, audio, video and private learning resources
// never match and fall through to the authenticated route, which still demands
// a session. The key is an unguessable path (workspace/project/type/random).
const PUBLIC_IMAGE_TYPES = new Set(["logo", "hero", "banner", "product", "gallery", "favicon"]);

export function createPublicSiteMediaRouter({ db, storage }) {
  const router = express.Router();
  const find = db.prepare("SELECT asset_type AS assetType, mime_type AS mimeType, metadata_json AS metadata FROM site_media_assets WHERE storage_key = ? LIMIT 1");
  const isPublicImage = (row) => {
    if (!row || !PUBLIC_IMAGE_TYPES.has(row.assetType) || !/^image\/[a-z0-9.+-]+$/i.test(row.mimeType || "")) return false;
    try { return JSON.parse(row.metadata || "{}").visibility !== "workspace"; } catch { return false; }
  };

  router.get("/site-media-object/:key", async (req, res, next) => {
    let storageKey;
    try { storageKey = Buffer.from(String(req.params.key), "base64url").toString("utf8"); } catch { return next(); }
    if (!storageKey || storageKey.length > 600) return next();
    const row = find.get(storageKey);
    if (!isPublicImage(row)) return next();
    try {
      const asset = await storage.readLocalAsset(req.params.key);
      res.type(row.mimeType);
      res.set({ "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" });
      return res.send(asset.body);
    } catch (error) {
      if (error instanceof SiteMediaStorageError) return res.status(error.status || 404).json({ success: false, code: error.code });
      console.error("Public site media error:", error);
      return res.status(500).json({ success: false, code: "SITE_MEDIA_ERROR" });
    }
  });

  return router;
}
