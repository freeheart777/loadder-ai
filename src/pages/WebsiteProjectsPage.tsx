import { useEffect, useState } from "react";
import { ArrowRight, Globe, Plus, Storefront } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type SiteProject = {
  id: string;
  name?: string;
  siteType?: string;
  status?: string;
  updatedAt?: string;
};

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "فهرست سایت‌ها بارگذاری نشد.");
  return data;
}

// Ecommerce starters use the existing Store Studio and public storefront;
// they are not a second business-site renderer.
const isStore = (project: SiteProject) => ["STORE", "ECOMMERCE"].includes(String(project.siteType || "").toUpperCase());
const studioPath = (project: SiteProject) => `${isStore(project) ? "/dashboard/websites/store" : "/dashboard/websites/corporate"}?project=${encodeURIComponent(project.id)}`;

/** The one workspace-scoped entry point for every Site Project. */
export default function WebsiteProjectsPage() {
  const [projects, setProjects] = useState<SiteProject[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void apiFetch("/api/site-projects").then(read)
      .then((payload) => {
        if (!active) return;
        setProjects(Array.isArray(payload.projects) ? payload.projects : []);
        setState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "فهرست سایت‌ها بارگذاری نشد.");
        setState("error");
      });
    return () => { active = false; };
  }, []);

  return <main dir="rtl" className="min-h-screen bg-[#070b12] p-4 text-white sm:p-6 lg:p-10" data-site-project-entry>
    <section className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-white/10 bg-[#0d1622] p-5 shadow-2xl sm:p-7">
        <div className="min-w-0">
          <span className="text-[10px] font-black tracking-[.18em] text-emerald-300">SITE PROJECTS</span>
          <h1 className="mt-2 text-2xl font-black">سایت‌های من</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/50">همه سایت‌ها و فروشگاه‌های این Workspace را از یک‌جا باز و مدیریت کنید.</p>
        </div>
        <Link to="/dashboard/websites/corporate?new=1" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950" data-create-site-project><Plus size={18} /> ساخت سایت جدید</Link>
      </header>

      {state === "loading" && <div className="mt-5 grid min-h-48 place-items-center rounded-3xl border border-white/10 bg-white/[.03] text-sm text-white/45">در حال بارگذاری سایت‌ها…</div>}
      {state === "error" && <div role="alert" className="mt-5 rounded-3xl border border-rose-300/20 bg-rose-500/10 p-5 text-sm leading-7 text-rose-100">{message}</div>}
      {state === "ready" && projects.length === 0 && <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[.03] p-7 text-center"><Globe size={32} className="mx-auto text-emerald-200" /><h2 className="mt-4 font-black">هنوز سایتی ندارید</h2><p className="mt-2 text-sm leading-7 text-white/45">از یکی از قالب‌های آماده شروع کنید؛ فروشگاه اینترنتی نیز در انتخاب‌گر ساخت سایت در دسترس است.</p><Link to="/dashboard/websites/corporate?new=1" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950"><Plus size={18} /> ساخت سایت جدید</Link></div>}
      {state === "ready" && projects.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {projects.map((project) => <article key={project.id} className="min-w-0 rounded-3xl border border-white/10 bg-[#0d1622] p-5 transition hover:border-emerald-300/35">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-black">{project.name || "سایت بدون نام"}</h2><p className="mt-2 flex items-center gap-2 text-xs text-white/45">{isStore(project) ? <Storefront size={16} /> : <Globe size={16} />}{isStore(project) ? "فروشگاه" : "وب‌سایت"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${project.status === "PUBLISHED" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-100"}`}>{project.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}</span></div>
          {String(project.siteType || "").toUpperCase() === "MEDICAL" && <Link to={`/dashboard/websites/${encodeURIComponent(project.id)}/medical`} className="mt-5 ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950">مرکز مدیریت درمانی</Link>}
          {String(project.siteType || "").toUpperCase() === "EDUCATION" && <Link to={`/dashboard/websites/${encodeURIComponent(project.id)}/education`} className="mt-5 ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950">مرکز مدیریت آموزش</Link>}
          <Link to={studioPath(project)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/[.06]">باز کردن ویرایشگر <ArrowRight size={16} /></Link>
        </article>)}
      </div>}
    </section>
  </main>;
}
