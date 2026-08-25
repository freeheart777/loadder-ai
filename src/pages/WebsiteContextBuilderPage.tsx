import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Globe, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { sectionFor } from "../lib/landingConversion";
import type { LandingBlueprint } from "../components/landing/TrustedLandingRenderer";

type ContextSnapshot = {
  identity?: {
    businessName?: string | null;
    legalName?: string | null;
    industry?: string | null;
    subindustry?: string | null;
    location?: { country?: string | null; city?: string | null };
    website?: string | null;
    description?: string | null;
  };
  strategy?: {
    valueProposition?: string | null;
    positioning?: string | null;
    differentiators?: string[];
    goals?: string[];
    growthDrivers?: string[];
  };
  audiences?: { targetAudiences?: string[]; audienceProblems?: string[] };
  offerings?: Array<{ name?: string; description?: string } | string>;
  brand?: {
    personality?: string[];
    voice?: string | null;
    tone?: string | null;
    messagingPrinciples?: string[];
    promises?: string[];
  };
  visual?: {
    direction?: string | null;
    colors?: { primary?: string[]; secondary?: string[] };
    typography?: Record<string, unknown>;
    imageryDirection?: string | null;
  };
};

type ContextVersion = {
  id: string;
  status: string;
  snapshot?: ContextSnapshot;
};

type Preset = {
  presetId: string;
  websiteType: string;
  pages: Array<{
    pageType: string;
    name: string;
    path: string;
    sections: string[];
    navigationVisible: boolean;
    navigationOrder: number;
  }>;
};

type Theme = LandingBlueprint["designTokens"];

const theme: Theme = {
  font: "brand",
  primaryColor: "#7c3aed",
  secondaryColor: "#17122b",
  backgroundColor: "#070512",
  foregroundColor: "#ffffff",
  mutedColor: "#b8b2c7",
  radius: "lg",
  spacingDensity: "comfortable",
  buttonStyle: "solid",
  containerWidth: "standard",
};

const validHttps = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.hostname.endsWith(".example.com") && url.hostname !== "example.com";
  } catch {
    return false;
  }
};

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "business-site";
};

const pickPreset = (industry = "") => {
  const value = industry.toLowerCase();
  if (/(medical|clinic|health|درمان|پزشک|پزشکی)/.test(value)) return "MEDICAL";
  if (/(legal|law|حقوق|وکیل)/.test(value)) return "LEGAL";
  if (/(catalog|retail|فروش|فروشگاه)/.test(value)) return "CATALOG";
  if (/(consult|professional|مشاوره|خدمات حرفه)/.test(value)) return "PROFESSIONAL_SERVICE";
  return "CORPORATE";
};

async function json(path: string, init?: RequestInit) {
  const response = await apiFetch(path, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.code || data.message || "خطا");
  return data;
}

const post = (path: string, body: unknown) =>
  json(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });

function contextBlueprint(
  pageName: string,
  sections: string[],
  context: ContextSnapshot,
  ctaTarget: string,
): LandingBlueprint {
  const identity = context.identity || {};
  const strategy = context.strategy || {};
  const audiences = context.audiences || {};
  const audience = audiences.targetAudiences?.slice(0, 2).join("، ") || "مخاطبان کسب‌وکار";
  const offer = strategy.valueProposition || identity.description || "معرفی روشن خدمات و ارزش کسب‌وکار";
  const goal = strategy.goals?.[0] || strategy.positioning || "حضور پایدار و معتبر کسب‌وکار";

  return {
    goal,
    offer,
    audienceSummary: audience,
    primaryCta: {
      label: "شروع گفتگو",
      type: "EXTERNAL_URL",
      target: ctaTarget,
    },
    secondaryCta: null,
    seo: {
      title: identity.businessName || pageName,
      description: identity.description || offer,
    },
    socialPreview: {
      title: identity.businessName || pageName,
      description: offer,
      imageAssetId: null,
    },
    sections: sections.map((componentId, index) => {
      const section = sectionFor(componentId, index);
      return section.props.primaryCta && typeof section.props.primaryCta === "object"
        ? {
            ...section,
            props: {
              ...section.props,
              primaryCta: {
                ...(section.props.primaryCta as Record<string, unknown>),
                type: "EXTERNAL_URL",
                target: ctaTarget,
              },
            },
          }
        : section;
    }),
    designTokens: theme,
    tracking: { enabledActions: ["LANDING_VISIT", "CTA_CLICK"] },
    accessibility: { mainLabel: identity.businessName || pageName },
  };
}

export default function WebsiteContextBuilderPage() {
  const navigate = useNavigate();
  const [context, setContext] = useState<ContextVersion | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("business-site");
  const [presetId, setPresetId] = useState("CORPORATE");
  const [ctaTarget, setCtaTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void Promise.all([json("/api/business-context/"), json("/api/websites/presets")])
      .then(([ctx, presetData]) => {
        const active = ctx.activeContext as ContextVersion | null;
        setContext(active);
        setPresets(presetData.presets || []);
        const snapshot = active?.snapshot;
        const businessName = snapshot?.identity?.businessName || "";
        setName(businessName || "وب‌سایت جدید");
        setSlug(slugify(businessName));
        setPresetId(pickPreset(snapshot?.identity?.industry || ""));
        const website = snapshot?.identity?.website || "";
        if (validHttps(website)) setCtaTarget(website);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "خطا در دریافت Business Context"));
  }, []);

  const snapshot = context?.snapshot;
  const stale = Boolean(context && context.status !== "active");
  const preset = useMemo(() => presets.find((item) => item.presetId === presetId), [presets, presetId]);
  const offerings = (snapshot?.offerings || [])
    .map((item) => (typeof item === "string" ? item : item.name || item.description || ""))
    .filter(Boolean)
    .slice(0, 4);
  const audiences = snapshot?.audiences?.targetAudiences?.slice(0, 4) || [];
  const differentiators = snapshot?.strategy?.differentiators?.slice(0, 4) || [];

  async function createWebsite() {
    if (!context || !snapshot || !preset) {
      setMessage("Business Context فعال و یک preset معتبر لازم است.");
      return;
    }
    if (stale) {
      setMessage("این Context فعال نیست؛ ابتدا Business Context را به‌روز کنید.");
      return;
    }
    if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage("نام و slug را بررسی کنید.");
      return;
    }
    if (!validHttps(ctaTarget)) {
      setMessage("برای دکمه اقدام، یک نشانی HTTPS واقعی وارد کنید.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const website = (
        await post("/api/websites", {
          name: name.trim(),
          slug,
          websiteType: preset.websiteType,
          presetId: preset.presetId,
          businessContextVersionId: context.id,
          locale: "fa-IR",
          direction: "rtl",
          theme,
        })
      ).website;

      for (const page of preset.pages) {
        const created = (
          await post(`/api/websites/${website.id}/pages`, {
            pageType: page.pageType,
            name: page.name,
            path: page.path,
            navigationVisible: page.navigationVisible,
            navigationOrder: page.navigationOrder,
          })
        ).page;
        await post(`/api/website-pages/${created.id}/blueprints`, {
          blueprint: contextBlueprint(page.name, page.sections, snapshot, ctaTarget),
        });
      }

      navigate(`/dashboard/websites/${website.id}/edit`, { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ساخت وب‌سایت انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (!context) {
    return (
      <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
        <section className="mx-auto max-w-3xl p-6 pt-16">
          <Link to="/dashboard/intent" className="mb-8 inline-flex min-h-11 items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight /> بازگشت
          </Link>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
            <Sparkle className="mb-4 text-violet-300" size={28} />
            <h1 className="text-3xl font-bold">اول کسب‌وکار را می‌شناسیم، بعد سایت را می‌سازیم.</h1>
            <p className="mt-4 leading-8 text-white/65">
              برای ساخت سایت، Loadder باید Business Context فعال داشته باشد. این همان اطلاعاتی است که قبلاً درباره کسب‌وکارت ساخته‌ایم؛ قرار نیست دوباره از صفر واردشان کنی.
            </p>
            <Link to="/dashboard/onboarding?returnTo=%2Fdashboard%2Fwebsites%2Fnew" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-600 px-6 font-bold">
              تکمیل شناخت کسب‌وکار
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
      <section className="mx-auto max-w-6xl space-y-5 p-6 pb-16 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/dashboard/websites" className="inline-flex min-h-11 items-center gap-2 text-white/70 hover:text-white">
            <ArrowRight /> بازگشت
          </Link>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">Business Context فعال</span>
        </div>

        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-white/[0.03] to-cyan-500/10 p-7 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-200"><Sparkle size={28} /></div>
            <div>
              <p className="text-sm text-violet-200">ساخت سایت بر اساس مغز کسب‌وکار</p>
              <h1 className="mt-1 text-3xl font-black md:text-4xl">لازم نیست کسب‌وکارت را دوباره تعریف کنی.</h1>
              <p className="mt-3 max-w-3xl leading-8 text-white/65">Loadder از Business Profile، DNA، Brand Book و Context موجود استفاده می‌کند و فقط چیزهایی را از تو می‌پرسد که واقعاً هنوز تصمیم‌گیری نشده‌اند.</p>
            </div>
          </div>
        </header>

        {stale && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">
            <WarningCircle size={24} />
            <div><strong>Context نیاز به بازسازی دارد.</strong><p className="mt-1 text-sm text-amber-100/70">برای جلوگیری از ساخت سایت با اطلاعات قدیمی، ابتدا Business Context را به‌روز کن.</p></div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-3xl border border-white/10 bg-black/20 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-sm text-cyan-200">منبع حقیقت</p><h2 className="mt-1 text-2xl font-bold">این سایت از چه کسب‌وکاری ساخته می‌شود؟</h2></div>
              <Globe className="text-cyan-200" size={28} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ContextItem label="نام کسب‌وکار" value={snapshot?.identity?.businessName || "ثبت نشده"} />
              <ContextItem label="صنعت" value={snapshot?.identity?.industry || "ثبت نشده"} />
              <ContextItem label="ارزش پیشنهادی" value={snapshot?.strategy?.valueProposition || "هنوز مشخص نشده"} wide />
              <ContextItem label="جایگاه‌یابی" value={snapshot?.strategy?.positioning || "هنوز مشخص نشده"} wide />
              <ContextItem label="مخاطب هدف" value={audiences.join("، ") || "هنوز مشخص نشده"} wide />
              <ContextItem label="تمایزها" value={differentiators.join("، ") || "هنوز مشخص نشده"} wide />
            </div>
            {(offerings.length > 0 || snapshot?.visual?.direction) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ContextItem label="پیشنهادها / خدمات" value={offerings.join("، ") || "ثبت نشده"} />
                <ContextItem label="جهت بصری برند" value={snapshot?.visual?.direction || "طبق Brand Book"} />
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-black/20 p-6">
            <p className="text-sm text-violet-200">تنها تصمیم‌های لازم</p>
            <h2 className="mt-1 text-2xl font-bold">سایتت را آماده کنیم</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm">نام سایت<input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 p-3" /></label>
              <label className="block text-sm">آدرس داخلی سایت<input dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().trim())} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left" /><span className="mt-1 block text-xs text-white/40">/dashboard/websites/{slug || "business-site"}</span></label>
              <label className="block text-sm">الگوی اولیه<select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 p-3">{presets.map((item) => <option key={item.presetId} value={item.presetId} className="bg-[#090714]">{item.presetId}</option>)}</select></label>
              <label className="block text-sm">مقصد دکمه اقدام<input type="url" dir="ltr" value={ctaTarget} onChange={(e) => setCtaTarget(e.target.value.trim())} placeholder="https://your-real-domain.com" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left" /><span className="mt-1 block text-xs text-white/40">اگر سایت فعلی در Context ثبت شده باشد، همان را پیشنهاد می‌دهیم؛ مقصد ساختگی تولید نمی‌کنیم.</span></label>
            </div>
            <button disabled={busy || stale || !preset || !name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !validHttps(ctaTarget)} onClick={() => void createWebsite()} className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 font-bold shadow-lg shadow-violet-900/30 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? "در حال ساخت سایت..." : "ساخت سایت بر اساس Business Context"}
            </button>
            {message && <p className="mt-3 text-sm text-amber-200">{message}</p>}
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-bold">چه چیزهایی خودکار وارد می‌شوند؟</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "هویت و نام کسب‌وکار",
              "ارزش پیشنهادی و جایگاه‌یابی",
              "مخاطب و پیشنهادهای اصلی",
              "جهت برند و ساختار اولیه صفحات",
            ].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/75"><Check className="text-emerald-300" />{item}</div>)}
          </div>
          <p className="mt-4 text-xs leading-6 text-white/35">Preset انتخابی فقط ساختار اولیه را تعیین می‌کند. Business Context همچنان منبع اصلی محتوای تصمیم‌گیری است و سیستم کسب‌وکار دومی ساخته نمی‌شود.</p>
        </section>
      </section>
    </main>
  );
}

function ContextItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 leading-7 text-white/80">{value}</p>
    </div>
  );
}
