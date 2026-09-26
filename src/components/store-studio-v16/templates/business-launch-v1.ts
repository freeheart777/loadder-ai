import type { SectionConfig } from "../types";
import type { WebsiteTemplate } from "./types";

const item = (id: string, title: string, subtitle: string) => ({ id, title, subtitle, body: "", imageUrl: "", meta: "" });
const section = (id: string, type: SectionConfig["type"], title: string, subtitle: string, extra: Partial<SectionConfig> = {}): SectionConfig => ({ id, type, enabled: true, title, subtitle, backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra });
const contact = (label: string) => section("contact-main", "contact", label, "فرم را کامل کنید تا با شما تماس بگیریم.", { showInNav: true, navLabel: "تماس", contact: { formEnabled: true, submitLabel: "ارسال درخواست", successMessage: "پیام شما ثبت شد.", phone: "", email: "", address: "", mapUrl: "" } });
const cards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, values: [string, string][]) => section(id, type, title, "برای شروع آماده و قابل ویرایش است.", { showInNav: true, navLabel, columns: 3, items: values.map(([name, detail], index) => item(`${id}-${index}`, name, detail)) });
const story = (id: string, title: string, navLabel: string, subtitle: string, body: string, type: "text" | "text-image" = "text") => section(id, type, title, subtitle, { showInNav: true, navLabel, body });

const medical: WebsiteTemplate = {
  id: "medical-practice-v1", label: "کلینیک و پزشک", description: "معرفی پزشک، خدمات درمانی و درخواست نوبت.", siteKind: "BUSINESS",
  design: { primaryColor: "#0f766e", secondaryColor: "#ccfbf1" }, header: { storeName: "کلینیک شما" },
  hero: { layout: "background", eyebrow: "مراقبت حرفه‌ای", title: "سلامت شما، اولویت ماست", subtitle: "با آرامش، خدمات مناسب را انتخاب کنید.", ctaLabel: "درخواست نوبت", ctaHref: "#contact-main", backgroundColor: "#134e4a", overlayOpacity: 52 },
  sections: [
    cards("doctor-main", "team", "پزشک شما", "پزشک", [["دکتر نام شما", "متخصص و مشاور درمان"]]),
    cards("services-main", "services", "خدمات کلینیک", "خدمات", [["ویزیت تخصصی", "بررسی و برنامه درمان"], ["درمان‌های کلینیک", "خدمت حرفه‌ای و ایمن"], ["پیگیری درمان", "همراهی پس از مراجعه"]]),
    cards("treatments-main", "services", "درمان‌ها", "درمان‌ها", [["ارزیابی اولیه", "بررسی نیاز و شرایط مراجعه‌کننده"], ["برنامه درمان", "مسیر درمان متناسب با نیاز فرد"], ["مراقبت پس از درمان", "پیگیری و پاسخ‌گویی پس از مراجعه"]]),
    story("testimonials-main", "تجربه مراجعان", "نظرات", "نظر و رضایت مراجعان", "تجربه‌های تأییدشده مراجعان را پس از دریافت رضایت آن‌ها اضافه کنید."),
    contact("درخواست نوبت"),
  ],
};
// Legal: default copy and a few self-contained SVG images (data:image URLs render the
// same on the canvas and the published site). All text and images stay editable.
const legalImage = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const legalHeroImage = legalImage(`<rect width="800" height="600" fill="#292524"/><g fill="#a16207" opacity=".35"><polygon points="250,200 400,120 550,200"/><rect x="250" y="205" width="300" height="22" rx="4"/>${[275, 345, 415, 485].map((x) => `<rect x="${x}" y="240" width="30" height="190" rx="8"/>`).join("")}<rect x="235" y="440" width="330" height="26" rx="4"/></g>`);
const legalPortrait = legalImage(`<rect width="800" height="600" fill="#f5f0e6"/><circle cx="400" cy="235" r="95" fill="#a8a29e"/><path d="M220 600c0-120 80-200 180-200s180 80 180 200z" fill="#a8a29e"/><path d="M370 400h60l-30 120z" fill="#292524" opacity=".8"/>`);
const legalDocumentImage = legalImage(`<rect width="800" height="600" fill="#fef3c7"/><rect x="290" y="130" width="220" height="300" rx="14" fill="#ffffff"/><g fill="#a16207" opacity=".45"><rect x="320" y="180" width="160" height="12" rx="6"/><rect x="320" y="215" width="120" height="12" rx="6"/><rect x="320" y="250" width="145" height="12" rx="6"/></g><circle cx="490" cy="410" r="44" fill="#a16207" opacity=".7"/>`);
const legalCards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const legal: WebsiteTemplate = {
  id: "legal-firm-v1", label: "موسسه حقوقی", description: "معرفی وکلا، تخصص‌ها، تجربه‌ها و درخواست مشاوره.", siteKind: "BUSINESS",
  design: { primaryColor: "#a16207", secondaryColor: "#fef3c7" }, header: { storeName: "موسسه حقوقی شما" },
  hero: { layout: "background", eyebrow: "مشاوره و وکالت تخصصی", title: "همراه حقوقی شما در تصمیم‌های مهم", subtitle: "از اولین جلسه مشاوره تا پایان پرونده، مسیر حقوقی را روشن توضیح می‌دهیم و با دقت پیگیری می‌کنیم.", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main", imageUrl: legalHeroImage, backgroundColor: "#292524", overlayOpacity: 58 },
  sections: [
    legalCards("attorneys-main", "team", "وکلای ما", "وکلا", [
      ["وکیل پایه یک دادگستری", "دعاوی خانواده و ملکی", "معرفی کوتاه وکیل، سوابق و حوزه تخصص را اینجا بنویسید.", legalPortrait],
      ["وکیل پایه یک دادگستری", "حقوق شرکت‌ها و قراردادها", "معرفی کوتاه وکیل، سوابق و حوزه تخصص را اینجا بنویسید.", legalPortrait],
    ]),
    legalCards("practice-main", "services", "حوزه‌های فعالیت", "تخصص‌ها", [
      ["حقوق خانواده", "طلاق، مهریه، حضانت و نفقه", "مشاوره و وکالت در دعاوی خانواده با رعایت کامل حریم خصوصی."],
      ["حقوق شرکت‌ها", "ثبت شرکت، قرارداد و امور تجاری", "همراهی حقوقی کسب‌وکار از تأسیس تا حل اختلاف میان شرکا."],
      ["دعاوی ملکی", "الزام به تنظیم سند، خلع ید، تخلیه", "بررسی اسناد ملکی و دفاع در دعاوی ملک و مستغلات."],
      ["حقوق کیفری", "دفاع در دادسرا و دادگاه", "همراهی و دفاع در مراحل تحقیق و رسیدگی کیفری."],
      ["تنظیم قرارداد", "نگارش و بازبینی قرارداد", "بررسی بندهای قرارداد پیش از امضا برای کاهش ریسک اختلاف."],
      ["داوری و حل اختلاف", "داوری، میانجی‌گری و سازش", "تلاش برای حل اختلاف بیرون از فرایند طولانی دادگاه."],
    ]),
    legalCards("cases-main", "portfolio", "پرونده‌ها و تجربه‌ها", "تجربه‌ها", [
      ["اختلاف میان شرکای تجاری", "حقوق تجارت · نمونه پرونده", "بررسی اسناد شرکت، مذاکره میان شرکا و پیگیری مسیر حل اختلاف.", legalDocumentImage],
      ["الزام به تنظیم سند رسمی", "دعاوی ملکی · نمونه پرونده", "بررسی قرارداد خرید، استعلام‌های ثبتی و طرح دعوای الزام به تنظیم سند.", legalDocumentImage],
    ]),
    { ...story("articles-main", "مقالات حقوقی", "مقالات", "راهنما و دیدگاه تخصصی", "در این بخش راهنماهای کوتاه حقوقی منتشر کنید؛ مثلاً نکات پیش از امضای قرارداد اجاره، مراحل ثبت شرکت یا حقوق مالی زوجه.", "text-image"), imageUrl: legalDocumentImage },
    { ...contact("درخواست مشاوره حقوقی"), subtitle: "موضوع خود را کوتاه بنویسید تا برای هماهنگی جلسه مشاوره با شما تماس بگیریم." },
  ],
};
const education: WebsiteTemplate = {
  id: "education-center-v1", label: "مرکز آموزشی", description: "دوره‌ها، مدرسان، تجربه دانش‌پذیران و ثبت‌نام.", siteKind: "BUSINESS",
  design: { primaryColor: "#4338ca", secondaryColor: "#e0e7ff" }, header: { storeName: "آموزشگاه شما" },
  hero: { layout: "centered", eyebrow: "یادگیری برای آینده", title: "مهارتی که آینده شما را می‌سازد", subtitle: "دوره‌های عملی با مسیر یادگیری روشن.", ctaLabel: "ثبت‌نام در دوره", ctaHref: "#contact-main", backgroundColor: "#312e81" },
  sections: [
    cards("courses-main", "services", "دوره‌های آموزشی", "دوره‌ها", [["دوره پایه", "شروع اصولی و کاربردی"], ["دوره پیشرفته", "پروژه‌محور و تخصصی"], ["کارگاه عملی", "تمرین با مربی"]]),
    cards("teachers-main", "team", "مدرسان", "مدرسان", [["مدرس شما", "مدرس ارشد"], ["مدرس همکار", "مربی عملی"]]),
    story("features-main", "ویژگی‌های آموزش", "ویژگی‌ها", "یک مسیر یادگیری روشن", "جزئیات برنامه آموزشی، پشتیبانی و شیوه یادگیری مرکزتان را اینجا شرح دهید."),
    story("testimonials-main", "تجربه دانش‌پذیران", "تجربه‌ها", "داستان‌های یادگیری", "تجربه‌های واقعی دانش‌پذیران را با اجازه آن‌ها به اشتراک بگذارید."),
    contact("ثبت‌نام و مشاوره"),
  ],
};
const corporate: WebsiteTemplate = { id: "corporate-company-v1", label: "شرکت حرفه‌ای", description: "درباره شرکت، خدمات، نمونه‌کارها، مشتریان و تماس.", siteKind: "BUSINESS", design: { primaryColor: "#0369a1", secondaryColor: "#e0f2fe" }, header: { storeName: "شرکت شما" }, hero: { layout: "split", eyebrow: "راهکارهای حرفه‌ای", title: "همراه مطمئن رشد کسب‌وکار شما", subtitle: "خدمات روشن و نتیجه‌محور برای سازمان شما.", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main" }, sections: [section("about-main", "about", "درباره شرکت", "داستان و مزیت رقابتی شما", { showInNav: true, navLabel: "درباره ما", body: "این بخش را با داستان، تخصص و دستاوردهای شرکت خود کامل کنید." }), cards("services-main", "services", "خدمات ما", "خدمات", [["مشاوره", "تحلیل و نقشه راه"], ["اجرا", "پیاده‌سازی راهکار"], ["پشتیبانی", "بهبود مستمر"]]), cards("portfolio-main", "portfolio", "نمونه‌کارها", "نمونه‌کارها", [["پروژه نمونه", "صنعت شما"], ["پروژه نمونه", "صنعت شما"]]), story("clients-main", "مشتریان و شرکای ما", "مشتریان", "مورد اعتماد مشتریان", "نام‌ها یا لوگوهای مشتریان را فقط با مجوز استفاده اضافه کنید."), contact("شروع گفت‌وگو")] };

export const businessLaunchTemplates: readonly WebsiteTemplate[] = [medical, legal, education, corporate];
