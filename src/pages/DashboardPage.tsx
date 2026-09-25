import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import HomeChrome from "../components/home/HomeChrome";
import { AttentionZone, InProgressZone, LearnedZone, ToolsZone, Zone } from "../components/home/zones";
import { ATTENTION_COPY, ZONE_LABELS } from "../lib/homeCopy";
import {
  primaryItem, readAttention, readFindings, readPreparedWork,
  type Finding, type PreparedWork, type ZoneState,
} from "../lib/homeData";
import type { MissionControl } from "../lib/missionControlCopy";
import { apiFetch } from "../lib/api";

type WebsiteProject = { id: string; name?: string; siteType?: string; status?: string; updatedAt?: string };

const studioPath = (project: WebsiteProject, preview = false) => `${project.siteType === "STORE" ? "/dashboard/websites" : "/dashboard/websites/corporate"}?project=${encodeURIComponent(project.id)}${preview ? "&preview=1" : ""}`;
const publicPath = (project: WebsiteProject) => project.siteType === "STORE" ? `/store/${project.id}` : `/site/${project.id}`;
const projectKind = (project: WebsiteProject) => project.siteType === "STORE" ? "فروشگاه" : "وب‌سایت حرفه‌ای";
const updatedLabel = (value?: string) => value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "تازه ایجاد شده";

function WebsiteWorkspace({ projects, state }: { projects: WebsiteProject[]; state: "loading" | "ok" | "failed" }) {
  const published = projects.filter((project) => project.status === "PUBLISHED").length;
  const drafts = projects.length - published;
  return <div className="rounded-[26px] border border-sky-300/20 bg-gradient-to-bl from-sky-500/[.14] via-violet-500/[.07] to-transparent p-5 sm:p-6" data-website-workspace>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-[10px] font-black tracking-[.16em] text-sky-200">WEBSITE BUILDER</span><h3 className="mt-2 text-xl font-bold">وب‌سایت‌های شما</h3><p className="mt-2 max-w-xl text-sm leading-7 text-white/50">از قالب آماده شروع کنید، مستقیم روی سایت ویرایش کنید و سپس نسخه منتشرشده را مدیریت کنید.</p></div><Link to="/dashboard/websites/corporate?new=1" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-slate-950">ساخت وب‌سایت جدید</Link></div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-2xl bg-white/[.07] p-3"><b className="block text-lg">{projects.length}</b><span className="text-[11px] text-white/45">همه وب‌سایت‌ها</span></div><div className="rounded-2xl bg-white/[.07] p-3"><b className="block text-lg text-amber-200">{drafts}</b><span className="text-[11px] text-white/45">پیش‌نویس</span></div><div className="rounded-2xl bg-white/[.07] p-3"><b className="block text-lg text-emerald-200">{published}</b><span className="text-[11px] text-white/45">منتشرشده</span></div></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2">{state === "loading" && <p className="text-sm text-white/35">در حال بارگذاری وب‌سایت‌ها…</p>}{state === "failed" && <p className="text-sm text-white/35">فهرست وب‌سایت‌ها فعلاً در دسترس نیست.</p>}{state === "ok" && projects.slice(0, 4).map((project) => <article key={project.id} className="rounded-2xl border border-white/[.09] bg-slate-950/30 p-4 transition hover:border-sky-300/40 hover:bg-white/[.06]"><span className="flex items-center justify-between gap-3"><b className="truncate">{project.name || "وب‌سایت بدون نام"}</b><i className={`rounded-full px-2 py-1 text-[9px] font-black not-italic ${project.status === "PUBLISHED" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-100"}`}>{project.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}</i></span><span className="mt-2 block text-[11px] text-white/40">{projectKind(project)} · آخرین تغییر: {updatedLabel(project.updatedAt)}</span><span className="mt-3 flex gap-2"><Link to={studioPath(project)} className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-slate-950">باز کردن ویرایشگر</Link><Link to={project.status === "PUBLISHED" ? publicPath(project) : studioPath(project, true)} className="rounded-lg bg-white/[.08] px-3 py-2 text-[10px] font-black text-white/75">{project.status === "PUBLISHED" ? "پیش‌نمایش سایت" : "پیش‌نمایش پیش‌نویس"}</Link></span></article>)}{state === "ok" && projects.length === 0 && <div className="rounded-2xl border border-dashed border-sky-200/25 bg-white/[.03] p-5 sm:col-span-2"><b className="block">اولین سایتتان را از یک قالب حرفه‌ای شروع کنید.</b><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/60 sm:grid-cols-4"><span className="rounded-xl bg-white/[.06] p-2">کلینیک و پزشک</span><span className="rounded-xl bg-white/[.06] p-2">موسسه حقوقی</span><span className="rounded-xl bg-white/[.06] p-2">مرکز آموزشی</span><span className="rounded-xl bg-white/[.06] p-2">شرکت حرفه‌ای</span></div></div>}</div>
    <div className="mt-6 border-t border-white/10 pt-5 text-center" aria-label="ارتباط هسته برند با ابزارهای Loadder"><b className="text-sm text-white/85">یک برند، همه‌چیز را نیرو می‌دهد.</b><p className="mt-1 text-[10px] text-white/40">Brand Core هویت و جهت مشترک خروجی‌های کسب‌وکار را نگه می‌دارد.</p><div className="mx-auto mt-4 w-fit rounded-2xl border border-violet-300/25 bg-violet-400/10 px-5 py-3"><Link to="/dashboard/brand-book" className="text-xs font-black text-violet-100">Brand Core</Link><span className="mt-1 block text-[9px] text-white/40">هویت · جایگاه · لحن · هویت بصری</span></div><div className="mx-auto h-5 w-px bg-gradient-to-b from-violet-300/50 to-white/10"/><div className="grid gap-2 text-right sm:grid-cols-2 lg:grid-cols-4"><Link to="/dashboard/business-proposal" className="rounded-xl border border-white/10 bg-white/[.035] p-3 transition hover:border-cyan-300/30 hover:bg-white/[.06]"><b className="block text-[11px]">Business Proposal</b><span className="mt-1 block text-[9px] text-white/40">طرح کسب‌وکار بر پایه برند</span></Link><Link to="/dashboard/websites/corporate" className="rounded-xl border border-white/10 bg-white/[.035] p-3 transition hover:border-sky-300/30 hover:bg-white/[.06]"><b className="block text-[11px]">Website Builder</b><span className="mt-1 block text-[9px] text-white/40">وب‌سایت با هویت یکپارچه</span></Link><Link to="/dashboard/marketing" className="rounded-xl border border-white/10 bg-white/[.035] p-3 transition hover:border-emerald-300/30 hover:bg-white/[.06]"><b className="block text-[11px]">Marketing</b><span className="mt-1 block text-[9px] text-white/40">پیام و محتوای برند</span></Link><Link to="/dashboard/ads" className="rounded-xl border border-white/10 bg-white/[.035] p-3 transition hover:border-amber-300/30 hover:bg-white/[.06]"><b className="block text-[11px]">Ads Intelligence</b><span className="mt-1 block text-[9px] text-white/40">تبلیغات در اکوسیستم برند</span></Link></div></div>
  </div>;
}

/**
 * HOME.
 *
 * Four zones, in one order: what needs you, what is under way, what we have
 * learned, your tools. Every zone reads an endpoint that already existed, and
 * each reads independently — one failing contract dims one zone and leaves the
 * rest of Home usable.
 *
 * Home shows one attention item, the first the canonical contract emitted. It
 * does not re-rank, and it does not summarise the rest: the full list is one
 * click away behind «بقیهٔ موارد», which is also where «چرا؟» leads for depth.
 */
export default function DashboardPage() {
  const [attention, setAttention] = useState<ZoneState<MissionControl>>({ status: "loading", data: null });
  const [prepared, setPrepared] = useState<ZoneState<PreparedWork[]>>({ status: "loading", data: null });
  const [findings, setFindings] = useState<ZoneState<Finding[]>>({ status: "loading", data: null });
  const [websites, setWebsites] = useState<WebsiteProject[]>([]);
  const [websiteState, setWebsiteState] = useState<"loading" | "ok" | "failed">("loading");

  useEffect(() => {
    let live = true;
    void readAttention()
      .then((data) => { if (live) setAttention({ status: "ok", data }); })
      .catch(() => { if (live) setAttention({ status: "failed", data: null }); });
    void readPreparedWork()
      .then((data) => { if (live) setPrepared({ status: "ok", data }); })
      .catch(() => { if (live) setPrepared({ status: "failed", data: null }); });
    void readFindings()
      .then((data) => { if (live) setFindings({ status: "ok", data }); })
      .catch(() => { if (live) setFindings({ status: "failed", data: null }); });
    void apiFetch("/api/site-projects").then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.projects)) throw new Error("SITE_PROJECTS_UNAVAILABLE");
      if (live) { setWebsites(data.projects); setWebsiteState("ok"); }
    }).catch(() => { if (live) setWebsiteState("failed"); });
    return () => { live = false; };
  }, []);

  const item = primaryItem(attention.data);
  const others = Math.max(0, (attention.data?.items.length ?? 0) - 1);

  return (
    <HomeChrome>
      <Zone label="وب‌سایت">
        <WebsiteWorkspace projects={websites} state={websiteState} />
      </Zone>
      <Zone label={ZONE_LABELS.attention}>
        <AttentionZone state={attention} item={item} />
        {others > 0 && (
          <Link data-attention-more to="/dashboard/attention" className="mt-5 inline-flex min-h-11 items-center text-[13.5px] text-white/40 underline decoration-white/15 underline-offset-[6px] transition hover:text-white/70">
            {ATTENTION_COPY.more}
          </Link>
        )}
      </Zone>

      <Zone label={ZONE_LABELS.inProgress}>
        <InProgressZone state={prepared} />
      </Zone>

      <Zone label={ZONE_LABELS.learned}>
        <LearnedZone state={findings} />
      </Zone>

      <Zone id="tools" label={ZONE_LABELS.tools}>
        <ToolsZone />
      </Zone>
    </HomeChrome>
  );
}
