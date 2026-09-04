import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Store Studio media is uploaded from the rendered image, not a detached picker modal", () => {
  const canvas = read("src/components/store-studio-v16/StudioCanvas.tsx");
  const core = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  const mediaControl = canvas.slice(canvas.indexOf("function InlineMediaControl"), canvas.indexOf("function editorLabel"));

  assert.match(canvas, /data-inline-media-control="true"/);
  assert.match(canvas, /data-inline-media-input="true"/);
  assert.match(canvas, /kind:\s*"hero"/);
  assert.match(canvas, /kind:\s*"banner"/);
  assert.match(canvas, /kind:\s*"logo"/);
  assert.match(canvas, /kind:\s*"product"/);
  assert.match(canvas, /onImageUpload/);
  assert.match(mediaControl, /absolute inset-0/);
  assert.match(mediaControl, /type="file"/);
  assert.match(mediaControl, /group-hover\/media/);
  assert.doesNotMatch(mediaControl, /<Plus/);

  assert.match(core, /async function uploadMedia\(target: InlineMediaTarget, file: File\)/);
  assert.match(core, /applyMediaToConfig/);
  assert.match(core, /await persistConfig\(nextConfig\)/);
  assert.match(core, /onImageUpload=\{uploadMedia\}/);
  assert.doesNotMatch(core, /mediaTarget/);
  assert.doesNotMatch(core, /انتخاب تصویر/);
});

test("inline media upload uses canonical helper, surfaces failures and persists success", () => {
  const core = read("src/pages/StoreWebsiteStudioPageV16Core.tsx");
  const helper = read("src/lib/siteMediaUpload.ts");

  assert.match(core, /import \{ uploadSiteMedia \} from "\.\.\/lib\/siteMediaUpload"/);
  assert.match(core, /const uploaded = await uploadSiteMedia\(\{/);
  assert.match(core, /siteProjectId: project\.id/);
  assert.match(core, /assetType: target\.kind/);
  assert.match(core, /URL تصویر دریافت نشد/);
  assert.match(core, /setMessage\(e instanceof Error \? e\.message : "آپلود ناموفق بود"\)/);
  assert.match(core, /تصویر آپلود، اعمال و ذخیره شد/);
  assert.match(core, /await persistConfig\(nextConfig\)/);
  assert.doesNotMatch(core, /\/media\/upload-url/);
  assert.doesNotMatch(core, /\/media\/complete/);
  assert.doesNotMatch(core, /fetch\(upload\.signedUrl/);

  assert.match(helper, /apiFetch\(`\/api\/site-projects\/\$\{siteProjectId\}\/media\/upload`/);
  assert.match(helper, /body: file/);
});
