import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSiteMediaStorageAdapter } from "../app/services/site-media-storage-adapter.mjs";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("website builder exposes one-request media upload and image-surface picker", () => {
  const route = read("server/app/routes/site-media.mjs");
  const helper = read("src/lib/siteMediaUpload.ts");
  const css = read("src/direct-media.css");
  const wrapper = read("src/pages/StoreWebsiteStudioPageV16.tsx");
  assert.match(route, /site-projects\/:id\/media\/upload/);
  assert.match(route, /express\.raw\(\{ type: \(\) => true, limit: "25mb" \}\)/);
  assert.match(helper, /\/media\/upload`/);
  assert.doesNotMatch(helper, /media\/upload-url/);
  assert.doesNotMatch(helper, /media\/complete/);
  assert.match(css, /label\[data-inline-media-control="true"\]/);
  assert.match(css, /inset: 0 !important/);
  assert.match(wrapper, /DIRECT MEDIA · 2026\.09\.04/);
});

test("direct storage write persists binary bytes without signed-upload token", async () => {
  const rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "loadder-direct-media-"));
  try {
    const storage = createSiteMediaStorageAdapter({ env: { SITE_MEDIA_LOCAL_DIR: rootDir, API_PORT: "3001" } });
    const body = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0x04]);
    const stored = await storage.directUpload({
      workspaceId: "workspace-test",
      siteProjectId: "store-test",
      assetType: "hero",
      fileName: "hero.jpg",
      mimeType: "image/jpeg",
      body,
    });
    assert.equal(stored.sizeBytes, body.length);
    assert.match(stored.path, /^workspace-test\/store-test\/hero\//);
    const disk = await fsp.readFile(path.join(rootDir, stored.path));
    assert.deepEqual(disk, body);
  } finally {
    await fsp.rm(rootDir, { recursive: true, force: true });
  }
});

test("legacy completion is idempotent after proxied PUT registration", () => {
  const repository = read("server/app/repositories/site-media-repository.mjs");
  const service = read("server/app/services/site-media-service.mjs");
  assert.match(repository, /findByStorageKey/);
  assert.match(repository, /if \(existing\) return existing/);
  assert.match(service, /repository\.findByStorageKey\?\.\(project\.id, storageKey\)/);
  assert.match(service, /acceptLocalUpload[\s\S]*repository\.create/);
});
