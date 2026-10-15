import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import Database from "better-sqlite3";
import { createPublicSiteMediaRouter } from "../app/routes/public-site-media.mjs";

// A visitor of a published site must see the customer's images, and nothing else
// in the media store: not documents, not workspace-private resources, not unknown keys.
const b64 = (key) => Buffer.from(key, "utf8").toString("base64url");
const rows = [
  ["w/p/hero/a.png", "hero", "image/png", {}],
  ["w/p/logo/b.svg", "logo", "image/svg+xml", {}],
  ["w/p/document/c.pdf", "document", "application/pdf", {}],
  ["w/p/gallery/d.png", "gallery", "image/png", { visibility: "workspace" }],
  ["w/p/hero/e.html", "hero", "text/html", {}],
];

async function withServer(fn) {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE site_media_assets (storage_key TEXT, asset_type TEXT, mime_type TEXT, metadata_json TEXT)");
  for (const [key, type, mime, meta] of rows) db.prepare("INSERT INTO site_media_assets VALUES (?,?,?,?)").run(key, type, mime, JSON.stringify(meta));
  const storage = { readLocalAsset: async (encoded) => ({ body: Buffer.from(`bytes:${Buffer.from(encoded, "base64url").toString()}`) }) };
  const app = express();
  app.use("/api", createPublicSiteMediaRouter({ db, storage }));
  app.use((_req, res) => res.status(401).json({ fallthrough: true }));   // stands in for requireAuth
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); db.close(); }
}

test("anonymous visitors get site imagery with safe headers", async () => {
  await withServer(async (base) => {
    for (const [key, mime] of [["w/p/hero/a.png", "image/png"], ["w/p/logo/b.svg", "image/svg+xml"]]) {
      const res = await fetch(`${base}/api/site-media-object/${b64(key)}`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type"), new RegExp(mime.replace("+", "\\+")));
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.match(res.headers.get("content-security-policy"), /sandbox/);
      assert.equal(await res.text(), `bytes:${key}`);
    }
  });
});

test("documents, private resources, non-image mime types and unknown keys are never served publicly", async () => {
  await withServer(async (base) => {
    for (const key of ["w/p/document/c.pdf", "w/p/gallery/d.png", "w/p/hero/e.html", "w/p/hero/missing.png", "../../etc/passwd"]) {
      const res = await fetch(`${base}/api/site-media-object/${b64(key)}`);
      assert.equal(res.status, 401, `${key} must fall through to the authenticated route`);
    }
    assert.equal((await fetch(`${base}/api/site-media-object/!!!`)).status, 401);   // not valid base64url: ignored, not an error
  });
});
