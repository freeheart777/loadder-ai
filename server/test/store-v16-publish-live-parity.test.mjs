import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("public Store and product routes delegate to the canonical V16 renderer", () => {
  const runtime = source("src/components/store-studio-v16/PublicStorefrontRuntime.tsx");
  assert.match(runtime, /import StudioCanvas from "\.\/StudioCanvas"/);
  assert.match(source("src/pages/PublicStorefrontPage.tsx"), /PublicStorefrontRuntime page="storefront"/);
  assert.match(source("src/pages/PublicProductPage.tsx"), /PublicStorefrontRuntime page="product"/);
  assert.doesNotMatch(runtime, /dangerouslySetInnerHTML|querySelector|MutationObserver|createPortal/);
});

test("public Store presentation is sourced from the latest immutable publish version only", () => {
  const auth = source("server/app/routes/auth.mjs");
  const projection = source("server/app/services/store-public-presentation.mjs");
  assert.match(auth, /ORDER BY latest\.version DESC LIMIT 1/);
  assert.match(auth, /publishedVersion:\{id:store\.publishedVersionId/);
  assert.match(auth, /projectPublicStorePresentation\(content\)/);
  assert.match(projection, /projectProductOverrides/);
  assert.doesNotMatch(projection, /title:string\(source\.title\).*productOverrides/);
  assert.doesNotMatch(auth, /presentation:content/);
});

test("V16 product presentation cannot override authoritative catalog money", () => {
  const config = source("src/components/store-studio-v16/config.ts");
  assert.match(config, /regularPriceMinor: product\.basePriceMinor/);
  assert.match(config, /compareAtPriceMinor: product\.compareAtPriceMinor \?\? null/);
  assert.match(config, /title: product\.name/);
  assert.match(config, /imageUrl: productMainImage\(product\)/);
  assert.doesNotMatch(config, /regularPriceMinor: override\.regularPriceMinor/);
  assert.doesNotMatch(config, /title: override\.title/);
  assert.doesNotMatch(config, /imageUrl: override\.imageUrl/);
});

test("publication and public availability share authoritative transactional policies", () => {
  const repository=source("server/app/repositories/site-project-repository.mjs");
  const ecommerce=source("server/app/services/ecommerce-service.mjs");
  const auth=source("server/app/routes/auth.mjs");
  assert.match(repository,/function publish\(id, now\).*db\.transaction/s);
  assert.match(ecommerce,/export const isVariantPurchasable/);
  assert.match(ecommerce,/if \(!isVariantPurchasable\(variant, quantity\)\)/);
  assert.match(auth,/purchasable:isVariantPurchasable\(v\)/);
});

test("Studio distinguishes draft preview, save, and explicit publication", () => {
  const core = source("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  const toolbar = source("src/components/store-studio-v16/StudioToolbar.tsx");
  assert.match(core, /\/publish`, \{ method: "POST" \}/);
  assert.match(core, /پیش‌نمایش پیش‌نویس/);
  assert.match(toolbar, /انتشار نسخه/);
  assert.match(toolbar, /ذخیره و انتشار مستقل‌اند/);
});
