import assert from "node:assert/strict";
import test from "node:test";
import { controlCenterFor, controlCenterKind, controlCenterPath, indef, publicSitePath, websiteStudioPath, workspaceBookingModules } from "../../src/components/control-center/modules.ts";

const labels = (type) => controlCenterFor(type).modules.map((m) => m.label);
const keys = (type) => controlCenterFor(type).modules.map((m) => m.key);

test("the sidebar is driven by the capabilities the site type actually has", () => {
  assert.deepEqual(keys("MEDICAL"), ["dashboard", "content", "people", "providers", "services", "schedules", "appointments", "files", "settings"]);
  assert.deepEqual(keys("EDUCATION"), ["dashboard", "content", "people", "providers", "services", "schedules", "appointments", "files"]);
  assert.deepEqual(keys("STORE"), ["dashboard", "content", "commerce"]);
  assert.deepEqual(keys("BUSINESS"), ["dashboard", "content"]);
  assert.deepEqual(keys(undefined), ["dashboard", "content"]);
});

test("Medical vocabulary", () => {
  assert.deepEqual(labels("MEDICAL"), ["نمای کلی", "محتوا", "بیماران", "پزشکان", "خدمات", "برنامهٔ پزشکان", "نوبت‌ها", "فایل‌ها", "تنظیمات"]);
  assert.equal(controlCenterFor("medical").vocabulary.center, "مرکز مدیریت درمانی");
});

test("Education vocabulary", () => {
  assert.deepEqual(labels("EDUCATION"), ["نمای کلی", "محتوا", "دانشجویان", "مدرس‌ها", "دوره‌ها", "برنامهٔ مدرس‌ها", "رزروها", "منابع آموزشی"]);
  assert.equal(controlCenterFor("EDUCATION").vocabulary.center, "مرکز مدیریت آموزش");
});

test("no cross-vertical leakage between Medical and Education vocabularies", () => {
  const medical = JSON.stringify(controlCenterFor("MEDICAL").vocabulary) + labels("MEDICAL").join(" ");
  const education = JSON.stringify(controlCenterFor("EDUCATION").vocabulary) + labels("EDUCATION").join(" ");
  for (const term of ["دانشجو", "مدرس", "دوره", "رزرو", "کلاس", "آموزش"]) assert.ok(!medical.includes(term), `Medical leaks "${term}"`);
  for (const term of ["بیمار", "پزشک", "نوبت", "درمان", "مراجعه"]) assert.ok(!education.includes(term), `Education leaks "${term}"`);
});

test("no module is shown for data that does not exist (no payments/messages/analytics invented)", () => {
  for (const type of ["MEDICAL", "EDUCATION", "STORE", "BUSINESS"]) {
    const text = labels(type).join(" ");
    for (const term of ["پرداخت", "پیام", "تحلیل"]) assert.ok(!text.includes(term), `${type} lists "${term}"`);
  }
});

test("one routing model and the Build <-> Operate paths", () => {
  assert.equal(controlCenterPath("a b"), "/dashboard/websites/a%20b/control");
  assert.equal(controlCenterPath("s1", "providers"), "/dashboard/websites/s1/control/providers");
  assert.equal(controlCenterPath("s1", "dashboard"), "/dashboard/websites/s1/control");
  assert.equal(websiteStudioPath("s1", "MEDICAL"), "/dashboard/websites/corporate?project=s1");
  assert.equal(websiteStudioPath("s1", "ECOMMERCE"), "/dashboard/websites/store?project=s1");
  assert.equal(publicSitePath("s1", "EDUCATION"), "/site/s1");
  assert.equal(publicSitePath("s1", "STORE"), "/store/s1");
  assert.equal(controlCenterKind("ecommerce"), "STORE");
});

test("workspace Booking Studio reuses only the booking modules", () => {
  assert.deepEqual(workspaceBookingModules().map((m) => m.key), ["providers", "services", "schedules", "appointments"]);
});

test("Persian indefinite forms used in empty states", () => {
  assert.equal(indef("پزشک"), "پزشکی"); assert.equal(indef("دوره"), "دوره‌ای"); assert.equal(indef("مدرس"), "مدرسی"); assert.equal(indef("نوبت"), "نوبتی");
});
