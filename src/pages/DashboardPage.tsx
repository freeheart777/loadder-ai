import { Link, useLocation } from "react-router-dom";
import { useEffect, useState, type ElementType } from "react";
import WorkspaceSelector from "../components/WorkspaceSelector";
import type { OnboardingStatus } from "../components/onboarding/types";
import { useAuth } from "../lib/auth";
import { fetchOnboardingStatus } from "../lib/onboarding";

import {
  House,
  FolderOpen,
  Sparkle,
  BookOpenText,
  Brain,} from "@phosphor-icons/react";

import { useStagger } from "../lib/animations/useStagger";
import { demoBusiness } from "../data/demoBusiness";

type Tool = {
  title: string;
  icon: ElementType;
  status: string;
  route?: string;
};

const tools: Tool[] = [
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
];

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
  const { activeWorkspace } = useAuth();
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setOnboarding(null);
    void fetchOnboardingStatus(controller.signal).then(setOnboarding).catch(() => setOnboarding(null));
    return () => controller.abort();
  }, [activeWorkspace?.id]);

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
      <aside className="fixed right-0 top-0 z-40 flex h-screen w-[260px] flex-col border-l border-white/[0.08] bg-black/60 p-5 backdrop-blur-2xl">
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

        <nav className="space-y-2">
          <div className="flex items-center gap-3 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3.5 text-sm">
            <House
              size={20}
              weight="duotone"
            />
            صفحه اصلی
          </div>

          <Link
            to="/dashboard/content"
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"
          >
            <Sparkle size={20} />
            استودیوی محتوا
          </Link>
          <Link
            to="/dashboard/business-brain"
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-white/55 transition hover:bg-white/[0.04]"
          >
            <Brain size={20} />
            برند و کسب‌وکار
          </Link>
        </nav>

        <div className="mt-auto rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="text-sm text-white/45">
            فضای کاری
          </div>

          <div className="mt-2">
            <WorkspaceSelector />
          </div>

          <div className="mt-4 text-sm text-white/40">
            {!onboarding ? "در حال بررسی راه‌اندازی…" : onboarding.complete ? "راه‌اندازی کامل" : onboarding.contextStale ? "شناخت کسب‌وکار نیازمند به‌روزرسانی" : "راه‌اندازی تکمیل نشده"}
          </div>
        </div>
      </aside>

      <section className="mr-[260px] min-h-screen">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#050507]/85 px-8 py-5 backdrop-blur-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">
                داشبورد
              </h1>

              {isDemo && (
                <span className="rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-3 py-1 text-xs text-cyan-200">
                  نسخه دمو
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-white/45">
              {isDemo
                ? `${business?.name} — نمای یکپارچه کسب‌وکار`
                : "همه ابزارهای هوش مصنوعی کسب‌وکارت در یک جا"}
            </p>
          </div>

          <Link
            to={!onboarding || onboarding.complete ? "/dashboard/content" : "/dashboard/onboarding"}
            className="flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-gradient-to-l from-violet-500/20 to-fuchsia-500/15 px-5 py-3 text-sm"
          >
            <Sparkle size={16} weight="bold" />
            {!onboarding || onboarding.complete ? "تولید محتوا" : onboarding.contextStale ? "به‌روزرسانی شناخت کسب‌وکار" : "ادامه راه‌اندازی"}
          </Link>
        </header>

        <div className="p-8">
          <section className="relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.035] p-8">
            <div className="pointer-events-none absolute -left-20 -top-20 h-[300px] w-[300px] rounded-full bg-violet-500/10 blur-[100px]" />

            <div className="relative z-10">
              <h2 className="text-3xl font-semibold">
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
                ۳ ابزار آماده
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
              پروژه‌های اخیر
            </h2>

            <div
              data-stagger
              className="mt-5 rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-10 text-center"
            >
              <FolderOpen
                size={30}
                weight="duotone"
                className="mx-auto text-white/30"
              />

              <p className="mt-4 text-base text-white/50">
                هنوز پروژه‌ای ساخته نشده
              </p>
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
