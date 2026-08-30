import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const editor = read("../../src/components/commerce/ProductMediaEditor.tsx");
const detail = read("../../src/pages/StoreProductDetailPage.tsx");
const quickStart = read("../../src/pages/StoreQuickStartPage.tsx");
const studio = read("../../src/pages/StoreWebsiteStudioPageV13.tsx");
const storefront = read("../../src/pages/PublicStorefrontPage.tsx");
const publicProduct = read("../../src/pages/PublicProductPage.tsx");
const media = read("../../src/lib/productMedia.ts");

test("product editor supports device upload, Media Library, and HTTPS URL fallback", () => {
  assert.match(editor, /multiple\s+type="file"\s+accept="image\/\*"/);
  assert.match(editor, /\/site-projects\/\$\{product\.siteProjectId\}\/assets/);
  assert.match(editor, /kind:\s*"gallery"/);
  assert.match(editor, /Media Library موجود/);
  assert.match(editor, /isSafeProductImageUrl/);
  assert.match(editor, /افزودن از URL/);
});

test("ordered gallery provides main, reorder, remove, and set-main actions", () => {
  assert.match(
    editor,
    /metadata:\s*\{\s*\.\.\.\(product\.metadata \|\| \{\}\),\s*gallery: nextGallery/,
  );
  assert.match(editor, /const setMain/);
  assert.match(editor, /const move/);
  assert.match(editor, /const remove/);
  assert.match(editor, /تصویر اصلی/);
  assert.match(editor, /فایل در Media Library باقی ماند/);
});

test("variant-specific media and product editing use canonical APIs", () => {
  assert.match(editor, /\/commerce\/variants\/\$\{variantId\}/);
  assert.match(editor, /تصویر اختصاصی تنوع‌ها/);
  assert.match(editor, /\/commerce\/products\/\$\{product\.id\}/);
  assert.match(editor, /ویرایش اطلاعات محصول/);
  assert.match(detail, /<ProductMediaEditor/);
});

test("mobile controls remain touch-friendly and galleries adapt responsively", () => {
  assert.match(editor, /grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4/);
  assert.match(editor, /min-h-11/);
  assert.match(editor, /overflow-x-auto/);
  assert.match(detail, /max-w-6xl px-5 pb-12/);
});

test("Quick Start, Studio, and public storefront share canonical image selection", () => {
  assert.match(media, /export function productMainImage/);
  assert.match(media, /export function productGallery/);
  assert.match(quickStart, /productMainImage\(x\)/);
  assert.match(studio, /productMainImage\(product\)/);
  assert.match(storefront, /productMainImage\(p\)/);
  assert.match(publicProduct, /productGallery\(product\)/);
});
