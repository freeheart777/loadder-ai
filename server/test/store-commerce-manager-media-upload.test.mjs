import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const managerGate = read("../../src/pages/StoreCommerceManagerPage.tsx");
const manager = read("../../src/pages/StoreCommerceManagerPageCore.tsx");
const uploader = read("../../src/lib/siteMediaUpload.ts");

test("product creator uses canonical binary Media Storage instead of Base64 project assets", () => {
  assert.match(managerGate, /ensureActiveStoreProject/);
  assert.match(manager, /uploadSiteMedia/);
  assert.doesNotMatch(manager, /readAsDataURL|FileReader/);
  assert.doesNotMatch(manager, /\/site-projects\/\$\{project\.id\}\/assets/);
  assert.doesNotMatch(manager, /۱\.۲MB|1200\s*\*\s*1024/);
  assert.match(manager, /حداکثر ۲۵MB/);
});

test("canonical uploader sends one authenticated binary request through Loadder API", () => {
  assert.match(uploader, /\/media\/upload`/);
  assert.match(uploader, /method: "POST"/);
  assert.match(uploader, /"x-loadder-asset-type": assetType/);
  assert.match(uploader, /"x-loadder-file-name": file\.name/);
  assert.match(uploader, /body: file/);
  assert.doesNotMatch(uploader, /\/media\/upload-url/);
  assert.doesNotMatch(uploader, /\/media\/complete/);
  assert.doesNotMatch(uploader, /method: "PUT"/);
  assert.doesNotMatch(uploader, /FileReader|readAsDataURL/);
});
