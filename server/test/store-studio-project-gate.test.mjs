import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Store Studio is gated behind a readable persistent STORE project", () => {
  const wrapper = read("src/pages/StoreWebsiteStudioPageV16.tsx");
  const helper = read("src/lib/activeStoreProject.ts");

  assert.match(wrapper, /loadActiveStoreProject\(\)/);
  assert.match(wrapper, /state === "ready"/);
  assert.match(wrapper, /<StoreWebsiteStudioPageV16Core/);
  assert.match(wrapper, /data-store-project-gate/);
  assert.doesNotMatch(wrapper, /restoreConfig\(\{\}\)/, "wrapper must not render a fake default canvas");

  assert.match(helper, /siteType:\s*"STORE"/);
  assert.match(helper, /method:\s*"POST"/);
  assert.match(helper, /\/api\/site-projects\/\$\{project\.id\}/);
});

test("Commerce manager uses the same active-store identity contract", () => {
  const wrapper = read("src/pages/StoreCommerceManagerPage.tsx");
  assert.match(wrapper, /ensureActiveStoreProject\(\)/);
  assert.match(wrapper, /state === "ready"/);
  assert.match(wrapper, /<StoreCommerceManagerPageCore/);
});

test("all active website builder entry routes converge on gated V16", () => {
  const app = read("src/App.tsx");
  assert.match(app, /path="\/dashboard\/websites" element=\{<StoreWebsiteStudioPageV16 \/>\}/);
  assert.match(app, /path="\/dashboard\/websites\/studio" element=\{<StoreWebsiteStudioPageV16 \/>\}/);
  assert.match(app, /path="\/site-builder" element=\{<StoreWebsiteStudioPageV16 \/>\}/);
  for (const duplicate of ["/dashboard/websites/new", "/dashboard/websites/quick-start"]) {
    const escaped = duplicate.replaceAll("/", "\\/");
    assert.match(app, new RegExp(`path="${escaped}"[\\s\\S]{0,100}<Navigate to="\\/dashboard\\/websites" replace \\/>`));
  }
  assert.doesNotMatch(app, /StoreQuickStartPage/);
});
