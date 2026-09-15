/**
 * GROWTH ENTRY V1 — PROTOTYPE CONTENT. Not production data.
 *
 * Invented copy for one business, used to validate the first-run growth
 * experience. Nothing here reads or writes a canonical API. The whole
 * `src/prototype/growth/` directory is removable on its own: it imports
 * nothing from the entry prototype, so neither can break the other.
 *
 * Register note: the anchor sentence was given in the informal voice
 * («کسب‌وکارت»), so this whole prototype speaks informally. Shipped Home copy
 * is formal. That divergence is a decision for review, not an accident.
 *
 * Banned from every string below, because an empty page is not a broken page:
 * «داده‌ای نیست», «چیزی موجود نیست», «راه‌اندازی لازم است», «اطلاعاتی وجود ندارد».
 * What Loadder does not know is stated as something Loadder has not learned yet.
 */

export const GROWTH_DATA_ORIGIN = "FIXTURE_ONLY_NOT_CANONICAL";

export type StateId = "new" | "returning";

/** Observe → Understand → Suggest, in words a shopkeeper uses. */
export const PROCESS: { title: string; note: string }[] = [
  { title: "نگاه می‌کنم", note: "می‌بینم چه چیزی هست و چه چیزی نیست." },
  { title: "می‌فهمم", note: "می‌گویم کدامش مهم است و چرا." },
  { title: "پیشنهاد می‌دهم", note: "یک کار می‌گویم؛ انجام دادنش با توست." },
];

export type FirstAction = { label: string; hint: string; cost: string; promise: string; icon: string };

/**
 * The smallest first move, cheapest first. Each one says what it costs the
 * person and what Loadder gives back, so none of them is a leap of faith.
 */
export const FIRST_ACTIONS: FirstAction[] = [
  {
    label: "سایت یا صفحه‌ات را نشانم بده",
    hint: "یک آدرس بده، خودم می‌خوانمش.",
    cost: "حدود یک دقیقه",
    promise: "بعدش می‌گویم چه دیدم.",
    icon: "globe",
  },
  {
    label: "چند سؤال کوتاه جواب بده",
    hint: "چهار سؤال دربارهٔ کاری که می‌کنی.",
    cost: "حدود سه دقیقه",
    promise: "بعدش می‌گویم چه فهمیدم.",
    icon: "chat",
  },
  {
    label: "اجازه بده خودم بررسی کنم",
    hint: "هرچه تا حالا این‌جا ساخته‌ای را نگاه می‌کنم.",
    cost: "کاری از تو نمی‌خواهد",
    promise: "بعدش می‌گویم چه پیدا کردم.",
    icon: "search",
  },
];

/** State B. What Loadder has learned, and what it still has not. */
export const KNOWN = [
  "صفحه‌ات را خواندم؛ راه تماس رویش هست.",
  "قیمت هیچ‌جا روی صفحه نوشته نشده.",
  "این هفته ۴۱ نفر صفحه را دیدند و ۳ نفر شماره گذاشتند.",
];

export const NOT_YET = [
  "هنوز نمی‌دانم چند نفرشان واقعاً خرید کردند.",
  "هنوز نمی‌دانم مشتری‌هایت بیشتر از کجا می‌آیند.",
];

export const SUGGESTION = {
  title: "به نظرم اول قیمت را روی صفحه بگذاریم.",
  because: "آدم‌ها می‌آیند، ولی چیزی که برای تصمیم گرفتن لازم دارند روی صفحه نیست.",
  ask: "فقط بگو آماده کنم یا نه.",
  consequence: "فقط یک پیش‌نویس می‌سازم · خرج: ۰ تومان · هیچ‌کس نمی‌بیند",
  yes: "آماده کن",
  no: "الان نه",
};

/**
 * Direct access, on both states. A tool opens because the person asked, not
 * because Loadder has finished understanding them.
 */
export const TOOLS: { label: string; route: string; icon: string }[] = [
  { label: "سایت‌ساز", route: "/dashboard/websites", icon: "globe" },
  { label: "مشتری‌ها", route: "/dashboard/crm", icon: "users" },
  { label: "ساخت محتوا", route: "/dashboard/content", icon: "pen" },
  { label: "تبلیغات", route: "/dashboard/ads", icon: "megaphone" },
  { label: "فروشگاه", route: "/dashboard/websites/commerce", icon: "bag" },
  { label: "آمار و نتیجه‌ها", route: "/dashboard/analytics", icon: "chart" },
];

export const GROWTH_COPY = Object.freeze({
  newTitle: "هنوز کسب‌وکارت را کامل نمی‌شناسم.",
  newLead: "برای همین هنوز پیشنهادی ندارم که به دردت بخورد. از هر کدام از این‌ها که راحت‌تری شروع کن؛ بقیه‌اش با من.",
  newActions: "از کجا شروع کنیم؟",
  returningTitle: "حالا چند چیز از کسب‌وکارت می‌دانم.",
  returningLead: "این‌ها را دیدم. کامل نیست، ولی برای اولین پیشنهاد کافی است.",
  knownLabel: "چه دیدم",
  notYetLabel: "چه چیزی را هنوز نمی‌دانم",
  processLabel: "کاری که من می‌کنم",
  here: "الان این‌جاییم",
  safety: "تا وقتی خودت نگویی، هیچ چیزی منتشر نمی‌شود و هیچ پولی خرج نمی‌شود.",
  toolsTitle: "یا مستقیم سراغ کارت برو",
  toolsHint: "لازم نیست اول من چیزی بدانم.",
  more: "چیز تازه‌ای نشانم بده تا بهتر بشناسمت",
});
