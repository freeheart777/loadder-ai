import { Link } from "react-router-dom";
import type { ElementType } from "react";
import BusinessBrainMotion from "../BusinessBrainMotion";
import { FolderOpen, Sparkle, ChartLineUp, BookOpenText, FileText, Globe, Gauge, InstagramLogo, Megaphone, UsersThree, Lightning, Brain } from "@phosphor-icons/react";
import MissionControlDashboard from "../mission-control/MissionControlDashboard";

/**
 * The expert surface: Mission Control plus the full tool launcher.
 *
 * This is the pre-existing /dashboard body, extracted unchanged so that both
 * the legacy layout (beginner_home_v1 off) and the "همه ابزارها" disclosure
 * (flag on) render exactly the same expert capability. No route was removed.
 */
type Tool = { title: string; icon: ElementType; status: string; route: string };
const tools: Tool[] = [
  { title: "اپلیکیشن‌ساز هوشمند", icon: Lightning, status: "آماده", route: "/dashboard/business-builder" },
  { title: "Business Brain", icon: Brain, status: "آماده", route: "/dashboard/business-brain" },
  { title: "برند بوک", icon: BookOpenText, status: "آماده", route: "/dashboard/brand-book" },
  { title: "بیزنس پروپوزال", icon: FileText, status: "آماده", route: "/dashboard/business-proposal" },
  { title: "سایت‌ساز هوشمند", icon: Globe, status: "آماده", route: "/dashboard/websites/new" },
  { title: "مدیریت سایت", icon: Globe, status: "آماده", route: "/dashboard/site-operations" },
  { title: "KPI", icon: Gauge, status: "آماده", route: "/dashboard/kpi" },
  { title: "تولید محتوا", icon: Sparkle, status: "آماده", route: "/dashboard/content" },
  { title: "مدیر سوشال", icon: InstagramLogo, status: "آماده", route: "/dashboard/social" },
  { title: "تبلیغات هوشمند", icon: Megaphone, status: "آماده", route: "/dashboard/ads" },
  { title: "CRM", icon: UsersThree, status: "آماده", route: "/dashboard/crm" },
  { title: "تحلیل و گزارش", icon: ChartLineUp, status: "آماده", route: "/dashboard/analytics" },
  { title: "اتوماسیون", icon: Lightning, status: "آماده", route: "/dashboard/automation" },
];

function ToolCard({ tool }: { tool: Tool }) { const Icon = tool.icon; return <Link data-stagger to={tool.route} className="group relative min-h-[190px] overflow-hidden rounded-[24px] border border-violet-300/20 bg-white/[0.035] p-5 text-right transition duration-300 hover:-translate-y-1 hover:border-violet-300/45 hover:bg-white/[0.06]"><div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-fuchsia-500/[0.05]" /><div className="relative z-10"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-[15px] border border-violet-300/20 bg-black/25 text-cyan-300"><Icon size={22} weight="duotone" /></div><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-300">{tool.status}</span></div><h3 className="mt-6 text-base font-semibold text-white">{tool.title}</h3><p className="mt-2 text-sm leading-7 text-white/45">برای شروع کلیک کن</p><div className="mt-4 flex items-center gap-2 text-sm text-violet-300/65"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> آماده شروع</div></div></Link>; }

export default function ExpertToolsSurface({ userName }: { userName?: string | null }) {
  return <>
    <MissionControlDashboard userName={userName} />
    <section className="relative mt-8 overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.035] p-8"><div className="pointer-events-none absolute -left-20 -top-20 h-[300px] w-[300px] rounded-full bg-violet-500/10 blur-[100px]" /><div className="relative z-10"><h2 className="text-3xl font-semibold">کسب‌وکارت را هوشمندتر مدیریت کن.</h2><p className="mt-4 max-w-3xl text-base leading-8 text-white/55">از ساخت اپلیکیشن و سایت تا برند، محتوا، CRM، Analytics و Automation؛ همه به Business Brain مشترک Loadder متصل می‌شوند.</p></div></section>
    <section className="mt-8"><BusinessBrainMotion /></section>
    <section className="mt-10"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-xl font-semibold">ابزارهای کسب‌وکار</h2><p className="mt-1 text-sm text-white/45">ابزار موردنظرت را انتخاب کن.</p></div><span className="text-sm text-violet-300/70">۱۳ ابزار فعال</span></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">{tools.map((tool) => <ToolCard key={tool.title} tool={tool} />)}</div></section>
    <section className="mt-10"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">پروژه‌های اخیر</h2><div className="flex items-center gap-4"><Link to="/dashboard/business-builder" className="text-sm text-cyan-300">مشاهده اپ‌ها</Link><Link to="/dashboard/websites" className="text-sm text-violet-300">مشاهده سایت‌ها</Link></div></div><div data-stagger className="mt-5 rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-10 text-center"><FolderOpen size={30} weight="duotone" className="mx-auto text-white/30" /><p className="mt-4 text-base text-white/50">از همین‌جا اولین اپلیکیشن یا سایت کسب‌وکارت را بساز</p><div className="mt-5 flex justify-center gap-3"><Link to="/dashboard/business-builder" className="inline-flex rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold">ساخت اولین اپلیکیشن</Link><Link to="/dashboard/websites/new" className="inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold">ساخت اولین سایت</Link></div></div></section>
  </>;
}
