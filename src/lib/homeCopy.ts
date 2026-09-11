/**
 * HOME — frozen presentation copy.
 *
 * Every user-facing sentence on Home is written here. Nothing is generated at
 * runtime: a canonical token maps to a fixed Persian phrase, or it does not
 * render at all. That is what keeps raw tokens, internal vocabulary and
 * invented conclusions off the screen.
 *
 * The rule behind the wording: Loadder may say what it saw and what it has not
 * learned yet. It may not say what a number means unless the canonical record
 * says so.
 */

export const ZONE_LABELS = Object.freeze({
  attention: "به شما نیاز دارد",
  inProgress: "در جریان",
  learned: "تازه‌ترین چیزی که دیدم",
  tools: "ابزارهای شما",
});

export const NAV = Object.freeze({
  home: "خانه",
  tools: "ابزارها",
  account: "حساب من",
  signOut: "خروج",
  workspace: "فضای کاری",
});

export const ATTENTION_COPY = Object.freeze({
  why: "چرا این را می‌گویم؟",
  more: "بقیهٔ موارد",
  failed: "این بخش الان در دسترس نیست. کمی بعد دوباره سر بزنید.",
  loading: "…",
  /** The canonical item records what is unknown; this says so without naming it. */
  unknown: "دلیلش را هنوز نمی‌دانم؛ فقط همین را دیدم.",
});

/**
 * Zone 1 with nothing in it. Never a shortage report: Loadder has not learned
 * the business yet, and each way out of that opens a real tool.
 */
export const UNKNOWN_COPY = Object.freeze({
  title: "هنوز چیزی درباره کسب‌وکار شما نمی‌دانم.",
  lead: "برای همین هنوز پیشنهادی ندارم که به دردتان بخورد. از هر کدام از این‌ها که راحت‌ترید شروع کنید.",
});

export const FIRST_ACTIONS: { label: string; hint: string; route: string; icon: string }[] = [
  { label: "سایت یا صفحه‌تان را بسازید", hint: "تا بتوانم بخوانمش", route: "/dashboard/websites", icon: "globe" },
  { label: "فهرست مشتری‌ها را وارد کنید", hint: "تا پیگیری‌ها را ببینم", route: "/dashboard/crm", icon: "users" },
  { label: "اولین محتوا را بسازید", hint: "تا نتیجه‌اش را بسنجم", route: "/dashboard/content", icon: "pen" },
];

/**
 * Zone 2. Only canonical prepared work is listed: a copilot run that finished
 * preparing something and is waiting for a person. Nothing is simulated, and
 * no progress bar is drawn for work whose progress is not recorded.
 */
export const PROGRESS_COPY = Object.freeze({
  empty: "الان کاری در جریان نیست.",
  failed: "این بخش الان در دسترس نیست.",
});

/**
 * Zone 3. A finding says one recorded state about one recorded subject. The
 * label names what was measured; the state is the only claim, and it comes
 * from the canonical record. INSUFFICIENT_EVIDENCE is shown, not hidden —
 * not knowing yet is a result too.
 */
export const SEMANTIC_LABELS: Record<string, string> = {
  listening_attention_state: "توجهی که به شما شده",
  competitive_visibility_state: "دیده‌شدن شما در کنار بقیه",
};

export const SEMANTIC_STATES: Record<string, string> = {
  SURGING: "خیلی بیشتر شده",
  RISING: "بیشتر شده",
  STABLE: "تغییر محسوسی نکرده",
  FALLING: "کمتر شده",
  LEADING: "جلوتر بوده‌اید",
  PARITY: "هم‌اندازهٔ بقیه بوده",
  TRAILING: "عقب‌تر بوده‌اید",
  INSUFFICIENT_EVIDENCE: "هنوز برای گفتنش کافی نمی‌دانم",
};

export const LEARNED_COPY = Object.freeze({
  empty: "هنوز چیزی یاد نگرفته‌ام که ارزش گفتن داشته باشد.",
  failed: "این بخش الان در دسترس نیست.",
  /** Confidence is null on canonical findings today. Never imply otherwise. */
  boundary: "این فقط چیزی است که دیدم؛ دلیلش را نمی‌دانم.",
});

/** Zone 4. Direct access: opening a tool never waits on anything above it. */
export const TOOLS: { label: string; route: string; icon: string }[] = [
  { label: "سایت‌ساز", route: "/dashboard/websites", icon: "globe" },
  { label: "فروشگاه", route: "/dashboard/websites/commerce", icon: "bag" },
  { label: "مشتری‌ها", route: "/dashboard/crm", icon: "users" },
  { label: "ساخت محتوا", route: "/dashboard/content", icon: "pen" },
  { label: "تبلیغات", route: "/dashboard/ads", icon: "megaphone" },
  { label: "اینستاگرام", route: "/dashboard/social", icon: "instagram" },
  { label: "آمار و نتیجه‌ها", route: "/dashboard/analytics", icon: "chart" },
  { label: "شاخص‌ها", route: "/dashboard/kpi", icon: "gauge" },
  { label: "برند بوک", route: "/dashboard/brand-book", icon: "book" },
  { label: "پیشنهاد کاری", route: "/dashboard/business-proposal", icon: "file" },
  { label: "اپلیکیشن‌ساز", route: "/dashboard/business-builder", icon: "app" },
  { label: "کارهای تکراری", route: "/dashboard/automation", icon: "repeat" },
];

export const TOOLS_COPY = Object.freeze({ hint: "مستقیم باز می‌شود؛ لازم نیست اول من چیزی بدانم." });

/** The entry. One question, three answers, and two of them skip Home entirely. */
export const START_COPY = Object.freeze({
  title: "هنوز چیزی درباره کسب‌وکار شما نمی‌دانم.",
  lead: "برای همین هنوز پیشنهادی ندارم. یکی از این سه را انتخاب کنید تا از همان‌جا شروع کنیم.",
  toolsTitle: "کدام ابزار؟",
  toolsLead: "مستقیم باز می‌شود. لازم نیست اول چیزی به من بگویید.",
  back: "برگردید به سؤال اول",
  skip: "فعلاً خانه را ببینید",
});

export const START_PATHS: { id: "tools" | "home"; title: string; hint: string; icon: string }[] = [
  { id: "tools", title: "می‌دانم چه چیزی لازم دارم", hint: "مستقیم همان ابزار را باز کنید.", icon: "grid" },
  { id: "home", title: "یک مشکل در کسب‌وکارم دارم", hint: "می‌خواهم بدانم اول کدام را درست کنم.", icon: "target" },
  { id: "home", title: "نمی‌دانم", hint: "اول کسب‌وکارم را بشناسید، بعد بگویید.", icon: "compass" },
];

const fa = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

/** A recorded timestamp, never a duration Loadder would have to infer. */
export function whenLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : fa.format(date);
}
