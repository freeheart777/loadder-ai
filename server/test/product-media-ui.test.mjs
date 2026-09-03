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

test("active product editor retains URL, Media Library, and variant editing compatibility", () => {
  assert.match(editor, /multiple\s+type="file"\s+accept="image\/\*"/);
  assert.match(editor, /Media Library موجود/);
  assert.match(editor, /isSafeProductImageUrl/);
  assert.match(editor, /افزودن از URL/);
  assert.match(editor, /\/commerce\/variants\/\$\{variantId\}/);
  assert.match(editor, /تصویر اختصاصی تنوع‌ها/);
  assert.match(editor, /\/commerce\/products\/\$\{product\.id\}/);
  assert.match(editor, /ویرایش اطلاعات محصول/);
});

test("active product media editor uses canonical storage without Base64", () => {
  assert.match(editor, /\/media\/upload-url/);
  assert.match(editor, /\/media\/complete/);
  assert.match(editor, /fetch\(upload\.signedUrl/);
  assert.match(editor, /const setMain/);
  assert.match(editor, /const remove/);
  assert.match(editor, /تصویر اصلی/);
  assert.match(editor, /فایل در Media Library باقی ماند/);
  assert.doesNotMatch(editor, /readAsDataURL|FileReader/);
});

test("product detail renders the proven storage-backed ProductMediaEditor", () => {
  assert.match(detail, /<ProductMediaEditor/);
  assert.doesNotMatch(detail, /<UnifiedProductMediaEditor/);
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
