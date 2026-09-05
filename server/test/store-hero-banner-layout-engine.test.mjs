import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd(), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const types = read("src/components/store-studio-v16/types.ts");
const config = read("src/components/store-studio-v16/config.ts");
const layouts = read("src/components/store-studio-v16/HeroBannerLayout.tsx");
const inspector = read("src/components/store-studio-v16/InspectorPanel.tsx");
const canvas = read("src/components/store-studio-v16/StudioCanvas.tsx");
const core = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");

test("V16 models every approved Hero layout with bounded proportions and heights", () => {
  for (const value of ["full-image", "image-text", "main-two", "main-secondary", "text-led"])
    assert.match(types, new RegExp(`"${value}"`));
  assert.match(types, /LayoutRatio = 50 \| 60 \| 70 \| 80/);
  assert.match(types, /LayoutHeight = "compact" \| "medium" \| "large" \| "extra-large"/);
  assert.match(types, /MediaSlots = Record<MediaSlotKey, MediaSlot>/);
  assert.match(config, /layoutHeightPixels/);
  assert.match(layouts, /gridTemplateColumns: desktopColumns\(ratio, direction, primaryIsMedia\)/);
  assert.match(layouts, /data-hero-layout="full-image"/);
  assert.match(layouts, /hero\.overlayOpacity/);
  assert.match(layouts, /layout !== "text-led"/);
});

test("Hero text and every required independent media slot are editable", () => {
  for (const label of ["عنوان اصلی", "زیرعنوان / توضیح", "متن CTA اصلی", "لینک CTA اصلی", "متن CTA دوم", "لینک CTA دوم"])
    assert.match(inspector, new RegExp(label));
  assert.match(inspector, /activeMediaSlots\(layout\)/);
  assert.match(core, /const slot = target\.slot \|\| "main"/);
  assert.match(core, /mediaSlots: \{ \.\.\.current\.hero\.mediaSlots, \[slot\]/);
  assert.match(canvas, /target=\{\{ kind: "hero", slot \}\}/);
  assert.match(canvas, /label=\{hasImage \? "تغییر تصویر" : "افزودن تصویر"\}/);
});

test("reusable Banner sections expose layouts, ordering, text, CTA and per-slot media", () => {
  for (const value of ["full-width", "two-up", "main-two", "image-text", "text-image"])
    assert.match(types, new RegExp(`"${value}"`));
  assert.match(inspector, /data-banner-layout-inspector="true"/);
  assert.match(inspector, /activeMediaSlots\(banner\.layout\)/);
  assert.match(inspector, /جایگاه بنر اصلی/);
  assert.match(inspector, /لینک CTA/);
  assert.match(core, /sections\.splice\(Math\.min\(index, sections\.length\), 0, section\)/);
  assert.match(core, /kind === "banner"/);
  assert.match(core, /banner: \{ \.\.\.banner, mediaSlots:/);
  assert.match(canvas, /target=\{\{ kind: "banner", id: section\.id, slot \}\}/);
  assert.match(layouts, /BannerLayoutRenderer/);
});

test("layout state is backward compatible, persisted authoritatively, and mobile-safe", () => {
  for (const legacy of ["storeBuilderV11", "storeBuilderV13", "storeBuilderV14", "storeBuilderV15", "storeBuilderV16"])
    assert.match(config, new RegExp(legacy));
  assert.match(config, /normalizedMediaSlots/);
  assert.match(config, /bannerConfigForSection/);
  assert.match(core, /const storeBuilderV16: StudioConfig = \{ \.\.\.nextConfig, version: 16 \}/);
  assert.match(core, /await persistConfig\(nextConfig\)/);
  assert.match(layouts, /if \(device === "mobile"\) return <div className="grid grid-cols-1">/);
  assert.match(layouts, /device === "tablet" \? 40 : 50/);
  assert.match(canvas, /props\.device==="tablet"\?"768px":"390px"/);
  const source = [layouts, inspector, canvas, core].join("\n");
  for (const forbidden of ["querySelector", "MutationObserver", "createPortal", "style.setProperty", "/media/upload-url"])
    assert.equal(source.includes(forbidden), false, forbidden);
});

test("draft preview stays free of editor instructions and incomplete layouts degrade safely", () => {
  assert.match(layouts, /\{control && <span className="mt-1 block text-\[10px\]">برای انتخاب تصویر کلیک کنید<\/span>\}/);
  assert.match(layouts, /if \(!editor && !hasMedia\("main"\)\)/);
  assert.match(layouts, /if \(!secondarySlots\.length\) return fullMedia\(\)/);
  assert.match(layouts, /if \(!editor && !hasMedia\("secondary"\)\) return fullMedia\(\)/);
  assert.match(canvas, /renderMediaControl=\{interactive \? \(slot, hasImage\) => \(/);
  assert.match(canvas, /renderMediaControl=\{props\.interactive !== false \? \(slot, hasImage\) => \(/);
});
