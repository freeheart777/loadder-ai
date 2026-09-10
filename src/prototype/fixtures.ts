/**
 * PROTOTYPE FIXTURES — not production data.
 *
 * Every value here is invented for the Master Home visual prototype. Nothing in
 * this directory reads or writes a canonical Loadder API, and nothing here may
 * ever be persisted. The whole `src/prototype/` directory is removable.
 */

export const PROTOTYPE_DATA_ORIGIN = "FIXTURE_ONLY_NOT_CANONICAL";

export type Tool = { fa: string; en?: string; icon: string; route: string };

/** Zone 4. Direct access is preserved: opening a tool never requires a plan. */
export const TOOLS: Tool[] = [
  { fa: "مشتری‌ها", en: "CRM", icon: "users", route: "/dashboard/crm" },
  { fa: "ساخت محتوا", en: "Content", icon: "pen", route: "/dashboard/content" },
  { fa: "سایت‌ساز", en: "Website Builder", icon: "globe", route: "/dashboard/websites" },
  { fa: "فروشگاه", en: "Commerce", icon: "bag", route: "/dashboard/websites/commerce" },
  { fa: "آمار و نتیجه‌ها", en: "Analytics", icon: "chart", route: "/dashboard/analytics" },
  { fa: "تبلیغات", en: "Ads", icon: "megaphone", route: "/dashboard/ads" },
  { fa: "برند بوک", en: undefined, icon: "book", route: "/dashboard/brand-book" },
  { fa: "اپلیکیشن‌ساز", en: "App Builder", icon: "bolt", route: "/dashboard/business-builder" },
  { fa: "اینستاگرام", en: "Social", icon: "instagram", route: "/dashboard/social" },
  { fa: "پیشنهاد کاری", en: "Proposal", icon: "file", route: "/dashboard/business-proposal" },
  { fa: "کارهای تکراری", en: "Automation", icon: "repeat", route: "/dashboard/automation" },
  { fa: "مدیریت سایت", en: "Site Ops", icon: "gear", route: "/dashboard/site-operations" },
  { fa: "شاخص‌ها", en: "KPI", icon: "gauge", route: "/dashboard/kpi" },
];

/** Shortlist variant for Screen 10-B. */
export const SHORTLIST = TOOLS.slice(0, 4);

export type Confidence = "saw" | "think" | "unknown";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  saw: "دیدم",
  think: "فکر می‌کنم",
  unknown: "هنوز نمی‌دانم",
};

export const DIAGNOSIS = {
  business: "کافه‌ای در تهران",
  headline: "سه چیز دیدم.",
  findings: [
    { tone: "saw" as Confidence, text: "راه تماس روی صفحه هست و با یک کلیک در دسترس است." },
    { tone: "saw" as Confidence, text: "قیمت هیچ‌جا نوشته نشده." },
    { tone: "unknown" as Confidence, text: "چند نفر از کسانی که صفحه را می‌بینند واقعاً خرید می‌کنند." },
  ],
  conclusion: "به نظرم اول باید همین را بررسی کنیم: آدم‌ها می‌آیند، ولی چیزی که لازم دارند تا تصمیم بگیرند روی صفحه نیست.",
};

export const PLAN = {
  goal: "مشتری بیشتر",
  because: "آدم‌ها به صفحه می‌آیند، ولی کمتر کسی تماس می‌گیرد.",
  steps: [
    { title: "مسیر تماس را بررسی می‌کنم", output: "یک گزارش کوتاه", needsYou: false },
    { title: "صفحه را با قیمت و یک دعوت روشن بازنویسی می‌کنم", output: "یک نسخهٔ تازه از صفحه", needsYou: false },
    { title: "نسخهٔ تازه را نشانتان می‌دهم", output: "پیش‌نمایش", needsYou: true },
    { title: "دو هفته نتیجه را می‌سنجم", output: "یک نتیجهٔ ساده", needsYou: false },
  ],
};

export const PERMISSION = {
  action: "انتشار نسخهٔ تازهٔ صفحه",
  facts: [
    { label: "چه اتفاقی می‌افتد", value: "صفحه برای همه باز می‌شود" },
    { label: "چقدر خرج دارد", value: "۰ تومان" },
    { label: "چه کسی می‌بیند", value: "هر کسی که لینک را داشته باشد" },
    { label: "برگشت دارد؟", value: "بله، تا هر وقت بخواهید" },
  ],
  posture: [
    { text: "بررسی کنم", allowed: true },
    { text: "پیش‌نویس بسازم", allowed: true },
    { text: "منتشر کنم", allowed: false },
    { text: "پول خرج کنم", allowed: false },
  ],
};

export const WORK = [
  { state: "done" as const, text: "صفحه بررسی شد" },
  { state: "done" as const, text: "نسخهٔ تازه آماده شد" },
  { state: "waiting" as const, text: "منتظر نظر شما" },
  { state: "next" as const, text: "انتشار" },
  { state: "next" as const, text: "اندازه‌گیری" },
];

export const OUTPUT = {
  kind: "صفحهٔ تازه",
  title: "کافه رستا",
  tagline: "قهوهٔ دم‌کرده، هر روز از ساعت ۸ صبح",
  price: "از ۹۵٬۰۰۰ تومان",
  cta: "رزرو میز",
  note: "قیمت و یک دعوت روشن اضافه شد؛ بقیهٔ صفحه دست‌نخورده ماند.",
};

export const REPLAN = {
  headline: "برنامه را کمی تغییر دادم.",
  numbers: [
    { value: "۴۱", label: "نفر صفحه را دیدند" },
    { value: "۳", label: "نفر شماره گذاشتند" },
  ],
  reasoning: "قبل از اینکه پول تبلیغ خرج کنیم، بهتر است خود صفحه را درست کنیم. با این نسبت، تبلیغ فقط آدم بیشتری را از همان مسیر رد می‌کند.",
  before: "تبلیغ در اینستاگرام",
  after: "اصلاح صفحه، بعد تبلیغ",
};

export const RESULT = {
  numbers: [
    { value: "۴۱", label: "نفر صفحه را دیدند" },
    { value: "۳", label: "نفر شماره گذاشتند" },
  ],
  meaning: "یعنی از هر ۱۴ نفر، یک نفر.",
  known: "این عددها از خود صفحه‌اند و دقیق‌اند.",
  unknown: "چند نفرشان واقعاً به کافه آمدند — چون هنوز جایی ثبت نمی‌شود.",
};

export const LEARNING = {
  saw: "هفته‌ای که قیمت روی صفحه بود، شماره‌های بیشتری ثبت شد.",
  think: "فکر می‌کنم قیمت کمک کرده، اما همان هفته پستتان هم بیشتر دیده شد. مطمئن نیستم کدام.",
  offer: "می‌خواهید دفعهٔ بعد طوری امتحان کنیم که مطمئن‌تر شویم؟ نصف بازدیدکننده‌ها را با قیمت و نصف را بدون قیمت نشان می‌دهم.",
};

export const MATURE = {
  primary: {
    title: "سه نفر شماره گذاشتند و هنوز کسی با آن‌ها تماس نگرفته.",
    belief: "فکر می‌کنم اگر امروز زنگ بزنید شانس بیشتری دارید تا هفتهٔ بعد.",
    suggestion: "بگذارید یک متن کوتاه برای تماس آماده کنم.",
    ask: "فقط بگویید آماده کنم یا نه.",
    consequence: "فقط بررسی می‌کنم · خرج: ۰ تومان · پیام به مشتری: ۰",
  },
  inProgress: [
    { text: "اصلاح صفحهٔ کافه", detail: "منتظر نظر شما" },
    { text: "سنجش نتیجهٔ منوی تازه", detail: "۹ روز دیگر" },
  ],
  learned: {
    saw: "وقتی قیمت روی صفحه بود، شماره‌های بیشتری ثبت شد.",
    boundary: "هنوز مطمئن نیستم دلیل اصلی همین بوده.",
  },
  quiet: "۲ مورد دیگر می‌توانند صبر کنند.",
};
