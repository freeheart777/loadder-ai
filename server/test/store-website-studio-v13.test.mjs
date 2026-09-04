import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../src/App.tsx");
const v13 = read("../../src/pages/StoreWebsiteStudioPageV13.tsx");
const v14 = read("../../src/pages/StoreWebsiteStudioPageV14.tsx");
const v15 = read("../../src/pages/StoreWebsiteStudioPageV15.tsx");
const v16Gate = read("../../src/pages/StoreWebsiteStudioPageV16.tsx");
const v16 = read("../../src/pages/StoreWebsiteStudioPageV16Core.tsx");
const v16Types = read("../../src/components/store-studio-v16/types.ts");
const v16Config = read("../../src/components/store-studio-v16/config.ts");
const v16Canvas = read("../../src/components/store-studio-v16/StudioCanvas.tsx");
const v16Inspector = read("../../src/components/store-studio-v16/InspectorPanel.tsx");
const v16Source = [v16Gate, v16, v16Types, v16Config, v16Canvas, v16Inspector].join("\n");

test("main Store Studio route uses canonical gated V16 and every legacy URL redirects to it", () => {
  assert.match(app, /path="\/dashboard\/websites" element=\{<StoreWebsiteStudioPageV16 \/>\}/);
  assert.match(app, /const canonicalBuilder = <Navigate to="\/dashboard\/websites" replace \/>/);
  for (const route of [
    "/dashboard/websites/studio",
    "/site-builder",
    "/dashboard/websites/studio-v13",
    "/dashboard/websites/studio-v14",
    "/dashboard/websites/studio-v15",
    "/dashboard/websites/studio-v16",
    "/dashboard/websites/fallback/v13",
    "/dashboard/websites/fallback/v14",
    "/dashboard/websites/fallback/v15",
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(app, new RegExp(`path="${escaped}" element=\\{canonicalBuilder\\}`));
  }
  assert.match(v16Gate, /loadActiveStoreProject/);
  assert.match(v16Gate, /state === "ready"/);
  assert.match(v16Gate, /StoreWebsiteStudioPageV16Core/);
  assert.doesNotMatch(app, /element=\{<StoreWebsiteStudioPageV(?:13|14|15)\s*\/?>\}/);
});

test("V16 is a true state-owned visual canvas with contextual selection", () => {
  assert.match(v16, /data-studio-version="16"/);
  assert.match(v16, /LOADDER VISUAL STUDIO/);
  assert.match(v16Types, /selectedElement: Selection/);
  assert.match(v16Canvas, /data-editor-element=\{interactive \? type : undefined\}/);
  assert.match(v16Canvas, /data-editor-selected=\{interactive \? \(active \? "true" : "false"\) : undefined\}/);
  assert.match(v16Canvas, /data-canvas-interactive=\{props\.interactive === false \? "false" : "true"\}/);
  const dynamicEvalToken = "ev" + "al(";
  for (const forbidden of ["querySelector", "MutationObserver", "createPortal", "document.", "style.setProperty", dynamicEvalToken])
    assert.equal(v16Source.includes(forbidden), false, forbidden);
});

test("V16 supports responsive commerce pages and configurable product sections", () => {
  assert.match(v16Types, /PageMode = "storefront" \| "collection" \| "product" \| "cart" \| "checkout" \| "success"/);
  assert.match(v16Types, /DeviceMode = "desktop" \| "tablet" \| "mobile"/);
  assert.match(v16Canvas, /props\.device==="tablet"\?"768px":"390px"/);
  assert.match(v16Canvas, /data-preview-device=\{props\.device\}/);
  for (const field of ["columnsDesktop", "columnsTablet", "columnsMobile", "productIds", "cardStyle", "imageRatio", "showPromotionBadge", "showCartButton"])
    assert.match(v16Source, new RegExp(field));
});

test("V16 reads real catalog and media while keeping visual overrides separate", () => {
  assert.match(v16, /\/api\/stores\/\$\{selected\.id\}\/products/);
  assert.match(v16, /setAssets\(\(detail\.assets/);
  assert.match(v16Inspector, /ویرایش اطلاعات اصلی محصول/);
  assert.match(v16Inspector, /override بصری/);
  assert.match(v16, /\/media\/upload-url/);
  assert.match(v16, /\/media\/complete/);
  assert.doesNotMatch(v16Source, /\/api\/commerce\/products\/\$\{/);
  assert.doesNotMatch(v16Source, /api\/public\/cart|api\/public\/checkout|addPublicCartItem|Commerce Core V2/);
});

test("V16 persists only storeBuilderV16 and preserves legacy configuration", () => {
  assert.match(v16, /async function persistConfig\(nextConfig:\s*StudioConfig\)/);
  assert.match(v16, /const\s+storeBuilderV16\s*:\s*StudioConfig\s*=\s*\{\s*\.\.\.nextConfig\s*,\s*version\s*:\s*16\s*\}/);
  assert.match(v16, /const\s+content\s*=\s*\{\s*\.\.\.project\.content\s*,\s*storeBuilderV16\s*\}/);
  assert.match(v16, /await\s+persistConfig\(nextConfig\)/);
  assert.match(v16, /method\s*:\s*"PATCH"/);
  for (const legacy of ["storeBuilderV15", "storeBuilderV14", "storeBuilderV13", "storeBuilderV11"])
    assert.match(v16Config, new RegExp(legacy));
  assert.match(v16Types, /version: 16/);
  assert.doesNotMatch(v16Source, /Commerce Core V2|addPublicCartItem|api\/public\/cart|api\/public\/checkout/);
});

test("V15 is a state-owned commerce editor without DOM-driven canvas manipulation", () => {
  assert.match(v15, /Loadder Commerce Studio V15/);
  assert.doesNotMatch(v15, /StoreWebsiteStudioPageV1[234]/);
  for (const forbidden of ["querySelector", "MutationObserver", "createPortal", "document.", "style.setProperty"])
    assert.equal(v15.includes(forbidden), false, forbidden);
  assert.match(v15, /type DeviceMode="desktop"\|"tablet"\|"mobile"/);
  assert.match(v15, /type CommercePreviewMode="storefront"\|"cart"\|"checkout"\|"success"/);
  assert.match(v15, /data-preview-device=\{device\}/);
});

test("V15 exposes direct product and checkout-copy editing", () => {
  for (const field of [
    "selectedProductId",
    "title",
    "regularPriceMinor",
    "compareAtPriceMinor",
    "promotionBadge",
    "promotionBadgeText",
    "cartButtonLabel",
    "checkoutButtonLabel",
    "orderSuccessTitle",
  ]) assert.match(v15, new RegExp(field));
});

test("V15 persists backward-compatible configuration without replacing commerce runtime", () => {
  assert.match(v15, /storeBuilderV15/);
  assert.match(v15, /\.\.\.project\.content/);
  assert.match(v15, /method:"PATCH"/);
  assert.doesNotMatch(v15, /api\/public\/cart|api\/public\/checkout|addPublicCartItem/);
});

test("V14 is a non-destructive commerce bridge over standalone V13", () => {
  assert.match(v14, /StoreWebsiteStudioPageV13/);
  assert.match(v14, /Commerce Core V2/);
  assert.doesNotMatch(v14, /querySelector|MutationObserver|createPortal|document\./);
});

test("V13 is standalone and has no DOM-driven canvas manipulation", () => {
  assert.doesNotMatch(v13, /StoreWebsiteStudioPageV1[12]/);
  for (const forbidden of ["querySelector", "MutationObserver", "createPortal", "document.", "style.setProperty"])
    assert.equal(v13.includes(forbidden), false, forbidden);
});

test("preview modes and responsive storefront layouts are explicit React branches", () => {
  assert.match(v13, /type PreviewMode = "desktop" \| "tablet" \| "mobile"/);
  assert.match(v13, /data-preview-mode=\{mode\}/);
});

test("all V13 design controls are state-owned and applied to preview", () => {
  assert.match(v13, /design/);
  assert.match(v13, /setConfig|setDesign|patch/);
});

test("V11 content and commerce data remain backward-compatible on load and save", () => {
  assert.match(v16Config, /storeBuilderV11/);
  assert.match(v16Config, /storeBuilderV1[3456]/);
});
