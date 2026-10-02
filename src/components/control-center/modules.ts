// The Control Center is ONE shell with ONE routing model. What differs per vertical is
// (a) which capabilities the site type provides and (b) the vocabulary used to name them.
// Nothing here fetches or invents data: a module only appears when its capability exists,
// and every module reads canonical records (Booking, enrolments, documents, ...).
export type ControlCenterKind = "MEDICAL" | "EDUCATION" | "STORE" | "GENERIC";
export type Capability = "overview" | "people" | "booking" | "files" | "content" | "settings" | "commerce";
export type ModuleKey = "dashboard" | "people" | "providers" | "services" | "schedules" | "appointments" | "files" | "content" | "settings" | "commerce";

export type Vocabulary = {
  /** Heading of the whole centre, e.g. «مرکز مدیریت درمانی». */
  center: string;
  people: string; provider: string; providers: string; service: string; services: string;
  schedule: string; appointment: string; appointments: string; files: string;
  /** One customer ("بیمار"/"دانشجو"), the care/lesson mode noun, and the modes a service may offer. */
  person: string; mode: string; modes: readonly (readonly [string, string])[];
};

/** Persian indefinite form: «پزشک» → «پزشکی», «دوره» → «دوره‌ای». */
export const indef = (word: string) => (word.endsWith("ه") ? `${word}‌ای` : `${word}ی`);

export type ModuleDef = { key: ModuleKey; capability: Capability; group: "overview" | "operate" | "content" | "system"; label: (v: Vocabulary) => string };

const MEDICAL: Vocabulary = { center: "مرکز مدیریت درمانی", people: "بیماران", provider: "پزشک", providers: "پزشکان", service: "خدمت", services: "خدمات", schedule: "برنامهٔ پزشکان", appointment: "نوبت", appointments: "نوبت‌ها", files: "فایل‌ها", person: "بیمار", mode: "شیوه مراجعه", modes: [["IN_PERSON", "حضوری"], ["VIDEO", "ویدئویی"], ["AUDIO", "صوتی"], ["TEXT", "متنی"]] };
const EDUCATION: Vocabulary = { center: "مرکز مدیریت آموزش", people: "دانشجویان", provider: "مدرس", providers: "مدرس‌ها", service: "دوره", services: "دوره‌ها", schedule: "برنامهٔ مدرس‌ها", appointment: "رزرو", appointments: "رزروها", files: "منابع آموزشی", person: "دانشجو", mode: "نوع کلاس", modes: [["IN_PERSON", "حضوری"], ["ONLINE", "آنلاین"]] };
const STORE: Vocabulary = { center: "مرکز مدیریت فروشگاه", people: "مشتریان", provider: "ارائه‌دهنده", providers: "ارائه‌دهندگان", service: "خدمت", services: "خدمات", schedule: "برنامه", appointment: "نوبت", appointments: "نوبت‌ها", files: "فایل‌ها", person: "مشتری", mode: "شیوه ارائه", modes: [["IN_PERSON", "حضوری"], ["ONLINE", "آنلاین"], ["VIDEO", "ویدئویی"], ["AUDIO", "صوتی"]] };
const GENERIC: Vocabulary = { ...STORE, center: "مرکز کنترل" };
/** Booking management outside any one site (the workspace's own services and providers). */
export const WORKSPACE_BOOKING: Vocabulary = { ...GENERIC, center: "مدیریت نوبت‌دهی" };

const VOCABULARY: Record<ControlCenterKind, Vocabulary> = { MEDICAL, EDUCATION, STORE, GENERIC };

// What each site type can actually operate today. Payments, messages and analytics are not
// listed because no site-scoped canonical module exists for them yet; they appear when one does.
const CAPABILITIES: Record<ControlCenterKind, readonly Capability[]> = {
  MEDICAL: ["overview", "people", "booking", "files", "content", "settings"],
  EDUCATION: ["overview", "people", "booking", "files", "content"],
  STORE: ["overview", "commerce", "content"],
  GENERIC: ["overview", "content"],
};

const MODULES: readonly ModuleDef[] = [
  { key: "dashboard", capability: "overview", group: "overview", label: () => "نمای کلی" },
  { key: "content", capability: "content", group: "content", label: () => "محتوا" },
  { key: "people", capability: "people", group: "operate", label: (v) => v.people },
  { key: "providers", capability: "booking", group: "operate", label: (v) => v.providers },
  { key: "services", capability: "booking", group: "operate", label: (v) => v.services },
  { key: "schedules", capability: "booking", group: "operate", label: (v) => v.schedule },
  { key: "appointments", capability: "booking", group: "operate", label: (v) => v.appointments },
  { key: "commerce", capability: "commerce", group: "operate", label: () => "محصولات و سفارش‌ها" },
  { key: "files", capability: "files", group: "operate", label: (v) => v.files },
  { key: "settings", capability: "settings", group: "system", label: () => "تنظیمات" },
];

export const GROUP_LABELS: Record<ModuleDef["group"], string> = { overview: "مرکز کنترل", operate: "عملیات", content: "محتوا", system: "سیستم" };

export function controlCenterKind(siteType?: string | null): ControlCenterKind {
  const type = String(siteType || "").toUpperCase();
  if (type === "MEDICAL" || type === "EDUCATION") return type;
  return type === "STORE" || type === "ECOMMERCE" ? "STORE" : "GENERIC";
}

export type ControlCenterDefinition = { kind: ControlCenterKind; vocabulary: Vocabulary; capabilities: readonly Capability[]; modules: { key: ModuleKey; group: ModuleDef["group"]; label: string }[] };

export function controlCenterFor(siteType?: string | null): ControlCenterDefinition {
  const kind = controlCenterKind(siteType), vocabulary = VOCABULARY[kind], capabilities = CAPABILITIES[kind];
  return { kind, vocabulary, capabilities, modules: MODULES.filter((m) => capabilities.includes(m.capability)).map((m) => ({ key: m.key, group: m.group, label: m.label(vocabulary) })) };
}

/** Booking-only definition for the workspace Booking Studio (services/providers not tied to one site). */
export function workspaceBookingModules() {
  return MODULES.filter((m) => m.capability === "booking").map((m) => ({ key: m.key, group: m.group, label: m.label(WORKSPACE_BOOKING) }));
}

export const controlCenterPath = (siteProjectId: string, module?: ModuleKey) => `/dashboard/websites/${encodeURIComponent(siteProjectId)}/control${module && module !== "dashboard" ? `/${module}` : ""}`;

/** Build surfaces (Website Studio) for a site. Stores use the Store Studio; everything else the business studio. */
export const websiteStudioPath = (siteProjectId: string, siteType?: string | null) => `${controlCenterKind(siteType) === "STORE" ? "/dashboard/websites/store" : "/dashboard/websites/corporate"}?project=${encodeURIComponent(siteProjectId)}`;

/** The public site's address for a project (storefronts live under /store, every other type under /site). */
export const publicSitePath = (siteProjectId: string, siteType?: string | null) => `${controlCenterKind(siteType) === "STORE" ? "/store" : "/site"}/${encodeURIComponent(siteProjectId)}`;
