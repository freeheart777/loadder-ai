import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Desktop,
  DeviceMobile,
  FloppyDisk,
  PaperPlaneTilt,
  Plus,
  CaretUp,
  CaretDown,
  Trash,
} from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";
import TrustedLandingRenderer, {
  type LandingBlueprint,
} from "../components/landing/TrustedLandingRenderer";
import VisualStyleSelector from "../components/website/VisualStyleSelector";
import VisualRecommendationCard, {
  type VisualCandidate,
  type VisualRecommendation,
} from "../components/website/VisualRecommendationCard";
import { componentOptions, sectionFor } from "../lib/landingConversion";
type Theme = LandingBlueprint["designTokens"];
type Website = {
  id: string;
  name: string;
  slug: string;
  websiteType: string;
  presetId: string;
  businessContextVersionId: string;
  status: string;
  theme: Theme;
};
type Page = {
  id: string;
  websiteProjectId: string;
  pageType: string;
  name: string;
  path: string;
  navigationVisible: boolean;
  navigationOrder: number;
  currentDraftBlueprintId: string | null;
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
type VisualCatalog = {
  componentId: string;
  componentVersion: number;
  displayName: string;
  description: string;
  allowedProps: Record<string, string[]>;
  defaults: Record<string, string>;
  allowedSectionTypes: string[];
};
type VisualBinding = {
  sectionId: string;
  descriptor: {
    componentId: string;
    componentVersion: number;
    props: Record<string, string>;
  };
};
type VisualBlueprint = LandingBlueprint & {
  websiteVisualDescriptors?: VisualBinding[];
};
type Revision = { id: string; version: number; blueprint: VisualBlueprint };
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
const validLaunchCta = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" && url.hostname !== "example.com" && !url.hostname.endsWith(".example.com") && value !== "https://wa.me/989120000000"; } catch { return false; } };
const pageBlueprint = (name: string, sections: string[], ctaTarget: string): LandingBlueprint => ({
  goal: "حضور پایدار و معتبر کسب‌وکار",
  offer: "معرفی روشن خدمات و ارزش کسب‌وکار",
  audienceSummary: "مخاطبان کسب‌وکار",
  primaryCta: {
    label: "تماس و مشاوره",
    type: "EXTERNAL_URL",
    target: ctaTarget,
  },
  secondaryCta: null,
  seo: { title: name, description: `${name}؛ اطلاعات معتبر کسب‌وکار` },
  socialPreview: {
    title: name,
    description: "معرفی کسب‌وکار",
    imageAssetId: null,
  },
  sections: sections.map((componentId, index) => { const section = sectionFor(componentId, index); return section.props.primaryCta && typeof section.props.primaryCta === "object" ? { ...section, props: { ...section.props, primaryCta: { ...(section.props.primaryCta as Record<string, unknown>), type: "EXTERNAL_URL", target: ctaTarget } } } : section; }),
  designTokens: theme,
  tracking: { enabledActions: ["LANDING_VISIT", "CTA_CLICK"] },
  accessibility: { mainLabel: name },
});
async function json(path: string, init?: RequestInit) {
  const r = await apiFetch(path, init),
    d = await r.json();
  if (!r.ok) throw Error(d.code || d.message || "خطا");
  return d;
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
export default function WebsiteBuilderPage() {
  const { id } = useParams(),
    navigate = useNavigate(),
    [websites, setWebsites] = useState<Website[]>([]),
    [site, setSite] = useState<Website | null>(null),
    [pages, setPages] = useState<Page[]>([]),
    [presets, setPresets] = useState<Preset[]>([]),
    [contexts, setContexts] = useState<Array<{ id: string; status: string }>>(
      [],
    ),
    [visualCatalog, setVisualCatalog] = useState<VisualCatalog[]>([]),
    [activeRevision, setActiveRevision] = useState<Revision | null>(null),
    [recommendation, setRecommendation] = useState<VisualRecommendation | null>(
      null,
    ),
    [suggestedVisual, setSuggestedVisual] = useState<VisualCandidate | null>(
      null,
    ),
    [presetId, setPresetId] = useState("CORPORATE"),
    [name, setName] = useState("وب‌سایت جدید"),
    [slug, setSlug] = useState("business-site"),
    [ctaTarget, setCtaTarget] = useState(""),
    [selectedPage, setSelectedPage] = useState(0),
    [selectedSection, setSelectedSection] = useState(0),
    [blueprint, setBlueprint] = useState<VisualBlueprint | null>(null),
    [mobile, setMobile] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [readiness, setReadiness] = useState({
      websitePublicationConfigured: false,
    }),
    recommendationPageId = pages[selectedPage]?.id,
    recommendationSectionId = blueprint?.sections[selectedSection]?.id,
    currentRecommendation =
      recommendation?.baseRevisionId === activeRevision?.id &&
      recommendation?.sectionId === recommendationSectionId
        ? recommendation
        : null;
  useEffect(() => {
    void Promise.all([
      json("/api/websites"),
      json("/api/websites/presets"),
      json("/api/business-context/versions"),
      json("/api/websites/readiness"),
    ])
      .then(([w, p, c, r]) => {
        setWebsites(w.websites);
        setPresets(p.presets);
        setContexts(c.versions);
        setReadiness(r);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(() => {
    if (!id || id === "new") return;
    void Promise.all([
      json(`/api/websites/${id}`),
      json(`/api/websites/${id}/pages`),
      json(`/api/websites/${id}/visual-components`),
    ])
      .then(([w, p, v]) => {
        setSite(w.website);
        setName(w.website.name);
        setSlug(w.website.slug);
        setPages(p.pages);
        setVisualCatalog(v.components);
      })
      .catch((e) => setMessage(e.message));
  }, [id]);
  useEffect(() => {
    const pg = pages[selectedPage];
    if (!pg) return;
    void json(`/api/website-pages/${pg.id}/blueprints`)
      .then((d) => {
        const latest = d.blueprints[0] as Revision | undefined;
        setActiveRevision(latest || null);
        setBlueprint(
          latest?.blueprint || pageBlueprint(pg.name, ["HERO", "CTA"], ""),
        );
        setSelectedSection(0);
      })
      .catch((e) => setMessage(e.message));
  }, [pages, selectedPage]);
  useEffect(() => {
    if (
      !id ||
      id === "new" ||
      !recommendationPageId ||
      !recommendationSectionId ||
      !activeRevision
    )
      return;
    let active = true;
    void post(
      `/api/websites/${id}/pages/${recommendationPageId}/sections/${recommendationSectionId}/visual-recommendation`,
      { baseRevisionId: activeRevision.id },
    )
      .then((data) => active && setRecommendation(data.recommendation))
      .catch(() => active && setRecommendation(null));
    return () => {
      active = false;
    };
  }, [id, recommendationPageId, recommendationSectionId, activeRevision]);
  async function create() {
    const preset = presets.find((x) => x.presetId === presetId),
      context = contexts.find((x) => x.status === "active") || contexts[0];
    if (!preset || !context) {
      setMessage("Business Context فعال لازم است.");
      return;
    }
    if (!validLaunchCta(ctaTarget)) {
      setMessage("یک نشانی HTTPS واقعی برای دکمه اقدام وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const w = (
        await post("/api/websites", {
          name,
          slug,
          websiteType: preset.websiteType,
          presetId: preset.presetId,
          businessContextVersionId: context.id,
          locale: "fa-IR",
          direction: "rtl",
          theme,
        })
      ).website as Website;
      for (const p of preset.pages) {
        const pg = (
          await post(`/api/websites/${w.id}/pages`, {
            pageType: p.pageType,
            name: p.name,
            path: p.path,
            navigationVisible: p.navigationVisible,
            navigationOrder: p.navigationOrder,
          })
        ).page;
        await post(`/api/website-pages/${pg.id}/blueprints`, {
          blueprint: pageBlueprint(p.name, p.sections, ctaTarget),
        });
      }
      navigate(`/dashboard/websites/${w.id}/edit`, { replace: true });
      setSite(w);
      setPages((await json(`/api/websites/${w.id}/pages`)).pages);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }
  function updateSection(value: Record<string, unknown>) {
    setBlueprint((b) =>
      b
        ? {
            ...b,
            sections: b.sections.map((s, i) =>
              i === selectedSection
                ? { ...s, props: { ...s.props, ...value } }
                : s,
            ),
          }
        : b,
    );
  }
  function updateCtaTarget(target: string) {
    setCtaTarget(target);
    setBlueprint((b) => b ? { ...b, primaryCta: { label: b.primaryCta?.label || "تماس و مشاوره", type: "EXTERNAL_URL", target }, sections: b.sections.map((section) => section.props.primaryCta && typeof section.props.primaryCta === "object" ? { ...section, props: { ...section.props, primaryCta: { ...(section.props.primaryCta as Record<string, unknown>), type: "EXTERNAL_URL", target } } } : section) } : b);
  }
  function move(delta: number) {
    if (!blueprint) return;
    const target = selectedSection + delta;
    if (target < 0 || target >= blueprint.sections.length) return;
    const sections = [...blueprint.sections],
      [item] = sections.splice(selectedSection, 1);
    sections.splice(target, 0, item);
    setBlueprint({ ...blueprint, sections });
    setSelectedSection(target);
  }
  function remove() {
    if (!blueprint || blueprint.sections.length < 2) return;
    setBlueprint({
      ...blueprint,
      sections: blueprint.sections.filter((_, i) => i !== selectedSection),
    });
    setSelectedSection(Math.max(0, selectedSection - 1));
  }
  async function save() {
    const pg = pages[selectedPage];
    if (!pg || !blueprint) return;
    if (!validLaunchCta(blueprint.primaryCta?.target || "")) {
      setMessage("یک نشانی HTTPS واقعی برای دکمه اقدام وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const d = await post(`/api/website-pages/${pg.id}/blueprints`, {
        blueprint,
        supersedesBlueprintId: pg.currentDraftBlueprintId,
      });
      setActiveRevision(d.blueprint);
      setBlueprint(d.blueprint.blueprint);
      setPages((x) =>
        x.map((p) =>
          p.id === pg.id
            ? { ...p, currentDraftBlueprintId: d.blueprint.id }
            : p,
        ),
      );
      setMessage(`نسخه ${d.blueprint.version} ذخیره شد.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }
  async function changeVisual(
    action: "APPLY" | "REPLACE" | "REMOVE",
    item?: VisualCatalog,
    props?: Record<string, string>,
  ) {
    const pg = pages[selectedPage],
      section = blueprint?.sections[selectedSection];
    if (!id || !pg || !section || !activeRevision) {
      setMessage("ابتدا نسخه فعلی را ذخیره کنید.");
      return;
    }
    setBusy(true);
    try {
      const d = await post(
        `/api/websites/${id}/pages/${pg.id}/sections/${section.id}/visual`,
        {
          action,
          baseRevisionId: activeRevision.id,
          ...(item
            ? {
                componentId: item.componentId,
                componentVersion: item.componentVersion,
                props,
              }
            : {}),
        },
      );
      setActiveRevision(d.blueprint);
      setBlueprint(d.blueprint.blueprint);
      setPages((x) =>
        x.map((p) =>
          p.id === pg.id
            ? { ...p, currentDraftBlueprintId: d.blueprint.id }
            : p,
        ),
      );
      setMessage(
        action === "REMOVE"
          ? "سبک بصری در نسخه جدید حذف شد."
          : `سبک بصری در نسخه ${d.blueprint.version} اعمال شد.`,
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setMessage(
        (
          {
            VISUAL_REVISION_CONFLICT:
              "نسخه تغییر کرده است؛ صفحه را تازه‌سازی کنید.",
            VISUAL_SECTION_INCOMPATIBLE:
              "این سبک برای بخش انتخاب‌شده مناسب نیست.",
            VISUAL_PAGE_BUDGET_EXCEEDED:
              "حداکثر چهار سبک بصری در هر صفحه مجاز است.",
            VISUAL_RESTRICTION_VIOLATION:
              "این سبک در همین صفحه قبلاً استفاده شده است.",
            VISUAL_COMPONENT_NOT_AVAILABLE: "این سبک دیگر در دسترس نیست.",
            VISUAL_ACTION_STATE_INVALID:
              "وضعیت فعلی بخش با این اقدام هماهنگ نیست.",
          } as Record<string, string>
        )[code] || "اعمال سبک بصری ناموفق بود.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!site) return;
    if (!blueprint || !validLaunchCta(blueprint.primaryCta?.target || "")) {
      setMessage("پیش از انتشار، نشانی واقعی دکمه اقدام را وارد کنید.");
      return;
    }
    if (!readiness.websitePublicationConfigured) {
      setMessage(
        "انتشار عمومی وب‌سایت هنوز پیکربندی نشده است؛ پیش‌نمایش و نسخه‌سازی فعال است.",
      );
      return;
    }
    setBusy(true);
    try {
      const d = await post(`/api/websites/${site.id}/publish`, {});
      if (d.publicUrl)
        await navigator.clipboard
          ?.writeText(d.publicUrl)
          .catch(() => undefined);
      setMessage(
        d.publicUrl
          ? `وب‌سایت منتشر شد: ${d.publicUrl}`
          : "نشانی عمومی در دسترس نیست.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "انتشار ناموفق بود");
    } finally {
      setBusy(false);
    }
  }
  if (!id)
    return (
      <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5">
            <Link
              to="/dashboard"
              className="min-h-11 min-w-11 rounded-full border border-white/10 p-3"
            >
              <ArrowRight />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">وب‌سایت‌ها</h1>
              <p className="text-sm text-white/45">
                حضور پایدار، چندصفحه‌ای و سازگار با برند
              </p>
            </div>
            <Link
              to="/dashboard/websites/new"
              className="flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4"
            >
              <Plus />
              وب‌سایت جدید
            </Link>
          </div>
        </header>
        <section className="mx-auto grid max-w-6xl gap-4 p-6 md:grid-cols-2">
          {websites.map((w) => (
            <Link
              key={w.id}
              to={`/dashboard/websites/${w.id}/edit`}
              className="rounded-3xl border border-white/10 bg-white/[.03] p-6"
            >
              <span className="text-xs text-violet-300">{w.status}</span>
              <h2 className="mt-3 text-xl font-semibold">{w.name}</h2>
              <p dir="ltr" className="text-left text-white/45">
                /{w.slug}
              </p>
            </Link>
          ))}
        </section>
      </main>
    );
  if (id === "new" && !site)
    return (
      <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
        <section className="mx-auto max-w-xl space-y-5 p-6 pt-16">
          <Link
            to="/dashboard/websites"
            className="inline-flex min-h-11 items-center gap-2"
          >
            <ArrowRight />
            بازگشت
          </Link>
          <h1 className="text-3xl font-bold">ساخت وب‌سایت</h1>
          <label className="block">
            نام
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/5 p-3"
            />
          </label>
          <label className="block">
            نامک
            <input
              dir="ltr"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left"
            />
          </label>
          <label className="block">
            الگوی کسب‌وکار
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl bg-[#0a0d1a] p-3"
            >
              {presets.map((p) => (
                <option key={p.presetId} value={p.presetId}>
                  {p.presetId}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            نشانی دکمه اقدام
            <input type="url" dir="ltr" value={ctaTarget} onChange={(e) => setCtaTarget(e.target.value.trim())} placeholder="https://your-business.example/path" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left" />
            {!validLaunchCta(ctaTarget) && <span className="mt-2 block text-xs text-amber-300">یک نشانی HTTPS واقعی لازم است؛ نشانی نمونه قابل انتشار نیست.</span>}
          </label>
          <button
            disabled={busy || !validLaunchCta(ctaTarget)}
            onClick={() => void create()}
            className="min-h-11 w-full rounded-xl bg-violet-600 px-4"
          >
            ساخت صفحات پیشنهادی
          </button>
          {message && <p className="text-amber-200">{message}</p>}
        </section>
      </main>
    );
  const section = blueprint?.sections[selectedSection];
  return (
    <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050714]/95">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 p-4">
          <Link
            to="/dashboard/websites"
            className="min-h-11 min-w-11 rounded-full border border-white/10 p-3"
          >
            <ArrowRight />
          </Link>
          <h1 className="min-w-48 flex-1 text-xl font-bold">{site?.name}</h1>
          <button
            onClick={() => setMobile((x) => !x)}
            className="min-h-11 min-w-11 rounded-xl border border-white/10 p-3"
            aria-label="تغییر پیش‌نمایش"
          >
            {mobile ? <Desktop /> : <DeviceMobile />}
          </button>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4"
          >
            <FloppyDisk />
            ذخیره نسخه
          </button>
          <button
            disabled={busy}
            onClick={() => void publish()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/30 px-4 text-emerald-200"
          >
            <PaperPlaneTilt />
            انتشار سایت
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] gap-5 p-5 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-5 rounded-3xl border border-white/10 bg-white/[.03] p-5">
          <div>
            <h2 className="mb-2 text-sm font-semibold">صفحات و ناوبری</h2>
            <div className="flex flex-wrap gap-2">
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPage(i)}
                  className={`min-h-11 rounded-xl px-3 text-sm ${i === selectedPage ? "bg-violet-600" : "bg-white/5"}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          {blueprint && (
            <>
              <label className="block text-sm">
                نشانی دکمه اقدام
                <input type="url" dir="ltr" value={blueprint.primaryCta?.target || ""} onChange={(e) => updateCtaTarget(e.target.value.trim())} placeholder="https://your-business.example/path" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left" />
                {!validLaunchCta(blueprint.primaryCta?.target || "") && <span className="mt-2 block text-xs text-amber-300">یک نشانی HTTPS واقعی لازم است؛ نشانی نمونه قابل انتشار نیست.</span>}
              </label>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">بخش‌ها</h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => move(-1)}
                      className="min-h-11 min-w-11 rounded-lg border border-white/10"
                    >
                      <CaretUp />
                    </button>
                    <button
                      onClick={() => move(1)}
                      className="min-h-11 min-w-11 rounded-lg border border-white/10"
                    >
                      <CaretDown />
                    </button>
                    <button
                      onClick={remove}
                      className="min-h-11 min-w-11 rounded-lg border border-red-400/20 text-red-300"
                    >
                      <Trash />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {blueprint.sections.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSection(i);
                        setSuggestedVisual(null);
                      }}
                      className={`min-h-11 rounded-lg px-3 text-xs ${i === selectedSection ? "bg-violet-600" : "bg-white/5"}`}
                    >
                      {s.componentId}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="افزودن بخش"
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setBlueprint((b) =>
                      b
                        ? {
                            ...b,
                            sections: [
                              ...b.sections,
                              sectionFor(e.target.value, b.sections.length),
                            ],
                          }
                        : b,
                    );
                    e.target.value = "";
                  }}
                  className="mt-3 min-h-11 w-full rounded-xl bg-[#0a0d1a] p-3"
                >
                  <option value="">افزودن بخش…</option>
                  {componentOptions.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              {section && (
                <>
                  <label className="block text-sm">
                    عنوان
                    <textarea
                      value={String(
                        section.props.headline || section.props.heading || "",
                      )}
                      onChange={(e) =>
                        updateSection(
                          section.componentId === "HERO"
                            ? { headline: e.target.value }
                            : { heading: e.target.value },
                        )
                      }
                      className="mt-2 min-h-24 w-full rounded-xl bg-black/20 p-3"
                    />
                  </label>
                  <label className="block text-sm">
                    متن
                    <textarea
                      value={String(section.props.body || "")}
                      onChange={(e) => updateSection({ body: e.target.value })}
                      className="mt-2 min-h-28 w-full rounded-xl bg-black/20 p-3"
                    />
                  </label>
                  <VisualRecommendationCard
                    recommendation={currentRecommendation}
                    busy={busy}
                    onAccept={() => {
                      if (!currentRecommendation) return;
                      if (currentRecommendation.action === "REMOVE") {
                        void changeVisual("REMOVE");
                        return;
                      }
                      const candidate = currentRecommendation.candidate,
                        item = visualCatalog.find(
                          (entry) =>
                            entry.componentId === candidate?.componentId &&
                            entry.componentVersion ===
                              candidate?.componentVersion,
                        );
                      if (candidate && item)
                        void changeVisual(
                          currentRecommendation.action === "REPLACE"
                            ? "REPLACE"
                            : "APPLY",
                          item,
                          candidate.props,
                        );
                    }}
                    onAlternative={(candidate) => setSuggestedVisual(candidate)}
                    onIgnore={() => setRecommendation(null)}
                  />
                  <VisualStyleSelector
                    key={`${section.id}:${blueprint.websiteVisualDescriptors?.find((item) => item.sectionId === section.id)?.descriptor.componentId || "none"}:${suggestedVisual?.componentId || "manual"}`}
                    catalog={visualCatalog}
                    sectionType={section.componentId}
                    suggested={
                      suggestedVisual
                        ? {
                            componentId: suggestedVisual.componentId,
                            componentVersion: suggestedVisual.componentVersion,
                            props: suggestedVisual.props,
                          }
                        : undefined
                    }
                    current={(() => {
                      const binding = blueprint.websiteVisualDescriptors?.find(
                        (item) => item.sectionId === section.id,
                      );
                      return binding
                        ? {
                            componentId: binding.descriptor.componentId,
                            componentVersion:
                              binding.descriptor.componentVersion,
                            props: binding.descriptor.props,
                          }
                        : null;
                    })()}
                    busy={busy}
                    onApply={(item, props, replace) =>
                      void changeVisual(
                        replace ? "REPLACE" : "APPLY",
                        item,
                        props,
                      )
                    }
                    onRemove={() => void changeVisual("REMOVE")}
                  />
                </>
              )}
            </>
          )}
          {message && (
            <p className="rounded-xl bg-white/5 p-3 text-sm text-white/70">
              {message}
            </p>
          )}
          <p className="text-xs leading-6 text-white/45">
            تجارت، رزرو داخلی، AI، دامنه سفارشی و فرم حساس هنوز فعال نیستند.
          </p>
        </aside>
        <section
          className={`mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-white ${mobile ? "max-w-[390px]" : "max-w-none"}`}
        >
          <nav
            aria-label="ناوبری وب‌سایت"
            className="flex min-h-14 flex-wrap items-center gap-3 bg-[#111122] px-4 text-sm text-white"
          >
            {pages
              .filter((p) => p.navigationVisible)
              .map((p) => (
                <span key={p.id}>{p.name}</span>
              ))}
          </nav>
          {blueprint && <TrustedLandingRenderer blueprint={blueprint} />}
        </section>
      </div>
    </main>
  );
}
