/**
 * Beginner Home copy mapping (Level 1 + Level 2).
 *
 * HARD RULE: every customer-facing sentence on the beginner surface comes from
 * one of the frozen tables below. Nothing is generated at runtime and no raw
 * backend string is ever rendered. An unrecognised canonical signal falls back
 * to GENERIC_SCRIPT, which claims nothing.
 *
 * The tables are keyed by the closed set of canonical Mission Control
 * `signalId` values produced by server/app/services/mission-control-service.mjs.
 */

export type MissionControlFact = { label: string; value: unknown; sourceRef: { type: string; id: string } };

export type MissionControlItem = {
  signalId: string;
  band: string;
  facts: MissionControlFact[];
  beliefs: Array<{ recommendationId: string; code: string; state: string; confidence: number | null; confidenceReason: string }>;
  unknown: string[];
  action: { label: string; requiredApproval: string; executable: false; deepLink: string };
  explainability: Record<string, unknown>;
  whyThisIsHere: string;
};

/** The five fixed card sections. Labels are constants, never data-driven. */
export const CARD_LABELS = Object.freeze({
  saw: "چه دیدم",
  belief: "برداشت من",
  suggestion: "پیشنهاد من",
  ask: "از شما چه می‌خواهم",
  consequence: "اگر قبول کنید",
});

export const BUTTON_LABELS = Object.freeze({
  accept: "باشه، ادامه بده",
  decline: "فعلاً نه",
  why: "چرا این را می‌گویی؟",
  details: "جزئیات کامل",
  allTools: "همه ابزارها",
});

export type BeginnerScript = { saw: string; belief: string; suggestion: string; ask: string };

/**
 * Rendered only when the canonical non-execution proof is present on the item
 * (`action.executable === false`). If that field is absent the whole line is
 * dropped rather than guessed.
 *
 * Stated as a quiet ledger rather than a promise: repeated reassurance ("no
 * money will be spent without your permission") makes the product read as
 * dangerous. The figures describe this action only, which is exactly what the
 * canonical field proves.
 */
export const CONSEQUENCE_SENTENCE = "فقط بررسی می‌کنم · خرج: ۰ تومان · پیام به مشتری: ۰";

const GENERIC_SCRIPT: BeginnerScript = Object.freeze({
  saw: "یک موضوع تازه در کسب‌وکار شما ثبت شده است.",
  belief: "هنوز نمی‌توانم دربارهٔ آن نتیجه‌ای بگیرم.",
  suggestion: "بهتر است یک بار خودتان نگاهش کنید.",
  ask: "فقط بگویید بررسی‌اش را ادامه بدهم یا نه.",
});

const SCRIPTS: Readonly<Record<string, BeginnerScript>> = Object.freeze({
  EXPERIMENT_WINDOW_CLOSED_NO_DECISION: {
    saw: "دورهٔ نتیجه‌گیری یکی از کارهایی که شروع کرده بودید تمام شده است.",
    belief: "به نظرم این کار بی‌جواب مانده و هنوز تکلیفش را روشن نکرده‌اید.",
    suggestion: "یک بار با هم نتیجه‌اش را مرور کنیم.",
    ask: "فقط بگویید مرورش کنیم یا فعلاً کنارش بگذاریم.",
  },
  CONVERTED_LEAD_WITHOUT_TREATMENT_LINKAGE: {
    saw: "یک نفر از میان مخاطبان شما مشتری شما شده است.",
    belief: "هنوز مطمئن نیستم این نتیجهٔ کدام‌یک از کارهای شما بوده است.",
    suggestion: "چند روز دیگر هم نگاه کنیم تا روشن‌تر شود.",
    ask: "فقط بگویید بررسی ادامه پیدا کند یا نه.",
  },
  UNDECIDED_RECOMMENDATION: {
    saw: "یک پیشنهاد برای شما آماده شده و هنوز جوابی نگرفته است.",
    belief: "فکر می‌کنم ارزش دارد یک بار نگاهش کنید، ولی عجله‌ای در کار نیست.",
    suggestion: "یک بار بازش کنید و ببینید به کارتان می‌آید یا نه.",
    ask: "فقط بگویید نگهش داریم یا کنارش بگذاریم.",
  },
  CONTENT_CANDIDATE_STUCK: {
    saw: "یک پیش‌نویس متن آمادهٔ شماست و بلاتکلیف مانده است.",
    belief: "به نظرم بدون نظر شما نمی‌شود ادامه داد.",
    suggestion: "یک بار بخوانیدش و تکلیفش را روشن کنید.",
    ask: "فقط بگویید نگهش داریم یا نه.",
  },
});

/** Canonical signal types this surface has hand-written copy for. */
export const MAPPED_SIGNAL_IDS = Object.freeze(Object.keys(SCRIPTS));

export function scriptFor(signalId: string): BeginnerScript {
  return SCRIPTS[signalId] ?? GENERIC_SCRIPT;
}

export function isMappedSignal(signalId: string) {
  return Object.prototype.hasOwnProperty.call(SCRIPTS, signalId);
}

/**
 * The non-execution line is shown only when the item literally carries the
 * canonical proof. `undefined` (an older or partial payload) is not proof.
 */
export function consequenceFor(item: Pick<MissionControlItem, "action">) {
  return item.action?.executable === false ? CONSEQUENCE_SENTENCE : null;
}

const faNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

/** A. The status sentence is derived from the actionable item count and nothing else. */
export function statusSentence(actionableCount: number) {
  if (actionableCount <= 0) return "فعلاً موضوع فوری برای تصمیم‌گیری ندارید.";
  if (actionableCount === 1) return "امروز یک موضوع نیاز به توجه شما دارد.";
  return `امروز ${faNumber(actionableCount)} موضوع نیاز به توجه شما دارد.`;
}

export function moreItemsSentence(count: number) {
  return `${faNumber(count)} مورد دیگر`;
}

// ---------------------------------------------------------------------------
// Level 2 — "چرا این را می‌گویی؟"
// ---------------------------------------------------------------------------

const FACT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  EXPERIMENT_STATUS: "وضعیت این کار",
  MEASUREMENT_WINDOW_ENDED_AT: "پایان دورهٔ نتیجه‌گیری",
  DECISION_STATE: "تصمیم شما",
  CRM_EVENT_TYPE: "چه اتفاقی افتاد",
  OCCURRED_AT: "چه زمانی",
  EVIDENCE_AUTHORITY: "اعتبار این اطلاعات",
  RECOMMENDATION_TYPE: "موضوع پیشنهاد",
  CALCULATED_AT: "زمان بررسی",
  CANDIDATE_STATE: "وضعیت پیش‌نویس",
  CREATED_AT: "زمان ثبت",
});

const FACT_VALUES: Readonly<Record<string, string>> = Object.freeze({
  COMPLETED: "تمام‌شده",
  RUNNING: "در حال انجام",
  DRAFT: "پیش‌نویس",
  READY: "آماده",
  PENDING: "در انتظار شما",
  NO_DECISION: "هنوز تصمیمی نگرفته‌اید",
  DEFERRED: "فعلاً کنار گذاشته‌اید",
  DECIDED: "تصمیم گرفته‌اید",
  AMBIGUOUS: "روشن نیست",
  RECONCILIATION_REQUIRED: "منتظر بررسی شماست",
  CANONICAL_RECORD: "در سوابق خودتان ثبت شده",
  REPORTED: "گزارش شده",
  UNKNOWN: "نامشخص",
  EXPERIMENT_OUTCOME_REVIEW: "مرور نتیجهٔ یک کار",
  INSPECT_FUNNEL_BOTTLENECK: "بررسی مسیر فروش",
  GATHER_MORE_EVIDENCE: "کمی صبر و اطلاعات بیشتر",
  "lead.converted": "یک نفر مشتری شما شد",
});

const faDateTime = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

/** Never returns a raw backend token, a UUID, or an untranslated enum. */
export function factValueText(value: unknown) {
  const raw = String(value ?? "");
  if (FACT_VALUES[raw]) return FACT_VALUES[raw];
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return faDateTime(raw);
  }
  return "ثبت شده";
}

export type BeginnerFactLine = { label: string; value: string };

/** Level 2 shows at most three canonical facts, and only ones we can say plainly. */
export function factLines(item: Pick<MissionControlItem, "facts">, limit = 3): BeginnerFactLine[] {
  return (item.facts ?? [])
    .filter((entry) => Boolean(FACT_LABELS[entry.label]))
    .slice(0, limit)
    .map((entry) => ({ label: FACT_LABELS[entry.label], value: factValueText(entry.value) }));
}

const REASONS: Readonly<Record<string, string>> = Object.freeze({
  MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION:
    "دورهٔ نتیجه‌گیری این کار تمام شده، اما هنوز جواب شما ثبت نشده است.",
  CANONICAL_CRM_CONVERSION_HAS_NO_GROWTH_EVIDENCE_LINK:
    "این اتفاق در سوابق خودتان ثبت شده، ولی به هیچ‌کدام از کارهایی که انجام داده‌اید وصل نیست.",
  GOVERNED_RECOMMENDATION_HAS_NO_DECISION: "این پیشنهاد ثبت شده و هنوز جوابی از شما نگرفته است.",
  PROVIDER_OUTCOME_REQUIRES_RECONCILIATION: "نتیجهٔ این پیش‌نویس روشن نشد و باید خودتان تکلیفش را مشخص کنید.",
  CANDIDATE_PENDING_BEYOND_AGE_FLOOR: "این پیش‌نویس بیشتر از حد معمول در انتظار مانده است.",
});

export function reasonSentence(item: Pick<MissionControlItem, "whyThisIsHere">) {
  return REASONS[item.whyThisIsHere] ?? "این مورد بر پایهٔ چیزی که ثبت شده نیاز به نگاه شما دارد.";
}

const UNKNOWNS: Readonly<Record<string, string>> = Object.freeze({
  BUSINESS_IMPACT_VALUE: "هنوز نمی‌دانم این موضوع چقدر روی درآمد شما اثر گذاشته است.",
  CAUSALITY: "هنوز نمی‌دانم این اتفاق نتیجهٔ کدام کار شما بوده است.",
  ATTRIBUTION: "هنوز نمی‌دانم این نتیجه را باید به کدام کار شما مربوط دانست.",
  EXPERIMENT_EFFECTIVENESS: "هنوز نمی‌دانم این کار به نتیجه رسیده یا نه.",
  TREATMENT_LINKAGE: "هنوز نمی‌دانم این نتیجه به کدام کار شما وصل است.",
  PROVIDER_OUTCOME: "هنوز نمی‌دانم نتیجهٔ نهایی این پیش‌نویس چه شده است.",
});

/** Level 2 always states exactly one explicit unknown. */
export function unknownSentence(item: Pick<MissionControlItem, "unknown">) {
  for (const code of item.unknown ?? []) {
    if (UNKNOWNS[code]) return UNKNOWNS[code];
  }
  return "چیزهایی هست که هنوز نمی‌دانم و نمی‌خواهم حدس بزنم.";
}

// ---------------------------------------------------------------------------
// Signal availability — absence of data is never rendered as good news.
// ---------------------------------------------------------------------------

export const SIGNAL_MESSAGES = Object.freeze({
  allFailed:
    "فعلاً نمی‌توانم وضعیت کسب‌وکار شما را بخوانم. یعنی اطلاعات در دسترس نیست، نه اینکه همه‌چیز روبه‌راه است.",
  partial: "بخشی از بررسی‌ها الان در دسترس نیست، پس این فهرست کامل نیست.",
  retry: "تلاش دوباره",
  emptyHint: "می‌توانید وضعیت کسب‌وکارتان را در «همه ابزارها» مرور کنید.",
  declined: "باشه. چیزی ثبت نشد؛ هر وقت خواستید دوباره سراغش بروید.",
});

/**
 * Deep links come from the API, so they are checked against the same canonical
 * allowlist the expert surface uses before they are ever navigated to.
 */
const ALLOWED_LINKS = [/^\/dashboard\/growth-loop\/[^/?#]+$/, /^\/dashboard\/content$/, /^\/dashboard\/crm$/, /^\/intelligence$/];

export function safeDeepLink(link: string | undefined | null) {
  return typeof link === "string" && ALLOWED_LINKS.some((pattern) => pattern.test(link)) ? link : null;
}
