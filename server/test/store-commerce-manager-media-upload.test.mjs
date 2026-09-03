import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manager = read("../../src/pages/StoreCommerceManagerPage.tsx");
const uploader = read("../../src/lib/siteMediaUpload.ts");

test("product creator uses canonical binary Media Storage instead of Base64 project assets", () => {
  assert.match(manager, /uploadSiteMedia/);
  assert.doesNotMatch(manager, /readAsDataURL|FileReader/);
  assert.doesNotMatch(manager, /\/site-projects\/\$\{project\.id\}\/assets/);
  assert.doesNotMatch(manager, /۱\.۲MB|1200\s*\*\s*1024/);
  assert.match(manager, /حداکثر ۲۵MB/);
});

test("canonical uploader performs allocate, binary PUT, and completion", () => {
  assert.match(uploader, /\/media\/upload-url/);
  assert.match(uploader, /method: "PUT"/);
  assert.match(uploader, /body: file/);
  assert.match(uploader, /\/media\/complete/);
  assert.match(uploader, /credentials: targetsLoadderApi\(signedUrl\) \? "include" : "omit"/);
  assert.doesNotMatch(uploader, /FileReader|readAsDataURL/);
});
