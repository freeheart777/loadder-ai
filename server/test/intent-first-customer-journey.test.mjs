import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../src/App.tsx");
const auth = read("../../src/pages/AuthPage.tsx");
const intent = read("../../src/pages/IntentSelectionPage.tsx");
const journey = read("../../src/lib/customerJourney.ts");
const onboarding = read("../../src/pages/OnboardingPage.tsx");
const onboardingService = read("../app/services/onboarding-service.mjs");
const dashboard = read("../../src/pages/DashboardPage.tsx");
const policy = read("../../src/lib/productPolicy.ts");

test("authenticated entry routes to the intent selection experience", () => {
  assert.match(app, /path="\/dashboard\/intent" element=\{<IntentSelectionPage \/>\}/);
  assert.match(auth, /navigate\("\/dashboard\/intent", \{ replace: true \}\)/);
  assert.match(policy, /"\/dashboard\/intent"/);
});

test("direct services use only existing Website Landing and Content routes", () => {
  assert.match(journey, /WEBSITE: "\/dashboard\/websites\/new"/);
  assert.match(journey, /LANDING: "\/dashboard\/landings\/new"/);
  assert.match(journey, /CONTENT: "\/dashboard\/content"/);
  for (const route of ["/dashboard/websites/new", "/dashboard/landings/new", "/dashboard/content"]) assert.match(app, new RegExp(route.replaceAll("/", "\\/")));
});

test("website new entry reaches WebsiteBuilderPage new mode instead of the empty listing", () => {
  assert.match(app, /path="\/dashboard\/websites\/new" element=\{<Navigate to="\/dashboard\/websites\/new\/edit" replace \/>\}/);
  assert.match(app, /path="\/dashboard\/websites\/:id\/edit" element=\{<WebsiteBuilderPage \/>\}/);
});

test("diagnosis and build-my-business reuse the existing business foundation", () => {
  assert.match(intent, /نمی‌دانم چه چیزی لازم دارم/);
  assert.match(intent, /می‌خواهم کسب‌وکارم را با لودر بسازم/);
  assert.match(intent, /BUSINESS_FOUNDATION_DESTINATION/);
  assert.match(journey, /BUSINESS_FOUNDATION_DESTINATION = "\/dashboard\/business-brain"/);
  assert.match(intent, /پیشنهاد ساختگی نمایش داده نمی‌شود/);
});

test("safe return destination is preserved and arbitrary destinations fail closed", () => {
  assert.match(journey, /SAFE_RETURN_DESTINATIONS\.has\(value\)/);
  assert.match(journey, /encodeURIComponent\(safe\)/);
  assert.match(onboarding, /safeReturnDestination\(searchParams\.get\("returnTo"\)\)/);
  assert.match(onboarding, /navigate\(returnTo \|\| data\.nextDestination \|\| "\/dashboard"\)/);
  assert.doesNotMatch(journey, /https?:|window\.location|startsWith/);
});

test("onboarding and Dashboard no longer default every customer to Content", () => {
  assert.match(onboardingService, /nextDestination: "\/dashboard"/);
  assert.doesNotMatch(onboardingService, /dashboard\/content/);
  assert.doesNotMatch(onboarding, /dashboard\/content\?template=instagram/);
  assert.match(dashboard, /to="\/dashboard\/intent"/);
  assert.match(dashboard, />\s*انتخاب مسیر\s*</);
});

test("intent UI excludes hidden routes and performs navigation only", () => {
  for (const forbidden of ["catalog", "commerce", "payment", "domains", "integrations", "ads", "automation", "internal", "execute", "publish", "apiFetch"]) assert.equal(intent.toLowerCase().includes(forbidden), false);
  assert.match(intent, /<main dir="rtl"/);
  assert.match(intent, /grid grid-cols-1 gap-3 sm:grid-cols-3/);
  assert.match(intent, /min-h-12/);
});
