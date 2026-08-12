import { Link } from "react-router-dom";

import {
  ArrowRight,
  Brain,
  ChartLineUp,
  TrendUp,
  Megaphone,
  CurrencyCircleDollar,
  UsersThree,
  Sparkle,
  CalendarBlank,
  Bell,
  Rocket,
  Eye,
  UserPlus,
  ShoppingBag,
  Target,
  WarningCircle,
  CheckCircle,
  Lightning,
} from "@phosphor-icons/react";

type HealthCard = {
  title: string;
  value: number;
  description: string;
  icon: React.ElementType;
};

type Metric = {
  title: string;
  value: string;
  change?: string;
};

type FunnelStep = {
  title: string;
  value: string;
  width: string;
  icon: React.ElementType;
};

type Engine = {
  title: string;
  score: string;
  icon: React.ElementType;
  items: [string, string][];
};

const healthCards: HealthCard[] = [
  {
    title: "رشد کسب‌وکار",
    value: 86,
    description: "وضعیت کلی رشد فروش، مشتری و بازاریابی",
    icon: TrendUp,
  },
  {
    title: "سلامت بازاریابی",
    value: 84,
    description: "عملکرد تبلیغات، محتوا و جذب مشتری",
    icon: Megaphone,
  },
  {
    title: "سلامت فروش",
    value: 78,
    description: "توانایی تبدیل مشتری بالقوه به خرید",
    icon: CurrencyCircleDollar,
  },
  {
    title: "سلامت مشتریان",
    value: 82,
    description: "وفاداری، بازگشت و ارزش مشتریان",
    icon: UsersThree,
  },
];

const quickMetrics: Metric[] = [
  {
    title: "امتیاز عملکرد",
    value: "۸۶٪",
    change: "+۱۲٪",
  },
  {
    title: "سفارش‌ها",
    value: "۲۱۰",
    change: "+۲۲٪",
  },
  {
    title: "درآمد کل",
    value: "۳۸۴ میلیون",
    change: "+۱۷٪",
  },
  {
    title: "نرخ تبدیل",
    value: "۶.۲٪",
    change: "+۰.۸٪",
  },
  {
    title: "لید جدید",
    value: "۹۲",
    change: "+۱۸٪",
  },
  {
    title: "بازدید سایت",
    value: "۱۷۰ هزار",
    change: "+۲۱٪",
  },
];

const funnelSteps: FunnelStep[] = [
  {
    title: "آشنایی با برند",
    value: "۲۴۸ هزار نفر",
    width: "100%",
    icon: Eye,
  },
  {
    title: "بازدید و علاقه‌مندی",
    value: "۴۸ هزار نفر",
    width: "82%",
    icon: Eye,
  },
  {
    title: "مشتری بالقوه",
    value: "۲۱۳ نفر",
    width: "65%",
    icon: UserPlus,
  },
  {
    title: "تصمیم خرید",
    value: "۱۲۴ نفر",
    width: "48%",
    icon: ShoppingBag,
  },
  {
    title: "مشتری خریدار",
    value: "۸۶ نفر",
    width: "34%",
    icon: UsersThree,
  },
];

const engines: Engine[] = [
  {
    title: "موتور بازاریابی",
    score: "۸۴٪",
    icon: Megaphone,
    items: [
      ["هزینه جذب مشتری", "۴۸۰ هزار تومان"],
      ["بازده تبلیغات", "۴.۸ برابر"],
      ["نرخ تعامل", "۶.۲٪"],
      ["نرخ تبدیل", "۶.۸٪"],
    ],
  },
  {
    title: "موتور فروش",
    score: "۷۸٪",
    icon: CurrencyCircleDollar,
    items: [
      ["درآمد", "۳۸۴ میلیون"],
      ["ارزش فرصت فروش", "۱.۲ میلیارد"],
      ["موفقیت فروش", "۴۲٪"],
      ["زمان فروش", "۱۸ روز"],
    ],
  },
  {
    title: "موتور مشتری",
    score: "۸۲٪",
    icon: UsersThree,
    items: [
      ["مشتریان فعال", "۱,۲۴۸"],
      ["بازگشت مشتری", "۷۲٪"],
      ["ریزش مشتری", "۴.۵٪"],
      ["سلامت مشتری", "۸۲٪"],
    ],
  },
  {
    title: "موتور محتوا",
    score: "۹۱٪",
    icon: Sparkle,
    items: [
      ["امتیاز تعامل", "۹۱٪"],
      ["محتوای موفق", "آموزشی"],
      ["موضوع برتر", "هوش مصنوعی"],
      ["تبدیل محتوا", "۷.۲٪"],
    ],
  },
];

const growthBars = [42, 48, 55, 61, 58, 72, 81, 90];

export default function KPIPage() {
  return (
    <main
      dir="rtl"
      className="loadder-dashboard-bg min-h-screen text-white"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight size={18} />
            </Link>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <ChartLineUp
                size={25}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مرکز هوشمندی عملکرد
              </h1>

              <p className="mt-1 text-sm text-white/45">
                تصویر کامل عملکرد کسب‌وکار شما
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white/70"
            >
              <CalendarBlank size={17} />
              ۳۰ روز گذشته
            </button>

            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/60"
            >
              <Bell size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_330px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                مرکز فرمان رشد
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                اتاق فرمان رشد کسب‌وکار
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                Loadder داده‌های فروش، بازاریابی، مشتری و محتوا را کنار هم
                تحلیل می‌کند تا وضعیت واقعی رشد کسب‌وکار را به زبان ساده نمایش دهد.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.08] px-4 py-3">
                  <div className="text-xs text-white/40">
                    وضعیت کلی
                  </div>
                  <div className="mt-1 text-sm font-semibold text-emerald-300">
                    مثبت و رو به رشد
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] px-4 py-3">
                  <div className="text-xs text-white/40">
                    فرصت اصلی
                  </div>
                  <div className="mt-1 text-sm font-semibold text-violet-200">
                    افزایش نرخ تبدیل
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex min-h-[220px] items-center justify-center">
              <div className="absolute h-[190px] w-[190px] rounded-full border border-violet-400/15 bg-violet-500/[0.05]" />

              <div className="absolute h-[135px] w-[135px] rounded-full border border-cyan-400/10 bg-cyan-500/[0.04]" />

              <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-500/20 to-cyan-500/10 shadow-[0_0_50px_rgba(139,92,246,.18)]">
                <Rocket
                  size={45}
                  weight="duotone"
                  className="text-violet-200"
                />
              </div>
            </div>
          </div>
        </section>

        {/* HEALTH CARDS */}
        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {healthCards.map((item) => (
            <HealthCardComponent
              key={item.title}
              {...item}
            />
          ))}
        </section>

        {/* QUICK METRICS */}
        <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {quickMetrics.map((metric) => (
            <MetricCard
              key={metric.title}
              {...metric}
            />
          ))}
        </section>

        {/* FUNNEL + CHART */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Target
                size={23}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  مسیر تبدیل مشتری
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  از دیده‌شدن تا خرید
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-4">
              {funnelSteps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.title}
                    className="flex justify-center"
                  >
                    <div
                      className="rounded-2xl border border-violet-400/15 bg-gradient-to-l from-violet-500/20 via-blue-500/10 to-cyan-500/10 p-4 transition hover:scale-[1.015]"
                      style={{
                        width: step.width,
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/20">
                            <Icon
                              size={18}
                              weight="duotone"
                              className="text-cyan-300"
                            />
                          </div>

                          <div>
                            <div className="text-xs text-white/35">
                              مرحله {index + 1}
                            </div>
                            <div className="mt-0.5 text-sm font-semibold">
                              {step.title}
                            </div>
                          </div>
                        </div>

                        <span className="text-sm font-semibold">
                          {step.value}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  روند رشد در ۳۰ روز گذشته
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  تغییرات درآمد، مشتری و فروش
                </p>
              </div>

              <span className="rounded-full border border-emerald-400/10 bg-emerald-500/[0.08] px-3 py-1.5 text-xs text-emerald-300">
                +۲۱٪ رشد
              </span>
            </div>

            <div className="relative mt-8 h-[300px] overflow-hidden rounded-[24px] border border-white/[0.05] bg-black/20 p-6">
              <div className="pointer-events-none absolute inset-0 grid grid-rows-4">
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div />
              </div>

              <div className="relative flex h-full items-end gap-4">
                {growthBars.map((height, index) => (
                  <div
                    key={index}
                    className="group flex h-full flex-1 items-end"
                  >
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-violet-600/60 via-blue-500/75 to-cyan-300/90 transition duration-300 group-hover:opacity-80"
                      style={{
                        height: `${height}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 text-center text-xs text-white/35">
              <span>هفته اول</span>
              <span>هفته دوم</span>
              <span>هفته سوم</span>
              <span>هفته چهارم</span>
            </div>
          </div>
        </section>

        {/* GROWTH ENGINES */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                موتورهای رشد کسب‌وکار
              </h2>

              <p className="mt-1 text-sm text-white/40">
                بررسی عملکرد بخش‌های اصلی
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-cyan-300/75">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.8)]" />
              تحلیل هوشمند فعال
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {engines.map((engine) => (
              <EngineCard
                key={engine.title}
                {...engine}
              />
            ))}
          </div>
        </section>

        {/* INSIGHTS */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <InsightCard
            icon={CheckCircle}
            title="نقطه قوت"
            text="رشد مشتریان و درآمد در وضعیت خوبی قرار دارد."
            tone="success"
          />

          <InsightCard
            icon={WarningCircle}
            title="نیاز به توجه"
            text="نرخ تبدیل صفحه فروش پایین‌تر از هدف تعیین‌شده است."
            tone="warning"
          />

          <InsightCard
            icon={Sparkle}
            title="فرصت رشد"
            text="محتوای آموزشی بیشترین پتانسیل افزایش تعامل را دارد."
            tone="ai"
          />
        </section>

        {/* AI ADVISOR */}
        <section className="mt-8 overflow-hidden rounded-[32px] border border-violet-400/15 bg-gradient-to-l from-violet-500/[0.10] via-[#080d1d]/70 to-cyan-500/[0.05] p-8 backdrop-blur-xl">
          <div className="grid gap-8 xl:grid-cols-[1fr_370px]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.08]">
                  <Brain
                    size={25}
                    weight="duotone"
                    className="text-violet-300"
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-bold">
                    مشاور هوشمند Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    ترجمه داده‌ها به تصمیم قابل اجرا
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                روند رشد کسب‌وکار مثبت است، اما نرخ تبدیل بازدیدکننده به
                مشتری پایین‌تر از ظرفیت فعلی است. پیشنهاد Loadder این است
                که پیام صفحه فروش بهینه شود، محتوای آموزشی بیشتری تولید شود
                و بخشی از بودجه تبلیغات به کانال‌های پربازده منتقل شود.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <ActionSuggestion
                  title="بهبود صفحه فروش"
                  effect="+۱۱٪ تبدیل احتمالی"
                />

                <ActionSuggestion
                  title="پیگیری لیدهای داغ"
                  effect="+۸ مشتری احتمالی"
                />

                <ActionSuggestion
                  title="تقویت محتوای آموزشی"
                  effect="+۱۲٪ تعامل احتمالی"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="flex items-center gap-2">
                <Lightning
                  size={20}
                  weight="duotone"
                  className="text-cyan-300"
                />

                <span className="font-semibold">
                  اقدام بعدی
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60 transition hover:bg-white/[0.06]"
                >
                  فقط تحلیل کن
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-3 text-sm text-cyan-200 transition hover:bg-cyan-500/[0.12]"
                >
                  پیشنهاد بده
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,.2)]"
                >
                  اجرا با تأیید من
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HealthCardComponent({
  title,
  value,
  description,
  icon: Icon,
}: HealthCard) {
  return (
    <div className="rounded-[26px] border border-white/[0.08] bg-[#080d1d]/65 p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-white/45">
            {title}
          </div>

          <div className="mt-4 text-4xl font-bold">
            {value}٪
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/10 bg-gradient-to-br from-violet-500/15 to-cyan-500/10">
          <Icon
            size={21}
            weight="duotone"
            className="text-cyan-300"
          />
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300"
          style={{
            width: `${value}%`,
          }}
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-white/40">
        {description}
      </p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
}: Metric) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[#080d1d]/58 p-5 backdrop-blur-xl">
      <div className="text-sm text-white/40">
        {title}
      </div>

      <div className="mt-3 text-2xl font-bold">
        {value}
      </div>

      {change && (
        <div className="mt-2 text-xs text-emerald-300">
          {change} نسبت به دوره قبل
        </div>
      )}

      <div className="mt-4 h-1 rounded-full bg-gradient-to-l from-violet-500 to-cyan-300" />
    </div>
  );
}

function EngineCard({
  title,
  score,
  icon: Icon,
  items,
}: Engine) {
  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-[#080d1d]/65 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-500/[0.08]">
            <Icon
              size={21}
              weight="duotone"
              className="text-violet-300"
            />
          </div>

          <h3 className="font-semibold">
            {title}
          </h3>
        </div>

        <span className="text-xl font-bold text-cyan-300">
          {score}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-black/20 p-3"
          >
            <span className="text-sm text-white/40">
              {label}
            </span>

            <span className="text-sm font-semibold">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  tone: "success" | "warning" | "ai";
}) {
  const className =
    tone === "success"
      ? "border-emerald-400/15 bg-emerald-500/[0.05]"
      : tone === "warning"
        ? "border-amber-400/15 bg-amber-500/[0.05]"
        : "border-violet-400/15 bg-violet-500/[0.05]";

  return (
    <div
      className={`rounded-[24px] border p-5 backdrop-blur-xl ${className}`}
    >
      <Icon
        size={22}
        weight="duotone"
        className="text-cyan-300"
      />

      <h3 className="mt-4 font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-white/45">
        {text}
      </p>
    </div>
  );
}

function ActionSuggestion({
  title,
  effect,
}: {
  title: string;
  effect: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="text-sm font-semibold">
        {title}
      </div>

      <div className="mt-2 text-xs text-cyan-300">
        {effect}
      </div>
    </div>
  );
}