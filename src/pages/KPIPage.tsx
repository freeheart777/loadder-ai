import { useState } from "react";
import { Link } from "react-router-dom";
import { withDemo } from "../lib/demoMode";

import {
  ArrowRight,
  Gauge,
  Sparkle,
  Target,
  TrendUp,
  CurrencyDollar,
  UsersThree,
  Megaphone,
  InstagramLogo,
  ShoppingCart,
  ChartLineUp,
  Brain,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Lightning,
} from "@phosphor-icons/react";
import { demoBusiness } from "../data/demoBusiness";

type Department =
  | "growth"
  | "marketing"
  | "sales"
  | "crm"
  | "content";

const departmentData = {
  growth: {
    title: "رشد کسب‌وکار",
    score: 86,
    metrics: [
      { label: "رشد درآمد", value: "۱۷٪", progress: 72 },
      { label: "رشد مشتری", value: "۱۲٪", progress: 64 },
      { label: "نرخ تبدیل", value: "۶.۸٪", progress: 68 },
      { label: "ماندگاری مشتری", value: "۷۲٪", progress: 72 },
    ],
  },

  marketing: {
    title: "مارکتینگ",
    score: 82,
    metrics: [
      { label: "بازده هزینه تبلیغات", value: "۴.۸x", progress: 84 },
      { label: "هزینه جذب مشتری", value: "۴۸۰K", progress: 76 },
      { label: "هزینه هر لید", value: "۱۲۰K", progress: 69 },
      { label: "نرخ تعامل", value: "۸.۴٪", progress: 74 },
    ],
  },

  sales: {
    title: "فروش",
    score: 79,
    metrics: [
      { label: "ارزش پایپ‌لاین فروش", value: "۹۸۰M", progress: 78 },
      { label: "تبدیل لید به فروش", value: "۴۰٪", progress: 67 },
      { label: "میانگین ارزش معامله", value: "۲۴M", progress: 73 },
      { label: "چرخه فروش", value: "۱۴ روز", progress: 62 },
    ],
  },

  crm: {
    title: "CRM",
    score: 74,
    metrics: [
      { label: "مشتریان فعال", value: "۱,۲۴۸", progress: 81 },
      { label: "خرید مجدد", value: "۳۶٪", progress: 64 },
      { label: "سلامت مشتری", value: "۷۸٪", progress: 78 },
      { label: "ریزش مشتری", value: "۸٪", progress: 58 },
    ],
  },

  content: {
    title: "محتوا",
    score: 88,
    metrics: [
      { label: "امتیاز محتوا", value: "۹۱٪", progress: 91 },
      { label: "دسترسی", value: "۱۱۸K", progress: 84 },
      { label: "نرخ تعامل", value: "۸.۴٪", progress: 78 },
      { label: "لید حاصل از محتوا", value: "۳۲", progress: 70 },
    ],
  },
};

export default function KPIPage() {
  const isDemo =
    new URLSearchParams(window.location.search).get("demo") === "1";

  const demoKPI =
    isDemo ? demoBusiness.demoKPI : null;

  const [department, setDepartment] =
    useState<Department>("growth");

  const [decisionMode, setDecisionMode] =
    useState("approval");

  const active = departmentData[department];

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#05070a] text-white"
    >
      {isDemo && demoKPI && (
        <section className="mx-auto max-w-[1550px] px-8 pt-6">
          <div className="rounded-[28px] border border-violet-300/15 bg-violet-500/[0.045] p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-violet-200">
                  KPI کسب‌وکار — نسخه دمو
                </div>

                <h2 className="mt-1 text-xl font-semibold">
                  {demoBusiness.name}
                </h2>
              </div>

              <div className="text-left">
                <div className="text-4xl font-bold">
                  {demoKPI.growthScore}٪
                </div>

                <div className="text-sm text-white/35">
                  امتیاز رشد
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DemoKPIBox
                title="درآمد"
                target={demoKPI.targetRevenue}
                current={demoKPI.currentRevenue}
                progress={demoKPI.revenueProgress}
              />

              <DemoKPIBox
                title="مشتری جدید"
                target={`${demoKPI.customerTarget}`}
                current={`${demoKPI.currentCustomers}`}
                progress={demoKPI.customerProgress}
              />

              <DemoKPIBox
                title="نرخ تبدیل"
                target={demoKPI.conversionTarget}
                current={demoKPI.currentConversion}
                progress={demoKPI.conversionProgress}
              />

              <DemoKPIBox
                title="رشد"
                target={demoKPI.growthTarget}
                current={demoKPI.currentGrowth}
                progress={demoKPI.growthProgress}
              />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.3fr]">
              <div className="rounded-[24px] border border-white/[0.07] bg-black/20 p-6 text-center">
                <div className="text-sm text-white/40">
                  احتمال تحقق اهداف این دوره
                </div>

                <div className="mt-5 text-6xl font-bold text-violet-200">
                  {demoKPI.goalProbability}٪
                </div>

                <div className="mx-auto mt-5 h-2 max-w-[280px] overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
                    style={{
                      width: `${demoKPI.goalProbability}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/[0.07] bg-black/20 p-6">
                <div className="text-sm font-semibold">
                  اهداف و نتایج کلیدی
                </div>

                <div className="mt-4 space-y-3">
                  {demoKPI.objectives.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {item.title}
                        </span>

                        <span className="text-sm text-violet-300">
                          {item.progress}٪
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                        <span>
                          فعلی: {item.current}
                        </span>

                        <span>
                          هدف: {item.target}
                        </span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
                          style={{
                            width: `${item.progress}%`,
                          }}
                        />
                      </div>
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

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-500/10">
              <Gauge
                size={25}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مرکز KPI و رشد
              </h1>

              <p className="mt-1 text-sm text-white/50">
                کنترل اهداف و موتورهای رشد کسب‌وکار
              </p>
            </div>
          </div>

          <div
            dir="ltr"
            className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-xl font-bold text-transparent"
          >
            رشد هوشمند Loadder
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">

        {/* HERO */}

        <section className="relative overflow-hidden rounded-[32px] border border-violet-400/15 bg-[#0a0d13] p-8">
          <div className="pointer-events-none absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full bg-violet-600/[0.10] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_360px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2">
                <Sparkle
                  size={15}
                  weight="fill"
                  className="text-violet-300"
                />

                <span className="text-sm text-violet-200">
                  هوشمندی رشد
                </span>
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.5]">
                هدف را مشخص کن؛
                <span className="text-violet-300">
                  {" "}
                  Loadder فاصله تا رسیدن به آن را نشان می‌دهد.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-8 text-white/55">
                KPIهای مارکتینگ، فروش، CRM و محتوا در آینده از
                Analytics و Business Brain تغذیه می‌شوند تا فقط
                وضعیت را نبینی؛ احتمال رسیدن به هدف را هم بفهمی.
              </p>
            </div>

            <GaugeCard
              value={86}
              title="امتیاز رشد"
              subtitle="سلامت کلی رشد کسب‌وکار"
            />
          </div>
        </section>

        {/* NORTH STAR */}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TopMetric
            icon={CurrencyDollar}
            title="هدف Revenue"
            value="۵۰۰M"
            detail="۳۸۴M محقق شده"
            progress={77}
          />

          <TopMetric
            icon={UsersThree}
            title="هدف مشتری جدید"
            value="۱۲۰"
            detail="۸۶ مشتری"
            progress={72}
          />

          <TopMetric
            icon={Target}
            title="نرخ تبدیل Goal"
            value="۸٪"
            detail="فعلی ۶.۸٪"
            progress={85}
          />

          <TopMetric
            icon={TrendUp}
            title="هدف رشد"
            value="۲۵٪"
            detail="فعلی ۱۷٪"
            progress={68}
          />
        </section>

        {/* DEPARTMENTS */}

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              موتورهای رشد
            </h2>

            <p className="mt-1 text-sm text-white/45">
              KPIهای هر بخش را جداگانه بررسی کن.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <DepartmentButton
              active={department === "growth"}
              onClick={() => setDepartment("growth")}
              icon={TrendUp}
              title="رشد"
            />

            <DepartmentButton
              active={department === "marketing"}
              onClick={() => setDepartment("marketing")}
              icon={Megaphone}
              title="مارکتینگ"
            />

            <DepartmentButton
              active={department === "sales"}
              onClick={() => setDepartment("sales")}
              icon={ShoppingCart}
              title="فروش"
            />

            <DepartmentButton
              active={department === "crm"}
              onClick={() => setDepartment("crm")}
              icon={UsersThree}
              title="CRM"
            />

            <DepartmentButton
              active={department === "content"}
              onClick={() => setDepartment("content")}
              icon={InstagramLogo}
              title="محتوا"
            />
          </div>
        </section>

        {/* KPI ENGINE */}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {active.title}
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  وضعیت KPIهای کلیدی
                </p>
              </div>

              <div className="rounded-full border border-emerald-300/15 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                امتیاز {active.score}%
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {active.metrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  progress={metric.progress}
                />
              ))}
            </div>
          </div>

          {/* PROBABILITY */}

          <aside className="rounded-[30px] border border-violet-400/15 bg-violet-500/[0.05] p-7">
            <div className="flex items-center gap-3">
              <Brain
                size={24}
                weight="duotone"
                className="text-violet-300"
              />

              <h2 className="text-xl font-semibold">
                پیش‌بینی AI
              </h2>
            </div>

            <div className="mt-7 flex justify-center">
              <RingChart
                value={72}
                title="احتمال تحقق هدف"
              />
            </div>

            <p className="mt-6 text-sm leading-8 text-white/55">
              با روند فعلی احتمال رسیدن به هدف ماهانه حدود ۷۲٪
              است. مهم‌ترین مانع فعلی نرخ تبدیل و سرعت پیگیری
              لیدهای داغ است.
            </p>
          </aside>
        </section>

        {/* FUNNEL */}

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <فروشFunnel />

          <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
            <div className="flex items-center gap-3">
              <ChartLineUp
                size={23}
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  پیشرفت اهداف
                </h2>

                <p className="mt-1 text-sm text-white/45">
                  پیشرفت اهداف کلیدی
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-5">
              <GoalBar
                title="Revenue"
                value={77}
              />

              <GoalBar
                title="مشتریان جدید"
                value={72}
              />

              <GoalBar
                title="نرخ تبدیل"
                value={85}
              />

              <GoalBar
                title="ماندگاری مشتری"
                value={72}
              />
            </div>
          </div>
        </section>

        {/* OKR */}

        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                هدف و نتایج کلیدی
              </h2>

              <p className="mt-1 text-sm text-white/45">
                هدف اصلی این دوره
              </p>
            </div>

            <span className="rounded-full bg-violet-500/10 px-4 py-2 text-sm text-violet-200">
              Q3
            </span>
          </div>

          <div className="mt-6 rounded-[24px] border border-violet-300/10 bg-violet-500/[0.04] p-6">
            <div className="text-sm text-white/40">
              هدف اصلی
            </div>

            <h3 className="mt-2 text-xl font-semibold">
              رشد پایدار فروش دیجیتال
            </h3>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <KeyResult
                title="رشد درآمد"
                target="+۳۰٪"
                current="+۱۷٪"
                progress={57}
              />

              <KeyResult
                title="هزینه جذب مشتری"
                target="کمتر از ۴۵۰K"
                current="۴۸۰K"
                progress={82}
              />

              <KeyResult
                title="نرخ تبدیل"
                target="۸٪"
                current="۶.۸٪"
                progress={85}
              />
            </div>
          </div>
        </section>

        {/* AI ADVISOR */}

        <section className="mt-8 rounded-[32px] border border-violet-400/20 bg-gradient-to-l from-violet-500/[0.10] via-[#0a0d13] to-cyan-500/[0.05] p-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="flex items-center gap-3">
                <Sparkle
                  size={25}
                  weight="fill"
                  className="text-violet-300"
                />

                <h2 className="text-2xl font-bold">
                  مشاور هوشمند KPI Loadder
                </h2>
              </div>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/60">
                با وضعیت فعلی دو اقدام بیشترین اثر احتمالی روی
                تحقق KPIهای این ماه دارند: افزایش نرخ تبدیل صفحه
                فرود و پیگیری سریع‌تر لیدهای با امتیاز بالا.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <AdviceCard
                  title="اولویت اول"
                  value="Landing نرخ تبدیل"
                  trend="up"
                />

                <AdviceCard
                  title="اولویت دوم"
                  value="پیگیری لیدهای داغ"
                  trend="up"
                />

                <AdviceCard
                  title="ریسک"
                  value="هزینه جذب مشتری"
                  trend="down"
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-5">
              <div className="text-sm text-white/45">
                حالت تصمیم‌گیری هوش مصنوعی
              </div>

              <div className="mt-4 space-y-3">
                {[
                  ["analysis", "فقط تحلیل کن"],
                  ["recommend", "پیشنهاد اقدام بده"],
                  ["approval", "اجرا با تأیید من"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setDecisionMode(id)
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-sm transition ${
                      decisionMode === id
                        ? "border-violet-400/30 bg-violet-500/15 text-violet-100"
                        : "border-white/[0.07] bg-white/[0.025] text-white/55"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-4 text-sm font-semibold"
              >
                <Lightning
                  size={17}
                  weight="fill"
                />
                تحلیل KPIها با AI
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function GaugeCard({
  value,
  title,
  subtitle,
}: {
  value: number;
  title: string;
  subtitle: string;
}) {
  const angle = -90 + value * 1.8;

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-5">
      <div className="text-sm text-white/45">
        {title}
      </div>

      <div className="relative mx-auto mt-4 h-[130px] w-[210px] overflow-hidden">
        <div className="absolute left-1/2 top-[105px] h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[16px] border-white/[0.07]" />

        <div
          className="absolute left-1/2 top-[105px] h-[72px] w-[3px] origin-bottom rounded-full bg-cyan-300 shadow-[0_0_15px_rgba(103,232,249,0.9)] transition-transform duration-700"
          style={{
            transform: `translateX(-50%) rotate(${angle}deg)`,
          }}
        />

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <div className="text-3xl font-bold">
            {value}٪
          </div>
        </div>
      </div>

      <p className="mt-2 text-sm text-white/40">
        {subtitle}
      </p>
    </div>
  );
}

function RingChart({
  value,
  title,
}: {
  value: number;
  title: string;
}) {
  return (
    <div
      className="relative flex h-[190px] w-[190px] items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(
          #8b5cf6 0deg,
          #22d3ee ${value * 3.6}deg,
          rgba(255,255,255,0.06) ${value * 3.6}deg
        )`,
      }}
    >
      <div className="flex h-[145px] w-[145px] flex-col items-center justify-center rounded-full bg-[#0a0d13]">
        <span className="text-4xl font-bold">
          {value}٪
        </span>

        <span className="mt-2 text-sm text-white/40">
          {title}
        </span>
      </div>
    </div>
  );
}

function TopMetric({
  icon: Icon,
  title,
  value,
  detail,
  progress,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  detail: string;
  progress: number;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#0a0d13] p-5">
      <div className="flex items-center justify-between">
        <Icon
          size={21}
          weight="duotone"
          className="text-violet-300"
        />

        <span className="text-sm text-white/40">
          {progress}٪
        </span>
      </div>

      <div className="mt-5 text-sm text-white/45">
        {title}
      </div>

      <div className="mt-1 text-2xl font-semibold">
        {value}
      </div>

      <div className="mt-2 text-sm text-white/40">
        {detail}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}

function DepartmentButton({
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
      className={`flex items-center gap-3 rounded-[20px] border p-4 text-right transition ${
        active
          ? "border-violet-400/40 bg-violet-500/10"
          : "border-white/[0.07] bg-[#0a0d13] hover:bg-white/[0.04]"
      }`}
    >
      <Icon
        size={20}
        weight="duotone"
        className={
          active
            ? "text-cyan-300"
            : "text-white/40"
        }
      />

      <span className="text-sm font-semibold">
        {title}
      </span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/45">
          {label}
        </span>

        <span className="text-lg font-semibold">
          {value}
        </span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-400 to-cyan-300"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="mt-2 text-left text-sm text-white/30">
        {progress}%
      </div>
    </div>
  );
}

function فروشFunnel() {
  const stages = [
    ["بازدید", "۴۸K", "100%"],
    ["لید", "۲۱۳", "82%"],
    ["فرصت فروش", "۱۲۴", "64%"],
    ["مشتری", "۸۶", "48%"],
    ["خرید مجدد", "۳۱", "32%"],
  ];

  return (
    <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
      <h2 className="text-xl font-semibold">
        قیف رشد مشتری
      </h2>

      <p className="mt-1 text-sm text-white/45">
        از ورود مخاطب تا خرید مجدد
      </p>

      <div className="mt-7 space-y-3">
        {stages.map(([title, value, width]) => (
          <div
            key={title}
            className="flex justify-center"
          >
            <div
              style={{
                width,
              }}
              className="rounded-2xl border border-violet-300/10 bg-gradient-to-l from-violet-500/15 via-fuchsia-500/[0.08] to-cyan-500/[0.06] px-5 py-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/55">
                  {title}
                </span>

                <span className="text-lg font-semibold">
                  {value}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalBar({
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
          className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

function KeyResult({
  title,
  target,
  current,
  progress,
}: {
  title: string;
  target: string;
  current: string;
  progress: number;
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-black/20 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle
          size={17}
          className="text-violet-300"
        />

        <span className="text-sm font-semibold">
          {title}
        </span>
      </div>

      <div className="mt-4 text-sm text-white/40">
        هدف: {target}
      </div>

      <div className="mt-1 text-base">
        فعلی: {current}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}

function AdviceCard({
  title,
  value,
  trend,
}: {
  title: string;
  value: string;
  trend: "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <div className="text-sm text-white/40">
        {title}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {value}
        </span>

        {trend === "up" ? (
          <ArrowUp
            size={16}
            className="text-emerald-300"
          />
        ) : (
          <ArrowDown
            size={16}
            className="text-amber-300"
          />
        )}
      </div>
    </div>
  );
}


function DemoKPIBox({
  title,
  target,
  current,
  progress,
}: {
  title: string;
  target: string;
  current: string;
  progress: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/45">
          {title}
        </div>

        <div className="text-sm text-violet-300">
          {progress}٪
        </div>
      </div>

      <div className="mt-4 text-2xl font-bold">
        {current}
      </div>

      <div className="mt-1 text-xs text-white/35">
        هدف: {target}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}
