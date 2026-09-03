import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Store Studio media is uploaded from the rendered image, not a detached picker modal", () => {
  const canvas = read("src/components/store-studio-v16/StudioCanvas.tsx");
  const core = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");

  assert.match(canvas, /data-inline-media-control="true"/);
  assert.match(canvas, /data-inline-media-input="true"/);
  assert.match(canvas, /kind:\s*"hero"/);
  assert.match(canvas, /kind:\s*"banner"/);
  assert.match(canvas, /kind:\s*"logo"/);
  assert.match(canvas, /kind:\s*"product"/);
  assert.match(canvas, /onImageUpload/);

  assert.match(core, /async function uploadMedia\(target: InlineMediaTarget, file: File\)/);
  assert.match(core, /applyMediaToConfig/);
  assert.match(core, /await persistConfig\(nextConfig\)/);
  assert.match(core, /onImageUpload=\{uploadMedia\}/);
  assert.doesNotMatch(core, /mediaTarget/);
  assert.doesNotMatch(core, /انتخاب تصویر/);
});

test("inline media upload fails loudly and persists after successful completion", () => {
  const core = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  assert.match(core, /HTTP \$\{uploaded\.status\}/);
  assert.match(core, /URL تصویر دریافت نشد/);
  assert.match(core, /تصویر آپلود، اعمال و ذخیره شد/);
  assert.match(core, /assetType = target\.kind/);
  assert.match(core, /credentials:\s*upload\.local\s*\?\s*"include"\s*:\s*"omit"/, "local API upload must carry the authenticated session while external signed storage URLs must not");
});
