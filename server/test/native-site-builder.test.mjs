import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("dashboard no longer points to the external portal", () => {
  const dashboard = read("../../src/pages/DashboardPage.tsx");
  const app = read("../../src/App.tsx");
  assert.doesNotMatch(dashboard, /iportals?\.ir/i);
  assert.match(dashboard, /\/dashboard\/websites\/new/);
  assert.match(app, /path=\"\/dashboard\/websites\/new\"/);
  assert.match(app, /path=\"\/site-builder\"/);
});

test("native builder is context-first and supports core website verticals", () => {
  const page = read("../../src/pages/NativeSiteBuilderPage.tsx");
  assert.match(page, /business-context/);
  for (const type of ["BUSINESS", "STORE", "NEWS", "LEGAL", "MEDICAL"]) assert.match(page, new RegExp(type));
  assert.match(page, /valueProposition/);
  assert.match(page, /offerings/);
  assert.match(page, /targetAudiences/);
  assert.match(page, /differentiators/);
  assert.match(page, /رزرو نوبت/);
});

test("native builder accepts manual visual assets and keeps a resumable draft", () => {
  const page = read("../../src/pages/NativeSiteBuilderPage.tsx");
  for (const kind of ["logo", "hero", "banner", "product"]) assert.match(page, new RegExp(`kind === \\"${kind}\\"|\\\"${kind}\\\"`));
  assert.match(page, /type=\"file\"/);
  assert.match(page, /image\//);
  assert.match(page, /FileReader/);
  assert.match(page, /localStorage/);
  assert.match(page, /توضیحات تکمیلی/);
  assert.match(page, /ساخت خودکار سایت/);
});
