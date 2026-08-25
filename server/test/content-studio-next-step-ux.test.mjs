import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studio = readFileSync(new URL("../../src/pages/ContentStudioPage.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");

test("Content Studio exposes bounded next steps only after a successful library save", () => {
  assert.match(studio, /\{savedItemId && <section aria-labelledby="content-next-steps-title"/);
  assert.match(studio, /محتوای شما آماده است؛ مرحله بعد چیست؟/);
  assert.match(studio, /setSavedItemId\(data\.item\.id\)/);
  assert.match(studio, /to=\{`\/dashboard\/library\/\$\{savedItemId\}`\}/);
});

test("next steps use only canonical controlled-launch routes", () => {
  for (const route of ["/dashboard/landings/new", "/dashboard/websites/new", "/dashboard"]) {
    assert.match(studio, new RegExp(`to="${route.replaceAll("/", "\\/")}"`));
    assert.match(app, new RegExp(`path="${route.replaceAll("/", "\\/")}"`));
  }
  for (const forbidden of ["/dashboard/catalog", "/dashboard/integrations", "/dashboard/domains", "/store/cart", "/store/payment", "/dashboard/automation", "/dashboard/ads"]) {
    assert.equal(studio.includes(forbidden), false);
  }
});

test("next steps navigate without payload transfer publication or execution", () => {
  const nextSteps = studio.slice(studio.indexOf('aria-labelledby="content-next-steps-title"'));
  assert.doesNotMatch(nextSteps, /[?&](content|text|prompt)=|navigate\([^)]*,\s*\{\s*state|apiFetch|publish|execute|انتشار خودکار/);
  assert.match(nextSteps, /هیچ محتوا، صفحه یا سایتی خودکار ساخته، منتشر یا اجرا نمی‌شود/);
});

test("next-step actions are RTL mobile-safe and dashboard navigation remains persistent", () => {
  assert.match(studio, /<main dir="rtl"/);
  assert.match(studio, /grid grid-cols-1 gap-3 sm:grid-cols-2/);
  assert.match(studio, /min-h-11/);
  assert.match(studio, /<Link to=\{withDemo\("\/dashboard"\)\}/);
});
