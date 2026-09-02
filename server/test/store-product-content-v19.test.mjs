import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const detail = fs.readFileSync(new URL("../../src/pages/StoreProductDetailPage.tsx", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../../src/components/store-studio-v16/types.ts", import.meta.url), "utf8");

test("product detail exposes persistent SEO GEO content studio", () => {
  assert.match(detail, /استودیوی محتوای محصول/);
  assert.match(detail, /SEO \+ GEO/);
  assert.match(detail, /geoDescription/);
  assert.match(detail, /contentMode/);
  assert.match(detail, /HYBRID/);
  assert.match(detail, /\/api\/commerce\/products\/\$\{product\.id\}/);
  assert.match(detail, /method:\s*"PATCH"/);
});

test("product content keeps catalog as source of truth", () => {
  assert.match(detail, /metadata:\{\.\.\.\(product\.metadata\|\|\{\}\)/);
  assert.doesNotMatch(detail, /localStorage|sessionStorage/);
  assert.doesNotMatch(detail, /document\.|querySelector|MutationObserver/);
});

test("product images include low-cost browser decoding hints", () => {
  assert.match(detail, /decoding="async"/);
  assert.match(detail, /loading="lazy"/);
});

test("store renderer model carries SEO and GEO fields without a parallel product model", () => {
  assert.match(types, /description\?: string/);
  assert.match(types, /seoTitle\?: string \| null/);
  assert.match(types, /seoDescription\?: string \| null/);
  assert.match(types, /geoDescription\?: string/);
  assert.match(types, /contentMode\?: "SEO" \| "GEO" \| "HYBRID"/);
});
