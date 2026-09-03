import assert from "node:assert/strict";
import test from "node:test";
import { createSiteMediaStorageAdapter } from "../app/services/site-media-storage-adapter.mjs";

test("Supabase site media signed upload preserves /storage/v1 in the returned URL", async () => {
  const calls = [];
  const storage = createSiteMediaStorageAdapter({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      SITE_MEDIA_BUCKET: "site-media",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        url: "/object/upload/sign/site-media/ws-1/site-1/gallery/photo.jpg?token=abc123",
        token: "abc123",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const upload = await storage.signedUpload({
    workspaceId: "ws-1",
    siteProjectId: "site-1",
    assetType: "gallery",
    fileName: "photo.jpg",
  });

  assert.equal(storage.remoteConfigured, true);
  assert.match(calls[0].url, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/upload\/sign\/site-media\//);
  assert.equal(
    upload.signedUrl,
    "https://example.supabase.co/storage/v1/object/upload/sign/site-media/ws-1/site-1/gallery/photo.jpg?token=abc123"
  );
});

test("Supabase site media keeps an already absolute signed upload URL unchanged", async () => {
  const absolute = "https://cdn.example.test/storage/v1/object/upload/sign/site-media/a.jpg?token=xyz";
  const storage = createSiteMediaStorageAdapter({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    },
    fetchImpl: async () => new Response(JSON.stringify({ url: absolute, token: "xyz" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });

  const upload = await storage.signedUpload({
    workspaceId: "ws-1",
    siteProjectId: "site-1",
    assetType: "gallery",
    fileName: "photo.jpg",
  });
  assert.equal(upload.signedUrl, absolute);
});
