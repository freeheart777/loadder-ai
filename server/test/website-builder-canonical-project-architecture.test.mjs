import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("website builder keeps one canonical store-project resolver", () => {
  const resolver = read("src/lib/activeStoreProject.ts");
  const api = read("src/lib/api.ts");
  assert.match(resolver, /canonicalProjectPromise/);
  assert.match(resolver, /setCanonicalStoreProjectId\(detail\.project\.id\)/);
  assert.match(api, /canonicalStoreProjectId/);
  assert.match(api, /normalizeCanonicalStoreListing/);
});

test("legacy website-builder routes cannot execute legacy builders", () => {
  const app = read("src/App.tsx");
  assert.match(app, /const canonicalBuilder = <Navigate to="\/dashboard\/websites" replace \/>/);
  for (const pathName of [
    "/dashboard/websites/store-v1",
    "/dashboard/websites/studio-v2",
    "/dashboard/websites/studio-v12",
    "/dashboard/websites/fallback/v15",
    "/dashboard/websites/studio-legacy",
    "/dashboard/websites/ai",
    "/site-builder/legacy",
  ]) {
    const escaped = pathName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(app, new RegExp(`path="${escaped}" element=\\{canonicalBuilder\\}`));
  }
  assert.doesNotMatch(app, /element=\{<StoreWebsiteStudioPageV(?:2|3|4|5|6|7|8|9|10|11|12|13|14|15)\s*\/?>\}/);
});
