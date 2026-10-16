import type { PageConfig, SectionConfig } from "../types";
import type { WebsiteTemplate } from "./types";

const item = (id: string, title: string, subtitle: string) => ({ id, title, subtitle, body: "", imageUrl: "", meta: "" });
const section = (id: string, type: SectionConfig["type"], title: string, subtitle: string, extra: Partial<SectionConfig> = {}): SectionConfig => ({ id, type, enabled: true, title, subtitle, backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra });
const contact = (label: string) => section("contact-main", "contact", label, "فرم را کامل کنید تا با شما تماس بگیریم.", { showInNav: true, navLabel: "تماس", contact: { formEnabled: true, submitLabel: "ارسال درخواست", successMessage: "پیام شما ثبت شد.", phone: "", email: "", address: "", mapUrl: "" } });
// Starter sections carry a short visitor-facing tagline (or none). They never carry an instruction to the editor:
// everything below is published as-is until the customer changes it.
const cards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, values: [string, string][], subtitle = "") => section(id, type, title, subtitle, { showInNav: true, navLabel, columns: 3, items: values.map(([name, detail], index) => item(`${id}-${index}`, name, detail)) });
const story = (id: string, title: string, navLabel: string, subtitle: string, body: string, type: "text" | "text-image" = "text") => section(id, type, title, subtitle, { showInNav: true, navLabel, body });
// Bundled CC0 stock photos (public/template-images, see CREDITS.md). The URL is absolute so the
// stored value is the same https address on the canvas, previews and the server-rendered site.
const templatePhoto = (path: string, ext: "webp" | "jpg" = "webp") => `${typeof window === "undefined" ? "" : window.location.origin}/template-images/${path}.${ext}`;

// Medical: default copy and bundled stock photos (hero, doctor portraits).
// All text and images stay editable; services and text sections carry no images.
const medicalCards = (id: string, type: "services" | "team", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][], tagline = "") =>
  ({ ...cards(id, type, title, navLabel, [], tagline), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const medical: WebsiteTemplate = {
  id: "medical-practice-v1", label: "کلینیک و پزشک", description: "معرفی پزشک، خدمات درمانی و درخواست نوبت.", siteKind: "BUSINESS", siteType: "MEDICAL",
  design: { primaryColor: "#0f766e", secondaryColor: "#ccfbf1" }, header: { storeName: "کلینیک شما" }, nav: { enabled: true, ctaLabel: "رزرو نوبت", ctaHref: "/booking" },
  hero: { layout: "background", eyebrow: "مراقبت درمانی حرفه‌ای", title: "مراقبت از سلامت شما، با آرامش و دقت", subtitle: "خدمات تخصصی، توضیح روشن مسیر درمان و پیگیری پس از مراجعه در یک مکان.", ctaLabel: "رزرو نوبت", ctaHref: "/booking", imageUrl: templatePhoto("medical/hero"), backgroundColor: "#134e4a", overlayOpacity: 52 },
  sections: [
    medicalCards("doctor-main", "team", "پزشکان ما", "پزشکان", [
      ["پزشک عمومی", "ویزیت و پیگیری درمان", "ویزیت با نوبت قبلی؛ برای هماهنگی زمان مراجعه از دکمه رزرو نوبت استفاده کنید.", templatePhoto("medical/doctor-1")],
      ["پزشک متخصص", "مشاوره و درمان تخصصی", "بررسی دقیق شرایط، توضیح روشن مسیر درمان و پیگیری پس از مراجعه.", templatePhoto("medical/doctor-2")],
    ], "تیم پزشکی کلینیک"),
    medicalCards("services-main", "services", "خدمات کلینیک", "خدمات", [
      ["ویزیت تخصصی", "معاینه و مشاوره", "بررسی دقیق شرایط و توضیح روشن گزینه‌های درمان."],
      ["خدمات درمانی کلینیک", "انجام درمان در محیطی ایمن", "درمان‌های رایج کلینیک با رعایت اصول بهداشت و ایمنی."],
      ["پیگیری درمان", "همراهی پس از مراجعه", "پاسخ به پرسش‌ها و بررسی روند بهبود پس از درمان."],
    ], "از ویزیت تا پیگیری درمان"),
    medicalCards("treatments-main", "services", "مسیر درمان", "درمان‌ها", [
      ["ارزیابی اولیه", "آشنایی با نیاز مراجعه‌کننده", "گفت‌وگو و معاینه برای شناخت دقیق شرایط."],
      ["برنامه درمان", "متناسب با شرایط هر فرد", "پیشنهاد مسیر درمان همراه با توضیح مراحل آن."],
      ["مراقبت پس از درمان", "توصیه‌ها و پیگیری", "راهنمایی برای دوره بهبود و مراجعه‌های بعدی."],
    ], "گام‌به‌گام تا بهبودی"),
    // Optional: starts disabled (no testimonials yet), so it is neither published nor listed in the menu until the customer turns it on.
    { ...story("testimonials-main", "تجربه مراجعان", "نظرات", "نظر مراجعان برای ما ارزشمند است", "تجربه مراجعان را پس از دریافت رضایت آن‌ها در این بخش منتشر کنید."), enabled: false },
    section("booking-cta", "cta", "نوبت می‌خواهید؟", "خدمت و پزشک را انتخاب کنید و از میان زمان‌های آزاد، نوبت خود را ثبت کنید.", { ctaLabel: "رزرو نوبت", ctaHref: "/booking", backgroundColor: "#0f766e", textColor: "#ffffff" }),
    { ...contact("درخواست نوبت"), subtitle: "نام و شماره تماس خود را بنویسید تا برای هماهنگی زمان مراجعه با شما تماس بگیریم." },
  ],
};

// Legal: default copy and bundled stock photos (hero, attorneys, cases, article).
// All text and images stay editable.
const legalCards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][], tagline = "") =>
  ({ ...cards(id, type, title, navLabel, [], tagline), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const legal: WebsiteTemplate = {
  id: "legal-firm-v1", label: "موسسه حقوقی", description: "معرفی وکلا، تخصص‌ها، تجربه‌ها و درخواست مشاوره.", siteKind: "BUSINESS", siteType: "LEGAL",
  design: { primaryColor: "#a16207", secondaryColor: "#fef3c7" }, header: { storeName: "موسسه حقوقی شما" },
  hero: { layout: "background", eyebrow: "مشاوره و وکالت تخصصی", title: "همراه حقوقی شما در تصمیم‌های مهم", subtitle: "از اولین جلسه مشاوره تا پایان پرونده، مسیر حقوقی را روشن توضیح می‌دهیم و با دقت پیگیری می‌کنیم.", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main", imageUrl: templatePhoto("legal/hero"), backgroundColor: "#292524", overlayOpacity: 58 },
  sections: [
    legalCards("attorneys-main", "team", "وکلای ما", "وکلا", [
      ["وکیل پایه یک دادگستری", "دعاوی خانواده و ملکی", "بررسی پرونده در جلسه مشاوره اولیه و پیگیری مرحله‌به‌مرحله تا حصول نتیجه.", templatePhoto("legal/lawyer-1")],
      ["وکیل پایه یک دادگستری", "حقوق شرکت‌ها و قراردادها", "تنظیم و بازبینی قرارداد، مشاوره حقوقی کسب‌وکار و پیگیری اختلافات تجاری.", templatePhoto("legal/lawyer-2")],
    ], "تیم حقوقی ما"),
    legalCards("practice-main", "services", "حوزه‌های فعالیت", "تخصص‌ها", [
      ["حقوق خانواده", "طلاق، مهریه، حضانت و نفقه", "مشاوره و وکالت در دعاوی خانواده با رعایت کامل حریم خصوصی."],
      ["حقوق شرکت‌ها", "ثبت شرکت، قرارداد و امور تجاری", "همراهی حقوقی کسب‌وکار از تأسیس تا حل اختلاف میان شرکا."],
      ["دعاوی ملکی", "الزام به تنظیم سند، خلع ید، تخلیه", "بررسی اسناد ملکی و دفاع در دعاوی ملک و مستغلات."],
      ["حقوق کیفری", "دفاع در دادسرا و دادگاه", "همراهی و دفاع در مراحل تحقیق و رسیدگی کیفری."],
      ["تنظیم قرارداد", "نگارش و بازبینی قرارداد", "بررسی بندهای قرارداد پیش از امضا برای کاهش ریسک اختلاف."],
      ["داوری و حل اختلاف", "داوری، میانجی‌گری و سازش", "تلاش برای حل اختلاف بیرون از فرایند طولانی دادگاه."],
    ], "تخصص‌های ما"),
    legalCards("cases-main", "portfolio", "پرونده‌ها و تجربه‌ها", "تجربه‌ها", [
      ["اختلاف میان شرکای تجاری", "حقوق تجارت · نمونه پرونده", "بررسی اسناد شرکت، مذاکره میان شرکا و پیگیری مسیر حل اختلاف.", templatePhoto("legal/case-1")],
      ["الزام به تنظیم سند رسمی", "دعاوی ملکی · نمونه پرونده", "بررسی قرارداد خرید، استعلام‌های ثبتی و طرح دعوای الزام به تنظیم سند.", templatePhoto("legal/case-2")],
    ], "نمونه‌ای از تجربه‌های ما"),
    { ...story("articles-main", "مقالات حقوقی", "مقالات", "راهنما و دیدگاه تخصصی", "پیش از امضای قرارداد، ثبت شرکت یا طرح دعوا، یک جلسه مشاوره می‌تواند مسیر را روشن و از هزینه‌های ناخواسته جلوگیری کند.", "text-image"), imageUrl: templatePhoto("legal/article") },
    { ...contact("درخواست مشاوره حقوقی"), subtitle: "موضوع خود را کوتاه بنویسید تا برای هماهنگی جلسه مشاوره با شما تماس بگیریم." },
  ],
};
// Education: default copy and bundled stock photos (hero, instructor portraits).
// All text and images stay editable; course cards and text sections carry no images.
const educationCards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][], tagline = "") =>
  ({ ...cards(id, type, title, navLabel, [], tagline), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const educationPage = (id: string, title: string, slug: string, sections: SectionConfig[]): PageConfig => ({
  id,
  title,
  slug,
  isHome: false,
  showInNav: true,
  navLabel: title,
  seo: { title, description: "" },
  sections,
});

const education: WebsiteTemplate = {
  id: "education-center-v1", label: "مرکز آموزشی", description: "دوره‌ها، مدرسان، تجربه دانش‌پذیران و ثبت‌نام.", siteKind: "BUSINESS", siteType: "EDUCATION",
  design: { primaryColor: "#a98242", secondaryColor: "#e9ddc4", backgroundColor: "#242321", textColor: "#f5f0e5", surfaceColor: "#f5f0e5" }, header: { storeName: "آموزشگاه موسیقی شما", backgroundColor: "#242321", textColor: "#f5f0e5", sticky: true },
  hero: { layout: "centered", eyebrow: "آموزش موسیقی، با تمرین و همراهی", title: "صدای خودتان را پیدا کنید", subtitle: "دوره‌ها، کارگاه‌ها و کلاس‌های موسیقی با مسیر یادگیری روشن و همراهی مدرس.", ctaLabel: "رزرو کلاس", ctaHref: "/booking", imageUrl: templatePhoto("education/hero-music", "jpg"), backgroundColor: "#242321", textColor: "#f5f0e5", overlayOpacity: 60 },
  sections: [
    educationCards("courses-main", "services", "دوره‌های آموزشی", "دوره‌ها", [
      ["دوره مقدماتی", "شروع اصولی و کاربردی", "آشنایی با مفاهیم پایه و تمرین عملی از جلسه اول."],
      ["دوره پیشرفته", "پروژه‌محور و تخصصی", "یادگیری مهارت‌های تخصصی با انجام پروژه‌های واقعی."],
      ["کارگاه عملی", "تمرین در کنار مدرس", "جلسه‌های کوتاه و متمرکز برای تمرین و رفع اشکال."],
    ], "مسیرهای یادگیری"),
    educationCards("teachers-main", "team", "مدرسان", "مدرسان", [
      ["مدرس گیتار و ساز زهی", "آموزش خصوصی و گروهی", "تمرین عملی از جلسه اول، با برنامه تمرین هفتگی و بازخورد مدرس.", templatePhoto("education/instructor-1")],
      ["مدرس پیانو و ویولن", "نت‌خوانی و اجرا", "آموزش نت‌خوانی و تکنیک، همراه با آمادگی برای اجرا.", templatePhoto("education/instructor-2")],
    ], "با مدرسان ما آشنا شوید"),
    story("features-main", "چرا این مرکز آموزشی", "ویژگی‌ها", "یادگیری عملی با مسیر روشن", "آموزش پروژه‌محور، تمرین در هر جلسه و امکان رفع اشکال با مدرس؛ تا آنچه یاد می‌گیرید در عمل به کار بیاید."),
    { ...story("testimonials-main", "تجربه دانش‌پذیران", "تجربه‌ها", "داستان‌های یادگیری", "تجربه دانش‌پذیران را پس از دریافت اجازه آن‌ها در این بخش منتشر کنید."), enabled: false },
    { ...contact("ثبت‌نام و مشاوره"), subtitle: "دوره مورد نظر و شماره تماس خود را بنویسید تا برای راهنمایی و ثبت‌نام با شما تماس بگیریم." },
  ],
  // These are ordinary V16 static pages, persisted with the draft. They are
  // presentation only: course/provider/booking truth remains in its canonical
  // domain and is never copied into the website document.
  pages: [
    {
      id: "page-home", title: "خانه", slug: "", isHome: true, showInNav: true, navLabel: "خانه",
      seo: { title: "آموزشگاه موسیقی", description: "آموزش موسیقی، دوره‌ها و کارگاه‌های عملی با مدرسان باتجربه." },
      sections: [
        story("education-intro", "یادگیری موسیقی، قدم‌به‌قدم", "", "مسیر روشن برای تمرین", "برنامه آموزشی، تمرین و همراهی مدرس، متناسب با نیاز هر هنرجو."),
        educationCards("courses-home", "portfolio", "دوره‌های آموزشی", "", [
          ["گیتار و ساز زهی", "از نخستین نت تا اجرای کامل", "تمرین عملی از جلسه اول، با برنامه تمرین هفتگی و بازخورد مدرس.", templatePhoto("education/course-1", "jpg")],
          ["ویولن و سازهای ارکستری", "تکنیک، گوش و اجرا", "مسیر مرحله‌ای برای تقویت تکنیک و آمادگی برای اجرا.", templatePhoto("education/course-2", "jpg")],
          ["پیانو و کیبورد", "نت‌خوانی و نوازندگی", "آموزش نت‌خوانی همراه با تمرین قطعه‌های ساده تا پیشرفته.", templatePhoto("education/course-3", "jpg")],
        ], "مسیرهای یادگیری"),
        educationCards("teachers-home", "team", "مدرسان", "", [
          ["مدرس گیتار و ساز زهی", "آموزش خصوصی و گروهی", "تمرین عملی از جلسه اول، با برنامه تمرین هفتگی و بازخورد مدرس.", templatePhoto("education/instructor-1")],
          ["مدرس پیانو و ویولن", "نت‌خوانی و اجرا", "آموزش نت‌خوانی و تکنیک، همراه با آمادگی برای اجرا.", templatePhoto("education/instructor-2")],
        ], "با مدرسان ما آشنا شوید"),
        section("education-booking-cta", "cta", "برای شروع آماده‌اید؟", "زمان مناسب کلاس را از مسیر رسمی رزرو انتخاب کنید.", { ctaLabel: "رزرو کلاس", ctaHref: "/booking", backgroundColor: "#a98242", textColor: "#ffffff" }),
        { ...contact("ثبت‌نام و مشاوره"), subtitle: "دوره مورد نظر و شماره تماس خود را بنویسید تا برای راهنمایی و ثبت‌نام با شما تماس بگیریم." },
      ],
    },
    educationPage("page-courses", "دوره‌ها", "courses", [
      educationCards("courses-directory", "services", "دوره‌های آموزشی", "", [
        ["دوره مقدماتی", "شروع اصولی و کاربردی", "آشنایی با مفاهیم پایه، نت‌خوانی و تمرین عملی از جلسه اول."],
        ["دوره پیشرفته", "پروژه‌محور و تخصصی", "تقویت تکنیک و اجرا با قطعه‌های پیشرفته و بازخورد مستقیم مدرس."],
        ["کارگاه عملی", "تمرین در کنار مدرس", "جلسه‌های کوتاه و متمرکز برای تمرین و رفع اشکال؛ برای اطلاع از زمان برگزاری با ما تماس بگیرید."],
      ], "برنامه دوره‌ها"),
    ]),
    educationPage("page-teachers", "مدرسان", "teachers", [
      educationCards("teachers-directory", "team", "مدرسان", "", [
        ["مدرس گیتار و ساز زهی", "آموزش خصوصی و گروهی", "تمرین عملی از جلسه اول، با برنامه تمرین هفتگی و بازخورد مدرس.", templatePhoto("education/instructor-1")],
        ["مدرس پیانو و ویولن", "نت‌خوانی و اجرا", "آموزش نت‌خوانی و تکنیک، همراه با آمادگی برای اجرا.", templatePhoto("education/instructor-2")],
      ], "تیم آموزشی"),
    ]),
    educationPage("page-children", "موسیقی کودک", "children", [
      story("children-music", "موسیقی کودک", "", "آشنایی، بازی و تمرین", "آشنایی با موسیقی از راه بازی و تمرین کوتاه، با برنامه‌ای متناسب با سن و همراهی خانواده."),
    ]),
    educationPage("page-workshops", "کارگاه‌ها", "workshops", [
      educationCards("workshops-directory", "services", "کارگاه‌ها و رویدادها", "", [
        ["کارگاه عملی", "تمرین در کنار مدرس", "برای اطلاع از زمان و ظرفیت کارگاه‌ها، فرم ثبت‌نام و مشاوره را ارسال کنید یا با ما تماس بگیرید."],
      ], "کارگاه‌ها"),
    ]),
    educationPage("page-performances", "اجراها", "performances", [
      educationCards("performances-directory", "portfolio", "اجراها", "اجراها", [
        ["اجرای هنرجویان", "برنامه‌ها و رویدادها", "هنرجویان ما در پایان هر دوره فرصت اجرا و تجربه صحنه را دارند."],
      ], "اجراهای ما"),
    ]),
    educationPage("page-magazine", "مجله", "magazine", [
      educationCards("magazine-directory", "services", "مجله آموزشی", "", [
        ["راهنمای تمرین روزانه", "برنامه‌ریزی تمرین", "تمرین کوتاه و منظم هر روز، بهتر از تمرین طولانی و نامنظم است."],
        ["آمادگی برای اجرای نخست", "نکته‌های تمرین", "تمرین قطعه با سرعت پایین و اجرای آزمایشی برای دوستان، اعتمادبه‌نفس شما را بالا می‌برد."],
      ], "یادداشت‌های آموزشی"),
    ]),
  ],
};
// Corporate: default copy and bundled stock photos (hero, about, projects).
// All text and images stay editable; service cards and the clients text block carry no images.
const corporateCards = (id: string, type: "services" | "portfolio", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][], tagline = "") =>
  ({ ...cards(id, type, title, navLabel, [], tagline), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const corporate: WebsiteTemplate = {
  id: "corporate-company-v1", label: "شرکت حرفه‌ای", description: "درباره شرکت، خدمات، نمونه‌کارها، مشتریان و تماس.", siteKind: "BUSINESS", siteType: "CORPORATE",
  design: { primaryColor: "#0369a1", secondaryColor: "#e0f2fe" }, header: { storeName: "شرکت شما" },
  hero: { layout: "split", eyebrow: "راهکارهای حرفه‌ای برای رشد کسب‌وکار", title: "همراه مطمئن کسب‌وکار شما", subtitle: "خدمات، توانمندی‌ها و پروژه‌های ما؛ روشن، حرفه‌ای و متناسب با نیاز سازمان شما.", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main", imageUrl: templatePhoto("corporate/hero") },
  sections: [
    section("about-main", "about", "درباره شرکت", "داستان و رویکرد ما", { showInNav: true, navLabel: "درباره ما", imageUrl: templatePhoto("corporate/about"), body: "با تکیه بر تجربه تیم و رویکردی مرحله‌به‌مرحله، به کسب‌وکارها کمک می‌کنیم هدف‌هایشان را روشن، قابل اندازه‌گیری و عملی کنند." }),
    corporateCards("services-main", "services", "خدمات ما", "خدمات", [
      ["مشاوره و راهکار", "تحلیل نیاز و نقشه راه", "بررسی وضعیت فعلی و پیشنهاد مسیر روشن برای رسیدن به هدف."],
      ["اجرای پروژه", "از برنامه تا تحویل", "اجرای مرحله‌به‌مرحله پروژه با گزارش منظم پیشرفت."],
      ["پشتیبانی و خدمات", "همراهی پس از تحویل", "پاسخ‌گویی و بهبود مستمر پس از راه‌اندازی."],
      ["توسعه کسب‌وکار", "رشد و ورود به فرصت‌های تازه", "شناسایی فرصت‌ها و برنامه‌ریزی برای گسترش فعالیت."],
      ["راهکارهای اختصاصی", "متناسب با نیاز هر سازمان", "طراحی راهکاری که با شرایط و اهداف شما هماهنگ است."],
      ["همکاری سازمانی", "همراهی بلندمدت", "همکاری پایدار برای پروژه‌های مستمر و چندمرحله‌ای."],
    ], "راهکارهای متناسب با نیاز شما"),
    corporateCards("portfolio-main", "portfolio", "نمونه‌کارها", "نمونه‌کارها", [
      ["طراحی و اجرای پروژه", "از نیازسنجی تا تحویل", "اجرای مرحله‌به‌مرحله با گزارش منظم پیشرفت و تحویل در زمان مقرر.", templatePhoto("corporate/project-1")],
      ["راهکار سازمانی", "مشاوره و پیاده‌سازی", "راهکاری متناسب با ساختار و هدف‌های سازمان، همراه با آموزش تیم.", templatePhoto("corporate/project-2")],
      ["همکاری بلندمدت", "پشتیبانی و توسعه مستمر", "همراهی پس از تحویل و بهبود مستمر با نیازهای در حال تغییر مشتری.", templatePhoto("corporate/project-3")],
    ], "نمونه‌ای از کارهای ما"),
    { ...story("clients-main", "مشتریان و شرکای ما", "مشتریان", "همکاری‌هایی که به آن افتخار می‌کنیم", "تجربه مشتریان خود را پس از دریافت بازخورد در این بخش منتشر کنید."), enabled: false },
    { ...contact("شروع همکاری"), subtitle: "برای دریافت اطلاعات بیشتر یا بررسی زمینه همکاری، اطلاعات تماس خود را ثبت کنید تا با شما در ارتباط باشیم." },
  ],
};

// Hybrid: a craft business that designs/builds to order AND shows ready-made products.
// Capability boundary (verified in the backend): Commerce (cart, checkout, discounts) is STORE-only, so the product
// showcase here is DISPLAY + INQUIRY: it carries no prices, stock, cart or checkout, and every call to action leads to
// the lead form. Booking is not part of the HYBRID archetype either. Nothing below pretends otherwise.
const hybridCards = (id: string, type: "services" | "portfolio", title: string, subtitle: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][], extra: Partial<SectionConfig> = {}) =>
  ({ ...cards(id, type, title, navLabel, []), subtitle, items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })), ...extra });

const hybrid: WebsiteTemplate = {
  id: "hybrid-business-v1", label: "کسب‌وکار ترکیبی", description: "خدمات سفارشی، ویترین محصولات آماده، نمونه‌کارها و دریافت استعلام در یک سایت.", siteKind: "BUSINESS", siteType: "HYBRID",
  design: { primaryColor: "#b45309", secondaryColor: "#fef3c7", backgroundColor: "#faf7f2", textColor: "#292524", surfaceColor: "#ffffff" },
  header: { storeName: "کارگاه و فروشگاه شما", backgroundColor: "#1c1917", textColor: "#fafaf9", sticky: true },
  nav: { enabled: true, ctaLabel: "استعلام و سفارش", ctaHref: "#contact-main" },
  footer: { enabled: true, text: "طراحی، ساخت و فروش محصولات دست‌ساز.", backgroundColor: "#1c1917", textColor: "#e7e5e4" },
  hero: { layout: "background", eyebrow: "طراحی، ساخت و فروش", title: "از طرح تا ساخت؛ کاری که ماندگار می‌ماند", subtitle: "سفارش ساخت اختصاصی بدهید یا از محصولات آماده ما دیدن کنید. هر دو مسیر با یک گفتگو شروع می‌شود.", ctaLabel: "مشاهده محصولات", ctaHref: "#products-main", imageUrl: templatePhoto("hybrid/hero", "jpg"), backgroundColor: "#1c1917", overlayOpacity: 48 },
  sections: [
    hybridCards("services-main", "services", "خدمات طراحی و ساخت سفارشی", "از اندازه‌گیری تا نصب، همراه شما هستیم.", "خدمات", [
      ["طراحی و مشاوره", "طرح متناسب با فضا و بودجه شما", "نیاز و فضای شما را بررسی می‌کنیم و طرح و مواد مناسب را پیشنهاد می‌دهیم."],
      ["ساخت سفارشی", "از نقشه تا محصول نهایی", "ساخت در کارگاه خودمان با پیگیری مرحله‌به‌مرحله و گزارش پیشرفت."],
      ["نصب و پشتیبانی", "تحویل و نصب در محل", "نصب دقیق و پشتیبانی پس از تحویل برای اطمینان از رضایت شما."],
    ]),
    hybridCards("products-main", "portfolio", "محصولات آماده", "نمونه‌ای از محصولات موجود. برای قیمت و سفارش، فرم استعلام را پر کنید.", "محصولات", [
      ["سینی و میز کنار چوبی", "دست‌ساز · موجود برای سفارش", "سینی و میز کنار چوب راش با روکش مقاوم؛ قیمت و موجودی را از ما بپرسید.", templatePhoto("hybrid/product-1", "jpg")],
      ["ست ظروف چوب", "دست‌ساز · قابل سفارش در اندازه دلخواه", "قاشق، چنگال و کاسه چوبی با کیفیت مناسب استفاده روزانه.", templatePhoto("hybrid/product-2", "jpg")],
      ["کتابخانه و قفسه", "ساخت اختصاصی بر اساس اندازه", "قفسه‌های مدولار با طراحی متناسب با فضای شما.", templatePhoto("hybrid/product-3", "jpg")],
    ], { backgroundColor: "#fff7ed" }),
    section("about-main", "text-image", "داستان کارگاه", "چرا کار دست؟", { showInNav: true, navLabel: "درباره ما", imageUrl: templatePhoto("hybrid/workshop", "jpg"), mediaPosition: "start", body: "طراحی و ساخت را در کارگاه خودمان و کنار هم انجام می‌دهیم؛ از انتخاب مواد تا نصب نهایی، مسیر هر سفارش را شفاف پیگیری می‌کنیم." }),
    hybridCards("projects-main", "portfolio", "نمونه پروژه‌ها", "تجربه‌ای از کارهای انجام‌شده برای مشتریان.", "نمونه‌کارها", [
      ["بازطراحی فضای کار", "پروژه سفارشی", "طراحی و ساخت مبلمان اختصاصی برای یک فضای کاری.", templatePhoto("hybrid/project-1", "jpg")],
      ["دکور و مبلمان خانه", "پروژه سفارشی", "هماهنگی طرح، رنگ و مواد با فضای زندگی مشتری.", templatePhoto("hybrid/project-2", "jpg")],
    ]),
    section("inquiry-cta", "cta", "پروژه یا سفارشی در ذهن دارید؟", "توضیح کوتاهی بنویسید؛ برای مشاوره و برآورد با شما تماس می‌گیریم.", { ctaLabel: "ارسال استعلام", ctaHref: "#contact-main", backgroundColor: "#b45309", textColor: "#ffffff" }),
    { ...contact("استعلام و سفارش"), subtitle: "نام، شماره تماس و توضیح سفارش خود را بنویسید تا با شما تماس بگیریم." },
  ],
};

export const businessLaunchTemplates: readonly WebsiteTemplate[] = [medical, legal, education, corporate, hybrid];
