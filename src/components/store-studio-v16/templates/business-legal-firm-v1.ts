import type { SectionConfig, SectionItem } from "../types";
import type { SectionItemIcon } from "../item-icons";
import type { WebsiteTemplate } from "./types";

// Legal Firm Starter (spec: legal-firm-starter), expressed in the existing
// V16 BUSINESS section schema — no new section types or renderers:
//   HeroSection          → hero
//   TrustMetricsSection  → services (value = title, label = subtitle, icon)
//   ServicesGridSection  → services (icon, title, subtitle, body)
//   TeamProfileSection   → team (image, name, role, bio)
//   FeaturesSection      → services (icon, title, body)
//   CaseStudiesSection   → portfolio (image, title, practice area, result)
//   TestimonialsSection  → team (photo, name, role, quote)
//   ArticlesSection      → portfolio (image, title, meta line, excerpt, href)
//   ContactFormSection   → contact
// Every item is a repeater entry in the Inspector; plain data, no AI.

type ItemSeed = [title: string, subtitle: string, body?: string, icon?: SectionItemIcon, href?: string];

const items = (sectionId: string, seeds: ItemSeed[]): SectionItem[] => seeds.map(([title, subtitle, body = "", icon, href], index) => ({
  id: `${sectionId}-${index + 1}`, title, subtitle, body, imageUrl: "", meta: "", ...(icon ? { icon } : {}), ...(href ? { href } : {}),
}));

const section = (id: string, type: SectionConfig["type"], title: string, subtitle: string, extra: Partial<SectionConfig> = {}): SectionConfig => ({
  id, type, enabled: true, title, subtitle, backgroundColor: "#ffffff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra,
});

const cards = (id: string, type: "services" | "team" | "portfolio", title: string, subtitle: string, navLabel: string, columns: number, seeds: ItemSeed[], extra: Partial<SectionConfig> = {}) =>
  section(id, type, title, subtitle, { showInNav: Boolean(navLabel), navLabel, columns, items: items(id, seeds), ...extra });

export const legalFirmStarterV1: WebsiteTemplate = {
  id: "business.legal.firm.v1",
  label: "دفتر حقوقی حرفه‌ای",
  description: "معرفی دفتر، آمار اعتماد، حوزه‌های تخصصی، وکلا، پرونده‌ها، نظر موکلان، مقالات و فرم رزرو مشاوره.",
  siteKind: "BUSINESS",
  design: { primaryColor: "#1e3a5f", secondaryColor: "#e8edf4" },
  header: { storeName: "دفتر حقوقی شما" },
  hero: {
    layout: "background",
    eyebrow: "دفتر وکالت و مشاوره حقوقی",
    title: "دفاع حرفه‌ای از حقوق شما",
    subtitle: "مشاوره روشن، استراتژی دقیق و پیگیری مستمر پرونده؛ از اولین جلسه تا نتیجه.",
    ctaLabel: "رزرو جلسه مشاوره",
    ctaHref: "#contact-main",
    backgroundColor: "#111b2b",
    overlayOpacity: 60,
  },
  sections: [
    cards("metrics-main", "services", "اعتماد در عدد", "کارنامه‌ای که به آن تکیه می‌کنیم", "", 4, [
      ["۲۵+", "سال سابقه وکالت", "", "trophy"],
      ["۱۲۰۰+", "پرونده به نتیجه رسیده", "", "scales"],
      ["۹۸٪", "رضایت موکلان", "", "handshake"],
      ["۲۴ ساعت", "پاسخ به درخواست مشاوره", "", "clock"],
    ], { backgroundColor: "#f5f7fb" }),
    cards("practice-main", "services", "حوزه‌های تخصصی", "در هر پرونده، وکیل متخصص همان حوزه کنار شماست", "خدمات", 3, [
      ["حقوق خانواده", "طلاق، مهریه، حضانت", "مشاوره و وکالت در دعاوی خانواده با حفظ محرمانگی کامل.", "users"],
      ["حقوق تجارت و شرکت‌ها", "ثبت، قرارداد، اختلاف شرکا", "همراهی حقوقی کسب‌وکار از تأسیس تا حل اختلاف.", "briefcase"],
      ["دعاوی ملکی", "خلع ید، الزام به تنظیم سند", "بررسی اسناد و دفاع در دعاوی ملک و مستغلات.", "house"],
      ["حقوق کیفری", "دفاع در دادسرا و دادگاه", "دفاع دقیق در تمام مراحل رسیدگی کیفری.", "gavel"],
      ["تنظیم قرارداد", "نگارش و بازبینی قرارداد", "قراردادهایی که از بروز اختلاف پیشگیری می‌کنند.", "file"],
      ["داوری و حل اختلاف", "داوری تجاری و سازش", "حل سریع‌تر اختلاف، بیرون از فرایند طولانی دادگاه.", "bank"],
    ]),
    cards("attorneys-main", "team", "وکلای ما", "تیمی متخصص با تجربه در دادگاه‌های کشور", "وکلا", 3, [
      ["نام وکیل ارشد", "وکیل پایه یک دادگستری · مدیر دفتر", "بیش از دو دهه تجربه در دعاوی تجاری و ملکی."],
      ["نام وکیل", "وکیل پایه یک دادگستری · حقوق خانواده", "متخصص دعاوی خانواده و مذاکره برای سازش."],
      ["نام وکیل", "مشاور حقوقی · حقوق شرکت‌ها", "تنظیم قرارداد و همراهی حقوقی شرکت‌ها."],
    ]),
    cards("features-main", "services", "چرا دفتر ما", "آنچه موکلان ما را کنار ما نگه می‌دارد", "", 3, [
      ["محرمانگی کامل", "", "اطلاعات و اسناد شما فقط در اختیار وکیل پرونده است.", "shield"],
      ["مشاوره شفاف", "", "از ابتدا مسیر، هزینه و ریسک‌های پرونده را روشن می‌گوییم.", "chat"],
      ["پیگیری منظم", "", "گزارش مرحله‌به‌مرحله پرونده، بدون نیاز به پیگیری شما.", "lightning"],
    ], { backgroundColor: "#f5f7fb" }),
    cards("cases-main", "portfolio", "پرونده‌های موفق", "نمونه‌هایی از نتایجی که برای موکلان رقم زدیم", "پرونده‌ها", 3, [
      ["حل اختلاف شرکای تجاری", "حقوق تجارت", "توافق در داوری ظرف سه ماه و حفظ فعالیت شرکت."],
      ["الزام به تنظیم سند رسمی", "دعاوی ملکی", "صدور حکم به نفع موکل و انتقال رسمی ملک."],
      ["دفاع در پرونده کیفری", "حقوق کیفری", "صدور قرار منع تعقیب پس از ارائه دفاعیات مستند."],
    ]),
    cards("testimonials-main", "team", "نظر موکلان", "تجربه کسانی که به ما اعتماد کردند", "", 3, [
      ["نام موکل", "مدیر شرکت بازرگانی", "«در تمام مراحل پرونده در جریان بودم و نتیجه فراتر از انتظارم بود.»"],
      ["نام موکل", "موکل دعاوی خانواده", "«با آرامش و احترام، مسیر سختی را برایم ساده کردند.»"],
      ["نام موکل", "موکل دعاوی ملکی", "«پیگیری دقیق و پاسخ‌گویی سریع؛ کاملاً حرفه‌ای.»"],
    ]),
    cards("articles-main", "portfolio", "مقالات حقوقی", "راهنماهای کوتاه برای تصمیم آگاهانه", "مقالات", 3, [
      ["پیش از امضای قرارداد اجاره چه باید بدانیم؟", "راهنمای حقوقی · ۵ دقیقه", "نکات کلیدی که از اختلاف‌های رایج پیشگیری می‌کنند.", undefined, "#"],
      ["مراحل ثبت شرکت و مسئولیت شرکا", "حقوق شرکت‌ها · ۷ دقیقه", "از انتخاب نوع شرکت تا تنظیم اساسنامه.", undefined, "#"],
      ["حقوق مالی زوجه پس از طلاق", "حقوق خانواده · ۶ دقیقه", "مهریه، نفقه و اجرت‌المثل به زبان ساده.", undefined, "#"],
    ]),
    section("contact-main", "contact", "رزرو جلسه مشاوره", "فرم را کامل کنید؛ همکاران ما برای هماهنگی جلسه تماس می‌گیرند.", {
      showInNav: true,
      navLabel: "تماس",
      contact: { formEnabled: true, submitLabel: "ارسال درخواست مشاوره", successMessage: "درخواست شما ثبت شد؛ به‌زودی تماس می‌گیریم.", phone: "", email: "", address: "", mapUrl: "" },
    }),
  ],
};
