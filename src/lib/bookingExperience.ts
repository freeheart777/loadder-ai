// Presentation vocabulary for the canonical public Booking flow. One state machine
// (PublicBookingPage), one repository; only the words and palette vary by site type.
// Unknown site types keep the original class/course vocabulary (Education-compatible).
export type BookingExperienceKind = "MEDICAL" | "EDUCATION";

export type BookingExperience = {
  kind: BookingExperienceKind;
  title: string;
  /** Seven step labels: service, provider, mode, slot, details, review, confirmation. */
  stepLabels: [string, string, string, string, string, string, string];
  pickService: string;
  pickProvider: string;
  pickMode: string;
  pickSlot: string;
  detailsRequired: string;
  nameField: string;
  unavailableSlot: string;
  submitFailed: string;
  confirmedEyebrow: string;
  emptyTitle: string;
  emptyBody: string;
  noProviders: string;
  theme: { page: string; card: string; accent: string; accentSoft: string; primary: string; muted: string };
};

const EDUCATION: BookingExperience = {
  kind: "EDUCATION",
  title: "رزرو کلاس",
  stepLabels: ["دوره", "مدرس", "نوع کلاس", "زمان", "اطلاعات هنرجو", "بازبینی", "تأیید"],
  pickService: "یک دوره را انتخاب کنید.",
  pickProvider: "یک مدرس را انتخاب کنید.",
  pickMode: "نوع کلاس را انتخاب کنید.",
  pickSlot: "یک زمان قابل رزرو انتخاب کنید.",
  detailsRequired: "نام و شماره تماس هنرجو لازم است.",
  nameField: "نام هنرجو",
  unavailableSlot: "زمان در دسترس نیست.",
  submitFailed: "ثبت نوبت ناموفق بود.",
  confirmedEyebrow: "رزرو با موفقیت ثبت شد",
  emptyTitle: "هنوز دوره‌ای برای رزرو ثبت نشده است.",
  emptyBody: "پس از ثبت دوره‌ها توسط آموزشگاه، اینجا قابل رزرو خواهند بود.",
  noProviders: "برای این دوره هنوز مدرسی ثبت نشده است.",
  theme: { page: "bg-[#242321]", card: "bg-[#f5f0e5]", accent: "text-[#9a7439]", accentSoft: "border-[#a98242] bg-[#eee1c8]", primary: "bg-[#292721]", muted: "text-stone-400" },
};

const MEDICAL: BookingExperience = {
  kind: "MEDICAL",
  title: "رزرو نوبت",
  stepLabels: ["خدمت / تخصص", "پزشک", "شیوه مراجعه", "تاریخ و ساعت", "اطلاعات بیمار", "بازبینی و تأیید", "نوبت شما ثبت شد"],
  pickService: "یک خدمت یا تخصص را انتخاب کنید.",
  pickProvider: "یک پزشک را انتخاب کنید.",
  pickMode: "شیوه مراجعه را انتخاب کنید.",
  pickSlot: "یک تاریخ و ساعت قابل رزرو انتخاب کنید.",
  detailsRequired: "نام و شماره تماس بیمار لازم است.",
  nameField: "نام بیمار",
  unavailableSlot: "این ساعت در دسترس نیست.",
  submitFailed: "ثبت نوبت ناموفق بود.",
  confirmedEyebrow: "نوبت شما ثبت شد",
  emptyTitle: "هنوز خدمتی برای رزرو نوبت ثبت نشده است.",
  emptyBody: "پس از تعریف خدمات و پزشکان توسط مرکز درمانی، امکان رزرو نوبت از همین صفحه فراهم می‌شود.",
  noProviders: "برای این خدمت هنوز پزشکی ثبت نشده است.",
  theme: { page: "bg-[#f7f3ea]", card: "bg-[#fffdf8] border border-[#2b2a27]/10", accent: "text-[#5f7560]", accentSoft: "border-[#5f7560] bg-[#e6ede2]", primary: "bg-[#2b2a27]", muted: "text-[#2b2a27]/40" },
};

export function bookingExperienceFor(siteType?: string | null): BookingExperience {
  return String(siteType || "").toUpperCase() === "MEDICAL" ? MEDICAL : EDUCATION;
}
