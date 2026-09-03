import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const editor = read("../../src/components/commerce/ProductMediaEditor.tsx");
const detail = read("../../src/pages/StoreProductDetailPage.tsx");

test("product media uses canonical site media storage instead of Base64 JSON", () => {
  assert.match(editor, /\/media\/upload-url/);
  assert.match(editor, /\/media\/complete/);
  assert.match(editor, /const signedUrl = String\(upload\.signedUrl\)/);
  assert.match(editor, /fetch\(signedUrl/);
  assert.doesNotMatch(editor, /FileReader/);
  assert.doesNotMatch(editor, /readAsDataURL/);
});

test("product detail renders the proven storage-backed product media editor", () => {
  assert.match(detail, /ProductMediaEditor/);
  assert.doesNotMatch(detail, /UnifiedProductMediaEditor/);
});

test("upload failures surface useful HTTP diagnostics", () => {
  assert.match(editor, /HTTP \$\{put\.status\}/);
  assert.match(editor, /data\.code/);
});
