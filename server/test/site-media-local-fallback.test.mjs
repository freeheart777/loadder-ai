import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSiteMediaStorageAdapter } from "../app/services/site-media-storage-adapter.mjs";

test("site media falls back to local disk when Supabase is not configured", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loadder-site-media-"));
  try {
    const storage = createSiteMediaStorageAdapter({ env: { SITE_MEDIA_LOCAL_DIR: dir } });
    const upload = await storage.signedUpload({ workspaceId: "ws-1", siteProjectId: "site-1", assetType: "hero", fileName: "hero.jpg" });
    assert.equal(storage.remoteConfigured, false);
    assert.match(upload.signedUrl, /^\/api\/site-media-local\/upload\//);
    assert.equal(upload.local, true);

    const bytes = Buffer.from("fake-image-bytes");
    await storage.acceptLocalUpload(upload.token, bytes);
    const publicUrl = storage.publicAssetUrl(upload.path);
    assert.match(publicUrl, /^\/api\/site-media-local\/object\//);

    const encodedKey = publicUrl.split("/").pop();
    const asset = await storage.readLocalAsset(encodedKey);
    assert.equal(asset.body.toString(), bytes.toString());
    assert.match(asset.fileName, /hero\.jpg$/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
