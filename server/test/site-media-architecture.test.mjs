import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createSiteMediaStorageAdapter } from "../app/services/site-media-storage-adapter.mjs";

const root = new URL("../../", import.meta.url);

test("there is only one product media editor implementation", () => {
  assert.equal(
    existsSync(new URL("src/components/commerce/UnifiedProductMediaEditor.tsx", root)),
    false,
    "Do not add a second product media uploader. Extend ProductMediaEditor or the canonical upload service instead.",
  );
});

test("local media storage performs a real binary write/read round-trip", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "loadder-site-media-"));
  try {
    const adapter = createSiteMediaStorageAdapter({
      env: {
        SITE_MEDIA_LOCAL_DIR: tempDir,
        SITE_MEDIA_LOCAL_API_BASE_URL: "http://127.0.0.1:3001",
      },
    });

    const allocation = await adapter.signedUpload({
      workspaceId: "workspace-test",
      siteProjectId: "store-test",
      assetType: "gallery",
      fileName: "pixel.png",
    });

    assert.equal(allocation.local, true);
    assert.ok(allocation.token);
    assert.ok(allocation.path.endsWith("-pixel.png"));

    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const accepted = await adapter.acceptLocalUpload(allocation.token, bytes);
    assert.equal(accepted.path, allocation.path);
    assert.equal(accepted.sizeBytes, bytes.length);

    const encodedKey = Buffer.from(allocation.path, "utf8").toString("base64url");
    const stored = await adapter.readLocalAsset(encodedKey);
    assert.deepEqual(stored.body, bytes);
    assert.equal(stored.fileName, path.basename(allocation.path));

    const publicUrl = adapter.publicAssetUrl(allocation.path);
    assert.match(publicUrl, /^http:\/\/127\.0\.0\.1:3001\/api\/site-media-local\/object\//);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("remote media storage signs uploads and returns a matching public URL contract", async () => {
  const calls = [];
  const adapter = createSiteMediaStorageAdapter({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      SITE_MEDIA_BUCKET: "site-media",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        async json() {
          return { url: "/object/upload/sign/site-media/workspace/store/gallery/file.png?token=test-token", token: "test-token" };
        },
      };
    },
  });

  const allocation = await adapter.signedUpload({
    workspaceId: "workspace",
    siteProjectId: "store",
    assetType: "gallery",
    fileName: "file.png",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/storage\/v1\/object\/upload\/sign\/site-media\//);
  assert.equal(calls[0].options.method, "POST");
  assert.match(allocation.signedUrl, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/upload\/sign\/site-media\//);
  assert.match(adapter.publicAssetUrl(allocation.path), /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/site-media\//);
});
