import type { PageConfig, SectionConfig } from "../types";
import type { WebsiteTemplate } from "./types";

const item = (id: string, title: string, subtitle: string) => ({ id, title, subtitle, body: "", imageUrl: "", meta: "" });
const section = (id: string, type: SectionConfig["type"], title: string, subtitle: string, extra: Partial<SectionConfig> = {}): SectionConfig => ({ id, type, enabled: true, title, subtitle, backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra });
const contact = (label: string) => section("contact-main", "contact", label, "فرم را کامل کنید تا با شما تماس بگیریم.", { showInNav: true, navLabel: "تماس", contact: { formEnabled: true, submitLabel: "ارسال درخواست", successMessage: "پیام شما ثبت شد.", phone: "", email: "", address: "", mapUrl: "" } });
const cards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, values: [string, string][]) => section(id, type, title, "برای شروع آماده و قابل ویرایش است.", { showInNav: true, navLabel, columns: 3, items: values.map(([name, detail], index) => item(`${id}-${index}`, name, detail)) });
const story = (id: string, title: string, navLabel: string, subtitle: string, body: string, type: "text" | "text-image" = "text") => section(id, type, title, subtitle, { showInNav: true, navLabel, body });
// Bundled CC0 stock photos (public/template-images, see CREDITS.md). The URL is absolute so the
// stored value is the same https address on the canvas, previews and the server-rendered site.
const templatePhoto = (path: string) => `${typeof window === "undefined" ? "" : window.location.origin}/template-images/${path}.webp`;

// Medical: default copy and bundled stock photos (hero, doctor portraits).
// All text and images stay editable; services and text sections carry no images.
const medicalCards = (id: string, type: "services" | "team", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const medical: WebsiteTemplate = {
  id: "medical-practice-v1", label: "کلینیک و پزشک", description: "معرفی پزشک، خدمات درمانی و درخواست نوبت.", siteKind: "BUSINESS", siteType: "MEDICAL",
  design: { primaryColor: "#0f766e", secondaryColor: "#ccfbf1" }, header: { storeName: "کلینیک شما" },
  hero: { layout: "background", eyebrow: "مراقبت درمانی حرفه‌ای", title: "مراقبت از سلامت شما، با آرامش و دقت", subtitle: "خدمات تخصصی، توضیح روشن مسیر درمان و پیگیری پس از مراجعه در یک مکان.", ctaLabel: "رزرو نوبت", ctaHref: "#contact-main", imageUrl: templatePhoto("medical/hero"), backgroundColor: "#134e4a", overlayOpacity: 52 },
  sections: [
    medicalCards("doctor-main", "team", "پزشکان ما", "پزشکان", [
      ["پزشک متخصص", "حوزه تخصص پزشک", "معرفی کوتاه پزشک و روزهای حضور در کلینیک را اینجا بنویسید.", templatePhoto("medical/doctor-1")],
      ["پزشک متخصص", "حوزه تخصص پزشک", "معرفی کوتاه پزشک و روزهای حضور در کلینیک را اینجا بنویسید.", templatePhoto("medical/doctor-2")],
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

// Legal: default copy and bundled stock photos (hero, attorneys, cases, article).
// All text and images stay editable.
const legalCards = (id: string, type: "services" | "team" | "portfolio", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const legal: WebsiteTemplate = {
  id: "legal-firm-v1", label: "موسسه حقوقی", description: "معرفی وکلا، تخصص‌ها، تجربه‌ها و درخواست مشاوره.", siteKind: "BUSINESS", siteType: "LEGAL",
  design: { primaryColor: "#a16207", secondaryColor: "#fef3c7" }, header: { storeName: "موسسه حقوقی شما" },
  hero: { layout: "background", eyebrow: "مشاوره و وکالت تخصصی", title: "همراه حقوقی شما در تصمیم‌های مهم", subtitle: "از اولین جلسه مشاوره تا پایان پرونده، مسیر حقوقی را روشن توضیح می‌دهیم و با دقت پیگیری می‌کنیم.", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main", imageUrl: templatePhoto("legal/hero"), backgroundColor: "#292524", overlayOpacity: 58 },
  sections: [
    legalCards("attorneys-main", "team", "وکلای ما", "وکلا", [
      ["وکیل پایه یک دادگستری", "دعاوی خانواده و ملکی", "معرفی کوتاه وکیل، سوابق و حوزه تخصص را اینجا بنویسید.", templatePhoto("legal/lawyer-1")],
      ["وکیل پایه یک دادگستری", "حقوق شرکت‌ها و قراردادها", "معرفی کوتاه وکیل، سوابق و حوزه تخصص را اینجا بنویسید.", templatePhoto("legal/lawyer-2")],
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
      ["اختلاف میان شرکای تجاری", "حقوق تجارت · نمونه پرونده", "بررسی اسناد شرکت، مذاکره میان شرکا و پیگیری مسیر حل اختلاف.", templatePhoto("legal/case-1")],
      ["الزام به تنظیم سند رسمی", "دعاوی ملکی · نمونه پرونده", "بررسی قرارداد خرید، استعلام‌های ثبتی و طرح دعوای الزام به تنظیم سند.", templatePhoto("legal/case-2")],
    ]),
    { ...story("articles-main", "مقالات حقوقی", "مقالات", "راهنما و دیدگاه تخصصی", "در این بخش راهنماهای کوتاه حقوقی منتشر کنید؛ مثلاً نکات پیش از امضای قرارداد اجاره، مراحل ثبت شرکت یا حقوق مالی زوجه.", "text-image"), imageUrl: templatePhoto("legal/article") },
    { ...contact("درخواست مشاوره حقوقی"), subtitle: "موضوع خود را کوتاه بنویسید تا برای هماهنگی جلسه مشاوره با شما تماس بگیریم." },
  ],
};
// Education: default copy and bundled stock photos (hero, instructor portraits).
// All text and images stay editable; course cards and text sections carry no images.
const educationCards = (id: string, type: "services" | "team", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

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
  hero: { layout: "centered", eyebrow: "آموزش موسیقی، با تمرین و همراهی", title: "صدای خودتان را پیدا کنید", subtitle: "دوره‌ها، کارگاه‌ها و کلاس‌های موسیقی با مسیر یادگیری روشن و قابل ویرایش.", ctaLabel: "رزرو کلاس", ctaHref: "/booking", imageUrl: templatePhoto("education/hero"), backgroundColor: "#242321", textColor: "#f5f0e5", overlayOpacity: 60 },
  sections: [
    educationCards("courses-main", "services", "دوره‌های آموزشی", "دوره‌ها", [
      ["دوره مقدماتی", "شروع اصولی و کاربردی", "آشنایی با مفاهیم پایه و تمرین عملی از جلسه اول."],
      ["دوره پیشرفته", "پروژه‌محور و تخصصی", "یادگیری مهارت‌های تخصصی با انجام پروژه‌های واقعی."],
      ["کارگاه عملی", "تمرین در کنار مدرس", "جلسه‌های کوتاه و متمرکز برای تمرین و رفع اشکال."],
    ]),
    educationCards("teachers-main", "team", "مدرسان", "مدرسان", [
      ["مدرس دوره", "حوزه تدریس", "معرفی کوتاه مدرس و دوره‌هایی که تدریس می‌کند را اینجا بنویسید.", templatePhoto("education/instructor-1")],
      ["مدرس دوره", "حوزه تدریس", "معرفی کوتاه مدرس و دوره‌هایی که تدریس می‌کند را اینجا بنویسید.", templatePhoto("education/instructor-2")],
    ]),
    story("features-main", "چرا این مرکز آموزشی", "ویژگی‌ها", "یادگیری عملی با مسیر روشن", "آموزش پروژه‌محور، تمرین در هر جلسه و امکان رفع اشکال با مدرس؛ تا آنچه یاد می‌گیرید در عمل به کار بیاید."),
    story("testimonials-main", "تجربه دانش‌پذیران", "تجربه‌ها", "داستان‌های یادگیری", "تجربه دانش‌پذیران را پس از دریافت اجازه آن‌ها در این بخش منتشر کنید."),
    { ...contact("ثبت‌نام و مشاوره"), subtitle: "دوره مورد نظر و شماره تماس خود را بنویسید تا برای راهنمایی و ثبت‌نام با شما تماس بگیریم." },
  ],
  // These are ordinary V16 static pages, persisted with the draft. They are
  // presentation only: course/provider/booking truth remains in its canonical
  // domain and is never copied into the website document.
  pages: [
    {
      id: "page-home", title: "خانه", slug: "", isHome: true, showInNav: true, navLabel: "خانه",
      seo: { title: "آموزشگاه موسیقی", description: "آموزش موسیقی، دوره‌ها و کارگاه‌های قابل ویرایش." },
      sections: [
        story("education-intro", "یادگیری موسیقی، قدم‌به‌قدم", "", "مسیر روشن برای تمرین", "برنامه آموزشی، تمرین و همراهی مدرس را متناسب با نیاز هنرجو معرفی کنید."),
        story("education-note", "برای شروع آماده‌اید؟", "", "رزرو از مسیر رسمی", "برای انتخاب زمان مناسب، از دکمه رزرو کلاس استفاده کنید."),
      ],
    },
    educationPage("page-courses", "دوره‌ها", "courses", [
      educationCards("courses-directory", "services", "دوره‌های آموزشی", "", [
        ["دوره مقدماتی", "شروع اصولی و کاربردی", "جزئیات هدف، پیش‌نیاز و برنامه تمرین این دوره را اینجا وارد کنید."],
        ["دوره پیشرفته", "پروژه‌محور و تخصصی", "توضیح مسیر یادگیری و خروجی مورد انتظار دوره را به‌روز کنید."],
        ["کارگاه عملی", "تمرین در کنار مدرس", "زمان و موضوع کارگاه را پس از نهایی شدن برنامه منتشر کنید."],
      ]),
    ]),
    educationPage("page-teachers", "مدرسان", "teachers", [
      educationCards("teachers-directory", "team", "مدرسان", "", [
        ["مدرس دوره", "حوزه تدریس", "معرفی، تخصص و شیوه تدریس مدرس را اینجا وارد کنید.", templatePhoto("education/instructor-1")],
        ["مدرس دوره", "حوزه تدریس", "معرفی، تخصص و شیوه تدریس مدرس را اینجا وارد کنید.", templatePhoto("education/instructor-2")],
      ]),
    ]),
    educationPage("page-children", "موسیقی کودک", "children", [
      story("children-music", "موسیقی کودک", "", "آشنایی، بازی و تمرین", "برنامه مناسب سن، روش آموزش و شرایط همراهی خانواده را با اطلاعات تأییدشده خودتان تکمیل کنید."),
    ]),
    educationPage("page-workshops", "کارگاه‌ها", "workshops", [
      educationCards("workshops-directory", "services", "کارگاه‌ها و رویدادها", "", [
        ["کارگاه عملی", "زمان و ظرفیت پس از تأیید منتشر می‌شود", "تا وقتی ظرفیت و ثبت‌نام در دامنه عملیاتی پشتیبانی نمی‌شود، این کارت هیچ وعده ثبت‌نامی نمی‌دهد."],
      ]),
    ]),
    educationPage("page-performances", "اجراها", "performances", [
      story("performances-directory", "اجراها", "", "ویدئو و برنامه‌ها", "ویدئو یا اجرای ضبط‌شده را تنها پس از افزودن رسانه معتبر منتشر کنید."),
    ]),
    educationPage("page-magazine", "مجله", "magazine", [
      educationCards("magazine-directory", "services", "مجله آموزشی", "", [
        ["راهنمای تمرین روزانه", "یادداشتی برای برنامه‌ریزی تمرین", "این یادداشت نمونه است؛ راهنماها و مقاله‌های تأییدشده آموزشگاه را پیش از انتشار بازبینی و ویرایش کنید."],
        ["آمادگی برای اجرای نخست", "تجربه و نکته‌های تمرین", "برای آماده‌سازی اجرا، برنامه تمرین و توصیه‌های واقعی مدرس را پس از تأیید در این صفحه وارد کنید."],
      ]),
    ]),
  ],
};
// Corporate: default copy and bundled stock photos (hero, about, projects).
// All text and images stay editable; service cards and the clients text block carry no images.
const corporateCards = (id: string, type: "services" | "portfolio", title: string, navLabel: string, entries: [title: string, subtitle: string, body: string, imageUrl?: string][]) =>
  ({ ...cards(id, type, title, navLabel, []), items: entries.map(([name, detail, body, imageUrl = ""], index) => ({ ...item(`${id}-${index}`, name, detail), body, imageUrl })) });

const corporate: WebsiteTemplate = {
  id: "corporate-company-v1", label: "شرکت حرفه‌ای", description: "درباره شرکت، خدمات، نمونه‌کارها، مشتریان و تماس.", siteKind: "BUSINESS", siteType: "CORPORATE",
  design: { primaryColor: "#0369a1", secondaryColor: "#e0f2fe" }, header: { storeName: "شرکت شما" },
  hero: { layout: "split", eyebrow: "راهکارهای حرفه‌ای برای رشد کسب‌وکار", title: "همراه مطمئن کسب‌وکار شما", subtitle: "خدمات، توانمندی‌ها و پروژه‌های مجموعه خود را روشن و حرفه‌ای به مشتریان معرفی کنید.", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main", imageUrl: templatePhoto("corporate/hero") },
  sections: [
    section("about-main", "about", "درباره شرکت", "داستان و رویکرد ما", { showInNav: true, navLabel: "درباره ما", imageUrl: templatePhoto("corporate/about"), body: "در این بخش داستان شکل‌گیری مجموعه، توانمندی‌ها و رویکرد کاری خود را کوتاه و روشن معرفی کنید." }),
    corporateCards("services-main", "services", "خدمات ما", "خدمات", [
      ["مشاوره و راهکار", "تحلیل نیاز و نقشه راه", "بررسی وضعیت فعلی و پیشنهاد مسیر روشن برای رسیدن به هدف."],
      ["اجرای پروژه", "از برنامه تا تحویل", "اجرای مرحله‌به‌مرحله پروژه با گزارش منظم پیشرفت."],
      ["پشتیبانی و خدمات", "همراهی پس از تحویل", "پاسخ‌گویی و بهبود مستمر پس از راه‌اندازی."],
      ["توسعه کسب‌وکار", "رشد و ورود به فرصت‌های تازه", "شناسایی فرصت‌ها و برنامه‌ریزی برای گسترش فعالیت."],
      ["راهکارهای اختصاصی", "متناسب با نیاز هر سازمان", "طراحی راهکاری که با شرایط و اهداف شما هماهنگ است."],
      ["همکاری سازمانی", "همراهی بلندمدت", "همکاری پایدار برای پروژه‌های مستمر و چندمرحله‌ای."],
    ]),
    corporateCards("portfolio-main", "portfolio", "نمونه‌کارها", "نمونه‌کارها", [
      ["پروژه نمونه", "حوزه فعالیت پروژه", "شرح کوتاه پروژه و نقش مجموعه شما در آن را اینجا بنویسید.", templatePhoto("corporate/project-1")],
      ["راهکار سازمانی", "حوزه فعالیت پروژه", "شرح کوتاه پروژه و نقش مجموعه شما در آن را اینجا بنویسید.", templatePhoto("corporate/project-2")],
      ["پروژه همکاری", "حوزه فعالیت پروژه", "شرح کوتاه پروژه و نقش مجموعه شما در آن را اینجا بنویسید.", templatePhoto("corporate/project-3")],
    ]),
    story("clients-main", "مشتریان و شرکای ما", "مشتریان", "همکاری‌هایی که به آن افتخار می‌کنیم", "تجربه مشتریان خود را پس از دریافت بازخورد در این بخش منتشر کنید."),
    { ...contact("شروع همکاری"), subtitle: "برای دریافت اطلاعات بیشتر یا بررسی زمینه همکاری، اطلاعات تماس خود را ثبت کنید تا با شما در ارتباط باشیم." },
  ],
};

const hybrid: WebsiteTemplate = {
  id: "hybrid-business-v1", label: "کسب‌وکار ترکیبی", description: "صفحات معرفی، مقالات و فروش محصولات در یک سایت.", siteKind: "BUSINESS", siteType: "HYBRID",
  design: { primaryColor: "#0f766e", secondaryColor: "#ecfdf5" }, header: { storeName: "کسب‌وکار شما" },
  hero: { layout: "split", eyebrow: "کسب‌وکار شما، یکپارچه و حرفه‌ای", title: "معرفی، محتوا و فروش در یک سایت", subtitle: "داستان کسب‌وکار، مقاله‌ها و محصولات خود را در کنار هم به مشتریان نشان دهید.", ctaLabel: "مشاهده محصولات", ctaHref: "#products-main", imageUrl: templatePhoto("corporate/hero") },
  sections: [
    section("about-main", "about", "درباره ما", "داستان کسب‌وکار ما", { showInNav: true, navLabel: "درباره ما", imageUrl: templatePhoto("corporate/about"), body: "در این بخش داستان شکل‌گیری کسب‌وکار، رویکرد و ارزش پیشنهادی خود را معرفی کنید." }),
    story("articles-main", "مقالات", "مقالات", "دانش و تجربه ما", "مقاله‌ها و راهنماهای مفید خود را در این بخش منتشر کنید."),
    { ...contact("شروع گفتگو"), subtitle: "اطلاعات تماس خود را ثبت کنید تا با شما در ارتباط باشیم." },
  ],
};

export const businessLaunchTemplates: readonly WebsiteTemplate[] = [medical, legal, education, corporate, hybrid];
