import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUTTON_LABELS,
  CARD_LABELS,
  CONSEQUENCE_SENTENCE,
  MAPPED_SIGNAL_IDS,
  SIGNAL_MESSAGES,
  consequenceFor,
  factLines,
  factValueText,
  isMappedSignal,
  moreItemsSentence,
  reasonSentence,
  safeDeepLink,
  scriptFor,
  statusSentence,
  unknownSentence,
} from "../../src/lib/beginnerCopy.ts";

const home = readFileSync(new URL("../../src/components/home/BeginnerHome.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../../src/components/home/RecommendationCard.tsx", import.meta.url), "utf8");
const copySource = readFileSync(new URL("../../src/lib/beginnerCopy.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../../src/pages/DashboardPage.tsx", import.meta.url), "utf8");
const flags = readFileSync(new URL("../../src/lib/featureFlags.ts", import.meta.url), "utf8");

// The closed canonical signal set produced by mission-control-service.mjs.
const CANONICAL_SIGNALS = [
  "EXPERIMENT_WINDOW_CLOSED_NO_DECISION",
  "CONVERTED_LEAD_WITHOUT_TREATMENT_LINKAGE",
  "UNDECIDED_RECOMMENDATION",
  "CONTENT_CANDIDATE_STUCK",
];

/** Terms that must never reach the beginner (Level 1/2) surface. */
const FORBIDDEN_TERMS = [
  "Mission Control",
  "Growth Loop",
  "Evidence",
  "Assessment",
  "Candidate",
  "Attribution",
  "Causality",
  "Policy",
  "Governance",
  "EXPERIMENT_",
  "RECONCILIATION_",
  "DECIDE_TODAY",
  "CRM",
  "تبدیل",
  "کمپین",
];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SCREAMING_SNAKE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;

function assertBeginnerSafe(text, context) {
  for (const term of FORBIDDEN_TERMS) {
    assert.ok(!text.includes(term), `${context} must not contain "${term}": ${text}`);
  }
  assert.ok(!UUID.test(text), `${context} must not contain a raw identifier: ${text}`);
  assert.ok(!SCREAMING_SNAKE.test(text), `${context} must not contain an internal code: ${text}`);
}

test("Beginner Home V1 contract", async (t) => {
  await t.test("every canonical signal has hand-written copy and no runtime generation", () => {
    for (const signalId of CANONICAL_SIGNALS) assert.ok(isMappedSignal(signalId), `missing copy for ${signalId}`);
    assert.deepEqual([...MAPPED_SIGNAL_IDS].sort(), [...CANONICAL_SIGNALS].sort());
    // Sentences are table lookups only; nothing is assembled from backend text.
    assert.doesNotMatch(copySource, /`[^`]*\$\{\s*(item|value|raw|entry)\./);
  });

  await t.test("an unknown signal renders a generic, non-claiming card and is not invented", () => {
    const fallback = scriptFor("SOME_FUTURE_SIGNAL");
    assert.equal(fallback, scriptFor("ANOTHER_FUTURE_SIGNAL"));
    assert.match(fallback.belief, /نمی‌توانم/);
    assertBeginnerSafe(Object.values(fallback).join(" "), "generic fallback");
  });

  await t.test("Level 1 vocabulary guard: no internal term reaches any card sentence", () => {
    for (const signalId of [...CANONICAL_SIGNALS, "SOME_FUTURE_SIGNAL"]) {
      const script = scriptFor(signalId);
      for (const [section, sentence] of Object.entries(script)) assertBeginnerSafe(sentence, `${signalId}.${section}`);
    }
    for (const [key, label] of Object.entries(CARD_LABELS)) assertBeginnerSafe(label, `label ${key}`);
    for (const [key, label] of Object.entries(BUTTON_LABELS)) assertBeginnerSafe(label, `button ${key}`);
    assertBeginnerSafe(CONSEQUENCE_SENTENCE, "consequence");
    for (const [key, message] of Object.entries(SIGNAL_MESSAGES)) assertBeginnerSafe(message, `signal message ${key}`);
    for (const count of [0, 1, 2, 7]) assertBeginnerSafe(statusSentence(count), `status ${count}`);
    assertBeginnerSafe(moreItemsSentence(3), "overflow line");
  });

  await t.test("belief sentences stay uncertain and suggestions never promise a result", () => {
    for (const signalId of CANONICAL_SIGNALS) {
      const { belief } = scriptFor(signalId);
      assert.match(belief, /به نظر|فکر می‌کنم|مطمئن نیستم|نمی‌توانم/, `${signalId} belief must hedge`);
    }
    assert.doesNotMatch(copySource, /افزایش فروش|تضمین|قطعاً|حتماً|موفق شد/);
  });

  await t.test("the status sentence is derived only from the actionable count", () => {
    assert.equal(statusSentence(0), "فعلاً موضوع فوری برای تصمیم‌گیری ندارید.");
    assert.equal(statusSentence(1), "امروز یک موضوع نیاز به توجه شما دارد.");
    assert.match(statusSentence(3), /۳ موضوع/);
    assert.match(statusSentence(-2), /ندارید/);
  });

  await t.test("the non-execution line appears only with the canonical proof field", () => {
    assert.equal(consequenceFor({ action: { executable: false } }), CONSEQUENCE_SENTENCE);
    assert.equal(consequenceFor({ action: {} }), null);
    assert.equal(consequenceFor({ action: { executable: true } }), null);
    assert.match(CONSEQUENCE_SENTENCE, /فقط بررسی می‌کنم/);
    assert.match(CONSEQUENCE_SENTENCE, /خرج: ۰ تومان/);
    assert.match(CONSEQUENCE_SENTENCE, /پیام به مشتری: ۰/);
    // A ledger, not a repeated promise.
    assert.doesNotMatch(CONSEQUENCE_SENTENCE, /اجازه|نگران|مطمئن باشید/);
  });

  await t.test("Level 2 shows bounded canonical facts, one reason and one explicit unknown", () => {
    const item = {
      facts: [
        { label: "EXPERIMENT_STATUS", value: "COMPLETED", sourceRef: { type: "EXPERIMENT", id: "a" } },
        { label: "MEASUREMENT_WINDOW_ENDED_AT", value: "2026-09-01T10:00:00.000Z", sourceRef: { type: "EXPERIMENT", id: "a" } },
        { label: "DECISION_STATE", value: "NO_DECISION", sourceRef: { type: "EXPERIMENT", id: "a" } },
        { label: "UNMAPPED_LABEL", value: "SOMETHING", sourceRef: { type: "X", id: "a" } },
      ],
      unknown: ["CAUSALITY"],
      whyThisIsHere: "MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION",
    };
    const lines = factLines(item);
    assert.equal(lines.length, 3);
    for (const line of lines) {
      assertBeginnerSafe(line.label, "fact label");
      assertBeginnerSafe(line.value, "fact value");
    }
    assertBeginnerSafe(reasonSentence(item), "reason");
    assertBeginnerSafe(unknownSentence(item), "unknown");
    assert.match(unknownSentence(item), /هنوز نمی‌دانم/);
    assert.match(unknownSentence({ unknown: ["A_BRAND_NEW_CODE"] }), /نمی‌خواهم حدس بزنم/);
    assert.match(reasonSentence({ whyThisIsHere: "A_BRAND_NEW_REASON" }), /نیاز به نگاه شما/);
  });

  await t.test("raw backend values are never rendered verbatim", () => {
    assert.equal(factValueText("SOME_INTERNAL_ENUM"), "ثبت شده");
    assert.equal(factValueText("3f6b1d0e-9a4c-4a1b-8c2d-5e7f9a0b1c2d"), "ثبت شده");
    assert.equal(factValueText(undefined), "ثبت شده");
    assert.equal(factValueText("NO_DECISION"), "هنوز تصمیمی نگرفته‌اید");
    assert.match(factValueText("2026-09-01T10:00:00.000Z"), /[۰-۹]/);
  });

  await t.test("deep links are allowlisted before navigation", () => {
    assert.equal(safeDeepLink("/dashboard/growth-loop/exp-1"), "/dashboard/growth-loop/exp-1");
    assert.equal(safeDeepLink("/dashboard/crm"), "/dashboard/crm");
    assert.equal(safeDeepLink("https://evil.example/x"), null);
    assert.equal(safeDeepLink("/dashboard/../admin"), null);
    assert.equal(safeDeepLink(undefined), null);
  });

  await t.test("the surface reads the canonical contract only and never writes", () => {
    assert.match(home, /apiFetch\("\/api\/mission-control"\)/);
    for (const source of [home, card]) {
      assert.doesNotMatch(source, /method:\s*["'](POST|PUT|PATCH|DELETE)/);
      assert.doesNotMatch(source, /healthScore|revenue|uplift|confidence\s*=|successRate/);
    }
    // No client-side re-ranking: canonical array order is preserved.
    assert.doesNotMatch(home, /\.sort\(/);
    assert.doesNotMatch(home, /score/);
    assert.match(home, /Canonical order is the array order returned by the server/);
  });

  await t.test("exactly one primary card, at most two secondary items and a bounded overflow line", () => {
    assert.match(home, /const MAX_SECONDARY = 2;/);
    assert.match(home, /ordered\.slice\(1, 1 \+ MAX_SECONDARY\)/);
    assert.match(home, /data-recommendation="secondary"/);
    assert.match(card, /data-recommendation="primary"/);
    assert.match(home, /moreItemsSentence\(overflow\)/);
  });

  await t.test("missing signals are never presented as a healthy business", () => {
    assert.match(home, /data-signal-state="unreadable"/);
    assert.match(home, /data-signal-state="partial"/);
    assert.match(SIGNAL_MESSAGES.allFailed, /نه اینکه همه‌چیز روبه‌راه است/);
    assert.match(home, /unreadable \? "فعلاً وضعیت کسب‌وکار شما را نمی‌دانم\."/);
  });

  await t.test("the flag keeps the legacy surface intact and reachable", () => {
    assert.match(flags, /beginner_home_v1/);
    assert.match(flags, /Boolean\(import\.meta\.env\.DEV\)/);
    assert.match(dashboard, /isBeginnerHomeEnabled\(\)/);
    assert.match(dashboard, /beginner\s*\?[\s\S]*?<BeginnerHome/);
    assert.match(dashboard, /:\s*<ExpertToolsSurface userName=\{user\?\.name\} \/>/);
    assert.match(dashboard, /data-all-tools-toggle/);
  });

  await t.test("mobile stays first class: touch targets, RTL and no horizontal overflow", () => {
    assert.match(dashboard, /dir="rtl"/);
    assert.match(dashboard, /overflow-x-hidden/);
    assert.ok((card.match(/min-h-11/g) || []).length >= 3);
    assert.ok((home.match(/min-h-11/g) || []).length >= 2);
    assert.match(home, /max-w-3xl/);
  });
});
