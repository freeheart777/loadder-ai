/**
 * ENTRY EXPERIENCE V1 — destination map.
 *
 * Every `route` below is an existing route declared in `src/App.tsx`. Nothing
 * here invents a path, and nothing here reads or writes an API: the prototype
 * is a signpost, not a system. The whole `src/prototype/entry/` directory is
 * removable.
 *
 * Deliberately absent from every beginner surface: Business Brain, Growth Loop
 * / Decision Room, Predictive, Marketing and Platform Admin. A beginner is
 * never shown a governance, evidence or mission-control concept here, and no
 * destination requires a goal, a plan or a diagnosis before it opens.
 */

export const ENTRY_DATA_ORIGIN = "ROUTES_ONLY_NO_BACKEND";

export type Destination = { label: string; hint: string; route: string; icon: string };

export type PathId = "build" | "grow" | "tool";

export const PATHS: { id: PathId; title: string; hint: string; icon: string }[] = [
  { id: "build", title: "می‌خواهم چیزی بسازم", hint: "سایت، فروشگاه، اپلیکیشن یا هویت برند", icon: "build" },
  { id: "grow", title: "می‌خواهم کسب‌وکارم بزرگ‌تر شود", hint: "نمی‌دانم از کجا شروع کنم؛ کمکم کنید", icon: "grow" },
  { id: "tool", title: "فقط می‌خواهم از یک ابزار استفاده کنم", hint: "می‌دانم دنبال چه هستم؛ مستقیم بازش کنید", icon: "tool" },
];

/** Path A. One thing to make, opened directly. */
export const BUILD: Destination[] = [
  { label: "یک سایت", hint: "صفحه‌ای که آدم‌ها شما را در آن پیدا کنند", route: "/dashboard/websites", icon: "globe" },
  { label: "یک فروشگاه اینترنتی", hint: "برای فروختن چیزی که دارید", route: "/dashboard/websites/setup", icon: "bag" },
  { label: "یک اپلیکیشن برای کارتان", hint: "برای کارهایی که هر روز تکرار می‌شود", route: "/dashboard/business-builder", icon: "app" },
  { label: "هویت و برند", hint: "اسم، رنگ، لحن و نشان", route: "/dashboard/brand-book", icon: "book" },
  { label: "یک پیشنهاد کاری", hint: "متنی که برای مشتری یا شریک می‌فرستید", route: "/dashboard/business-proposal", icon: "file" },
];

/** Path B. The only path that leads to Home, and it asks nothing on the way. */
export const GROW = {
  route: "/dashboard",
  label: "خانه را باز کنید",
  lead: "خانه یک چیز را نشان می‌دهد که همین حالا ارزش نگاه کردن دارد. اگر چیزی نبود، خالی می‌ماند.",
  facts: [
    "لازم نیست از قبل هدفی نوشته باشید.",
    "لازم نیست برنامه‌ای بسازید.",
    "هیچ کاری بدون اجازهٔ شما انجام نمی‌شود.",
  ],
};

/** Path C. Direct access. A tool opens because you asked, not because a plan allowed it. */
export const TOOLS: Destination[] = [
  { label: "مشتری‌ها", hint: "فهرست و پیگیری", route: "/dashboard/crm", icon: "users" },
  { label: "ساخت محتوا", hint: "متن و پست", route: "/dashboard/content", icon: "pen" },
  { label: "سایت‌ساز", hint: "ساخت و ویرایش صفحه", route: "/dashboard/websites", icon: "globe" },
  { label: "فروشگاه", hint: "کالا و سفارش", route: "/dashboard/websites/commerce", icon: "bag" },
  { label: "تبلیغات", hint: "کمپین و بودجه", route: "/dashboard/ads", icon: "megaphone" },
  { label: "اینستاگرام", hint: "برنامهٔ انتشار", route: "/dashboard/social", icon: "instagram" },
  { label: "آمار و نتیجه‌ها", hint: "چه اتفاقی افتاد", route: "/dashboard/analytics", icon: "chart" },
  { label: "شاخص‌ها", hint: "عددهایی که دنبال می‌کنید", route: "/dashboard/kpi", icon: "gauge" },
  { label: "برند بوک", hint: "رنگ و لحن", route: "/dashboard/brand-book", icon: "book" },
  { label: "پیشنهاد کاری", hint: "متن پیشنهاد", route: "/dashboard/business-proposal", icon: "file" },
  { label: "اپلیکیشن‌ساز", hint: "ابزار داخلی کارتان", route: "/dashboard/business-builder", icon: "app" },
  { label: "کارهای تکراری", hint: "کاری که خودش انجام شود", route: "/dashboard/automation", icon: "repeat" },
  { label: "مدیریت سایت", hint: "دامنه و تنظیمات", route: "/dashboard/site-operations", icon: "gear" },
];

export const ENTRY_COPY = Object.freeze({
  question: "برای چه کاری آمده‌اید؟",
  lead: "یکی را انتخاب کنید. انتخابتان قفل نمی‌شود؛ هر وقت خواستید برمی‌گردید و چیز دیگری را برمی‌دارید.",
  buildTitle: "چه چیزی بسازیم؟",
  buildLead: "روی هرکدام بزنید، همان‌جا باز می‌شود.",
  growTitle: "بگذارید از جایی شروع کنیم که به دردتان بخورد.",
  toolTitle: "کدام ابزار؟",
  toolLead: "هر کدام را بزنید مستقیم باز می‌شود. لازم نیست اول هدف یا برنامه‌ای بسازید.",
  back: "برگردید به سؤال اول",
  alsoTool: "فعلاً فقط می‌خواهم یک ابزار باز کنم",
  alsoBuild: "چیز دیگری هم می‌خواهم بسازم",
  footer: "هیچ‌کدام از این‌ها شما را به چیزی متعهد نمی‌کند.",
});
