import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd(), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Store Studio product submit is a real guarded form with visible validation", () => {
  const source = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  assert.match(source, /data-product-create-form="true"/);
  assert.match(source, /onSubmit=\{\(e\) => \{ e\.preventDefault\(\); void createProductInCatalog\(\); \}\}/);
  assert.match(source, /role="alert" aria-live="assertive" data-product-form-error="true"/);
  assert.match(source, /replace\(\/\[۰-۹\]\/g/);
  assert.match(source, /replace\(\/\[٠-٩\]\/g/);
  assert.match(source, /toMinorUnits\(localizedInteger\(productDraft\.basePriceMinor/);
  assert.match(source, /data-product-submit="true" disabled=\{productBusy \|\| productImageBusy\}/);
  assert.match(source, /aria-busy=\{productBusy\}/);
  assert.match(source, /data-product-form-actions="mobile-safe"/);
  assert.match(source, /flex-col gap-2 sm:col-span-2 sm:flex-row/);
  assert.match(source, /if \(!project \|\| !pickerSectionId \|\| productBusy \|\| productSubmitLock\.current\) return/);
  assert.match(source, /productSubmitLock\.current = true/);
  assert.match(source, /productSubmitLock\.current = false/);
});

test("product payload contains canonical product fields and final image URL", () => {
  const source = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  for (const field of [
    "name", "basePriceMinor", "compareAtPriceMinor", "inventoryQuantity", "category", "brand",
    "description", "seoTitle", "seoDescription", "imageUrl", "metadata",
  ]) assert.match(source, new RegExp(`\\b${field}\\b`));
  assert.match(source, /apiFetch\(`\/api\/stores\/\$\{project\.id\}\/products`/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /body: JSON\.stringify\(payload\)/);
  assert.match(source, /currency: config\.commerce\.currency/);
  assert.match(source, /uploadProductDraftImage\(file: File\)/);
  assert.match(source, /const uploaded = await uploadSiteMedia\(\{/);
  assert.match(source, /setProductDraft\(\(current\) => \(\{ \.\.\.current, imageUrl: uploaded\.url \}\)\)/);
  assert.doesNotMatch(source.slice(source.indexOf("const payload ="), source.indexOf("const out =", source.indexOf("const payload ="))), /\bfile\b|blob:/i);
});

test("successful creation refetches catalog, persists section membership and closes the form", () => {
  const source = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  const createFlow = source.slice(source.indexOf("async function createProductInCatalog"), source.indexOf("async function uploadProductDraftImage"));
  assert.match(createFlow, /method: "POST"/);
  assert.match(createFlow, /const refreshed = await read\(await apiFetch\(`\/api\/stores\/\$\{project\.id\}\/products`\)\)/);
  assert.match(createFlow, /authoritativeProducts\.some\(\(item\) => item\.id === product\.id\)/);
  assert.match(createFlow, /withProductInSection\(config, sectionId, product\.id, nextProducts\)/);
  assert.match(createFlow, /await persistConfig\(nextConfig\)/);
  assert.match(createFlow, /setCreateProductOpen\(false\)/);
  assert.match(createFlow, /setPickerSectionId\(null\)/);
  assert.match(createFlow, /محصول ساخته، ذخیره و روی فروشگاه قرار گرفت/);
  assert.match(createFlow, /همگام‌سازی کامل نشد/);
});

test("product image input preserves existing inline Hero, Banner, Logo and Product media flow", () => {
  const source = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  assert.match(source, /data-product-image-input="true"/);
  assert.match(source, /assetType: "product"/);
  assert.match(source, /URL نهایی آن در محصول ثبت خواهد شد/);
  assert.match(source, /function uploadMedia\(target: InlineMediaTarget, file: File\)/);
  for (const kind of ["hero", "logo", "banner", "product"]) assert.match(source, new RegExp(`target\\.kind === "${kind}"`));
  assert.match(source, /onImageUpload=\{uploadMedia\}/);
});
