import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ElementType } from "react";
import WorkspaceSelector from "../components/WorkspaceSelector";
import type { OnboardingStatus } from "../components/onboarding/types";
import { useAuth } from "../lib/auth";
import { fetchOnboardingStatus } from "../lib/onboarding";
import { apiFetch } from "../lib/api";

import {
  House,
  FolderOpen,
  Sparkle,
  BookOpenText,
  Browsers,
  Brain,
  List,
  SignOut,
  X,
} from "@phosphor-icons/react";

import { useStagger } from "../lib/animations/useStagger";
import { demoBusiness } from "../data/demoBusiness";

type Tool = {
  title: string;
  icon: ElementType;
  status: string;
  route?: string;
};

const tools: Tool[] = [
  { title: "استراتژی رشد", icon: Sparkle, status: "آماده", route: "/dashboard/growth" },
  {
    title: "برند و کسب‌وکار",
    icon: Brain,
    status: "آماده",
    route: "/dashboard/business-brain",
  },
  {
    title: "تولید محتوا",
    icon: Sparkle,
    status: "آماده",
    route: "/dashboard/content",
  },
  { title: "برند بوک", icon: BookOpenText, status: "آماده", route: "/dashboard/brand-book" },
  { title: "صفحه فرود", icon: Browsers, status: "آماده", route: "/dashboard/landings" },
  { title: "وب‌سایت", icon: Browsers, status: "آماده", route: "/dashboard/websites" },
];

const launchNavigation = [
  { title: "صفحه اصلی", route: "/dashboard", icon: House },
  { title: "راه‌اندازی کسب‌وکار", route: "/dashboard/onboarding", icon: BookOpenText },
  { title: "استراتژی رشد", route: "/dashboard/growth", icon: Sparkle },
  { title: "استودیوی محتوا", route: "/dashboard/content", icon: Sparkle },
  { title: "کتابخانه محتوا", route: "/dashboard/library", icon: FolderOpen },
  { title: "برند و کسب‌وکار", route: "/dashboard/business-brain", icon: Brain },
  { title: "وب‌سایت", route: "/dashboard/websites", icon: Browsers },
  { title: "صفحه فرود", route: "/dashboard/landings", icon: Browsers },
  { title: "فرم‌ها", route: "/dashboard/forms", icon: BookOpenText },
  { title: "مدیریت ارتباط با مشتری", route: "/dashboard/crm", icon: Brain },
  { title: "چرخه‌های بهبود", route: "/dashboard/improvement", icon: Sparkle },
] as const;

function DashboardNavigation({ pathname, onboarding, onNavigate, onLogout }: { pathname: string; onboarding: OnboardingStatus | null; onNavigate?: () => void; onLogout: () => void }) {
  return <>
    <nav aria-label="ناوبری اصلی" className="space-y-1 overflow-y-auto">
      {launchNavigation.map((item) => { const Icon = item.icon; const active = item.route === "/dashboard" ? pathname === item.route : pathname.startsWith(item.route); return <Link key={item.route} to={item.route} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${active ? "border border-violet-400/20 bg-violet-500/10 text-white" : "text-white/55 hover:bg-white/[0.04]"}`}><Icon size={20} weight={active ? "duotone" : "regular"}/>{item.title}</Link>; })}
    </nav>
    <div className="mt-auto rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="text-sm text-white/45">فضای کاری</div>
      <div className="mt-2"><WorkspaceSelector /></div>
      <div className="mt-4 text-sm text-white/40">{!onboarding ? "در حال بررسی راه‌اندازی…" : onboarding.complete ? "راه‌اندازی کامل" : onboarding.contextStale ? "شناخت کسب‌وکار نیازمند به‌روزرسانی" : "راه‌اندازی تکمیل نشده"}</div>
      <button type="button" onClick={onLogout} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-sm text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><SignOut size={18}/>خروج از حساب</button>
    </div>
  </>;
}

function ToolCard({
  tool,
}: {
  tool: Tool;
}) {
  const Icon = tool.icon;

  const active = Boolean(
    tool.route
  );

  const className = `
    group relative min-h-[190px]
    overflow-hidden rounded-[24px]
    border p-5 text-right
    transition duration-300
    ${
      active
        ? "border-violet-300/20 bg-white/[0.035] hover:-translate-y-1 hover:border-violet-300/45 hover:bg-white/[0.06]"
        : "cursor-default border-white/[0.07] bg-white/[0.02]"
    }
  `;

  const content = (
    <>
      {active && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-fuchsia-500/[0.05]" />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-[15px] border ${
              active
                ? "border-violet-300/20 bg-black/25 text-cyan-300"
                : "border-white/[0.08] bg-black/20 text-white/30"
            }`}
          >
            <Icon
              size={22}
              weight="duotone"
            />
          </div>

          <div className="flex items-center gap-2">

            <span
              className={`rounded-full px-3 py-1.5 text-sm ${
                active
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-white/[0.04] text-white/40"
              }`}
            >
              {tool.status}
            </span>
          </div>
        </div>

        <h3
          className={`mt-6 text-base font-semibold ${
            active
              ? "text-white"
              : "text-white/50"
          }`}
        >
          {tool.title}
        </h3>

        <p className="mt-2 text-sm leading-7 text-white/45">
          {tool.route
              ? "برای شروع کلیک کن"
              : "این متخصص در مرحله بعد فعال می‌شود"}
        </p>

        {active && (
          <div className="mt-4 flex items-center gap-2 text-sm text-violet-300/65">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
            آماده شروع
          </div>
        )}
      </div>
    </>
  );

  if (tool.route) {
    return (
      <Link
        data-stagger
        to={tool.route}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      data-stagger
      className={className}
    >
      {content}
    </div>
  );
}

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeWorkspace, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [recentContent, setRecentContent] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    setOnboarding(null);
    void fetchOnboardingStatus(controller.signal).then(setOnboarding).catch(() => setOnboarding(null));
    return () => controller.abort();
  }, [activeWorkspace?.id]);
  useEffect(() => { const controller = new AbortController(); void apiFetch("/api/content/items?limit=3", { signal: controller.signal }).then(async (response) => { if (!response.ok) return; const data = await response.json(); setRecentContent(data.items || []); }).catch(() => undefined); return () => controller.abort(); }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const close = () => setMobileMenuOpen(false);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const onResize = () => { if (window.matchMedia("(min-width: 1024px)").matches) close(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    requestAnimationFrame(() => drawerRef.current?.focus());
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); window.removeEventListener("resize", onResize); };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => { setMobileMenuOpen(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); };
  const signOut = async () => { setMobileMenuOpen(false); await logout(); navigate("/signup", { replace: true }); };

  const isDemo =
    new URLSearchParams(location.search).get("demo") === "1";

  const business = isDemo ? demoBusiness : null;

  const dashboardRef = useStagger();

  return (
    <main
      ref={dashboardRef}
      dir="rtl"
      className="min-h-screen bg-[#050507] text-white"
    >
      <aside className="fixed right-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-l border-white/[0.08] bg-black/60 p-5 backdrop-blur-2xl lg:flex">
        <div className="mb-10">
          <div
            dir="ltr"
            className="text-left text-xl font-semibold"
          >
            Loadder AI
          </div>

          <p className="mt-1 text-sm text-white/45">
            مرکز هوشمند کسب‌وکار
          </p>
        </div>

        <DashboardNavigation pathname={location.pathname} onboarding={onboarding} onLogout={() => void signOut()} />
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 z-50 lg:hidden" role="presentation"><button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="بستن منوی ناوبری" onClick={closeMobileMenu}/><aside ref={drawerRef} id="mobile-dashboard-navigation" tabIndex={-1} aria-label="منوی داشبورد" className="absolute inset-y-0 right-0 flex w-[min(88vw,320px)] flex-col border-l border-white/10 bg-[#07070b] p-4 shadow-2xl outline-none motion-safe:animate-in motion-safe:slide-in-from-right"><div className="mb-5 flex items-center justify-between"><div><div dir="ltr" className="text-left text-lg font-semibold">Loadder AI</div><p className="mt-1 text-xs text-white/45">مرکز کسب‌وکار</p></div><button type="button" onClick={closeMobileMenu} aria-label="بستن منو" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><X size={22}/></button></div><DashboardNavigation pathname={location.pathname} onboarding={onboarding} onNavigate={closeMobileMenu} onLogout={() => void signOut()} /></aside></div>}

      <section className="min-h-screen w-full lg:mr-[260px] lg:w-[calc(100%-260px)]">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#050507]/85 px-4 py-3 backdrop-blur-2xl sm:px-6 lg:px-8 lg:py-5">
          <button ref={menuButtonRef} type="button" aria-label="باز کردن منوی ناوبری" aria-expanded={mobileMenuOpen} aria-controls="mobile-dashboard-navigation" onClick={() => setMobileMenuOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 lg:hidden"><List size={24}/></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">
                داشبورد
              </h1>

              {isDemo && (
                <span className="rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-3 py-1 text-xs text-cyan-200">
                  نسخه دمو
                </span>
              )}
            </div>

            <p className="mt-1 hidden truncate text-sm text-white/45 sm:block">
              {isDemo
                ? `${business?.name} — نمای یکپارچه کسب‌وکار`
                : "همه ابزارهای هوش مصنوعی کسب‌وکارت در یک جا"}
            </p>
          </div>

          <Link
            to={!onboarding || onboarding.complete ? "/dashboard/content" : "/dashboard/onboarding"}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-fuchsia-300/20 bg-gradient-to-l from-violet-500/20 to-fuchsia-500/15 px-3 py-2 text-xs sm:px-5 sm:py-3 sm:text-sm"
          >
            <Sparkle size={16} weight="bold" />
            {!onboarding || onboarding.complete ? "تولید محتوا" : onboarding.contextStale ? "به‌روزرسانی شناخت کسب‌وکار" : "ادامه راه‌اندازی"}
          </Link>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-5 sm:rounded-[30px] sm:p-8">
            <div className="pointer-events-none absolute -left-20 -top-20 h-[300px] w-[300px] rounded-full bg-violet-500/10 blur-[100px]" />

            <div className="relative z-10">
              <h2 className="text-2xl font-semibold sm:text-3xl">
                کسب‌وکارت را هوشمندتر مدیریت کن.
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-8 text-white/55">
                اطلاعات کسب‌وکار و برندت را ثبت کن و با استفاده از آن
                پیش‌نویس محتوای بازاریابی آماده کن.
              </p>
            </div>
          </section>


          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  ابزارهای Loadder
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  ابزار موردنظرت را انتخاب کن.
                </p>
              </div>

              <span className="text-sm text-violet-300/70">
                {tools.length.toLocaleString("fa-IR")} ابزار آماده
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.title}
                  tool={tool}
                />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">
              محتوای اخیر
            </h2>

            <div
              data-stagger
              className="mt-5 rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5 text-center sm:p-10"
            >
              {recentContent.length ? <div className="grid gap-3 text-right md:grid-cols-3">{recentContent.map((item) => <Link key={item.id} to={`/dashboard/library/${item.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="font-medium">{item.title}</div><div className="mt-2 text-xs text-white/35">{new Date(item.updatedAt).toLocaleString("fa-IR")}</div><div className="mt-3 text-sm text-violet-300">ادامه ویرایش</div></Link>)}</div> : <><FolderOpen size={30} weight="duotone" className="mx-auto text-white/30"/><p className="mt-4 text-base text-white/50">هنوز محتوایی ذخیره نشده</p><Link to="/dashboard/content" className="mt-4 inline-block rounded-xl bg-violet-500/20 px-4 py-2 text-sm text-violet-200">ساخت محتوا</Link></>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function DemoMetric({
  title,
  value,
  change,
}: {
  title: string;
  value: string;
  change: number;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="text-sm text-white/45">
        {title}
      </div>

      <div className="mt-4 text-3xl font-semibold">
        {value}
      </div>

      <div className="mt-2 text-sm text-emerald-300">
        +{change}٪
      </div>
    </div>
  );
}
