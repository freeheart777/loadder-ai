import type { SectionConfig, SectionItem } from "../types";
import type { SectionItemIcon } from "../item-icons";
import type { WebsiteTemplate } from "./types";

// Legal Firm Starter (spec: legal-firm-starter) — a complete starter website in
// the existing V16 BUSINESS section schema; no new section types or renderers:
//   HeroSection          → hero (trust badge = eyebrow, headline, subtitle, CTA, image)
//   TrustMetricsSection  → services (value = title, label = subtitle, icon)
//   ServicesGridSection  → services (icon, title, subtitle, body)
//   TeamProfileSection   → team (portrait, identity, specialty, bio)
//   FeaturesSection      → services (icon, title, body)
//   CaseStudiesSection   → portfolio (image, anonymous case, practice area, result)
//   TestimonialsSection  → team (avatar, anonymous client, context, quote)
//   ArticlesSection      → portfolio (image, SEO title, meta line, excerpt, href)
//   ContactFormSection   → contact (consultation form)
// Every card is an Inspector repeater entry; every image is an ordinary image
// field, replaceable from the Media Library or by inline upload. Services cards
// carry an icon but no image: the existing services card renders no media, and
// its server output is pinned byte-for-byte (docs/decisions/PR4B-render-boundary.md).
// Plain data, no AI, and no runtime imports (the server tests load this file directly).
//
// Default images are self-contained SVG placeholders (data:image/svg+xml): no
// hosting, identical on the Studio canvas, /site/:id, the server-rendered
// public site and custom domains (the renderer allows data:image URLs).

// ── Placeholder images ────────────────────────────────────────────────────
const image = (width: number, height: number, body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const gradient = (from: string, to: string) =>
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`;

/** heroImage: courthouse columns on navy. */
const heroImage = image(1600, 900, `${gradient("#0f1b2d", "#1e3a5f")}<g fill="#c9a227" opacity=".18"><rect x="560" y="250" width="480" height="40" rx="6"/><polygon points="540,250 800,120 1060,250"/>${[600, 700, 800, 900].map((x) => `<rect x="${x}" y="300" width="40" height="330" rx="10"/>`).join("")}<rect x="540" y="640" width="520" height="44" rx="6"/></g>`);

/** teamImage: neutral portrait silhouette — never a real person. */
const teamImage = (tone: string) => image(600, 600, `<rect width="600" height="600" fill="${tone}"/><circle cx="300" cy="235" r="110" fill="#94a3b8"/><path d="M110 600c0-120 85-200 190-200s190 80 190 200z" fill="#94a3b8"/><rect x="265" y="420" width="70" height="120" fill="#1e3a5f" opacity=".85"/>`);

/** caseImages: practice-area colour field with a document motif. */
const caseImage = (from: string, to: string) => image(800, 450, `${gradient(from, to)}<g fill="#ffffff" opacity=".22"><rect x="300" y="110" width="200" height="250" rx="14"/><rect x="330" y="160" width="140" height="12" rx="6" fill="${from}"/><rect x="330" y="195" width="110" height="12" rx="6" fill="${from}"/><rect x="330" y="230" width="130" height="12" rx="6" fill="${from}"/></g><circle cx="500" cy="330" r="46" fill="#c9a227" opacity=".55"/>`);

/** articleImages: open-page motif. */
const articleImage = (tone: string) => image(800, 450, `<rect width="800" height="450" fill="${tone}"/><g fill="#ffffff" opacity=".9"><path d="M220 110h170v250H220z"/><path d="M410 110h170v250H410z"/></g><g fill="#1e3a5f" opacity=".25">${[150, 180, 210, 240, 270].map((y) => `<rect x="245" y="${y}" width="120" height="9" rx="4"/><rect x="435" y="${y}" width="120" height="9" rx="4"/>`).join("")}</g>`);

// ── Section helpers ───────────────────────────────────────────────────────
type ItemSeed = { title: string; subtitle?: string; body?: string; icon?: SectionItemIcon; imageUrl?: string; href?: string };

const items = (sectionId: string, seeds: ItemSeed[]): SectionItem[] => seeds.map((seed, index) => ({
  id: `${sectionId}-${index + 1}`, title: seed.title, subtitle: seed.subtitle || "", body: seed.body || "", imageUrl: seed.imageUrl || "", meta: "",
  ...(seed.icon ? { icon: seed.icon } : {}), ...(seed.href ? { href: seed.href } : {}),
}));

const section = (id: string, type: SectionConfig["type"], title: string, subtitle: string, extra: Partial<SectionConfig> = {}): SectionConfig => ({
  id, type, enabled: true, title, subtitle, backgroundColor: "#ffffff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra,
});

const cards = (id: string, type: "services" | "team" | "portfolio", title: string, subtitle: string, navLabel: string, columns: number, seeds: ItemSeed[], extra: Partial<SectionConfig> = {}) =>
  section(id, type, title, subtitle, { showInNav: Boolean(navLabel), navLabel, columns, items: items(id, seeds), ...extra });

const LAWYER = "وکیل پایه یک دادگستری";

export const legalFirmStarterV1: WebsiteTemplate = {
  id: "business.legal.firm.v1",
  label: "دفتر حقوقی حرفه‌ای",
  description: "وب‌سایت کامل دفتر وکالت: آمار اعتماد، ۶ حوزه تخصصی، معرفی وکلا، پرونده‌های موفق، نظر موکلان، مقالات حقوقی و فرم رزرو مشاوره.",
  siteKind: "BUSINESS",
  metadata: {
    industry: "LEGAL",
    targetAudience: ["law firms", "legal offices", "consultants"],
  },
  design: { primaryColor: "#1e3a5f", secondaryColor: "#e8edf4" },
  header: { storeName: "دفتر حقوقی شما" },
  seo: {
    title: "دفتر وکالت و مشاوره حقوقی | وکیل پایه یک دادگستری",
    description: "مشاوره و وکالت تخصصی در دعاوی خانواده، تجاری، ملکی و کیفری. رزرو جلسه مشاوره حقوقی با وکیل پایه یک دادگستری.",
  },
  hero: {
    layout: "background",
    eyebrow: "دارای پروانه وکالت پایه یک · مشاوره کاملاً محرمانه",
    title: "وکالت تخصصی و مشاوره حقوقی قابل اعتماد",
    subtitle: "از اولین جلسه مشاوره تا صدور رأی، با استراتژی روشن، گزارش منظم و دفاع دقیق در کنار شما هستیم.",
    ctaLabel: "رزرو جلسه مشاوره",
    ctaHref: "#contact-main",
    imageUrl: heroImage,
    backgroundColor: "#111b2b",
    overlayOpacity: 55,
  },
  sections: [
    cards("metrics-main", "services", "اعتماد در عدد", "کارنامه‌ای که موکلان به آن تکیه می‌کنند", "", 4, [
      { title: "۲۵+", subtitle: "سال سابقه وکالت", icon: "trophy" },
      { title: "۱۲۰۰+", subtitle: "پرونده به نتیجه رسیده", icon: "scales" },
      { title: "۹۸٪", subtitle: "رضایت موکلان", icon: "handshake" },
      { title: "۲۴ ساعت", subtitle: "پاسخ به درخواست مشاوره", icon: "clock" },
    ], { backgroundColor: "#f5f7fb" }),
    cards("practice-main", "services", "حوزه‌های تخصصی", "در هر پرونده، وکیل متخصص همان حوزه کنار شماست", "خدمات", 3, [
      { title: "حقوق خانواده", subtitle: "طلاق، مهریه، حضانت و نفقه", body: "مشاوره و وکالت در دعاوی خانواده با حفظ کامل حریم خصوصی و تلاش برای سازش پیش از دادرسی.", icon: "users" },
      { title: "حقوق تجارت و شرکت‌ها", subtitle: "ثبت شرکت، قراردادها، اختلاف شرکا", body: "همراهی حقوقی کسب‌وکار از تأسیس و تنظیم اساسنامه تا حل اختلاف میان شرکا و طرف‌های تجاری.", icon: "briefcase" },
      { title: "دعاوی ملکی", subtitle: "الزام به تنظیم سند، خلع ید، تخلیه", body: "بررسی اسناد، استعلام‌های ثبتی و دفاع در دعاوی ملک و مستغلات، از پیش‌فروش تا انتقال رسمی.", icon: "house" },
      { title: "حقوق کیفری", subtitle: "دفاع در دادسرا و دادگاه", body: "دفاع دقیق و به‌موقع در تمام مراحل تحقیق و رسیدگی کیفری، با تمرکز بر حقوق دفاعی متهم.", icon: "gavel" },
      { title: "تنظیم و بازبینی قرارداد", subtitle: "قراردادهای تجاری، اجاره، مشارکت", body: "قراردادهایی دقیق و قابل اجرا که ریسک‌ها را پیش از امضا شناسایی و از بروز اختلاف پیشگیری می‌کنند.", icon: "file" },
      { title: "داوری و حل اختلاف", subtitle: "داوری تجاری، میانجی‌گری و سازش", body: "حل سریع‌تر و کم‌هزینه‌تر اختلاف، بیرون از فرایند طولانی دادگاه و با حفظ روابط تجاری.", icon: "bank" },
    ]),
    cards("attorneys-main", "team", "وکلای ما", "تیمی متخصص با سابقه وکالت در مراجع قضایی کشور", "وکلا", 3, [
      { title: LAWYER, subtitle: "مدیر دفتر · دعاوی تجاری و ملکی", body: "سوابق تحصیلی، سال‌های وکالت و پرونده‌های شاخص وکیل را اینجا معرفی کنید.", imageUrl: teamImage("#e8edf4") },
      { title: LAWYER, subtitle: "حقوق خانواده", body: "تخصص، رویکرد مشاوره و زبان‌های کاری وکیل را اینجا معرفی کنید.", imageUrl: teamImage("#eef2f6") },
      { title: LAWYER, subtitle: "حقوق کیفری و داوری", body: "سوابق دفاع، عضویت‌ها و حوزه‌های تمرکز وکیل را اینجا معرفی کنید.", imageUrl: teamImage("#e2e8f0") },
    ]),
    cards("features-main", "services", "چرا دفتر ما", "آنچه موکلان را کنار ما نگه می‌دارد", "", 3, [
      { title: "محرمانگی کامل", body: "اطلاعات و اسناد شما فقط در اختیار وکیل پرونده است و بدون اجازه شما در هیچ جا استفاده نمی‌شود.", icon: "shield" },
      { title: "مشاوره شفاف", body: "از جلسه اول مسیر پرونده، هزینه‌ها و ریسک‌ها را روشن و بدون ابهام توضیح می‌دهیم.", icon: "chat" },
      { title: "پیگیری منظم", body: "گزارش مرحله‌به‌مرحله پرونده را دریافت می‌کنید، بدون اینکه نیاز به پیگیری داشته باشید.", icon: "lightning" },
    ], { backgroundColor: "#f5f7fb" }),
    cards("cases-main", "portfolio", "پرونده‌های موفق", "نمونه‌هایی از نتایج؛ نام موکلان به‌دلیل محرمانگی ذکر نمی‌شود", "پرونده‌ها", 3, [
      { title: "اختلاف شرکای یک شرکت بازرگانی", subtitle: "حقوق تجارت · داوری", body: "حل اختلاف در داوری ظرف سه ماه، تقسیم عادلانه سهم‌الشرکه و ادامه فعالیت شرکت.", imageUrl: caseImage("#0f766e", "#1e3a5f") },
      { title: "الزام به تنظیم سند رسمی یک واحد مسکونی", subtitle: "دعاوی ملکی", body: "صدور حکم به نفع موکل و انتقال رسمی ملک پس از دو سال بلاتکلیفی.", imageUrl: caseImage("#7c2d12", "#1e3a5f") },
      { title: "دفاع در یک پرونده کیفری مالی", subtitle: "حقوق کیفری", body: "صدور قرار منع تعقیب پس از ارائه مستندات و لوایح دفاعی در مرحله تحقیقات.", imageUrl: caseImage("#334155", "#1e3a5f") },
    ]),
    cards("testimonials-main", "team", "نظر موکلان", "تجربه کسانی که به ما اعتماد کردند", "", 3, [
      { title: "موکل پرونده تجاری", subtitle: "مدیر یک شرکت بازرگانی", body: "«در تمام مراحل پرونده در جریان بودم و نتیجه فراتر از انتظارم بود.»", imageUrl: teamImage("#f1f5f9") },
      { title: "موکل پرونده خانواده", subtitle: "دعاوی خانواده", body: "«با آرامش و احترام، مسیر سختی را برایم ساده و قابل‌فهم کردند.»", imageUrl: teamImage("#f8fafc") },
      { title: "موکل پرونده ملکی", subtitle: "دعاوی ملکی", body: "«پیگیری دقیق و پاسخ‌گویی سریع؛ کاملاً حرفه‌ای و قابل اعتماد.»", imageUrl: teamImage("#eef2f6") },
    ]),
    cards("articles-main", "portfolio", "مقالات حقوقی", "راهنماهای کوتاه برای تصمیم آگاهانه", "مقالات", 3, [
      { title: "مطالبه مهریه: شرایط، مدارک لازم و مراحل رسیدگی", subtitle: "حقوق خانواده · ۶ دقیقه مطالعه", body: "از اجرای ثبت تا دادگاه خانواده؛ هر آنچه برای مطالبه مهریه باید بدانید، به زبان ساده.", imageUrl: articleImage("#dbe4ee"), href: "#articles-main" },
      { title: "ثبت شرکت با مسئولیت محدود؛ از انتخاب نام تا آگهی تأسیس", subtitle: "حقوق شرکت‌ها · ۷ دقیقه مطالعه", body: "مراحل، مدارک و نکات حقوقی ثبت شرکت و تنظیم اساسنامه برای شروعی بدون دردسر.", imageUrl: articleImage("#e5ece9"), href: "#articles-main" },
      { title: "الزام به تنظیم سند رسمی؛ راهنمای خریداران ملک", subtitle: "دعاوی ملکی · ۵ دقیقه مطالعه", body: "چه زمانی می‌توان فروشنده را به تنظیم سند رسمی ملزم کرد و این دعوا چه مراحلی دارد؟", imageUrl: articleImage("#efe7df"), href: "#articles-main" },
    ]),
    section("contact-main", "contact", "رزرو جلسه مشاوره حقوقی", "موضوع پرونده را کوتاه بنویسید؛ برای هماهنگی زمان جلسه با شما تماس می‌گیریم.", {
      showInNav: true,
      navLabel: "مشاوره",
      body: "اطلاعات شما محرمانه است و فقط برای هماهنگی جلسه مشاوره استفاده می‌شود.",
      contact: { formEnabled: true, submitLabel: "ارسال درخواست مشاوره", successMessage: "درخواست شما ثبت شد؛ همکاران ما به‌زودی برای هماهنگی جلسه تماس می‌گیرند.", phone: "", email: "", address: "", mapUrl: "" },
    }),
  ],
};
