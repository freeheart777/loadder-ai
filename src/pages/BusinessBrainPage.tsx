import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { withDemo } from "../lib/demoMode";

import {
  ArrowRight,
  Brain,
  Sparkle,
  Globe,
  BookOpenText,
  UsersThree,
  InstagramLogo,
  Megaphone,
  ShoppingCart,
  Files,
  CheckCircle,
  WarningCircle,
  TrendUp,
  Target,
  Lightning,
  Plus,
  UploadSimple,
  LinkSimple,
  PencilSimple,
  ChartLineUp,
  Package,
  UserFocus,
  Quotes,
  Flag,
  Lightbulb,
  ShieldWarning,
} from "@phosphor-icons/react";
import { demoBusiness } from "../data/demoBusiness";
import { apiFetch } from "../lib/api";

type BusinessProfileForm = {
  name: string;
  website: string;
  industry: string;
  description: string;
  country: string;
  city: string;
};

const emptyBusinessProfile: BusinessProfileForm = {
  name: "",
  website: "",
  industry: "",
  description: "",
  country: "",
  city: "",
};

type SourceId =
  | "website"
  | "brand"
  | "crm"
  | "social"
  | "ads"
  | "sales"
  | "files";

type Source = {
  id: SourceId;
  title: string;
  description: string;
  icon: React.ElementType;
  connected: boolean;
  quality: number;
};

const initialSources: Source[] = [
  {
    id: "website",
    title: "وب‌سایت",
    description: "صفحات، خدمات، محصولات و پیام‌های برند",
    icon: Globe,
    connected: true,
    quality: 84,
  },
  {
    id: "brand",
    title: "Brand Book",
    description: "هویت، لحن، شخصیت و قواعد برند",
    icon: BookOpenText,
    connected: true,
    quality: 92,
  },
  {
    id: "crm",
    title: "CRM",
    description: "مشتریان، لیدها، تعامل و تاریخچه ارتباط",
    icon: UsersThree,
    connected: true,
    quality: 73,
  },
  {
    id: "social",
    title: "شبکه‌های اجتماعی",
    description: "محتوا، مخاطب، Reach و Engagement",
    icon: InstagramLogo,
    connected: false,
    quality: 0,
  },
  {
    id: "ads",
    title: "تبلیغات",
    description: "کمپین‌ها، هزینه، ROAS و Conversion",
    icon: Megaphone,
    connected: false,
    quality: 0,
  },
  {
    id: "sales",
    title: "فروش",
    description: "Revenue، محصولات و رفتار خرید",
    icon: ShoppingCart,
    connected: false,
    quality: 0,
  },
  {
    id: "files",
    title: "فایل‌ها و اسناد",
    description: "پروپوزال، کاتالوگ، فایل‌های داخلی و تحقیقات",
    icon: Files,
    connected: false,
    quality: 0,
  },
];

const defaultIntelligence = [
  {
    icon: Target,
    title: "ارزش پیشنهادی",
    value:
      "یک پلتفرم یکپارچه برای مدیریت رشد، بازاریابی، فروش و هوشمندسازی کسب‌وکار با AI.",
  },
  {
    icon: UserFocus,
    title: "مخاطب اصلی",
    value:
      "کسب‌وکارهای کوچک و متوسط، مدیران مارکتینگ، تیم‌های فروش و شرکت‌های در حال رشد.",
  },
  {
    icon: Quotes,
    title: "لحن برند",
    value:
      "هوشمند، آینده‌نگر، قدرتمند، حرفه‌ای و در عین حال ساده و قابل استفاده.",
  },
  {
    icon: Flag,
    title: "جایگاه بازار",
    value:
      "AI Business Growth Platform با تمرکز بر اتصال ابزارهای بازاریابی، CRM، Analytics و Automation.",
  },
  {
    icon: Package,
    title: "محصولات و سرویس‌ها",
    value:
      "Brand Book، Content Studio، Social، Ads، CRM، Analytics، KPI، Automation و ابزارهای آینده.",
  },
  {
    icon: TrendUp,
    title: "محرک اصلی رشد",
    value:
      "اتصال داده‌های چند کانال به Business Brain و تبدیل داده به پیشنهاد و اقدام.",
  },
];

type BusinessDnaVersion = {
  id: string;
  versionNumber: number;
  status: "draft" | "active" | "archived";
  valueProposition: string | null;
  targetAudiences: string[];
  offerings: string[];
  positioning: string | null;
  differentiators: string[];
  goals: string[];
  constraints: string[];
  brandVoice: string | null;
  growthDrivers: string[];
};

type BusinessDnaForm = {
  valueProposition: string;
  targetAudiences: string;
  offerings: string;
  positioning: string;
  brandVoice: string;
  growthDrivers: string;
};

type BusinessContextVersion = {
  id: string;
  versionNumber: number;
  status: "draft" | "active" | "archived";
  sourceManifest: {
    businessProfile: { id: string; updatedAt: string };
    businessDna: { id: string; versionNumber: number };
    brandBook: { id: string; versionNumber: number };
  };
};

const emptyDnaForm: BusinessDnaForm = {
  valueProposition: "",
  targetAudiences: "",
  offerings: "",
  positioning: "",
  brandVoice: "",
  growthDrivers: "",
};

function dnaVersionToForm(version: BusinessDnaVersion | null): BusinessDnaForm {
  if (!version) return emptyDnaForm;
  return {
    valueProposition: version.valueProposition || "",
    targetAudiences: version.targetAudiences.join("\n"),
    offerings: version.offerings.join("\n"),
    positioning: version.positioning || "",
    brandVoice: version.brandVoice || "",
    growthDrivers: version.growthDrivers.join("\n"),
  };
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

const opportunities = [
  {
    title: "اتصال داده‌های CRM به Content Studio",
    description:
      "محتوا بر اساس سگمنت‌های واقعی مشتری و رفتار خرید شخصی‌سازی شود.",
    impact: "بالا",
  },
  {
    title: "ساخت Campaign Brain",
    description:
      "یک Big Idea مرکزی برای تمام کانال‌های Ads، Social، SMS و Content ساخته شود.",
    impact: "بالا",
  },
  {
    title: "AI Lead Prioritization",
    description:
      "لیدهای با احتمال خرید بالاتر به صورت خودکار برای تیم فروش اولویت‌بندی شوند.",
    impact: "متوسط",
  },
];

const risks = [
  {
    title: "کمبود داده واقعی",
    description:
      "بخشی از تحلیل‌ها تا زمان اتصال APIها همچنان بر پایه داده آزمایشی خواهد بود.",
  },
  {
    title: "Data Silos",
    description:
      "اگر سرویس‌ها جدا از Business Brain توسعه پیدا کنند، ارزش پلتفرم کاهش می‌یابد.",
  },
  {
    title: "پیچیدگی بیش از حد",
    description:
      "UI باید برای کاربر ساده بماند حتی اگر زیرساخت محصول بسیار پیچیده شود.",
  },
];

export default function BusinessBrainPage() {
  const isDemo =
    new URLSearchParams(window.location.search).get("demo") === "1";

  const demoBrain =
    isDemo ? demoBusiness.demoBrainProfile : null;

  const [sources, setSources] =
    useState<Source[]>(initialSources);

  const [activeTab, setActiveTab] = useState<
    "dna" | "sources" | "opportunities" | "risks"
  >("dna");

  const [notice, setNotice] = useState("");
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfileForm>(emptyBusinessProfile);
  const [profileExists, setProfileExists] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [activeDna, setActiveDna] = useState<BusinessDnaVersion | null>(null);
  const [draftDna, setDraftDna] = useState<BusinessDnaVersion | null>(null);
  const [dnaForm, setDnaForm] = useState<BusinessDnaForm>(emptyDnaForm);
  const [dnaLoading, setDnaLoading] = useState(true);
  const [dnaSaving, setDnaSaving] = useState(false);
  const [dnaError, setDnaError] = useState("");
  const [activeContext, setActiveContext] = useState<BusinessContextVersion | null>(null);
  const [contextDraft, setContextDraft] = useState<BusinessContextVersion | null>(null);
  const [contextStale, setContextStale] = useState(false);
  const [contextStaleReasons, setContextStaleReasons] = useState<string[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextSaving, setContextSaving] = useState(false);
  const [contextError, setContextError] = useState("");

  const loadBusinessContext = async () => {
    try {
      const response = await apiFetch("/api/business-context");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setActiveContext(data.activeContext || null);
      setContextDraft(data.latestDraft || null);
      setContextStale(Boolean(data.isStale));
      setContextStaleReasons(data.staleReasons || []);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : "خطا در دریافت وضعیت شناخت مشترک.");
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    void loadBusinessContext();
  }, []);

  const createContextDraft = async () => {
    setContextSaving(true);
    setContextError("");
    try {
      const response = await apiFetch("/api/business-context/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setContextDraft(data.version);
      showNotice(`نسخه پیشنهادی ${data.version.versionNumber} آماده شد.`);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : "ساخت نسخه جدید انجام نشد.");
    } finally {
      setContextSaving(false);
    }
  };

  const activateContextDraft = async () => {
    if (!contextDraft) return;
    setContextSaving(true);
    setContextError("");
    try {
      const response = await apiFetch(`/api/business-context/versions/${contextDraft.id}/activate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setActiveContext(data.version);
      setContextDraft(null);
      setContextStale(false);
      setContextStaleReasons([]);
      showNotice(`شناخت مشترک نسخه ${data.version.versionNumber} فعال شد.`);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : "فعال‌سازی نسخه انجام نشد.");
    } finally {
      setContextSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function loadBusinessProfile() {
      try {
        const response = await apiFetch("/api/business-profile");
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!active) return;
        if (data.profile) {
          setBusinessProfile({
            name: data.profile.name || "",
            website: data.profile.website || "",
            industry: data.profile.industry || "",
            description: data.profile.description || "",
            country: data.profile.country || "",
            city: data.profile.city || "",
          });
          setProfileExists(true);
        }
      } catch (error) {
        if (active) {
          setProfileError(
            error instanceof Error ? error.message : "خطا در دریافت اطلاعات کسب‌وکار."
          );
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    }
    void loadBusinessProfile();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBusinessDna() {
      try {
        const response = await apiFetch("/api/business-dna");
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!active) return;
        const activeVersion = data.activeVersion || null;
        const latestDraft = data.latestDraft || null;
        setActiveDna(activeVersion);
        setDraftDna(latestDraft);
        setDnaForm(dnaVersionToForm(latestDraft || activeVersion));
      } catch (error) {
        if (active) setDnaError(error instanceof Error ? error.message : "خطا در دریافت Business DNA.");
      } finally {
        if (active) setDnaLoading(false);
      }
    }
    void loadBusinessDna();
    return () => { active = false; };
  }, []);

  const dnaPayload = () => ({
    valueProposition: dnaForm.valueProposition,
    targetAudiences: lines(dnaForm.targetAudiences),
    offerings: lines(dnaForm.offerings),
    positioning: dnaForm.positioning,
    brandVoice: dnaForm.brandVoice,
    growthDrivers: lines(dnaForm.growthDrivers),
  });

  const saveDnaDraft = async () => {
    setDnaSaving(true);
    setDnaError("");
    try {
      const response = await apiFetch(
        draftDna ? `/api/business-dna/versions/${draftDna.id}` : "/api/business-dna/versions",
        {
          method: draftDna ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dnaPayload()),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setDraftDna(data.version);
      setDnaForm(dnaVersionToForm(data.version));
      showNotice(`نسخه پیش‌نویس ${data.version.versionNumber} ذخیره شد.`);
    } catch (error) {
      setDnaError(error instanceof Error ? error.message : "ذخیره Business DNA انجام نشد.");
    } finally {
      setDnaSaving(false);
    }
  };

  const activateDnaDraft = async () => {
    if (!draftDna) return;
    setDnaSaving(true);
    setDnaError("");
    try {
      const response = await apiFetch(`/api/business-dna/versions/${draftDna.id}/activate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setActiveDna(data.version);
      setDraftDna(null);
      setDnaForm(dnaVersionToForm(data.version));
      await loadBusinessContext();
      showNotice(`نسخه ${data.version.versionNumber} فعال شد.`);
    } catch (error) {
      setDnaError(error instanceof Error ? error.message : "فعال‌سازی نسخه انجام نشد.");
    } finally {
      setDnaSaving(false);
    }
  };

  const saveBusinessProfile = async () => {
    setProfileSaving(true);
    setProfileError("");
    try {
      const response = await apiFetch("/api/business-profile", {
        method: profileExists ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(businessProfile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setBusinessProfile({
        name: data.profile.name || "",
        website: data.profile.website || "",
        industry: data.profile.industry || "",
        description: data.profile.description || "",
        country: data.profile.country || "",
        city: data.profile.city || "",
      });
      setProfileExists(true);
      await loadBusinessContext();
      showNotice("اطلاعات پایه کسب‌وکار ذخیره شد.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "ذخیره اطلاعات انجام نشد."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const connectedCount =
    sources.filter((source) => source.connected).length;

  const dnaScore = Math.round(
    sources.reduce(
      (total, source) =>
        total + (source.connected ? source.quality : 0),
      0
    ) / sources.length
  );

  const displayedDna = draftDna || activeDna;
  const intelligence = defaultIntelligence.map((item, index) => {
    const persistedValues = [
      displayedDna?.valueProposition,
      displayedDna?.targetAudiences.join("، "),
      displayedDna?.brandVoice,
      displayedDna?.positioning,
      displayedDna?.offerings.join("، "),
      displayedDna?.growthDrivers.join("، "),
    ];
    return { ...item, value: persistedValues[index] || item.value };
  });

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2300);
  };

  const toggleSource = (id: SourceId) => {
    setSources((current) =>
      current.map((source) =>
        source.id === id
          ? {
              ...source,
              connected: !source.connected,
              quality: source.connected
                ? 0
                : source.quality || 65,
            }
          : source
      )
    );
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#05070a] text-white"
    >
      {isDemo && demoBrain && (
        <section className="mx-auto max-w-[1550px] px-8 pt-6">
          <div className="rounded-[28px] border border-violet-300/15 bg-violet-500/[0.045] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-violet-200">
                  Business Brain — نسخه دمو
                </div>

                <h2 className="mt-1 text-xl font-semibold">
                  {demoBusiness.name}
                </h2>
              </div>

              <div className="text-left">
                <div className="text-4xl font-bold">
                  {demoBrain.score}٪
                </div>

                <div className="text-sm text-white/35">
                  امتیاز شناخت کسب‌وکار
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {demoBrain.identity.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"
                >
                  <div className="text-sm font-semibold text-cyan-200">
                    {item.title}
                  </div>

                  <p className="mt-2 text-sm leading-7 text-white/50">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-[24px] border border-emerald-300/10 bg-emerald-500/[0.035] p-5">
                <div className="text-sm font-semibold text-emerald-200">
                  فرصت‌های رشد شناسایی‌شده
                </div>

                <div className="mt-4 space-y-3">
                  {demoBrain.opportunities.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">
                          {item.title}
                        </div>

                        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                          اثر {item.impact}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-7 text-white/45">
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-300/10 bg-amber-500/[0.035] p-5">
                <div className="text-sm font-semibold text-amber-200">
                  ریسک‌های مهم
                </div>

                <div className="mt-4 space-y-3">
                  {demoBrain.risks.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                    >
                      <div className="text-sm font-semibold">
                        {item.title}
                      </div>

                      <p className="mt-2 text-sm leading-7 text-white/45">
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05070a]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              to={withDemo("/dashboard")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.03] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight size={19} />
            </Link>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 shadow-[0_0_35px_rgba(139,92,246,0.15)]">
              <Brain
                size={27}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مغز هوشمند کسب‌وکار
              </h1>

              <p className="mt-1 text-sm text-white/50">
                لایه شناخت، یادگیری و تصمیم‌گیری Loadder
              </p>
            </div>
          </div>

          <div
            dir="ltr"
            className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-xl font-bold text-transparent"
          >
            Loadder Brain
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">

        <section className="mb-6 rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">مشخصات پایه کسب‌وکار</h2>
              <p className="mt-1 text-sm text-white/45">
                هویت اصلی این فضای کاری؛ پایه ماژول‌های هوشمند آینده.
              </p>
            </div>
            <span className="rounded-full border border-cyan-300/15 bg-cyan-500/[0.06] px-3 py-1.5 text-xs text-cyan-200">
              {profileExists ? "ذخیره‌شده" : "تکمیل‌نشده"}
            </span>
          </div>

          {profileLoading ? (
            <div className="mt-6 text-sm text-white/45">در حال دریافت اطلاعات…</div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ProfileField
                label="نام کسب‌وکار"
                value={businessProfile.name}
                required
                onChange={(name) => setBusinessProfile((current) => ({ ...current, name }))}
              />
              <ProfileField
                label="وب‌سایت"
                value={businessProfile.website}
                placeholder="https://example.com"
                dir="ltr"
                onChange={(website) => setBusinessProfile((current) => ({ ...current, website }))}
              />
              <ProfileField
                label="حوزه فعالیت"
                value={businessProfile.industry}
                onChange={(industry) => setBusinessProfile((current) => ({ ...current, industry }))}
              />
              <ProfileField
                label="کشور"
                value={businessProfile.country}
                onChange={(country) => setBusinessProfile((current) => ({ ...current, country }))}
              />
              <ProfileField
                label="شهر"
                value={businessProfile.city}
                onChange={(city) => setBusinessProfile((current) => ({ ...current, city }))}
              />
              <label className="md:col-span-2 xl:col-span-3">
                <span className="text-sm text-white/55">توضیح کوتاه کسب‌وکار</span>
                <textarea
                  value={businessProfile.description}
                  maxLength={4000}
                  rows={3}
                  onChange={(event) => setBusinessProfile((current) => ({ ...current, description: event.target.value }))}
                  className="mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/30"
                />
              </label>
            </div>
          )}

          {profileError && <p className="mt-4 text-sm text-red-300">{profileError}</p>}
          {!profileLoading && (
            <button
              type="button"
              disabled={profileSaving || businessProfile.name.trim().length < 2}
              onClick={() => void saveBusinessProfile()}
              className="mt-5 rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileSaving ? "در حال ذخیره…" : profileExists ? "ذخیره تغییرات" : "ایجاد مشخصات کسب‌وکار"}
            </button>
          )}
        </section>

        <section className="mb-6 rounded-[30px] border border-cyan-300/10 bg-cyan-500/[0.035] p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">شناخت مشترک Loadder</h2>
              <p className="mt-1 text-sm text-white/45">
                نسخه‌ای ثابت از اطلاعات کسب‌وکار، هویت برند و مسیر رشد شما.
              </p>
            </div>
            {!contextLoading && (
              <span className={`rounded-full border px-3 py-1.5 text-xs ${
                !activeContext
                  ? "border-white/10 bg-white/[0.04] text-white/45"
                  : contextStale
                    ? "border-amber-300/20 bg-amber-500/[0.08] text-amber-200"
                    : "border-emerald-300/20 bg-emerald-500/[0.08] text-emerald-200"
              }`}>
                {!activeContext ? "هنوز فعال نشده" : contextStale ? "نیازمند به‌روزرسانی" : "به‌روز"}
              </span>
            )}
          </div>

          {contextLoading ? (
            <p className="mt-5 text-sm text-white/40">در حال بررسی وضعیت…</p>
          ) : (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ContextStatus label="نسخه فعال" value={activeContext ? String(activeContext.versionNumber) : "ندارد"} />
                <ContextStatus
                  label="شناخت کسب‌وکار"
                  value={activeContext ? `نسخه ${activeContext.sourceManifest.businessDna.versionNumber}` : "—"}
                />
                <ContextStatus
                  label="برند بوک"
                  value={activeContext ? `نسخه ${activeContext.sourceManifest.brandBook.versionNumber}` : "—"}
                />
                <ContextStatus label="نسخه پیشنهادی" value={contextDraft ? String(contextDraft.versionNumber) : "ندارد"} />
              </div>

              {contextStale && (
                <div className="mt-4 rounded-2xl border border-amber-300/10 bg-amber-500/[0.05] p-4 text-sm text-amber-100/75">
                  اطلاعات زیر بعد از فعال‌سازی نسخه فعلی تغییر کرده است: {contextStaleReasons.map((reason) => ({
                    BUSINESS_PROFILE_CHANGED: "مشخصات کسب‌وکار",
                    BUSINESS_DNA_CHANGED: "شناخت کسب‌وکار",
                    BRAND_BOOK_CHANGED: "برند بوک",
                  })[reason] || reason).join("، ")}
                </div>
              )}

              {contextError && <p className="mt-4 text-sm text-red-300">{contextError}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={contextSaving}
                  onClick={() => void createContextDraft()}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-500/[0.08] px-5 py-3 text-sm text-cyan-100 disabled:opacity-50"
                >
                  {contextSaving ? "در حال آماده‌سازی…" : activeContext ? "بازسازی نسخه پیشنهادی" : "آماده‌سازی نسخه پیشنهادی"}
                </button>
                {contextDraft && (
                  <button
                    type="button"
                    disabled={contextSaving}
                    onClick={() => void activateContextDraft()}
                    className="rounded-xl border border-emerald-300/20 bg-emerald-500/[0.08] px-5 py-3 text-sm text-emerald-100 disabled:opacity-50"
                  >
                    فعال‌سازی نسخه {contextDraft.versionNumber}
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* HERO */}

        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#090c13] p-8">
          <div className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-violet-600/[0.12] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-28 right-[15%] h-[360px] w-[360px] rounded-full bg-cyan-500/[0.07] blur-[130px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/10 px-4 py-2">
                <Sparkle
                  size={15}
                  weight="fill"
                  className="text-violet-300"
                />

                <span className="text-sm text-violet-200">
                  هوشمندی کسب‌وکار
                </span>
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                قبل از اینکه AI برای کسب‌وکار تصمیم بگیرد،
                <span className="text-violet-300">
                  {" "}
                  باید واقعاً آن کسب‌وکار را بشناسد.
                </span>
              </h2>

              <p className="mt-4 max-w-4xl text-base leading-9 text-white/55">
                Business Brain اطلاعات برند، وب‌سایت، محصولات،
                CRM، Social، Ads، فروش و اسناد را به یک Business
                DNA واحد تبدیل می‌کند. تمام متخصص‌های AI در آینده
                از همین مغز مشترک تغذیه می‌شوند.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "تحلیل خودکار وب‌سایت در مرحله اتصال AI فعال می‌شود."
                    )
                  }
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-semibold"
                >
                  <LinkSimple size={17} />
                  تحلیل وب‌سایت
                </button>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "آپلود فایل و استخراج Business DNA در مرحله بعد فعال می‌شود."
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 py-3.5 text-sm"
                >
                  <UploadSimple size={17} />
                  آپلود اطلاعات برند
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab("dna")
                  }
                  className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 py-3.5 text-sm"
                >
                  <PencilSimple size={17} />
                  تکمیل دستی
                </button>
              </div>
            </div>

            <DNAVisual
              score={dnaScore}
              connected={connectedCount}
              total={sources.length}
            />
          </div>
        </section>

        {/* QUICK STATUS */}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            title="Business DNA"
            value={`${dnaScore}٪`}
            subtitle="سطح شناخت فعلی"
            icon={Brain}
          />

          <StatusCard
            title="منابع متصل"
            value={`${connectedCount}/${sources.length}`}
            subtitle="منبع داده"
            icon={LinkSimple}
          />

          <StatusCard
            title="فرصت‌های رشد"
            value="۳"
            subtitle="فرصت شناسایی‌شده"
            icon={Lightbulb}
          />

          <StatusCard
            title="ریسک‌های مهم"
            value="۳"
            subtitle="نیازمند توجه"
            icon={ShieldWarning}
          />
        </section>

        {/* TABS */}

        <section className="mt-8">
          <div className="grid gap-3 md:grid-cols-4">
            <TabButton
              active={activeTab === "dna"}
              onClick={() => setActiveTab("dna")}
              icon={Brain}
              title="Business DNA"
            />

            <TabButton
              active={activeTab === "sources"}
              onClick={() => setActiveTab("sources")}
              icon={LinkSimple}
              title="منابع داده"
            />

            <TabButton
              active={activeTab === "opportunities"}
              onClick={() => setActiveTab("opportunities")}
              icon={TrendUp}
              title="فرصت‌های رشد"
            />

            <TabButton
              active={activeTab === "risks"}
              onClick={() => setActiveTab("risks")}
              icon={WarningCircle}
              title="ریسک‌ها"
            />
          </div>
        </section>

        {/* BUSINESS DNA */}

        {activeTab === "dna" && (
          <section className="mt-5">
            <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    شناخت فعلی Loadder از کسب‌وکار
                  </h2>

                  <p className="mt-1 text-sm text-white/45">
                    این داده‌ها بعداً توسط AI استخراج، به‌روزرسانی و
                    اعتبارسنجی می‌شوند.
                  </p>
                </div>

                <span className="rounded-full border border-violet-300/15 bg-violet-500/10 px-4 py-2 text-sm text-violet-200">
                  {displayedDna
                    ? `DNA Version ${displayedDna.versionNumber} — ${displayedDna.status === "active" ? "فعال" : "پیش‌نویس"}`
                    : "DNA بدون نسخه"}
                </span>
              </div>

              <div className="mt-6 rounded-[24px] border border-violet-300/10 bg-violet-500/[0.035] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">ویرایش دستی Business DNA</h3>
                    <p className="mt-1 text-sm text-white/40">
                      هر خط در فهرست‌ها به‌عنوان یک مورد مستقل ذخیره می‌شود.
                    </p>
                  </div>
                  {activeDna && (
                    <span className="text-xs text-emerald-300">
                      نسخه فعال: {activeDna.versionNumber}
                    </span>
                  )}
                </div>

                {dnaLoading ? (
                  <div className="mt-5 text-sm text-white/45">در حال دریافت نسخه‌ها…</div>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <DnaEditorField
                      label="ارزش پیشنهادی"
                      value={dnaForm.valueProposition}
                      onChange={(valueProposition) => setDnaForm((current) => ({ ...current, valueProposition }))}
                    />
                    <DnaEditorField
                      label="مخاطبان اصلی"
                      value={dnaForm.targetAudiences}
                      onChange={(targetAudiences) => setDnaForm((current) => ({ ...current, targetAudiences }))}
                    />
                    <DnaEditorField
                      label="لحن برند"
                      value={dnaForm.brandVoice}
                      onChange={(brandVoice) => setDnaForm((current) => ({ ...current, brandVoice }))}
                    />
                    <DnaEditorField
                      label="جایگاه بازار"
                      value={dnaForm.positioning}
                      onChange={(positioning) => setDnaForm((current) => ({ ...current, positioning }))}
                    />
                    <DnaEditorField
                      label="محصولات و سرویس‌ها"
                      value={dnaForm.offerings}
                      onChange={(offerings) => setDnaForm((current) => ({ ...current, offerings }))}
                    />
                    <DnaEditorField
                      label="محرک‌های رشد"
                      value={dnaForm.growthDrivers}
                      onChange={(growthDrivers) => setDnaForm((current) => ({ ...current, growthDrivers }))}
                    />
                  </div>
                )}

                {dnaError && <p className="mt-4 text-sm text-red-300">{dnaError}</p>}
                {!dnaLoading && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={dnaSaving || !profileExists}
                      onClick={() => void saveDnaDraft()}
                      className="rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dnaSaving ? "در حال ذخیره…" : draftDna ? "ذخیره پیش‌نویس" : "ایجاد نسخه جدید"}
                    </button>
                    {draftDna && (
                      <button
                        type="button"
                        disabled={dnaSaving}
                        onClick={() => void activateDnaDraft()}
                        className="rounded-xl border border-emerald-300/20 bg-emerald-500/[0.08] px-5 py-3 text-sm text-emerald-200 disabled:opacity-50"
                      >
                        فعال‌سازی نسخه {draftDna.versionNumber}
                      </button>
                    )}
                    {!profileExists && (
                      <span className="self-center text-xs text-amber-200/70">
                        ابتدا مشخصات پایه کسب‌وکار را ایجاد کنید.
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {intelligence.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="rounded-[24px] border border-white/[0.07] bg-black/20 p-5 transition hover:border-violet-300/20 hover:bg-white/[0.035]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10">
                        <Icon
                          size={21}
                          weight="duotone"
                          className="text-cyan-300"
                        />
                      </div>

                      <h3 className="mt-4 text-base font-semibold">
                        {item.title}
                      </h3>

                      <p className="mt-2 text-sm leading-8 text-white/50">
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
                <div className="flex items-center gap-3">
                  <ChartLineUp
                    size={23}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <div>
                    <h2 className="text-xl font-semibold">
                      عمق شناخت داده
                    </h2>

                    <p className="mt-1 text-sm text-white/45">
                      هرچه داده بیشتر و معتبرتر باشد، تصمیم AI دقیق‌تر می‌شود.
                    </p>
                  </div>
                </div>

                <div className="mt-7 space-y-5">
                  <KnowledgeBar
                    title="هویت برند"
                    value={92}
                  />

                  <KnowledgeBar
                    title="شناخت مشتری"
                    value={73}
                  />

                  <KnowledgeBar
                    title="محصول و خدمات"
                    value={78}
                  />

                  <KnowledgeBar
                    title="داده عملکرد"
                    value={46}
                  />

                  <KnowledgeBar
                    title="داده فروش"
                    value={28}
                  />
                </div>
              </div>

              <div className="rounded-[30px] border border-violet-400/15 bg-violet-500/[0.05] p-7">
                <div className="flex items-center gap-3">
                  <Sparkle
                    size={22}
                    weight="fill"
                    className="text-violet-300"
                  />

                  <h2 className="text-xl font-semibold">
                    Insight مغز Loadder
                  </h2>
                </div>

                <p className="mt-5 text-base leading-9 text-white/60">
                  شناخت برند در وضعیت مناسبی قرار دارد؛ اما برای تصمیم‌های
                  دقیق رشد، داده واقعی Social، Ads و Sales هنوز کم است.
                  بیشترین افزایش کیفیت Business Brain از اتصال همین سه منبع
                  حاصل خواهد شد.
                </p>

                <button
                  type="button"
                  onClick={() => setActiveTab("sources")}
                  className="mt-6 flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-5 py-3 text-sm"
                >
                  <Plus size={16} />
                  تکمیل منابع داده
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SOURCES */}

        {activeTab === "sources" && (
          <section className="mt-5 rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
            <div>
              <h2 className="text-xl font-semibold">
                منابع داده Business Brain
              </h2>

              <p className="mt-1 text-sm text-white/45">
                هر ماژول می‌تواند هم اطلاعات دریافت کند و هم دانش جدید
                به Business Brain برگرداند.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => {
                const Icon = source.icon;

                return (
                  <div
                    key={source.id}
                    className={`rounded-[24px] border p-5 transition ${
                      source.connected
                        ? "border-emerald-400/15 bg-emerald-500/[0.035]"
                        : "border-white/[0.07] bg-black/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                        <Icon
                          size={23}
                          weight="duotone"
                          className="text-cyan-300"
                        />
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          source.connected
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-white/[0.05] text-white/40"
                        }`}
                      >
                        {source.connected
                          ? "متصل"
                          : "متصل نیست"}
                      </span>
                    </div>

                    <h3 className="mt-5 text-base font-semibold">
                      {source.title}
                    </h3>

                    <p className="mt-2 min-h-[56px] text-sm leading-7 text-white/45">
                      {source.description}
                    </p>

                    {source.connected && (
                      <>
                        <div className="mt-5 flex items-center justify-between text-sm">
                          <span className="text-white/40">
                            کیفیت داده
                          </span>

                          <span>
                            {source.quality}٪
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
                            style={{
                              width: `${source.quality}%`,
                            }}
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        toggleSource(source.id)
                      }
                      className={`mt-5 w-full rounded-xl border px-4 py-3 text-sm transition ${
                        source.connected
                          ? "border-red-300/10 bg-red-500/[0.04] text-red-200"
                          : "border-violet-300/15 bg-violet-500/[0.07] text-violet-200"
                      }`}
                    >
                      {source.connected
                        ? "قطع اتصال آزمایشی"
                        : "اتصال آزمایشی"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* OPPORTUNITIES */}

        {activeTab === "opportunities" && (
          <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
              <div className="flex items-center gap-3">
                <Lightbulb
                  size={24}
                  weight="duotone"
                  className="text-amber-300"
                />

                <div>
                  <h2 className="text-xl font-semibold">
                    فرصت‌های رشد
                  </h2>

                  <p className="mt-1 text-sm text-white/45">
                    فرصت‌هایی که Business Brain از ترکیب داده‌ها پیدا می‌کند.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {opportunities.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() =>
                      showNotice(
                        `فرصت «${item.title}» انتخاب شد.`
                      )
                    }
                    className="w-full rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-right transition hover:border-violet-300/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                          {index + 1}
                        </div>

                        <div>
                          <h3 className="text-base font-semibold">
                            {item.title}
                          </h3>

                          <p className="mt-2 text-sm leading-7 text-white/50">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-300">
                        اثر {item.impact}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <aside className="rounded-[30px] border border-violet-400/15 bg-violet-500/[0.05] p-7">
              <Brain
                size={30}
                weight="duotone"
                className="text-violet-300"
              />

              <h2 className="mt-5 text-xl font-semibold">
                Growth Opportunity Engine
              </h2>

              <p className="mt-4 text-base leading-9 text-white/55">
                در نسخه نهایی، فرصت‌ها فقط نمایش داده نمی‌شوند؛ هر فرصت
                مستقیماً می‌تواند به Content Studio، Ads، CRM یا Automation
                ارسال شود و به Action تبدیل شود.
              </p>

              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "ساخت Action Plan با AI در مرحله بعد فعال می‌شود."
                  )
                }
                className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-semibold"
              >
                <Lightning size={17} weight="fill" />
                ساخت برنامه اقدام
              </button>
            </aside>
          </section>
        )}

        {/* RISKS */}

        {activeTab === "risks" && (
          <section className="mt-5 grid gap-4 md:grid-cols-3">
            {risks.map((risk) => (
              <div
                key={risk.title}
                className="rounded-[26px] border border-amber-300/10 bg-amber-500/[0.035] p-6"
              >
                <WarningCircle
                  size={24}
                  weight="duotone"
                  className="text-amber-300"
                />

                <h3 className="mt-5 text-lg font-semibold">
                  {risk.title}
                </h3>

                <p className="mt-3 text-sm leading-8 text-white/50">
                  {risk.description}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* BOTTOM AI */}

        <section className="mt-8 rounded-[32px] border border-violet-400/20 bg-gradient-to-l from-violet-500/[0.09] via-[#0a0d13] to-cyan-500/[0.05] p-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="flex items-center gap-3">
                <Brain
                  size={27}
                  weight="duotone"
                  className="text-violet-300"
                />

                <h2 className="text-2xl font-bold">
                  Loadder Business Intelligence
                </h2>
              </div>

              <p className="mt-4 max-w-4xl text-base leading-9 text-white/60">
                هرچه Loadder بیشتر درباره برند، مشتری، محصول و عملکرد
                کسب‌وکار بداند، Content، Ads، CRM، Analytics، KPI و
                Automation خروجی دقیق‌تری خواهند داشت. این صفحه قرار است
                منبع حقیقت مشترک تمام AI Agentهای آینده Loadder باشد.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "بازسازی Business DNA با AI در مرحله اتصال مدل فعال می‌شود."
                )
              }
              className="flex min-h-[120px] items-center justify-center gap-3 rounded-[24px] border border-violet-300/15 bg-violet-500/[0.07] px-6 text-base transition hover:bg-violet-500/[0.12]"
            >
              <Sparkle size={21} weight="fill" />
              بازسازی Business DNA با AI
            </button>
          </div>
        </section>
      </div>

      {notice && (
        <div className="fixed bottom-7 left-7 z-[100] max-w-md rounded-2xl border border-violet-300/20 bg-[#11141c]/95 px-5 py-4 text-sm shadow-2xl backdrop-blur-xl">
          {notice}
        </div>
      )}
    </main>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  dir = "rtl",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  dir?: "rtl" | "ltr";
}) {
  return (
    <label>
      <span className="text-sm text-white/55">
        {label}{required ? " *" : ""}
      </span>
      <input
        dir={dir}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-300/30"
      />
    </label>
  );
}

function ContextStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="text-xs text-white/35">{label}</div>
      <div className="mt-2 text-sm font-medium text-white/75">{value}</div>
    </div>
  );
}

function DnaEditorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-white/55">{label}</span>
      <textarea
        value={value}
        rows={3}
        maxLength={4000}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none transition focus:border-violet-300/30"
      />
    </label>
  );
}

function DNAVisual({
  score,
  connected,
  total,
}: {
  score: number;
  connected: number;
  total: number;
}) {
  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-black/20 p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/45">
          Business DNA Score
        </span>

        <CheckCircle
          size={20}
          className="text-emerald-300"
        />
      </div>

      <div className="relative mx-auto mt-5 flex h-[205px] w-[205px] items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              #8b5cf6 0deg,
              #22d3ee ${score * 3.6}deg,
              rgba(255,255,255,0.06) ${score * 3.6}deg
            )`,
          }}
        />

        <div className="absolute inset-[18px] rounded-full bg-[#0a0d13]" />

        <div className="relative z-10 text-center">
          <Brain
            size={35}
            weight="duotone"
            className="mx-auto text-violet-300"
          />

          <div className="mt-2 text-4xl font-bold">
            {score}٪
          </div>

          <div className="mt-1 text-sm text-white/40">
            شناخت فعلی
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
        <span className="text-sm text-white/45">
          منابع متصل
        </span>

        <span className="text-sm font-semibold">
          {connected} از {total}
        </span>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#0a0d13] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/45">
          {title}
        </span>

        <Icon
          size={21}
          weight="duotone"
          className="text-violet-300"
        />
      </div>

      <div className="mt-4 text-3xl font-semibold">
        {value}
      </div>

      <div className="mt-2 text-sm text-white/35">
        {subtitle}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-3 rounded-[20px] border px-5 py-4 text-sm transition ${
        active
          ? "border-violet-400/40 bg-violet-500/10 text-white"
          : "border-white/[0.07] bg-[#0a0d13] text-white/50 hover:bg-white/[0.04]"
      }`}
    >
      <Icon
        size={19}
        weight="duotone"
        className={
          active
            ? "text-cyan-300"
            : "text-white/35"
        }
      />

      {title}
    </button>
  );
}

function KnowledgeBar({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/55">
          {title}
        </span>

        <span>{value}٪</span>
      </div>

      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-400 to-cyan-300"
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}
