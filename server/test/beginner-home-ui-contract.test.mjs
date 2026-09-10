import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUTTON_LABELS,
  CARD_LABELS,
  HOME_TOOLS,
  IN_PROGRESS_COPY,
  LEARNED_COPY,
  TOOLS_HINT,
  ZONE_LABELS,
  inProgressLines,
  learnedSentence,
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
const zones = readFileSync(new URL("../../src/components/home/zones.tsx", import.meta.url), "utf8");
const homeData = readFileSync(new URL("../../src/lib/homeData.ts", import.meta.url), "utf8");

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
  "Analytics",
  "Automation",
  "Mission Control",
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
    // Reads moved into lib/homeData.ts when Home grew to four zones.
    assert.match(homeData, /apiFetch\(path\)/);
    assert.match(homeData, /"\/api\/mission-control"/);
    assert.match(home, /readMissionControl/);
    for (const source of [home, card, homeData]) {
      assert.doesNotMatch(source, /method:\s*["'](POST|PUT|PATCH|DELETE)/);
      assert.doesNotMatch(source, /healthScore|revenue|uplift|confidence\s*=|successRate/);
    }
    // No client-side re-ranking: canonical array order is preserved.
    assert.doesNotMatch(home, /\.sort\(/);
    assert.doesNotMatch(home, /score/);
    assert.match(home, /preserves the canonical Mission Control order/);
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

  await t.test("Home V2 renders four permanent zones", () => {
    assert.deepEqual(Object.keys(ZONE_LABELS), ["attention", "inProgress", "learned", "tools"]);
    for (const [key, label] of Object.entries(ZONE_LABELS)) assertBeginnerSafe(label, `zone ${key}`);
    for (const marker of ["<Zone label={ZONE_LABELS.attention}>", "<InProgressZone", "<LearnedZone", "<ToolsZone"]) {
      assert.ok(home.includes(marker), `home is missing ${marker}`);
    }
    // Order is fixed: attention, in progress, learned, tools.
    assert.ok(home.indexOf("ZONE_LABELS.attention") < home.indexOf("<InProgressZone"));
    assert.ok(home.indexOf("<InProgressZone") < home.indexOf("<LearnedZone"));
    assert.ok(home.indexOf("<LearnedZone") < home.indexOf("<ToolsZone"));
  });

  await t.test("every zone reads an existing endpoint and none of them writes", () => {
    const allowed = ["/api/mission-control", "/api/business-state", "/api/intelligence/semantic/findings"];
    const called = [...homeData.matchAll(/apiFetch\(|read<[^>]*>\("([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
    for (const path of called) {
      assert.ok(allowed.some((prefix) => path.startsWith(prefix)), `unexpected endpoint ${path}`);
    }
    for (const source of [homeData, zones, home]) {
      assert.doesNotMatch(source, /method:\s*["'](POST|PUT|PATCH|DELETE)/);
    }
    // No zone invents a value the backend did not supply.
    assert.doesNotMatch(zones, /healthScore|percent|progressPercent|Math\.round|estimate/i);
  });

  await t.test("zone 2 counts canonical records and never shows a step ladder", () => {
    const lines = inProgressLines({ openWork: 2, awaitingYou: 1, needsSorting: 0 });
    assert.equal(lines.length, 2);
    // What wants the owner comes first.
    assert.equal(lines[0].wantsYou, true);
    for (const line of lines) assertBeginnerSafe(line.text, "in-progress line");
    assert.deepEqual(inProgressLines({ openWork: 0, awaitingYou: 0, needsSorting: 0 }), []);
    for (const [key, message] of Object.entries(IN_PROGRESS_COPY)) {
      for (const text of typeof message === "string" ? [message] : Object.values(message)) assertBeginnerSafe(text, `in-progress ${key}`);
    }
    // Persian reads "یک", never the digit, for a single item.
    assert.match(inProgressLines({ openWork: 0, awaitingYou: 1, needsSorting: 0 })[0].text, /^یک پیش‌نویس/);
    assert.match(inProgressLines({ openWork: 0, awaitingYou: 3, needsSorting: 0 })[0].text, /^۳ پیش‌نویس/);
    // A Jira-style ladder is exactly what this zone must not become.
    assert.doesNotMatch(zones, /StepRow|"done"\s*\|\s*"waiting"\s*\|\s*"next"/);
    assert.match(IN_PROGRESS_COPY.unreadable, /نمی‌توانم/);
  });

  await t.test("zone 3 states an observation only with its boundary, and never infers", () => {
    for (const [key, message] of Object.entries(LEARNED_COPY)) assertBeginnerSafe(message, `learned ${key}`);
    assert.match(learnedSentence(0), /کسی/);
    assert.match(learnedSentence(1), /یک نفر/);
    assert.match(learnedSentence(4), /۴ نفر/);
    for (const count of [0, 1, 4]) assertBeginnerSafe(learnedSentence(count), `learned ${count}`);
    // The boundary is rendered next to every finding, not as an optional extra.
    assert.match(zones, /data-learned-boundary/);
    assert.match(zones, /LEARNED_COPY\.boundary/);
    assert.match(LEARNED_COPY.boundary, /هنوز نمی‌دانم/);
    assert.match(LEARNED_COPY.empty, /هنوز چیزی یاد نگرفته‌ام/);
  });

  await t.test("zone 4 keeps every tool directly reachable with Persian-first labels", () => {
    assert.ok(HOME_TOOLS.length >= 13, "the tool set must not shrink");
    for (const tool of HOME_TOOLS) {
      assertBeginnerSafe(tool.label, `tool ${tool.label}`);
      assert.ok(tool.route.startsWith("/dashboard"), `tool ${tool.label} must link to a real route`);
      assert.ok(!("en" in tool), `tool ${tool.label} must not carry an English subtitle`);
    }
    assertBeginnerSafe(TOOLS_HINT, "tools hint");
    // Never gated: the grid renders unconditionally, with no plan or goal check.
    assert.doesNotMatch(zones, /HOME_TOOLS[\s\S]{0,200}(plan|goal|hasPlan)/i);
    assert.match(zones, /data-zone="tools"/);
  });

  await t.test("the permission primitive is visual only", () => {
    assert.match(zones, /export function PermissionFacts/);
    assert.match(zones, /data-permission-facts/);
    // Stacked label and value: the prototype review found edge-aligned pairs unreadable.
    assert.match(zones, /<dt[^>]*>\{fact\.label\}<\/dt>/);
    assert.doesNotMatch(zones, /PermissionFacts[\s\S]{0,600}(apiFetch|fetch\(|onApprove|execute)/);
  });

  await t.test("no decorative assistant signalling on the beginner surface", () => {
    for (const source of [home, card, zones]) {
      assert.doesNotMatch(source, /Sparkle|Magic|Robot|Star\b|✨|🤖/);
    }
  });

  await t.test("mobile stays first class: touch targets, RTL and no horizontal overflow", () => {
    assert.match(dashboard, /dir="rtl"/);
    assert.match(dashboard, /overflow-x-hidden/);
    assert.ok((card.match(/min-h-11/g) || []).length >= 3);
    assert.ok((home.match(/min-h-11/g) || []).length >= 2);
    assert.match(home, /max-w-3xl/);
  });
});
