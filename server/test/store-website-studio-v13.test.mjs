import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../src/App.tsx");
const v13 = read("../../src/pages/StoreWebsiteStudioPageV13.tsx");

test("main Store Studio routes use V13 while V11 and V12 remain available", () => {
  for (const route of [
    "/dashboard/websites",
    "/dashboard/websites/studio",
    "/site-builder",
  ]) {
    const escaped = route.replaceAll("/", "\\/");
    assert.match(
      app,
      new RegExp(
        `path="${escaped}"[\\s\\S]{0,100}element=\\{<StoreWebsiteStudioPageV13 \\/>\\}`,
      ),
    );
  }
  assert.match(
    app,
    /path="\/dashboard\/websites\/studio-v11"[\s\S]{0,100}StoreWebsiteStudioPageV11/,
  );
  assert.match(
    app,
    /path="\/dashboard\/websites\/studio-v12"[\s\S]{0,100}StoreWebsiteStudioPageV12/,
  );
  assert.match(
    app,
    /path="\/dashboard\/websites\/studio-v13"[\s\S]{0,100}StoreWebsiteStudioPageV13/,
  );
});

test("V13 is standalone and has no DOM-driven canvas manipulation", () => {
  assert.doesNotMatch(v13, /StoreWebsiteStudioPageV1[012]/);
  for (const forbidden of [
    "querySelector",
    "MutationObserver",
    "setTimeout",
    "createPortal",
    "document.",
    "style.setProperty",
  ]) {
    assert.equal(v13.includes(forbidden), false, forbidden);
  }
  assert.match(v13, /function PreviewContainer/);
  assert.match(v13, /data-preview-mode=\{mode\}/);
});

test("preview modes and responsive storefront layouts are explicit React branches", () => {
  assert.match(v13, /type PreviewMode = "desktop" \| "tablet" \| "mobile"/);
  assert.match(v13, /mode === "tablet" \? "768px" : "390px"/);
  assert.match(v13, /mode === "desktop" \? "1180px"/);
  assert.match(v13, /columns=\{mobile \? 2 : tablet \? 3 : 4\}/);
  assert.match(
    v13,
    /gridTemplateColumns: mobile \? "1fr" : "repeat\(2,minmax\(0,1fr\)\)"/,
  );
  assert.match(v13, /mobile \? \(\s*<header/);
  assert.match(v13, /if \(mobile\)\s*return \(\s*<section/);
});

test("all V13 design controls are state-owned and applied to preview", () => {
  for (const field of [
    "fontFamily",
    "primaryColor",
    "textColor",
    "backgroundColor",
    "typographyScale",
    "borderRadius",
    "sectionSpacing",
    "heroOverlayIntensity",
    "headingSize",
    "bodyTextSize",
    "buttonRadius",
    "cardShadowStrength",
  ])
    assert.match(v13, new RegExp(field));
  for (const label of [
    "دسکتاپ",
    "تبلت",
    "موبایل",
    "طراحی",
    "بخش‌ها",
    "پیش‌نمایش فروشگاه",
  ])
    assert.match(v13, new RegExp(label));
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
