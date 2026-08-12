import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Gauge,
  TrendUp,
  TrendDown,
  Target,
  UsersThree,
  CurrencyCircleDollar,
  ShoppingCart,
  Megaphone,
  Globe,
  Sparkle,
  Brain,
  CheckCircle,
  WarningCircle,
  ChartLineUp,
  Lightning,
  Eye,
  Funnel,
} from "@phosphor-icons/react";

import { businessData } from "../data/businessData";

type KpiStatus = "خوب" | "نیاز به توجه" | "بحرانی";

type Metric = {
  title: string;
  value: string;
  change?: string;
  status?: KpiStatus;
  icon: React.ElementType;
  description: string;
};

type EngineItem = {
  title: string;
  value: string;
};

type Engine = {
  title: string;
  score: number;
  icon: React.ElementType;
  description: string;
  items: EngineItem[];
};

function toFa(value: number) {
  return value.toLocaleString("fa-IR");
}

function percent(value: number) {
  return `${value.toLocaleString("fa-IR")}٪`;
}

const topMetrics: Metric[] = [
  {
    title: "سلامت کلی کسب‌وکار",
    value: percent(
      businessData.business.healthScore
    ),
    change: "+۶٪",
    status: "خوب",
    icon: Gauge,
    description:
      "ترکیب فروش، مشتری، بازاریابی و عملکرد کلی",
  },
  {
    title: "درآمد",
    value: businessData.sales.revenueLabel,
    change: "+۱۷٪",
    status: "خوب",
    icon: CurrencyCircleDollar,
    description:
      "درآمد ثبت‌شده در دوره فعلی",
  },
  {
    title: "مشتریان بالقوه",
    value: toFa(
      businessData.crm.newLeads
    ),
    change: "+۱۲٪",
    status: "خوب",
    icon: UsersThree,
    description:
      "مشتریان بالقوه جدید در این دوره",
  },
  {
    title: "نرخ تبدیل",
    value: percent(
      businessData.sales.conversionRate
    ),
    change: "+۸٪",
    status: "نیاز به توجه",
    icon: Target,
    description:
      "تبدیل بازدیدکننده و لید به مشتری",
  },
];

const engines: Engine[] = [
  {
    title: "فروش",
    score: 86,
    icon: ShoppingCart,
    description:
      "عملکرد درآمد، سفارش و تبدیل مشتری",
    items: [
      {
        title: "درآمد",
        value:
          businessData.sales.revenueLabel,
      },
      {
        title: "تعداد سفارش",
        value: toFa(
          businessData.sales.orders
        ),
      },
      {
        title: "نرخ تبدیل",
        value: percent(
          businessData.sales
            .conversionRate
        ),
      },
      {
        title: "ارزش فرصت‌ها",
        value:
          businessData.sales
            .opportunityValueLabel,
      },
    ],
  },

  {
    title: "بازاریابی",
    score: 84,
    icon: Megaphone,
    description:
      "هزینه، بازده و کیفیت جذب مشتری",
    items: [
      {
        title: "هزینه تبلیغات",
        value:
          businessData.marketing
            .adSpendLabel,
      },
      {
        title: "هزینه جذب مشتری",
        value:
          businessData.marketing
            .cacLabel,
      },
      {
        title: "بازده تبلیغات",
        value: `${businessData.marketing.roas.toLocaleString(
          "fa-IR"
        )} برابر`,
      },
      {
        title: "نرخ تعامل",
        value: percent(
          businessData.marketing
            .engagementRate
        ),
      },
    ],
  },

  {
    title: "مشتریان",
    score: 81,
    icon: UsersThree,
    description:
      "سلامت ارتباط با مشتری و کیفیت لید",
    items: [
      {
        title: "کل مشتریان",
        value: toFa(
          businessData.crm.totalCustomers
        ),
      },
      {
        title: "مشتریان فعال",
        value: toFa(
          businessData.crm.activeCustomers
        ),
      },
      {
        title: "لیدهای داغ",
        value: toFa(
          businessData.crm.hotLeads
        ),
      },
      {
        title: "حفظ مشتری",
        value: percent(
          businessData.crm.retentionRate
        ),
      },
    ],
  },

  {
    title: "وب‌سایت",
    score: 78,
    icon: Globe,
    description:
      "رفتار کاربران و تبدیل سایت",
    items: [
      {
        title: "بازدید",
        value: toFa(
          businessData.website.visits
        ),
      },
      {
        title: "لید",
        value: toFa(
          businessData.website.leads
        ),
      },
      {
        title: "نرخ تبدیل",
        value: percent(
          businessData.website
            .conversionRate
        ),
      },
      {
        title: "وضعیت",
        value: "رو به رشد",
      },
    ],
  },

  {
    title: "محتوا",
    score:
      businessData.content
        .performanceScore,
    icon: Sparkle,
    description:
      "قدرت محتوا در تعامل و تبدیل",
    items: [
      {
        title: "امتیاز عملکرد",
        value: percent(
          businessData.content
            .performanceScore
        ),
      },
      {
        title: "محتوای موفق",
        value:
          businessData.content
            .bestContentType,
      },
      {
        title: "موضوع برتر",
        value:
          businessData.content.topTopic,
      },
      {
        title: "تبدیل محتوا",
        value: percent(
          businessData.content
            .conversionRate
        ),
      },
    ],
  },

  {
    title: "آمادگی رشد",
    score:
      businessData.business
        .growthReadiness,
    icon: TrendUp,
    description:
      "توان فعلی کسب‌وکار برای رشد",
    items: [
      {
        title: "آمادگی رشد",
        value: percent(
          businessData.business
            .growthReadiness
        ),
      },
      {
        title: "کیفیت داده",
        value: percent(
          businessData.business
            .dataQuality
        ),
      },
      {
        title: "ریسک",
        value: percent(
          businessData.business
            .riskScore
        ),
      },
      {
        title: "هدف اصلی",
        value:
          businessData.goals.primary,
      },
    ],
  },
];

const scoreHistory = [
  63, 67, 69, 72, 75, 79, 82,
  businessData.business.healthScore,
];

const funnelItems = [
  {
    title: "دیده‌شدن",
    value: businessData.marketing.reach,
  },
  {
    title: "بازدید سایت",
    value: businessData.website.visits,
  },
  {
    title: "مشتری بالقوه",
    value: businessData.crm.newLeads,
  },
  {
    title: "لید داغ",
    value: businessData.crm.hotLeads,
  },
  {
    title: "سفارش",
    value: businessData.sales.orders,
  },
];

export default function KPIPage() {
  const [period, setPeriod] =
    useState("۳۰ روز");

  const [activeEngine, setActiveEngine] =
    useState("فروش");

  const [notice, setNotice] =
    useState("");

  const currentEngine = useMemo(
    () =>
      engines.find(
        (item) =>
          item.title === activeEngine
      ) ?? engines[0],
    [activeEngine]
  );

  const showNotice = (
    message: string
  ) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2200);
  };

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

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <Gauge
                size={25}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مرکز سنجش عملکرد
              </h1>

              <p className="mt-1 text-sm text-white/45">
                وضعیت واقعی کسب‌وکار در یک نگاه
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {[
              "۷ روز",
              "۳۰ روز",
              "۹۰ روز",
            ].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setPeriod(item)
                }
                className={`rounded-xl border px-4 py-2.5 text-sm transition ${
                  period === item
                    ? "border-violet-400/25 bg-violet-500/[0.12] text-violet-200"
                    : "border-white/[0.07] bg-white/[0.03] text-white/45 hover:bg-white/[0.06]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}

        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                تحلیل سلامت کسب‌وکار
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                فقط عدد نبین؛
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  بفهم کسب‌وکارت کجا قوی و کجا ضعیف است.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                شاخص‌های فروش، مشتری،
                بازاریابی، محتوا و وب‌سایت
                حالا از یک منبع داده مشترک
                Loadder تغذیه می‌شوند.
              </p>
            </div>

            <div className="rounded-[28px] border border-cyan-300/15 bg-cyan-500/[0.05] p-6">
              <div className="text-sm text-white/40">
                سلامت کلی
              </div>

              <div className="mt-4 text-6xl font-bold text-cyan-300">
                {percent(
                  businessData.business
                    .healthScore
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
                <TrendUp
                  size={17}
                  weight="bold"
                />

                وضعیت کلی مثبت است
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300"
                  style={{
                    width: `${businessData.business.healthScore}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* TOP KPI */}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {topMetrics.map((metric) => (
            <MetricCard
              key={metric.title}
              metric={metric}
            />
          ))}
        </section>

        {/* BUSINESS HEALTH TREND */}

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  روند سلامت کسب‌وکار
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  تغییر امتیاز کلی در دوره‌های اخیر
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/10 bg-cyan-500/[0.07] px-4 py-2 text-xs text-cyan-300">
                {period}
              </span>
            </div>

            <div className="relative mt-8 h-[290px] overflow-hidden rounded-[24px] border border-white/[0.05] bg-black/20 p-6">
              <div className="pointer-events-none absolute inset-0 grid grid-rows-4">
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div />
              </div>

              <div className="relative flex h-full items-end gap-4">
                {scoreHistory.map(
                  (score, index) => (
                    <div
                      key={index}
                      className="flex h-full flex-1 items-end"
                    >
                      <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-violet-600/60 via-blue-500/80 to-cyan-300/90"
                        style={{
                          height: `${score}%`,
                        }}
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* AI SUMMARY */}

          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] via-[#080d1d]/70 to-cyan-500/[0.04] p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Sparkle
                size={22}
                weight="fill"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  تحلیل Loadder
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  خلاصه وضعیت فعلی
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-8 text-white/55">
              سلامت کلی کسب‌وکار مناسب است.
              فروش و جذب مشتری روند مثبت
              دارند اما نرخ تبدیل هنوز
              ظرفیت بهبود دارد.
            </p>

            <div className="mt-6 space-y-3">
              <InsightRow
                icon={CheckCircle}
                title="نقطه قوت"
                value="فروش و بازاریابی"
                positive
              />

              <InsightRow
                icon={WarningCircle}
                title="نیاز به توجه"
                value="نرخ تبدیل"
              />

              <InsightRow
                icon={Lightning}
                title="فرصت فوری"
                value="پیگیری لیدهای داغ"
                positive
              />
            </div>
          </aside>
        </section>

        {/* ENGINES */}

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              موتورهای کسب‌وکار
            </h2>

            <p className="mt-1 text-sm text-white/40">
              هر بخش را برای مشاهده جزئیات انتخاب کن.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {engines.map((engine) => {
              const Icon = engine.icon;
              const active =
                activeEngine === engine.title;

              return (
                <button
                  key={engine.title}
                  type="button"
                  onClick={() =>
                    setActiveEngine(
                      engine.title
                    )
                  }
                  className={`rounded-[22px] border p-5 text-right transition ${
                    active
                      ? "border-violet-400/30 bg-violet-500/[0.10]"
                      : "border-white/[0.07] bg-[#080d1d]/55 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon
                      size={21}
                      weight="duotone"
                      className={
                        active
                          ? "text-cyan-300"
                          : "text-white/35"
                      }
                    />

                    <span className="text-lg font-bold">
                      {percent(
                        engine.score
                      )}
                    </span>
                  </div>

                  <div className="mt-4 text-sm font-semibold">
                    {engine.title}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ENGINE DETAIL */}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {currentEngine.title}
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  {currentEngine.description}
                </p>
              </div>

              <div className="text-4xl font-bold text-cyan-300">
                {percent(
                  currentEngine.score
                )}
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {currentEngine.items.map(
                (item) => (
                  <EngineMetric
                    key={item.title}
                    title={item.title}
                    value={item.value}
                  />
                )
              )}
            </div>
          </div>

          <aside className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Target
                size={22}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  هدف فعلی
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اولویت کسب‌وکار
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-violet-300/10 bg-violet-500/[0.06] p-5">
              <div className="text-xs text-white/35">
                هدف اصلی
              </div>

              <div className="mt-2 text-xl font-bold">
                {businessData.goals.primary}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {businessData.goals.secondary.map(
                (goal) => (
                  <div
                    key={goal}
                    className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-white/55"
                  >
                    {goal}
                  </div>
                )
              )}
            </div>
          </aside>
        </section>

        {/* FUNNEL */}

        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Funnel
              size={23}
              weight="duotone"
              className="text-violet-300"
            />

            <div>
              <h2 className="text-xl font-semibold">
                قیف رشد
              </h2>

              <p className="mt-1 text-sm text-white/40">
                حرکت مخاطب از دیده‌شدن تا خرید
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-5">
            {funnelItems.map(
              (item, index) => (
                <FunnelMetric
                  key={item.title}
                  index={index + 1}
                  title={item.title}
                  value={toFa(
                    item.value
                  )}
                />
              )
            )}
          </div>
        </section>

        {/* DATA QUALITY */}

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HealthBox
            icon={Eye}
            title="کیفیت داده"
            value={
              businessData.business
                .dataQuality
            }
          />

          <HealthBox
            icon={TrendUp}
            title="آمادگی رشد"
            value={
              businessData.business
                .growthReadiness
            }
          />

          <HealthBox
            icon={WarningCircle}
            title="ریسک"
            value={
              businessData.business
                .riskScore
            }
            danger
          />

          <HealthBox
            icon={ChartLineUp}
            title="عملکرد محتوا"
            value={
              businessData.content
                .performanceScore
            }
          />
        </section>

        {/* AI ACTION */}

        <section className="mt-8 overflow-hidden rounded-[32px] border border-violet-400/15 bg-gradient-to-l from-violet-500/[0.10] via-[#080d1d]/70 to-cyan-500/[0.05] p-8 backdrop-blur-xl">
          <div className="grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.08]">
                  <Brain
                    size={26}
                    weight="duotone"
                    className="text-violet-300"
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-bold">
                    تصمیم بعدی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    KPI را به اقدام تبدیل کن
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                با توجه به داده فعلی،
                مهم‌ترین فرصت رشد افزایش نرخ
                تبدیل و پیگیری سریع‌تر
                مشتریان بالقوه است.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <ActionMetric
                  title="اولویت اول"
                  value="بهبود نرخ تبدیل"
                />

                <ActionMetric
                  title="اولویت دوم"
                  value={`${toFa(
                    businessData.crm
                      .hotLeads
                  )} لید داغ`}
                />

                <ActionMetric
                  title="اولویت سوم"
                  value="کاهش هزینه جذب"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="font-semibold">
                اقدام پیشنهادی
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "تحلیل جزئی KPI در مرحله بعد فعال می‌شود."
                    )
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60"
                >
                  مشاهده تحلیل کامل
                </button>

                <Link
                  to="/dashboard/predictive"
                  className="block w-full rounded-xl border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-3 text-center text-sm text-cyan-200"
                >
                  پیش‌بینی نتیجه
                </Link>

                <Link
                  to="/dashboard/business-brain"
                  className="block w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-center text-sm font-semibold"
                >
                  ورود به مغز هوشمند
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {notice && (
        <div className="fixed bottom-7 left-7 z-[100] max-w-md rounded-2xl border border-violet-300/20 bg-[#090e1e]/95 px-5 py-4 text-sm shadow-2xl backdrop-blur-xl">
          {notice}
        </div>
      )}
    </main>
  );
}

function MetricCard({
  metric,
}: {
  metric: Metric;
}) {
  const Icon = metric.icon;

  const statusClass =
    metric.status === "خوب"
      ? "text-emerald-300"
      : metric.status ===
          "نیاز به توجه"
        ? "text-amber-300"
        : "text-red-300";

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/40">
          {metric.title}
        </span>

        <Icon
          size={21}
          weight="duotone"
          className="text-cyan-300"
        />
      </div>

      <div className="mt-4 text-2xl font-bold">
        {metric.value}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-emerald-300">
          {metric.change}
        </span>

        <span
          className={`text-xs ${statusClass}`}
        >
          {metric.status}
        </span>
      </div>

      <p className="mt-4 text-xs leading-6 text-white/35">
        {metric.description}
      </p>
    </div>
  );
}

function InsightRow({
  icon: Icon,
  title,
  value,
  positive = false,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <Icon
        size={19}
        weight="duotone"
        className={
          positive
            ? "text-emerald-300"
            : "text-amber-300"
        }
      />

      <div>
        <div className="text-xs text-white/30">
          {title}
        </div>

        <div className="mt-1 text-sm font-semibold">
          {value}
        </div>
      </div>
    </div>
  );
}

function EngineMetric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <div className="text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-lg font-bold">
        {value}
      </div>
    </div>
  );
}

function FunnelMetric({
  index,
  title,
  value,
}: {
  index: number;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/[0.10] text-sm text-violet-300">
        {index.toLocaleString("fa-IR")}
      </div>

      <div className="mt-4 text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-xl font-bold">
        {value}
      </div>
    </div>
  );
}

function HealthBox({
  icon: Icon,
  title,
  value,
  danger = false,
}: {
  icon: React.ElementType;
  title: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/40">
            {title}
          </div>

          <div
            className={`mt-3 text-3xl font-bold ${
              danger
                ? "text-amber-300"
                : "text-cyan-300"
            }`}
          >
            {percent(value)}
          </div>
        </div>

        <Icon
          size={22}
          weight="duotone"
          className={
            danger
              ? "text-amber-300"
              : "text-violet-300"
          }
        />
      </div>

      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${
            danger
              ? "bg-gradient-to-l from-amber-500 to-red-400"
              : "bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300"
          }`}
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

function ActionMetric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}