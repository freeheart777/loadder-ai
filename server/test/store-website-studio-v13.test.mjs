import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../src/App.tsx");
const v13 = read("../../src/pages/StoreWebsiteStudioPageV13.tsx");
const v14 = read("../../src/pages/StoreWebsiteStudioPageV14.tsx");
const v15 = read("../../src/pages/StoreWebsiteStudioPageV15.tsx");
const v16 = read("../../src/pages/StoreWebsiteStudioPageV16.tsx");
const v16Types = read("../../src/components/store-studio-v16/types.ts");
const v16Config = read("../../src/components/store-studio-v16/config.ts");
const v16Canvas = read("../../src/components/store-studio-v16/StudioCanvas.tsx");
const v16Inspector = read("../../src/components/store-studio-v16/InspectorPanel.tsx");
const v16Source = [v16, v16Types, v16Config, v16Canvas, v16Inspector].join("\n");

function routeWindow(path,length=260){const marker=`path="${path}"`,at=app.indexOf(marker);assert.ok(at>=0,`missing route ${path}`);return app.slice(at,at+length);}

test("main Store Studio routes use canonical V16 and legacy URLs cannot surface old studios", () => {
  for (const route of ["/dashboard/websites", "/dashboard/websites/studio", "/site-builder"]) {
    assert.match(routeWindow(route),/element=\{<StoreWebsiteStudioPageV16\s*\/>\}/);
  }
  for (const route of ["studio-v13", "studio-v14", "studio-v15", "studio-v16"]) {
    assert.match(routeWindow(`/dashboard/websites/${route}`),/<Navigate\s+to="\/dashboard\/websites"\s+replace\s*\/>/);
  }
  for (const [route,page] of [["fallback/v13","StoreWebsiteStudioPageV13"],["fallback/v14","StoreWebsiteStudioPageV14"],["fallback/v15","StoreWebsiteStudioPageV15"]]) {
    assert.match(routeWindow(`/dashboard/websites/${route}`),new RegExp(page));
  }
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
  assert.match(v16, /const\s+storeBuilderV16\s*:\s*StudioConfig\s*=\s*\{\s*\.\.\.config\s*,\s*version\s*:\s*16\s*\}/);
  assert.match(v16, /const\s+content\s*=\s*\{\s*\.\.\.project\.content\s*,\s*storeBuilderV16\s*\}/);
  assert.match(v16, /method\s*:\s*"PATCH"/);
  for (const legacy of ["storeBuilderV15", "storeBuilderV14", "storeBuilderV13", "storeBuilderV11"])
    assert.match(v16Config, new RegExp(legacy));
  assert.match(v16Types, /version: 16/);
  assert.match(v16Source, /runtime عمومی Cart\/Checkout\/Order تغییر نمی‌کند/);
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
  for (const field of ["selectedProductId","title","regularPriceMinor","compareAtPriceMinor","promotionBadge","promotionBadgeText","cartButtonLabel","shippingLabel","freeShippingThresholdMinor","checkoutButtonLabel","orderSuccessTitle"]) assert.match(v15,new RegExp(field));
});

test("V15 persists backward-compatible configuration without replacing commerce runtime", () => {
  assert.match(v15, /const content=\{\.\.\.project\.content,storeBuilderV15:\{version:15,commerce,design,sections,previewMode\}\}/);
  assert.match(v15, /content\.storeBuilderV14\?\.commerce/);
  assert.match(v15, /content\.storeBuilderV11\?\.sections/);
  assert.match(v15, /Runtime عمومی Cart\/Checkout\/Order بدون تغییر باقی می‌ماند/);
  assert.doesNotMatch(v15, /api\/public\/storefront|api\/public\/cart|Commerce Core V2|addPublicCartItem/);
  const writes = [...v15.matchAll(/apiFetch\(`([^`]+)`?,\{method:"(POST|PUT|PATCH|DELETE)"/g)];
  assert.equal(writes.length, 1);
  assert.equal(writes[0][2], "PATCH");
  assert.match(writes[0][1], /^\/api\/site-projects\//);
});

test("V14 is a non-destructive commerce bridge over standalone V13",()=>{
  assert.match(v14,/StoreWebsiteStudioPageV13/);
  assert.match(v14,/storeBuilderV14/);
  assert.match(v14,/commerce:config/);
  for(const field of ["currency","lowStockThreshold","allowBackorder","showCoupon","freeShippingThresholdMinor","collectEmail","collectPostalCode","paymentMode","orderSuccessTitle","cartButtonLabel","checkoutButtonLabel"]) assert.match(v14,new RegExp(field));
  assert.match(v14,/\/dashboard\/websites\/commerce/);
  assert.match(v14,/COMMERCE BRIDGE V14/);
});

test("V13 is standalone and has no DOM-driven canvas manipulation", () => {
  assert.doesNotMatch(v13, /StoreWebsiteStudioPageV1[012]/);
  for(const forbidden of ["querySelector","MutationObserver","setTimeout","createPortal","document.","style.setProperty"]) assert.equal(v13.includes(forbidden), false, forbidden);
  assert.match(v13, /function PreviewContainer/);
  assert.match(v13, /data-preview-mode=\{mode\}/);
});

test("preview modes and responsive storefront layouts are explicit React branches", () => {
  assert.match(v13, /type PreviewMode = "desktop" \| "tablet" \| "mobile"/);
  assert.match(v13, /mode === "tablet" \? "768px" : "390px"/);
  assert.match(v13, /mode === "desktop" \? "1180px"/);
  assert.match(v13, /columns=\{mobile \? 2 : tablet \? 3 : 4\}/);
  assert.match(v13, /gridTemplateColumns: mobile \? "1fr" : "repeat\(2,minmax\(0,1fr\)\)"/);
  assert.match(v13, /mobile \? \(\s*<header/);
  assert.match(v13, /if \(mobile\)\s*return \(\s*<section/);
});

test("all V13 design controls are state-owned and applied to preview", () => {
  for (const field of ["fontFamily","primaryColor","textColor","backgroundColor","typographyScale","borderRadius","sectionSpacing","heroOverlayIntensity","headingSize","bodyTextSize","buttonRadius","cardShadowStrength"]) assert.match(v13,new RegExp(field));
  for (const label of ["دسکتاپ","تبلت","موبایل","طراحی","بخش‌ها","پیش‌نمایش فروشگاه"]) assert.match(v13,new RegExp(label));
});

test("V11 content and commerce data remain backward-compatible on load and save", () => {
  assert.match(v13, /content\?\.storeBuilderV11\?\.sections/);
  assert.match(v13, /content\?\.commerceStudioV7/);
  assert.match(v13, /storeBuilderV11:\s*\{/);
  assert.match(v13, /storeBuilderV13:\s*\{ version: 13, design \}/);
  assert.match(v13, /commerceStudioV7:\s*\{/);
  assert.match(v13, /const content = \{\s*\.\.\.project\.content/);
  assert.match(v13, /\/api\/stores\/\$\{selected\.id\}\/products/);
});