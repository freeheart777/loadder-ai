import type { SectionConfig } from "../types";
import type { WebsiteTemplate } from "./types";

const item = (id: string, title: string, subtitle: string) => ({ id, title, subtitle, body: "", imageUrl: "", meta: "" });
const section = (id: string, type: SectionConfig["type"], title: string, subtitle: string, extra: Partial<SectionConfig> = {}): SectionConfig => ({ id, type, enabled: true, title, subtitle, backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra });
const contact = (label: string) => section("contact-main", "contact", label, "فرم را کامل کنید تا با شما تماس بگیریم.", { showInNav: true, navLabel: "تماس", contact: { formEnabled: true, submitLabel: "ارسال درخواست", successMessage: "پیام شما ثبت شد.", phone: "", email: "", address: "", mapUrl: "" } });
const cards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, values: [string, string][]) => section(id, type, title, "برای شروع آماده و قابل ویرایش است.", { showInNav: true, navLabel, columns: 3, items: values.map(([name, detail], index) => item(`${id}-${index}`, name, detail)) });
const story = (id: string, title: string, navLabel: string, subtitle: string, body: string, type: "text" | "text-image" = "text") => section(id, type, title, subtitle, { showInNav: true, navLabel, body });

// Medical: default copy and two self-contained SVG images (hero, doctor portrait).
// All text and images stay editable; services and text sections carry no images.
const medicalImage = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const medicalHeroImage = medicalImage(`<rect width="800" height="600" fill="#134e4a"/><g fill="#5eead4" opacity=".28"><rect x="250" y="190" width="300" height="250" rx="18"/><rect x="370" y="235" width="60" height="160" rx="10" fill="#134e4a"/><rect x="320" y="285" width="160" height="60" rx="10" fill="#134e4a"/><rect x="235" y="440" width="330" height="24" rx="6"/></g>`);
const medicalPortrait = medicalImage(`<rect width="800" height="600" fill="#ecfdf5"/><circle cx="400" cy="230" r="92" fill="#94a3b8"/><path d="M220 600c0-118 80-196 180-196s180 78 180 196z" fill="#ffffff"/><path d="M340 420c0 70 30 110 60 110s60-40 60-110" fill="none" stroke="#0f766e" stroke-width="10"/><circle cx="460" cy="420" r="14" fill="#0f766e"/>`);
const medicalCards = (id: string, type: "services" | "team", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const medical: WebsiteTemplate = {
  id: "medical-practice-v1", label: "کلینیک و پزشک", description: "معرفی پزشک، خدمات درمانی و درخواست نوبت.", siteKind: "BUSINESS",
  design: { primaryColor: "#0f766e", secondaryColor: "#ccfbf1" }, header: { storeName: "کلینیک شما" },
  hero: { layout: "background", eyebrow: "مراقبت درمانی حرفه‌ای", title: "مراقبت از سلامت شما، با آرامش و دقت", subtitle: "خدمات تخصصی، توضیح روشن مسیر درمان و پیگیری پس از مراجعه در یک مکان.", ctaLabel: "رزرو نوبت", ctaHref: "#contact-main", imageUrl: medicalHeroImage, backgroundColor: "#134e4a", overlayOpacity: 52 },
  sections: [
    medicalCards("doctor-main", "team", "پزشکان ما", "پزشکان", [
      ["پزشک متخصص", "حوزه تخصص پزشک", "معرفی کوتاه پزشک و روزهای حضور در کلینیک را اینجا بنویسید.", medicalPortrait],
      ["پزشک متخصص", "حوزه تخصص پزشک", "معرفی کوتاه پزشک و روزهای حضور در کلینیک را اینجا بنویسید.", medicalPortrait],
    ]),
    medicalCards("services-main", "services", "خدمات کلینیک", "خدمات", [
      ["ویزیت تخصصی", "معاینه و مشاوره", "بررسی دقیق شرایط و توضیح روشن گزینه‌های درمان."],
      ["خدمات درمانی کلینیک", "انجام درمان در محیطی ایمن", "درمان‌های رایج کلینیک با رعایت اصول بهداشت و ایمنی."],
      ["پیگیری درمان", "همراهی پس از مراجعه", "پاسخ به پرسش‌ها و بررسی روند بهبود پس از درمان."],
    ]),
    medicalCards("treatments-main", "services", "مسیر درمان", "درمان‌ها", [
      ["ارزیابی اولیه", "آشنایی با نیاز مراجعه‌کننده", "گفت‌وگو و معاینه برای شناخت دقیق شرایط."],
      ["برنامه درمان", "متناسب با شرایط هر فرد", "پیشنهاد مسیر درمان همراه با توضیح مراحل آن."],
      ["مراقبت پس از درمان", "توصیه‌ها و پیگیری", "راهنمایی برای دوره بهبود و مراجعه‌های بعدی."],
    ]),
    story("testimonials-main", "تجربه مراجعان", "نظرات", "نظر مراجعان برای ما ارزشمند است", "تجربه مراجعان را پس از دریافت رضایت آن‌ها در این بخش منتشر کنید."),
    { ...contact("درخواست نوبت"), subtitle: "نام و شماره تماس خود را بنویسید تا برای هماهنگی زمان مراجعه با شما تماس بگیریم." },
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
// Education: default copy and two self-contained SVG images (hero, instructor portrait).
// All text and images stay editable; course cards and text sections carry no images.
const educationImage = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const educationHeroImage = educationImage(`<rect width="800" height="600" fill="#312e81"/><g fill="#a5b4fc" opacity=".3"><polygon points="400,150 600,230 400,310 200,230"/><path d="M290 270v80c0 35 50 60 110 60s110-25 110-60v-80l-110 45z"/><rect x="592" y="232" width="10" height="120" rx="5"/><circle cx="597" cy="360" r="14"/></g>`);
const educationPortrait = educationImage(`<rect width="800" height="600" fill="#eef2ff"/><circle cx="400" cy="230" r="92" fill="#94a3b8"/><path d="M220 600c0-118 80-196 180-196s180 78 180 196z" fill="#6366f1" opacity=".75"/><rect x="330" y="470" width="140" height="90" rx="8" fill="#ffffff" opacity=".9"/>`);
const educationCards = (id: string, type: "services" | "team", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const education: WebsiteTemplate = {
  id: "education-center-v1", label: "مرکز آموزشی", description: "دوره‌ها، مدرسان، تجربه دانش‌پذیران و ثبت‌نام.", siteKind: "BUSINESS",
  design: { primaryColor: "#4338ca", secondaryColor: "#e0e7ff" }, header: { storeName: "آموزشگاه شما" },
  hero: { layout: "centered", eyebrow: "آموزش کاربردی، قدم‌به‌قدم", title: "مهارتی که در عمل به کار می‌آید", subtitle: "دوره‌های عملی با مسیر یادگیری روشن و همراهی مدرس در هر مرحله.", ctaLabel: "درخواست ثبت‌نام", ctaHref: "#contact-main", imageUrl: educationHeroImage, backgroundColor: "#312e81", overlayOpacity: 60 },
  sections: [
    educationCards("courses-main", "services", "دوره‌های آموزشی", "دوره‌ها", [
      ["دوره مقدماتی", "شروع اصولی و کاربردی", "آشنایی با مفاهیم پایه و تمرین عملی از جلسه اول."],
      ["دوره پیشرفته", "پروژه‌محور و تخصصی", "یادگیری مهارت‌های تخصصی با انجام پروژه‌های واقعی."],
      ["کارگاه عملی", "تمرین در کنار مدرس", "جلسه‌های کوتاه و متمرکز برای تمرین و رفع اشکال."],
    ]),
    educationCards("teachers-main", "team", "مدرسان", "مدرسان", [
      ["مدرس دوره", "حوزه تدریس", "معرفی کوتاه مدرس و دوره‌هایی که تدریس می‌کند را اینجا بنویسید.", educationPortrait],
      ["مدرس دوره", "حوزه تدریس", "معرفی کوتاه مدرس و دوره‌هایی که تدریس می‌کند را اینجا بنویسید.", educationPortrait],
    ]),
    story("features-main", "چرا این مرکز آموزشی", "ویژگی‌ها", "یادگیری عملی با مسیر روشن", "آموزش پروژه‌محور، تمرین در هر جلسه و امکان رفع اشکال با مدرس؛ تا آنچه یاد می‌گیرید در عمل به کار بیاید."),
    story("testimonials-main", "تجربه دانش‌پذیران", "تجربه‌ها", "داستان‌های یادگیری", "تجربه دانش‌پذیران را پس از دریافت اجازه آن‌ها در این بخش منتشر کنید."),
    { ...contact("ثبت‌نام و مشاوره"), subtitle: "دوره مورد نظر و شماره تماس خود را بنویسید تا برای راهنمایی و ثبت‌نام با شما تماس بگیریم." },
  ],
};
// Corporate: default copy and three self-contained SVG images (hero, about, projects).
// All text and images stay editable; service cards and the clients text block carry no images.
const corporateImage = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const corporateHeroImage = corporateImage(`<rect width="800" height="600" fill="#e0f2fe"/><rect x="120" y="360" width="560" height="26" rx="13" fill="#0369a1" opacity=".85"/>${[[230, "#0369a1"], [400, "#0ea5e9"], [570, "#0369a1"]].map(([x, c]) => `<circle cx="${x}" cy="215" r="52" fill="${c}" opacity=".75"/><path d="M${Number(x) - 85} 360c0-70 38-110 85-110s85 40 85 110z" fill="${c}" opacity=".75"/>`).join("")}<rect x="330" y="400" width="140" height="120" rx="10" fill="#ffffff"/>`);
const corporateAboutImage = corporateImage(`<rect width="800" height="600" fill="#0c4a6e"/><g fill="#7dd3fc" opacity=".35"><rect x="160" y="140" width="150" height="360" rx="8"/><rect x="330" y="80" width="170" height="420" rx="8"/><rect x="520" y="200" width="130" height="300" rx="8"/></g><g fill="#e0f2fe" opacity=".55">${[180, 240, 300, 360, 420].map((y) => `<rect x="360" y="${y - 60}" width="110" height="22" rx="4"/>`).join("")}</g>`);
const corporateProjectImage = (tone: string) => corporateImage(`<rect width="800" height="600" fill="${tone}"/><rect x="170" y="130" width="460" height="300" rx="18" fill="#ffffff"/><g fill="#0369a1" opacity=".55"><rect x="210" y="330" width="60" height="70" rx="6"/><rect x="290" y="280" width="60" height="120" rx="6"/><rect x="370" y="230" width="60" height="170" rx="6"/></g><circle cx="540" cy="250" r="50" fill="#0ea5e9" opacity=".6"/>`);
const corporateCards = (id: string, type: "services" | "portfolio", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const corporate: WebsiteTemplate = {
  id: "corporate-company-v1", label: "شرکت حرفه‌ای", description: "درباره شرکت، خدمات، نمونه‌کارها، مشتریان و تماس.", siteKind: "BUSINESS",
  design: { primaryColor: "#0369a1", secondaryColor: "#e0f2fe" }, header: { storeName: "شرکت شما" },
  hero: { layout: "split", eyebrow: "راهکارهای حرفه‌ای برای رشد کسب‌وکار", title: "همراه مطمئن کسب‌وکار شما", subtitle: "خدمات، توانمندی‌ها و پروژه‌های مجموعه خود را روشن و حرفه‌ای به مشتریان معرفی کنید.", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main", imageUrl: corporateHeroImage },
  sections: [
    section("about-main", "about", "درباره شرکت", "داستان و رویکرد ما", { showInNav: true, navLabel: "درباره ما", imageUrl: corporateAboutImage, body: "در این بخش داستان شکل‌گیری مجموعه، توانمندی‌ها و رویکرد کاری خود را کوتاه و روشن معرفی کنید." }),
    corporateCards("services-main", "services", "خدمات ما", "خدمات", [
      ["مشاوره و راهکار", "تحلیل نیاز و نقشه راه", "بررسی وضعیت فعلی و پیشنهاد مسیر روشن برای رسیدن به هدف."],
      ["اجرای پروژه", "از برنامه تا تحویل", "اجرای مرحله‌به‌مرحله پروژه با گزارش منظم پیشرفت."],
      ["پشتیبانی و خدمات", "همراهی پس از تحویل", "پاسخ‌گویی و بهبود مستمر پس از راه‌اندازی."],
      ["توسعه کسب‌وکار", "رشد و ورود به فرصت‌های تازه", "شناسایی فرصت‌ها و برنامه‌ریزی برای گسترش فعالیت."],
      ["راهکارهای اختصاصی", "متناسب با نیاز هر سازمان", "طراحی راهکاری که با شرایط و اهداف شما هماهنگ است."],
      ["همکاری سازمانی", "همراهی بلندمدت", "همکاری پایدار برای پروژه‌های مستمر و چندمرحله‌ای."],
    ]),
    corporateCards("portfolio-main", "portfolio", "نمونه‌کارها", "نمونه‌کارها", [
      ["پروژه نمونه", "حوزه فعالیت پروژه", "شرح کوتاه پروژه و نقش مجموعه شما در آن را اینجا بنویسید.", corporateProjectImage("#e0f2fe")],
      ["راهکار سازمانی", "حوزه فعالیت پروژه", "شرح کوتاه پروژه و نقش مجموعه شما در آن را اینجا بنویسید.", corporateProjectImage("#f0f9ff")],
      ["پروژه همکاری", "حوزه فعالیت پروژه", "شرح کوتاه پروژه و نقش مجموعه شما در آن را اینجا بنویسید.", corporateProjectImage("#e0f2fe")],
    ]),
    story("clients-main", "مشتریان و شرکای ما", "مشتریان", "همکاری‌هایی که به آن افتخار می‌کنیم", "تجربه مشتریان خود را پس از دریافت بازخورد در این بخش منتشر کنید."),
    { ...contact("شروع همکاری"), subtitle: "برای دریافت اطلاعات بیشتر یا بررسی زمینه همکاری، اطلاعات تماس خود را ثبت کنید تا با شما در ارتباط باشیم." },
  ],
};

export const businessLaunchTemplates: readonly WebsiteTemplate[] = [medical, legal, education, corporate];
