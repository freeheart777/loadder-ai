import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  ChartLineUp,
  TrendUp,
  TrendDown,
  CurrencyCircleDollar,
  Megaphone,
  UsersThree,
  Target,
  Globe,
  ShoppingCart,
  Sparkle,
  Brain,
  Eye,
  Funnel,
  Lightning,
  WarningCircle,
  CheckCircle,
  Storefront,
  UserPlus,
  Repeat,
  Package,
} from "@phosphor-icons/react";

import { businessData } from "../data/businessData";

type Period = "۷ روز" | "۳۰ روز" | "۹۰ روز";

type MetricCardData = {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ElementType;
  description: string;
};

type ChannelPerformance = {
  title: string;
  visitors: string;
  leads: string;
  sales: string;
  conversion: string;
  score: number;
};

type Insight = {
  title: string;
  description: string;
  type: "positive" | "warning" | "opportunity";
};

function faNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

function faPercent(value: number) {
  return `${value.toLocaleString("fa-IR")}٪`;
}

const metrics: MetricCardData[] = [
  {
    title: "درآمد کل",
    value: businessData.sales.revenueLabel,
    change: "+۱۷٪",
    positive: true,
    icon: CurrencyCircleDollar,
    description: "مجموع درآمد ثبت‌شده در دوره فعلی",
  },
  {
    title: "فروش آنلاین سایت",
    value: businessData.ecommerce.onlineRevenueLabel,
    change: "+۲۱٪",
    positive: true,
    icon: Storefront,
    description: "درآمد حاصل از سفارش‌های آنلاین",
  },
  {
    title: "بازده تبلیغات",
    value: `${businessData.marketing.roas.toLocaleString("fa-IR")} برابر`,
    change: "+۱۲٪",
    positive: true,
    icon: Megaphone,
    description: "بازده هزینه تبلیغات نسبت به درآمد",
  },
  {
    title: "نرخ تبدیل",
    value: faPercent(businessData.website.conversionRate),
    change: "+۸٪",
    positive: true,
    icon: Target,
    description: "تبدیل بازدیدکننده به مشتری یا خرید",
  },
];

const channelPerformance: ChannelPerformance[] = [
  {
    title: "تبلیغات گوگل",
    visitors: "۱۸,۴۰۰",
    leads: "۸۶",
    sales: "۷۸ میلیون",
    conversion: "۷.۸٪",
    score: 92,
  },
  {
    title: "اینستاگرام",
    visitors: "۱۲,۷۰۰",
    leads: "۵۸",
    sales: "۵۲ میلیون",
    conversion: "۶.۴٪",
    score: 84,
  },
  {
    title: "ورودی مستقیم",
    visitors: "۹,۳۰۰",
    leads: "۴۱",
    sales: "۳۹ میلیون",
    conversion: "۵.۹٪",
    score: 78,
  },
  {
    title: "معرفی مشتری",
    visitors: "۴,۸۰۰",
    leads: "۲۸",
    sales: "۲۹ میلیون",
    conversion: "۸.۲٪",
    score: 88,
  },
];

const insights: Insight[] = [
  {
    title: "فروش آنلاین در حال رشد است",
    description:
      "درآمد فروشگاه نسبت به دوره قبل افزایش داشته و سهم بیشتری از درآمد کل گرفته است.",
    type: "positive",
  },
  {
    title: "سبد خرید رهاشده فرصت فوری است",
    description: `${faNumber(
      businessData.ecommerce.abandonedCarts
    )} سبد خرید رهاشده شناسایی شده که می‌تواند با اتوماسیون بازیابی شود.`,
    type: "opportunity",
  },
  {
    title: "هزینه جذب باید کنترل شود",
    description: `هزینه جذب فعلی ${businessData.marketing.cacLabel} است و کاهش آن می‌تواند سودآوری رشد را بالا ببرد.`,
    type: "warning",
  },
];

const salesTrend = [58, 62, 66, 63, 72, 76, 82, 88];

const ecommerceFunnel = [
  {
    title: "بازدید سایت",
    value: businessData.website.visits,
    width: 100,
  },
  {
    title: "مشاهده محصول",
    value: businessData.website.productViews,
    width: 82,
  },
  {
    title: "افزودن به سبد",
    value: businessData.website.addToCart,
    width: 62,
  },
  {
    title: "شروع پرداخت",
    value: businessData.ecommerce.checkoutStarted,
    width: 48,
  },
  {
    title: "خرید موفق",
    value: businessData.ecommerce.completedPurchases,
    width: 34,
  },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("۳۰ روز");
  const [activeChannel, setActiveChannel] = useState("تبلیغات گوگل");
  const [notice, setNotice] = useState("");

  const currentChannel = useMemo(
    () =>
      channelPerformance.find(
        (channel) => channel.title === activeChannel
      ) ?? channelPerformance[0],
    [activeChannel]
  );

  const showNotice = (message: string) => {
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

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <ChartLineUp
                size={25}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                تحلیل و گزارش
              </h1>

              <p className="mt-1 text-sm text-white/45">
                فروش، تبلیغات، مشتری و رفتار سایت در یک نمای مشترک
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {(["۷ روز", "۳۰ روز", "۹۰ روز"] as Period[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-xl border px-4 py-2.5 text-sm transition ${
                  period === item
                    ? "border-violet-400/25 bg-violet-500/[0.10] text-violet-200"
                    : "border-white/[0.07] bg-white/[0.03] text-white/45"
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

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_380px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-2 text-sm text-cyan-200">
                <Brain size={16} weight="duotone" />
                تحلیل یکپارچه Loadder
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                بفهم رشد از کجا می‌آید،
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  کجا پول از دست می‌رود و قدم بعدی چیست.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                Analytics داده‌های سایت، CRM، فروش آنلاین، تبلیغات،
                محتوا و KPI را کنار هم قرار می‌دهد تا فقط گزارش نبینی؛
                دلیل اتفاق‌ها را هم بفهمی.
              </p>
            </div>

            <div className="rounded-[26px] border border-violet-300/15 bg-violet-500/[0.06] p-6">
              <div className="flex items-center gap-3">
                <Sparkle
                  size={21}
                  weight="fill"
                  className="text-violet-300"
                />

                <h3 className="text-lg font-semibold">
                  خلاصه هوشمند
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                فروش آنلاین در وضعیت مثبت است، اما سبدهای رهاشده و
                هزینه جذب مشتری هنوز دو نقطه مهم برای بهینه‌سازی هستند.
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs text-cyan-300">
                <TrendUp size={16} />
                احتمال رشد فعلی{" "}
                {faPercent(
                  businessData.predictive.growthProbability
                )}
              </div>
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.title}
              metric={metric}
            />
          ))}
        </section>

        {/* REVENUE TREND */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  روند درآمد و رشد
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  رفتار درآمد در بازه {period}
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/10 bg-cyan-500/[0.07] px-4 py-2 text-xs text-cyan-300">
                رشد مثبت
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
                {salesTrend.map((value, index) => (
                  <div
                    key={index}
                    className="flex h-full flex-1 items-end"
                  >
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-violet-600/60 via-blue-500/80 to-cyan-300/90"
                      style={{
                        height: `${value}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <CurrencyCircleDollar
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  اقتصاد رشد
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  هزینه و بازده جذب مشتری
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <AnalyticsRow
                title="هزینه تبلیغات"
                value={businessData.marketing.adSpendLabel}
              />

              <AnalyticsRow
                title="هزینه جذب مشتری"
                value={businessData.marketing.cacLabel}
              />

              <AnalyticsRow
                title="بازده تبلیغات"
                value={`${businessData.marketing.roas.toLocaleString(
                  "fa-IR"
                )} برابر`}
              />

              <AnalyticsRow
                title="درآمد سایت از تبلیغات"
                value={
                  businessData.marketing.websiteRevenueFromAdsLabel
                }
              />

              <AnalyticsRow
                title="میانگین مبلغ سفارش"
                value={
                  businessData.ecommerce.averageOrderValueLabel
                }
              />
            </div>
          </aside>
        </section>

        {/* ECOMMERCE FUNNEL */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <Funnel
                size={23}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  قیف فروش آنلاین
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  مسیر کاربر از بازدید تا خرید
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              {ecommerceFunnel.map((item, index) => (
                <div
                  key={item.title}
                  className="flex justify-center"
                >
                  <div
                    className="rounded-2xl border border-violet-400/15 bg-gradient-to-l from-violet-500/20 via-blue-500/10 to-cyan-500/10 px-5 py-4"
                    style={{
                      width: `${item.width}%`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/30">
                          مرحله {(index + 1).toLocaleString("fa-IR")}
                        </div>

                        <div className="mt-1 text-sm font-semibold">
                          {item.title}
                        </div>
                      </div>

                      <div className="text-lg font-bold">
                        {faNumber(item.value)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  وضعیت فروشگاه
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  مهم‌ترین شاخص‌های تجارت الکترونیک
                </p>
              </div>

              <Storefront
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <CommerceCard
                title="خرید موفق"
                value={faNumber(
                  businessData.ecommerce.completedPurchases
                )}
                icon={CheckCircle}
              />

              <CommerceCard
                title="سبد رهاشده"
                value={faNumber(
                  businessData.ecommerce.abandonedCarts
                )}
                icon={ShoppingCart}
              />

              <CommerceCard
                title="مشتری تکرارشونده"
                value={faNumber(
                  businessData.ecommerce.repeatCustomers
                )}
                icon={Repeat}
              />

              <CommerceCard
                title="ارزش طول عمر مشتری"
                value={
                  businessData.ecommerce.customerLifetimeValueLabel
                }
                icon={UsersThree}
              />
            </div>
          </div>
        </section>

        {/* CHANNEL PERFORMANCE */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              عملکرد کانال‌های جذب
            </h2>

            <p className="mt-1 text-sm text-white/40">
              کدام کانال واقعاً فروش و مشتری می‌سازد؟
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {channelPerformance.map((channel) => (
              <ChannelCard
                key={channel.title}
                channel={channel}
                active={activeChannel === channel.title}
                onClick={() =>
                  setActiveChannel(channel.title)
                }
              />
            ))}
          </div>
        </section>

        {/* CHANNEL DETAIL */}
        <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {currentChannel.title}
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  جزئیات عملکرد این کانال
                </p>
              </div>

              <span className="text-3xl font-bold text-cyan-300">
                {currentChannel.score.toLocaleString("fa-IR")}٪
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ChannelMetric
                title="بازدید"
                value={currentChannel.visitors}
              />

              <ChannelMetric
                title="لید"
                value={currentChannel.leads}
              />

              <ChannelMetric
                title="فروش"
                value={currentChannel.sales}
              />

              <ChannelMetric
                title="نرخ تبدیل"
                value={currentChannel.conversion}
              />
            </div>
          </div>

          <aside className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <UsersThree
                size={23}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  تحلیل مشتری
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  کیفیت و رفتار مشتریان
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <AnalyticsRow
                title="کل مشتریان"
                value={faNumber(
                  businessData.crm.totalCustomers
                )}
              />

              <AnalyticsRow
                title="لید جدید"
                value={faNumber(
                  businessData.crm.newLeads
                )}
              />

              <AnalyticsRow
                title="لید داغ"
                value={faNumber(
                  businessData.crm.hotLeads
                )}
              />

              <AnalyticsRow
                title="حفظ مشتری"
                value={faPercent(
                  businessData.crm.retentionRate
                )}
              />

              <AnalyticsRow
                title="ریزش"
                value={faPercent(
                  businessData.crm.churnRate
                )}
              />
            </div>
          </aside>
        </section>

        {/* CONTENT + WEBSITE */}
        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  تحلیل محتوا
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اثر محتوا بر تعامل و تبدیل
                </p>
              </div>

              <Sparkle
                size={22}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <CommerceCard
                title="امتیاز محتوا"
                value={faPercent(
                  businessData.content.performanceScore
                )}
                icon={Sparkle}
              />

              <CommerceCard
                title="بهترین نوع محتوا"
                value={
                  businessData.content.bestContentType
                }
                icon={CheckCircle}
              />

              <CommerceCard
                title="موضوع برتر"
                value={businessData.content.topTopic}
                icon={Eye}
              />

              <CommerceCard
                title="نرخ تبدیل محتوا"
                value={faPercent(
                  businessData.content.conversionRate
                )}
                icon={Target}
              />
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  رفتار سایت
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  عملکرد بازدیدکنندگان و تبدیل
                </p>
              </div>

              <Globe
                size={22}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <CommerceCard
                title="بازدید"
                value={faNumber(
                  businessData.website.visits
                )}
                icon={Eye}
              />

              <CommerceCard
                title="بازدیدکننده یکتا"
                value={faNumber(
                  businessData.website.uniqueVisitors
                )}
                icon={UsersThree}
              />

              <CommerceCard
                title="مشاهده محصول"
                value={faNumber(
                  businessData.website.productViews
                )}
                icon={Package}
              />

              <CommerceCard
                title="افزودن به سبد"
                value={faNumber(
                  businessData.website.addToCart
                )}
                icon={ShoppingCart}
              />
            </div>
          </div>
        </section>

        {/* INSIGHTS */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              بینش‌های مهم
            </h2>

            <p className="mt-1 text-sm text-white/40">
              اتفاق‌هایی که باید به آن‌ها توجه کنی
            </p>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {insights.map((insight) => (
              <InsightCard
                key={insight.title}
                insight={insight}
              />
            ))}
          </div>
        </section>

        {/* PREDICTION */}
        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
          <div className="flex items-center gap-3">
            <TrendUp
              size={23}
              weight="duotone"
              className="text-cyan-300"
            />

            <div>
              <h2 className="text-xl font-semibold">
                پیش‌بینی رشد
              </h2>

              <p className="mt-1 text-sm text-white/40">
                وضعیت احتمالی دوره آینده
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PredictionCard
              title="احتمال رشد"
              value={faPercent(
                businessData.predictive.growthProbability
              )}
            />

            <PredictionCard
              title="درآمد پیش‌بینی‌شده"
              value={
                businessData.predictive.predictedRevenueLabel
              }
            />

            <PredictionCard
              title="فروش آنلاین پیش‌بینی‌شده"
              value={
                businessData.predictive.predictedOnlineRevenueLabel
              }
            />

            <PredictionCard
              title="نرخ تبدیل آینده"
              value={faPercent(
                businessData.predictive.predictedConversionRate
              )}
            />
          </div>
        </section>

        {/* AI ACTION */}
        <section className="mt-8 overflow-hidden rounded-[32px] border border-violet-400/15 bg-gradient-to-l from-violet-500/[0.10] via-[#080d1d]/70 to-cyan-500/[0.05] p-8">
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
                    تحلیل هوشمند Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    از گزارش به تصمیم
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                داده فعلی نشان می‌دهد بیشترین فرصت فوری در بازیابی
                سبدهای خرید رهاشده، کاهش CAC و افزایش نرخ خرید مجدد
                قرار دارد.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <ActionCard
                  title="فرصت اول"
                  value="بازیابی سبد خرید"
                />

                <ActionCard
                  title="فرصت دوم"
                  value="کاهش هزینه جذب"
                />

                <ActionCard
                  title="فرصت سوم"
                  value="افزایش خرید مجدد"
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
                <Link
                  to="/dashboard/crm"
                  className="block w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-center text-sm text-white/60"
                >
                  مشاهده مشتریان
                </Link>

                <Link
                  to="/dashboard/predictive"
                  className="block w-full rounded-xl border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-3 text-center text-sm text-cyan-200"
                >
                  بررسی سناریوی آینده
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "اتصال تحلیل به Automation در مرحله بعد فعال می‌شود."
                    )
                  }
                  className="w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold"
                >
                  اجرای پیشنهاد هوشمند
                </button>
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
  metric: MetricCardData;
}) {
  const Icon = metric.icon;

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5">
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

      <div
        className={`mt-2 flex items-center gap-1 text-xs ${
          metric.positive
            ? "text-emerald-300"
            : "text-red-300"
        }`}
      >
        {metric.positive ? (
          <TrendUp size={14} />
        ) : (
          <TrendDown size={14} />
        )}

        {metric.change}
      </div>

      <p className="mt-4 text-xs leading-6 text-white/35">
        {metric.description}
      </p>
    </div>
  );
}

function AnalyticsRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <span className="text-sm text-white/40">
        {title}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}

function CommerceCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <Icon
        size={20}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-4 text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-lg font-bold">
        {value}
      </div>
    </div>
  );
}

function ChannelCard({
  channel,
  active,
  onClick,
}: {
  channel: ChannelPerformance;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-5 text-right transition ${
        active
          ? "border-violet-400/30 bg-violet-500/[0.09]"
          : "border-white/[0.08] bg-[#080d1d]/62 hover:border-violet-300/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <Megaphone
          size={20}
          weight="duotone"
          className="text-violet-300"
        />

        <span className="text-lg font-bold text-cyan-300">
          {channel.score.toLocaleString("fa-IR")}٪
        </span>
      </div>

      <div className="mt-4 font-semibold">
        {channel.title}
      </div>

      <div className="mt-2 text-xs text-white/35">
        تبدیل {channel.conversion}
      </div>
    </button>
  );
}

function ChannelMetric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
      <div className="text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-lg font-bold">
        {value}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
}: {
  insight: Insight;
}) {
  const Icon =
    insight.type === "positive"
      ? CheckCircle
      : insight.type === "warning"
        ? WarningCircle
        : Lightning;

  const iconClass =
    insight.type === "positive"
      ? "text-emerald-300"
      : insight.type === "warning"
        ? "text-amber-300"
        : "text-cyan-300";

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-6">
      <Icon
        size={22}
        weight="duotone"
        className={iconClass}
      />

      <h3 className="mt-4 font-semibold">
        {insight.title}
      </h3>

      <p className="mt-3 text-sm leading-8 text-white/45">
        {insight.description}
      </p>
    </div>
  );
}

function PredictionCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-violet-400/10 bg-violet-500/[0.05] p-5">
      <div className="text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-xl font-bold text-cyan-300">
        {value}
      </div>
    </div>
  );
}

function ActionCard({
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