import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const api = read("../../src/lib/api.ts");
const storage = read("../app/services/site-media-storage-adapter.mjs");

test("local media upload targets the API origin and direct API fetches include session credentials", () => {
  assert.match(storage, /localApiBaseUrl/);
  assert.match(storage, /\/api\/site-media-local\/upload\/\$\{token\}/);
  assert.match(storage, /\/api\/site-media-local\/object\//);
  assert.match(api, /targetsApi/);
  assert.match(api, /credentials:\s*"include"/);
});
