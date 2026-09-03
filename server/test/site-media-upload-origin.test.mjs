import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const api = read("../../src/lib/api.ts");
const storage = read("../app/services/site-media-storage-adapter.mjs");
const router = read("../app/routes/site-media.mjs");

test("media upload and reads use the Loadder API origin and preserve authenticated API requests", () => {
  assert.match(storage, /localApiBaseUrl/);
  assert.match(storage, /\/api\/site-media-upload\/\$\{token\}/);
  assert.match(storage, /\/api\/site-media-object\//);
  assert.doesNotMatch(storage, /signedUrl:\s*`\$\{storageApiBaseUrl\}/, "browser must not receive provider URLs");
  assert.match(router, /router\.put\("\/site-media-upload\/:token"/);
  assert.match(router, /router\.put\("\/site-media-local\/upload\/:token"/, "legacy alias remains during migration");
  assert.match(router, /router\.get\("\/site-media-object\/:key"/);
  assert.match(api, /targetsApi/);
  assert.match(api, /credentials:\s*"include"/);
});
