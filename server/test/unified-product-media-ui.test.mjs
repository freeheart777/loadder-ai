import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const editor = read("../../src/components/commerce/UnifiedProductMediaEditor.tsx");
const detail = read("../../src/pages/StoreProductDetailPage.tsx");

test("product media uses canonical site media storage instead of Base64 JSON", () => {
  assert.match(editor, /\/media\/upload-url/);
  assert.match(editor, /\/media\/complete/);
  assert.match(editor, /fetch\(upload\.signedUrl/);
  assert.doesNotMatch(editor, /FileReader/);
  assert.doesNotMatch(editor, /readAsDataURL/);
});

test("product detail renders unified storage-backed media editor", () => {
  assert.match(detail, /UnifiedProductMediaEditor/);
  assert.doesNotMatch(detail, /<ProductMediaEditor/);
});

test("upload failures surface useful HTTP diagnostics", () => {
  assert.match(editor, /HTTP \$\{put\.status\}/);
  assert.match(editor, /data\.code/);
});
