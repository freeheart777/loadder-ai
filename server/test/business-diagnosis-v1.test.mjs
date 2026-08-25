import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../../src/App.tsx");
const intent = read("../../src/pages/IntentSelectionPage.tsx");
const page = read("../../src/pages/BusinessDiagnosisPage.tsx");
const journey = read("../../src/lib/customerJourney.ts");
const diagnosis = read("../../src/lib/businessDiagnosis.ts");
const policy = read("../../src/lib/productPolicy.ts");

test("diagnosis is a first-class controlled-launch route", () => {
  assert.match(app, /path="\/dashboard\/diagnosis" element=\{<BusinessDiagnosisPage \/>\}/);
  assert.match(policy, /"\/dashboard\/diagnosis"/);
  assert.match(journey, /BUSINESS_DIAGNOSIS_DESTINATION = "\/dashboard\/diagnosis"/);
});

test("diagnosis intent is separated from build-my-business", () => {
  assert.match(intent, /choose\(BUSINESS_DIAGNOSIS_DESTINATION\)/);
  assert.match(intent, /choose\(BUSINESS_FOUNDATION_DESTINATION\)/);
  assert.match(intent, /سایت، شبکه اجتماعی، محتوا، تبلیغات و CRM/);
});

test("current-state audit covers the five declared business capability areas", () => {
  for (const id of ["website", "social", "content", "ads", "crm"]) assert.match(diagnosis, new RegExp(`id: "${id}"`));
  for (const state of ["MISSING", "NEEDS_WORK", "HEALTHY", "UNKNOWN"]) assert.match(diagnosis, new RegExp(`"${state}"`));
  assert.match(page, /وضعیت واقعی کانال‌ها و زیرساخت‌ها/);
});

test("recommendations are deterministic and tied to explicit answers", () => {
  assert.match(diagnosis, /answers\.website === "MISSING"/);
  assert.match(diagnosis, /answers\.content === "MISSING"/);
  assert.match(diagnosis, /goal === "LEADS"/);
  assert.match(page, /فقط از پاسخ‌های خودت استفاده می‌کند/);
  assert.match(page, /نتیجه بر اساس پاسخ‌های ثبت‌شده/);
  assert.doesNotMatch(page, /apiFetch|openai|generate|publish|execute/i);
});

test("unsupported gaps are recorded without fake service routes", () => {
  assert.match(diagnosis, /نیازهایی که فعلاً فقط ثبت می‌شوند/);
  assert.match(diagnosis, /destination: null/);
  assert.match(diagnosis, /سرویس ساختگی یا اجرای خودکار/);
  assert.doesNotMatch(diagnosis, /\/dashboard\/(ads|social|automation|domains|catalog)/);
});

test("diagnosis only links to currently safe customer destinations", () => {
  assert.match(diagnosis, /DIRECT_SERVICE_DESTINATIONS\.WEBSITE/);
  assert.match(diagnosis, /DIRECT_SERVICE_DESTINATIONS\.LANDING/);
  assert.match(diagnosis, /DIRECT_SERVICE_DESTINATIONS\.CONTENT/);
  assert.match(diagnosis, /BUSINESS_FOUNDATION_DESTINATION/);
  assert.doesNotMatch(page, /window\.location|https?:\/\//);
});
