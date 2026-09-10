import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import WorkspaceSelector from "../components/WorkspaceSelector";
import { House, FolderOpen, Sparkle, ChartLineUp, Gear, Plus, Globe, Lightning } from "@phosphor-icons/react";
import { useStagger } from "../lib/animations/useStagger";
import { demoBusiness } from "../data/demoBusiness";
import { withDemo } from "../lib/demoMode";
import { useAuth } from "../lib/auth";
import { isBeginnerHomeEnabled } from "../lib/featureFlags";
import ExpertToolsSurface from "../components/dashboard/ExpertToolsSurface";
import BeginnerHome from "../components/home/BeginnerHome";

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation(); const isDemo = new URLSearchParams(location.search).get("demo") === "1"; const business = isDemo ? demoBusiness : null; const dashboardRef = useStagger();
  const beginner = isBeginnerHomeEnabled();
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const openAllTools = () => { setToolsOpen(true); requestAnimationFrame(() => toolsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  return <main ref={dashboardRef} dir="rtl" className="min-h-screen overflow-x-hidden bg-[#050507] text-white">
    {!beginner && <aside className="fixed right-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-l border-white/[0.08] bg-black/60 p-5 backdrop-blur-2xl lg:flex"><div className="mb-10"><div dir="ltr" className="text-left text-xl font-semibold">Loadder AI</div><p className="mt-1 text-sm text-white/45">مرکز هوشمند کسب‌وکار</p></div><nav className="space-y-2"><div className="flex items-center gap-3 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3.5 text-sm"><House size={20} weight="duotone" /> صفحه اصلی</div><Link to="/dashboard/business-builder" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"><Lightning size={20} /> اپلیکیشن‌ساز</Link><Link to="/dashboard/websites" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"><FolderOpen size={20} /> پروژه‌های سایت</Link><Link to="/dashboard/business-brain" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"><Sparkle size={20} /> متخصص‌های هوش مصنوعی</Link><Link to={withDemo("/dashboard/analytics")} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"><ChartLineUp size={20} /> تحلیل و گزارش‌ها</Link><Link to="/dashboard/site-operations" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"><Globe size={20} /> مدیریت سایت</Link><button type="button" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"><Gear size={20} /> تنظیمات</button></nav><div className="mt-auto rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4"><div className="text-sm text-white/45">فضای کاری</div><div className="mt-2"><WorkspaceSelector /></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full w-[35%] rounded-full bg-gradient-to-l from-violet-500 via-fuchsia-500 to-cyan-400" /></div><div className="mt-2 text-sm text-white/40">تکمیل پروفایل ۳۵٪</div></div></aside>}
    <section className={beginner ? "min-h-screen" : "min-h-screen lg:mr-[260px]"}>
      {beginner
        ? <header className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div dir="ltr" className="text-left text-lg font-semibold">Loadder</div><div className="min-w-0"><WorkspaceSelector /></div></header>
        : <header className="sticky top-0 z-30 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] bg-[#050507]/85 px-4 py-4 sm:px-8 sm:py-5 backdrop-blur-2xl"><div><div className="flex items-center gap-3"><h1 className="text-2xl font-semibold">داشبورد</h1>{isDemo && <span className="rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-3 py-1 text-xs text-cyan-200">نسخه دمو</span>}</div><p className="mt-1 text-sm text-white/45">{isDemo ? `${business?.name} — نمای یکپارچه کسب‌وکار` : "همه ابزارهای هوش مصنوعی کسب‌وکارت در یک جا"}</p></div><div className="flex items-center gap-3"><Link to="/dashboard/business-builder" className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/[0.08] px-5 py-3 text-sm"><Plus size={16} weight="bold" /> ساخت اپلیکیشن</Link><Link to="/dashboard/websites/new" className="flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-gradient-to-l from-violet-500/20 to-fuchsia-500/15 px-5 py-3 text-sm"><Plus size={16} weight="bold" /> ساخت سایت</Link></div></header>}
      <div className="p-4 sm:p-8">
        {beginner
          ? <>
              <BeginnerHome userName={user?.name} onOpenAllTools={openAllTools} />
              <div ref={toolsRef} data-expert-surface className="mx-auto mt-10 w-full max-w-3xl">
                <button type="button" data-all-tools-toggle aria-expanded={toolsOpen} onClick={() => setToolsOpen((value) => !value)} className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 text-sm text-white/55">همه ابزارها<span className="text-white/30">{toolsOpen ? "بستن" : "باز کردن"}</span></button>
              </div>
              {toolsOpen && <div className="mt-6"><ExpertToolsSurface userName={user?.name} /></div>}
            </>
          : <ExpertToolsSurface userName={user?.name} />}
      </div>
    </section>
  </main>;
}
