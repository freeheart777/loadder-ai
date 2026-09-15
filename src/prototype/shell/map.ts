/**
 * EXPERIENCE SHELL V1 — the approved Experience Map, as navigation only.
 *
 * Frontend shell. No backend, no schema, no API, no business logic: every value
 * below is fixture copy and every outbound `route` is an existing route in
 * `src/App.tsx`. The whole `src/prototype/shell/` directory is removable, and it
 * imports nothing from the entry or growth prototypes, so none of the three can
 * break another.
 *
 * Register: formal («شما»), matching the approved map's own wording.
 *
 * The map:
 *   entry   one question, three answers
 *     ├─ «می‌دانم چه لازم دارم»    → tools   (direct capability, ungated)
 *     ├─ «یک مشکل دارم»            → home    (the centre, four zones)
 *     └─ «نمی‌دانم»                 → growth  (get understood first, then home)
 *   home ─ detail ─ past decisions   (the only route to the Decision Room)
 *   home ─ brain                     (a static entry point, nothing more)
 *
 * No module sidebar exists on any screen. Expert access is a command menu
 * later, not a permanent rail.
 */

export const SHELL_DATA_ORIGIN = "FIXTURE_ONLY_NOT_CANONICAL";

export type ScreenId = "entry" | "tools" | "growth" | "home" | "detail" | "brain";

export const SCREENS: ScreenId[] = ["entry", "tools", "growth", "home", "detail", "brain"];

export function toScreen(value: string | null): ScreenId {
  return SCREENS.includes(value as ScreenId) ? (value as ScreenId) : "entry";
}

export type Tool = { label: string; route: string; icon: string };

/** Direct access. Every target is an existing route; none of them is gated. */
export const TOOLS: Tool[] = [
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

/** The one route out to the existing Decision Room. Reachable from detail only. */
export const PAST_DECISIONS = {
  label: "تصمیم‌های گذشته دربارهٔ همین موضوع",
  route: "/dashboard/growth-loop/experiment-1",
};

export const PATHS: { id: Exclude<ScreenId, "entry" | "detail" | "brain">; title: string; hint: string; icon: string }[] = [
  { id: "tools", title: "می‌دانم چه چیزی لازم دارم", hint: "مستقیم همان ابزار را باز کنید.", icon: "grid" },
  { id: "home", title: "یک مشکل در کسب‌وکارم دارم", hint: "می‌خواهم بدانم اول کدام را درست کنم.", icon: "target" },
  { id: "growth", title: "نمی‌دانم", hint: "اول کسب‌وکارم را بشناسید، بعد بگویید.", icon: "compass" },
];

/** Observe → Understand → Suggest. Shown on the «نمی‌دانم» path. */
export const PROCESS = [
  { title: "نگاه می‌کنم", note: "می‌بینم چه چیزی هست و چه چیزی نیست." },
  { title: "می‌فهمم", note: "می‌گویم کدامش مهم است و چرا." },
  { title: "پیشنهاد می‌دهم", note: "یک کار می‌گویم؛ انجام دادنش با شماست." },
];

export const FIRST_ACTIONS = [
  { label: "سایت یا صفحه‌تان را نشانم بدهید", cost: "حدود یک دقیقه", icon: "globe" },
  { label: "چند سؤال کوتاه جواب بدهید", cost: "حدود سه دقیقه", icon: "chat" },
  { label: "اجازه بدهید خودم بررسی کنم", cost: "کاری از شما نمی‌خواهد", icon: "search" },
];

/** Zone 1. One thing, one decision, and the cost of saying yes. */
export const ATTENTION = {
  title: "سه نفر شماره گذاشتند و هنوز کسی با آن‌ها تماس نگرفته.",
  belief: "به نظرم اگر امروز زنگ بزنید شانس بیشتری دارید تا هفتهٔ بعد.",
  ask: "فقط بگویید آماده کنم یا نه.",
  consequence: "فقط یک متن آماده می‌کنم · خرج: ۰ تومان · پیام به مشتری: ۰",
  yes: "آماده کن",
  no: "الان نه",
  why: "چرا این را می‌گویم؟",
};

/** Zone 2. */
export const IN_PROGRESS = [
  { label: "اصلاح صفحهٔ کافه", detail: "منتظر نظر شما" },
  { label: "سنجش نتیجهٔ منوی تازه", detail: "۹ روز دیگر" },
];

/** Zone 3. What was learned, and the edge of it. */
export const LEARNED = {
  line: "هفته‌ای که قیمت روی صفحه بود، شماره‌های بیشتری ثبت شد.",
  boundary: "هنوز مطمئن نیستم دلیل اصلی همین بوده.",
};

/** The detail behind zone 1. The only screen that reaches past decisions. */
export const DETAIL = {
  saw: [
    "سه شماره در پنج روز گذشته ثبت شد.",
    "هیچ‌کدام هنوز در فهرست مشتری‌ها پیگیری نشده.",
  ],
  unknown: [
    "نمی‌دانم بعد از ثبت شماره چه اتفاقی افتاده.",
  ],
  permission: [
    { label: "چه اتفاقی می‌افتد", value: "یک متن کوتاه آماده می‌شود" },
    { label: "چقدر خرج دارد", value: "۰ تومان" },
    { label: "چه کسی می‌بیند", value: "فقط شما" },
    { label: "برگشت دارد؟", value: "بله، تا هر وقت بخواهید" },
  ],
};

/** The static Brain entry point. A place to look, never a place to decide. */
export const BRAIN = {
  known: [
    "صفحه‌تان را خوانده‌ام؛ راه تماس رویش هست.",
    "بازدیدها را هر روز می‌شمارم.",
    "فهرست مشتری‌ها را خودتان به من دادید.",
  ],
  unknown: [
    "نمی‌دانم هر بازدید کدام آدم است.",
    "فروش حضوری‌تان هیچ‌جا ثبت نمی‌شود.",
  ],
};

export const SHELL_COPY = Object.freeze({
  entryTitle: "هنوز چیزی درباره کسب‌وکار شما نمی‌دانم.",
  entryLead: "برای همین هنوز پیشنهادی ندارم. یکی از این سه را انتخاب کنید تا از همان‌جا شروع کنیم.",
  toolsTitle: "کدام ابزار؟",
  toolsLead: "مستقیم باز می‌شود. لازم نیست اول چیزی به من بگویید.",
  toolsToHome: "یا بگذارید اول نگاه کنم و بگویم از کجا شروع کنیم",
  growthTitle: "بگذارید اول کسب‌وکارتان را بشناسم.",
  growthLead: "سه راه کوتاه هست. هرکدام را که راحت‌ترید انتخاب کنید.",
  growthProcess: "کاری که من می‌کنم",
  growthAfter: "بعد از این، خانه مرکز کار شماست.",
  growthToHome: "خانه را ببینید",
  homeTitle: "خانه",
  homeLead: "یک تصمیم، کارهای در جریان، و چیزی که تازه یاد گرفته‌ام.",
  zoneAttention: "به شما نیاز دارد",
  zoneProgress: "در جریان",
  zoneLearned: "چیزی که یاد گرفته‌ام",
  zoneTools: "ابزارهای شما",
  brainEntry: "چیزی که از کسب‌وکار شما می‌دانم",
  brainEntryHint: "فقط نگاه کردن · تصمیمی نمی‌خواهد",
  brainTitle: "چیزی که از کسب‌وکار شما می‌دانم",
  brainLead: "این صفحه فقط می‌گوید چه می‌دانم و چه نمی‌دانم. تصمیمی از شما نمی‌خواهد.",
  brainKnown: "چه می‌دانم",
  brainUnknown: "چه چیزی را هنوز نمی‌دانم",
  brainStatic: "فعلاً همین‌قدر را نشان می‌دهم.",
  detailTitle: "چرا این را می‌گویم",
  detailSaw: "چه دیدم",
  detailUnknown: "چه چیزی را هنوز نمی‌دانم",
  detailPermission: "اگر بگویید آماده کن",
  backHome: "برگردید به خانه",
  backEntry: "برگردید به سؤال اول",
  toolsHint: "لازم نیست اول من چیزی بدانم.",
});
