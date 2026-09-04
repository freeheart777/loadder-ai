import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../../src/pages/StoreFinancialsPage.tsx");
const app = read("../../src/App.tsx");
const admin = read("../../src/pages/StoreAdminDashboardPage.tsx");

test("store financial dashboard is routed and discoverable from store admin", () => {
  assert.match(app, /StoreFinancialsPage/);
  assert.match(app, /\/dashboard\/websites\/commerce\/financials/);
  assert.match(admin, /دفتر مالی/);
  assert.match(admin, /\/dashboard\/websites\/commerce\/financials/);
});

test("store financial dashboard reads the canonical ledger and reconciliation endpoints", () => {
  assert.match(page, /\/financial-ledger\?limit=500/);
  assert.match(page, /\/financials\/reconcile/);
  assert.match(page, /\/financials`/);
  assert.match(page, /FINANCIAL_LEDGER_CONFLICT/);
  assert.match(page, /FINANCIAL_ADMIN_REQUIRED/);
  assert.match(page, /Immutable Ledger/);
});

test("store financial dashboard keeps currencies separated instead of summing unlike money", () => {
  assert.match(page, /totalsByCurrency/);
  assert.match(page, /new Map<string/);
  assert.match(page, /ارزهای مختلف عمداً با هم جمع نمی‌شوند/);
  assert.doesNotMatch(page, /reduce\([^)]*amountMinor[^)]*\).*currencyTotals/s);
});
