import assert from "node:assert/strict";
import test from "node:test";
import { createSiteMediaStorageAdapter } from "../app/services/site-media-storage-adapter.mjs";

test("remote site media never exposes a Supabase signed upload URL to the browser", async () => {
  const calls = [];
  const storage = createSiteMediaStorageAdapter({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      SITE_MEDIA_BUCKET: "site-media",
      API_PUBLIC_URL: "http://localhost:3001",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ Key: "stored" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const upload = await storage.signedUpload({
    workspaceId: "ws-1",
    siteProjectId: "site-1",
    assetType: "gallery",
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
  });

  assert.equal(storage.remoteConfigured, true);
  assert.equal(calls.length, 0, "allocating an upload must not call Supabase from the browser flow");
  assert.match(upload.signedUrl, /^http:\/\/localhost:3001\/api\/site-media-upload\//);
  assert.equal(upload.local, true);
  assert.equal(upload.proxied, true);
  assert.doesNotMatch(upload.signedUrl, /supabase|storage\/v1/i);

  const body = Buffer.from("real-image-bytes");
  const stored = await storage.acceptLocalUpload(upload.token, body);
  assert.equal(stored.sizeBytes, body.length);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/site-media\/ws-1\/site-1\/gallery\//);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "image/jpeg");
  assert.deepEqual(calls[0].options.body, body);
});

test("failed provider upload is surfaced and its one-time upload token is consumed", async () => {
  const storage = createSiteMediaStorageAdapter({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      API_PUBLIC_URL: "http://localhost:3001",
    },
    fetchImpl: async () => new Response("provider rejected upload", { status: 500 }),
  });

  const upload = await storage.signedUpload({
    workspaceId: "ws-1",
    siteProjectId: "site-1",
    assetType: "hero",
    fileName: "hero.jpg",
    mimeType: "image/jpeg",
  });

  await assert.rejects(
    storage.acceptLocalUpload(upload.token, Buffer.from("bytes")),
    (error) => error?.code === "SITE_MEDIA_PROVIDER_UPLOAD_FAILED" && error?.status === 502,
  );
  await assert.rejects(
    storage.acceptLocalUpload(upload.token, Buffer.from("bytes")),
    (error) => error?.code === "SITE_MEDIA_UPLOAD_TOKEN_INVALID" && error?.status === 403,
  );
});
