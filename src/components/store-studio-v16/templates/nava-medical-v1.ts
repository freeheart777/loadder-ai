import type { PageConfig, SectionConfig } from "../types";
import type { WebsiteTemplate } from "./types";

// NAVA: the Medical golden starter. It is plain V16 data on the canonical
// MEDICAL site type; there is no Medical renderer or CMS. Every card below is a
// clearly labelled sample: no doctors, claims, ratings, awards or results are
// invented, and live facts (duration, care modes, price, doctors) come from the
// Booking records a card is linked to.
const IVORY = "#f7f3ea", IVORY_DEEP = "#efe9db", CHARCOAL = "#2b2a27", SAGE = "#5f7560", BRONZE = "#a98242";
const templatePhoto = (path: string) => `${typeof window === "undefined" ? "" : window.location.origin}/template-images/${path}.webp`;

const item = (id: string, title: string, subtitle: string, body: string, extra: { imageUrl?: string; meta?: string } = {}) => ({ id, title, subtitle, body, imageUrl: extra.imageUrl || "", meta: extra.meta || "" });
const section = (id: string, type: SectionConfig["type"], title: string, subtitle: string, extra: Partial<SectionConfig> = {}): SectionConfig =>
  ({ id, type, enabled: true, title, subtitle, backgroundColor: IVORY, textColor: CHARCOAL, spacingTop: 56, spacingBottom: 56, ...extra });
const cards = (id: string, type: "services" | "team" | "portfolio", title: string, subtitle: string, navLabel: string, items: ReturnType<typeof item>[], extra: Partial<SectionConfig> = {}) =>
  section(id, type, title, subtitle, { showInNav: false, navLabel, columns: 3, items, ...extra });
const text = (id: string, title: string, subtitle: string, body: string, extra: Partial<SectionConfig> = {}) => section(id, "about", title, subtitle, { body, ...extra });
const cta = (id: string, title: string, subtitle: string, label: string, href: string) =>
  section(id, "cta", title, subtitle, { ctaLabel: label, ctaHref: href, backgroundColor: SAGE, textColor: "#ffffff" });
const contact = () => section("contact-main", "contact", "تماس و نشانی", "اطلاعات تماس، نشانی و ساعات کاری مرکز را اینجا کامل کنید.", { showInNav: true, navLabel: "تماس", backgroundColor: IVORY_DEEP, contact: { formEnabled: true, submitLabel: "ارسال پیام", successMessage: "پیام شما ثبت شد.", phone: "", email: "", address: "", mapUrl: "" } });
const page = (id: string, title: string, slug: string, sections: SectionConfig[], description = ""): PageConfig =>
  ({ id, title, slug, isHome: false, showInNav: true, navLabel: title, seo: { title, description }, sections });

const ORDINAL = ["یک", "دو", "سه", "چهار", "پنج"];
const SAMPLE = "این کارت نمونه است؛ توضیح واقعی را پیش از انتشار جایگزین کنید.";
const service = (index: number, category: string) => item(`service-${index}`, `خدمت نمونه ${ORDINAL[index - 1]}`, "نمونه — قابل ویرایش", `${SAMPLE}\n\nآمادگی پیش از مراجعه: مدارک و توصیه‌های لازم را اینجا بنویسید.`, { meta: category });
const doctor = (index: number, category: string, photo: string) => item(`doctor-${index}`, `پزشک نمونه ${ORDINAL[index - 1]}`, "تخصص — قابل ویرایش", "معرفی، زمینه‌های فعالیت و سوابق تأییدشدهٔ پزشک را اینجا بنویسید.", { meta: category, imageUrl: templatePhoto(photo) });
const article = (index: number, category: string) => item(`article-${index}`, `مقاله نمونه ${ORDINAL[index - 1]}`, "راهنمای بیمار — قابل ویرایش", `${SAMPLE}\n\nاین متن جایگزین توصیهٔ پزشکی نیست و باید پیش از انتشار توسط پزشک مسئول بازبینی شود.`, { meta: category });

export const navaMedicalV1: WebsiteTemplate = {
  id: "nava-medical-v1", label: "نوا — مرکز درمانی", description: "کلینیک و پزشکان با خدمات، مجله و نوبت‌دهی متصل به رزرو واقعی.", siteKind: "BUSINESS", siteType: "MEDICAL",
  design: { primaryColor: SAGE, secondaryColor: "#e6e9de", backgroundColor: IVORY, textColor: CHARCOAL, surfaceColor: "#fffdf8" },
  header: { storeName: "مرکز درمانی نوا", backgroundColor: IVORY, textColor: CHARCOAL, sticky: true },
  nav: { enabled: true, ctaLabel: "رزرو نوبت", ctaHref: "/booking" },
  footer: { enabled: true, text: "اطلاعات این سایت جایگزین مشاورهٔ پزشکی نیست.", backgroundColor: CHARCOAL, textColor: "#e9e4d6" },
  seo: { title: "مرکز درمانی نوا", description: "خدمات درمانی، پزشکان و رزرو نوبت." },
  hero: { enabled: true, layout: "split", eyebrow: "مراقبت پزشکی با آرامش و دقت", title: "سلامت شما، با توجه و زمان کافی", subtitle: "پزشکان، خدمات و نوبت‌دهی در یک مسیر روشن و ساده.", ctaLabel: "رزرو نوبت", ctaHref: "/booking", imageUrl: templatePhoto("medical/hero"), backgroundColor: IVORY_DEEP, textColor: CHARCOAL },
  sections: [
    cards("home-services", "services", "تخصص‌ها و خدمات", "نمونه — خدمات واقعی را از نوبت‌دهی متصل کنید.", "خدمات", [service(1, "عمومی"), service(2, "تخصصی"), service(3, "تشخیصی")], { showInNav: false }),
    cards("home-doctors", "team", "پزشکان", "نمونه — پزشکان واقعی را از نوبت‌دهی متصل کنید.", "پزشکان", [doctor(1, "تخصص نمونه", "medical/doctor-1"), doctor(2, "تخصص نمونه", "medical/doctor-2")], { columns: 2 }),
    cards("home-why", "services", "چرا این مرکز", "ارزش‌ها و روش کار را با اطلاعات تأییدشدهٔ خودتان بنویسید.", "درباره", [
      item("why-1", "زمان کافی برای هر بیمار", "نمونه — قابل ویرایش", "توضیح خودتان را جایگزین کنید."),
      item("why-2", "مسیر روشن مراجعه", "نمونه — قابل ویرایش", "توضیح خودتان را جایگزین کنید."),
      item("why-3", "پیگیری پس از ویزیت", "نمونه — قابل ویرایش", "فقط خدماتی را بنویسید که مرکز واقعاً ارائه می‌دهد."),
    ], { backgroundColor: IVORY_DEEP }),
    cards("home-facilities", "portfolio", "امکانات مرکز", "تصویر و توضیح امکانات واقعی را اضافه کنید.", "امکانات", [item("facility-1", "فضای انتظار", "نمونه", "تصویر و توضیح را اضافه کنید."), item("facility-2", "اتاق معاینه", "نمونه", "تصویر و توضیح را اضافه کنید.")], { columns: 2 }),
    cards("home-journey", "services", "مسیر مراجعه", "از رزرو تا پیگیری در چند گام.", "مسیر", [
      item("journey-1", "۱. انتخاب خدمت و پزشک", "", "خدمت و پزشک موردنظر را انتخاب کنید."),
      item("journey-2", "۲. انتخاب نوع مراجعه و زمان", "", "از میان زمان‌های واقعاً در دسترس انتخاب کنید."),
      item("journey-3", "۳. ثبت اطلاعات و تأیید", "", "کد پیگیری نوبت را دریافت کنید."),
    ], { backgroundColor: IVORY_DEEP, columns: 3 }),
    cta("home-cta-articles", "مجلهٔ سلامت", "مطالب آموزشی مرکز را بخوانید.", "ورود به مجله", "/magazine"),
    cta("home-cta-booking", "آمادهٔ رزرو نوبت هستید؟", "خدمت و پزشک را انتخاب کنید و زمان آزاد را ببینید.", "رزرو نوبت", "/booking"),
    contact(),
  ],
  pages: [
    page("page-services", "خدمات", "services", [
      text("services-intro", "خدمات مرکز", "برای هر خدمت، مدت، شیوه‌های مراجعه و پزشکان از نوبت‌دهی نمایش داده می‌شود.", "با فیلتر دسته‌بندی، خدمت موردنظر را پیدا کنید."),
      cards("services-directory", "services", "همهٔ خدمات", "کارت‌ها نمونه‌اند؛ هر کارت را به یک خدمت نوبت‌دهی متصل کنید.", "خدمات", [service(1, "عمومی"), service(2, "تخصصی"), service(3, "تشخیصی"), service(4, "تخصصی")]),
      text("services-faq", "سؤالات متداول", "نمونه", "پاسخ سؤال‌های رایج بیماران را اینجا بنویسید. این متن نمونه است و جایگزین توصیهٔ پزشکی نیست."),
      cta("services-cta", "نوبت می‌خواهید؟", "از صفحهٔ هر خدمت مستقیم رزرو کنید.", "رزرو نوبت", "/booking"),
    ], "خدمات درمانی مرکز"),
    page("page-doctors", "پزشکان", "doctors", [
      text("doctors-intro", "پزشکان مرکز", "تخصص، شیوه‌های مراجعه و خدمات هر پزشک از نوبت‌دهی نمایش داده می‌شود.", "با فیلتر تخصص، پزشک موردنظر را پیدا کنید."),
      cards("doctors-directory", "team", "همهٔ پزشکان", "کارت‌ها نمونه‌اند؛ هر کارت را به یک پزشک نوبت‌دهی متصل کنید.", "پزشکان", [doctor(1, "تخصص نمونه الف", "medical/doctor-1"), doctor(2, "تخصص نمونه ب", "medical/doctor-2")], { columns: 2 }),
      cta("doctors-cta", "با پزشک موردنظر وقت بگیرید", "از صفحهٔ هر پزشک مستقیم رزرو کنید.", "رزرو نوبت", "/booking"),
    ], "پزشکان مرکز"),
    page("page-clinic", "مرکز", "clinic", [
      section("clinic-about", "text-image", "دربارهٔ مرکز", "معرفی مرکز", { body: "معرفی مرکز، فضا و روش کار را با اطلاعات تأییدشده بنویسید.", imageUrl: templatePhoto("medical/hero"), mediaPosition: "end" }),
      cards("clinic-facilities", "portfolio", "امکانات", "تصویر و توضیح امکانات واقعی را اضافه کنید.", "امکانات", [item("facility-a", "پارکینگ و دسترسی", "نمونه", "وضعیت دسترسی را اینجا بنویسید."), item("facility-b", "تجهیزات", "نمونه", "فقط تجهیزات واقعی مرکز را بنویسید."), item("facility-c", "فضای انتظار", "نمونه", "توضیح را جایگزین کنید.")], { backgroundColor: IVORY_DEEP }),
      text("clinic-access", "دسترسی و ساعات کاری", "نشانی و ساعات", "نشانی، ساعات کاری و راه‌های ارتباطی را اینجا بنویسید."),
      cta("clinic-cta", "برای مراجعه نوبت بگیرید", "", "رزرو نوبت", "/booking"),
    ], "معرفی مرکز و امکانات"),
    page("page-magazine", "مجله", "magazine", [
      text("magazine-featured", "مقالهٔ ویژه", "نمونه", "یکی از مقاله‌های بازبینی‌شده را اینجا معرفی کنید. مطالب مجله جایگزین توصیهٔ پزشکی نیست."),
      cards("magazine-directory", "services", "مجلهٔ سلامت", "مقاله‌ها نمونه‌اند و باید توسط پزشک مسئول بازبینی شوند.", "مجله", [article(1, "راهنمای بیمار"), article(2, "پیشگیری"), article(3, "راهنمای بیمار")]),
      text("magazine-disclaimer", "سلب مسئولیت", "", "مطالب این بخش آموزشی است و جایگزین ویزیت یا توصیهٔ پزشک نیست."),
    ], "مقالات آموزشی سلامت"),
  ],
};
