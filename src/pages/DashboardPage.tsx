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

function WebsiteWorkspace({ projects, state }: { projects: WebsiteProject[]; state: "loading" | "ok" | "failed" }) {
  const published = projects.filter((project) => project.status === "PUBLISHED").length;
  const drafts = projects.length - published;
  return <div className="rounded-[26px] border border-sky-300/20 bg-gradient-to-bl from-sky-500/[.14] via-violet-500/[.07] to-transparent p-5 sm:p-6" data-website-workspace>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-[10px] font-black tracking-[.16em] text-sky-200">WEBSITE BUILDER</span><h3 className="mt-2 text-xl font-bold">وب‌سایت‌های شما</h3><p className="mt-2 max-w-xl text-sm leading-7 text-white/50">از قالب آماده شروع کنید، مستقیم روی سایت ویرایش کنید و سپس نسخه منتشرشده را مدیریت کنید.</p></div><Link to="/dashboard/websites/corporate" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-slate-950">ساخت وب‌سایت جدید</Link></div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-2xl bg-white/[.07] p-3"><b className="block text-lg">{projects.length}</b><span className="text-[11px] text-white/45">همه وب‌سایت‌ها</span></div><div className="rounded-2xl bg-white/[.07] p-3"><b className="block text-lg text-amber-200">{drafts}</b><span className="text-[11px] text-white/45">پیش‌نویس</span></div><div className="rounded-2xl bg-white/[.07] p-3"><b className="block text-lg text-emerald-200">{published}</b><span className="text-[11px] text-white/45">منتشرشده</span></div></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2">{state === "loading" && <p className="text-sm text-white/35">در حال بارگذاری وب‌سایت‌ها…</p>}{state === "failed" && <p className="text-sm text-white/35">فهرست وب‌سایت‌ها فعلاً در دسترس نیست.</p>}{state === "ok" && projects.slice(0, 4).map((project) => <Link key={project.id} to={project.siteType === "STORE" ? "/dashboard/websites" : "/dashboard/websites/corporate"} className="group rounded-2xl border border-white/[.09] bg-slate-950/30 p-4 transition hover:border-sky-300/40 hover:bg-white/[.06]"><span className="flex items-center justify-between gap-3"><b className="truncate">{project.name || "وب‌سایت بدون نام"}</b><i className={`rounded-full px-2 py-1 text-[9px] font-black not-italic ${project.status === "PUBLISHED" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-100"}`}>{project.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}</i></span><span className="mt-2 block text-[11px] text-white/40">{project.siteType === "STORE" ? "فروشگاه" : "وب‌سایت حرفه‌ای"} · باز کردن Studio</span></Link>)}{state === "ok" && projects.length === 0 && <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/40">هنوز وب‌سایتی ندارید. با یک قالب آماده شروع کنید.</p>}</div>
    <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-[11px]"><span className="self-center text-white/35">منابع آماده برای اتصال بعدی:</span><Link to="/dashboard/brand-book" className="rounded-full bg-white/[.07] px-3 py-2 text-white/70 hover:bg-white/[.12]">برند</Link><Link to="/dashboard/marketing" className="rounded-full bg-white/[.07] px-3 py-2 text-white/70 hover:bg-white/[.12]">بازاریابی</Link><span className="rounded-full bg-white/[.04] px-3 py-2 text-white/35">اسناد · به‌زودی</span></div>
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
