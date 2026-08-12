import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Brain,
  ChartLineUp,
  Sparkle,
  Globe,
  InstagramLogo,
  Megaphone,
  UsersThree,
  CurrencyCircleDollar,
  ShoppingCart,
  DeviceMobile,
  UserPlus,
  Target,
  TrendUp,
  ArrowUp,
  ArrowDown,
  Eye,
  Lightning,
  CheckCircle,
  WarningCircle,
  Gauge,
} from "@phosphor-icons/react";

type ServiceId =
  | "overview"
  | "website"
  | "social"
  | "ads"
  | "crm"
  | "sales"
  | "app";

type ChartPoint = {
  label: string;
  value: number;
};

type Service = {
  id: ServiceId;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  value: string;
  change: number;
  metric: string;
};

const services: Service[] = [
  {
    id: "overview",
    title: "نمای کلی",
    subtitle: "تصویر یکپارچه کسب‌وکار",
    icon: Brain,
    value: "۸۶٪",
    change: 12,
    metric: "سلامت کسب‌وکار",
  },
  {
    id: "website",
    title: "وب‌سایت",
    subtitle: "بازدید و تبدیل",
    icon: Globe,
    value: "۴۸.۲K",
    change: 18,
    metric: "بازدید",
  },
  {
    id: "social",
    title: "شبکه‌های اجتماعی",
    subtitle: "دیده‌شدن و تعامل",
    icon: InstagramLogo,
    value: "۱۱۸K",
    change: 14,
    metric: "دسترسی",
  },
  {
    id: "ads",
    title: "تبلیغات",
    subtitle: "عملکرد و بازده",
    icon: Megaphone,
    value: "۴.۸x",
    change: 21,
    metric: "بازده تبلیغات",
  },
  {
    id: "crm",
    title: "ارتباط با مشتری",
    subtitle: "لید و مشتری",
    icon: UsersThree,
    value: "۱,۲۴۸",
    change: 9,
    metric: "مشتری",
  },
  {
    id: "sales",
    title: "فروش",
    subtitle: "درآمد و خرید",
    icon: ShoppingCart,
    value: "۳۸۴M",
    change: 17,
    metric: "درآمد",
  },
  {
    id: "app",
    title: "اپلیکیشن",
    subtitle: "نصب و بازگشت",
    icon: DeviceMobile,
    value: "—",
    change: 0,
    metric: "آینده",
  },
];

const chartData: Record<ServiceId, ChartPoint[]> = {
  overview: [
    { label: "هفته ۱", value: 54 },
    { label: "هفته ۲", value: 61 },
    { label: "هفته ۳", value: 58 },
    { label: "هفته ۴", value: 68 },
    { label: "هفته ۵", value: 72 },
    { label: "هفته ۶", value: 78 },
    { label: "هفته ۷", value: 82 },
    { label: "هفته ۸", value: 86 },
  ],
  website: [
    { label: "هفته ۱", value: 28 },
    { label: "هفته ۲", value: 34 },
    { label: "هفته ۳", value: 31 },
    { label: "هفته ۴", value: 39 },
    { label: "هفته ۵", value: 42 },
    { label: "هفته ۶", value: 41 },
    { label: "هفته ۷", value: 46 },
    { label: "هفته ۸", value: 48 },
  ],
  social: [
    { label: "هفته ۱", value: 62 },
    { label: "هفته ۲", value: 70 },
    { label: "هفته ۳", value: 66 },
    { label: "هفته ۴", value: 81 },
    { label: "هفته ۵", value: 87 },
    { label: "هفته ۶", value: 94 },
    { label: "هفته ۷", value: 105 },
    { label: "هفته ۸", value: 118 },
  ],
  ads: [
    { label: "هفته ۱", value: 2.4 },
    { label: "هفته ۲", value: 2.8 },
    { label: "هفته ۳", value: 3.1 },
    { label: "هفته ۴", value: 2.9 },
    { label: "هفته ۵", value: 3.6 },
    { label: "هفته ۶", value: 4.1 },
    { label: "هفته ۷", value: 4.3 },
    { label: "هفته ۸", value: 4.8 },
  ],
  crm: [
    { label: "هفته ۱", value: 720 },
    { label: "هفته ۲", value: 790 },
    { label: "هفته ۳", value: 845 },
    { label: "هفته ۴", value: 910 },
    { label: "هفته ۵", value: 980 },
    { label: "هفته ۶", value: 1060 },
    { label: "هفته ۷", value: 1140 },
    { label: "هفته ۸", value: 1248 },
  ],
  sales: [
    { label: "هفته ۱", value: 220 },
    { label: "هفته ۲", value: 246 },
    { label: "هفته ۳", value: 238 },
    { label: "هفته ۴", value: 271 },
    { label: "هفته ۵", value: 294 },
    { label: "هفته ۶", value: 318 },
    { label: "هفته ۷", value: 346 },
    { label: "هفته ۸", value: 384 },
  ],
  app: [
    { label: "هفته ۱", value: 0 },
    { label: "هفته ۲", value: 0 },
    { label: "هفته ۳", value: 0 },
    { label: "هفته ۴", value: 0 },
    { label: "هفته ۵", value: 0 },
    { label: "هفته ۶", value: 0 },
    { label: "هفته ۷", value: 0 },
    { label: "هفته ۸", value: 0 },
  ],
};

const funnel = [
  {
    title: "افرادی که شما را دیدند",
    value: "۲۴۸ هزار",
    width: "100%",
  },
  {
    title: "افرادی که وارد سایت شدند",
    value: "۴۸.۲ هزار",
    width: "82%",
  },
  {
    title: "افرادی که علاقه نشان دادند",
    value: "۲۱۳",
    width: "64%",
  },
  {
    title: "افرادی که آماده خرید شدند",
    value: "۱۲۴",
    width: "48%",
  },
  {
    title: "مشتریان واقعی",
    value: "۸۶",
    width: "34%",
  },
];

export default function AnalyticsPage() {
  const [activeService, setActiveService] =
    useState<ServiceId>("overview");

  const [period, setPeriod] = useState("۳۰ روز");

  const currentService =
    services.find((item) => item.id === activeService) ??
    services[0];

  const currentData = chartData[activeService];

  const maxValue = useMemo(() => {
    return Math.max(
      ...currentData.map((item) => item.value),
      1
    );
  }, [currentData]);

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
                مرکز تحلیل و هوشمندی
              </h1>

              <p className="mt-1 text-sm text-white/45">
                تصویر کامل داده‌های کسب‌وکار شما
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {["۷ روز", "۳۰ روز", "۹۰ روز"].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPeriod(item)}
                  className={`rounded-xl border px-4 py-2.5 text-sm transition ${
                    period === item
                      ? "border-violet-400/25 bg-violet-500/[0.12] text-violet-200"
                      : "border-white/[0.07] bg-white/[0.03] text-white/45 hover:bg-white/[0.06]"
                  }`}
                >
                  {item}
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[22%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_370px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                تحلیل هوشمند کسب‌وکار
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                فقط عدد نبین؛
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  بفهم چه اتفاقی افتاده و چرا.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                Loadder داده‌های سایت، شبکه‌های اجتماعی،
                تبلیغات، مشتریان و فروش را کنار هم تحلیل
                می‌کند تا روند واقعی رشد کسب‌وکار مشخص شود.
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
                  تحلیل امروز Loadder
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                رشد فروش بیشتر از افزایش کیفیت لیدها و
                بهبود عملکرد تبلیغات ایجاد شده است.
                شبکه‌های اجتماعی بیشترین دیده‌شدن را ایجاد
                می‌کنند اما تبلیغات جست‌وجویی مشتریان
                باکیفیت‌تری می‌سازد.
              </p>

              <button
                type="button"
                className="mt-5 flex items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-500/[0.08] px-4 py-3 text-sm text-violet-200"
              >
                <Lightning
                  size={16}
                  weight="fill"
                />
                مشاهده پیشنهاد اجرایی
              </button>
            </div>
          </div>
        </section>

        {/* EXECUTIVE KPI */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KPICard
            title="درآمد"
            value="۳۸۴ میلیون"
            change={17}
            icon={CurrencyCircleDollar}
          />

          <KPICard
            title="لید جدید"
            value="۲۱۳"
            change={12}
            icon={UserPlus}
          />

          <KPICard
            title="نرخ تبدیل"
            value="۶.۸٪"
            change={8}
            icon={Target}
          />

          <KPICard
            title="هزینه جذب مشتری"
            value="۴۸۰ هزار"
            change={-9}
            icon={UsersThree}
            reversePositive
          />

          <KPICard
            title="بازده تبلیغات"
            value="۴.۸ برابر"
            change={21}
            icon={TrendUp}
          />
        </section>

        {/* HEALTH */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              سلامت کسب‌وکار
            </h2>

            <p className="mt-1 text-sm text-white/40">
              بررسی سریع موتورهای اصلی رشد
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <GaugeCard
              value={86}
              title="سلامت کلی کسب‌وکار"
              description="ترکیب فروش، مشتری، بازاریابی و درآمد"
            />

            <GaugeCard
              value={78}
              title="سلامت تبدیل مشتری"
              description="قدرت تبدیل بازدیدکننده به مشتری"
            />

            <GaugeCard
              value={84}
              title="بازده تبلیغات"
              description="کیفیت هزینه و خروجی کمپین‌ها"
            />

            <GaugeCard
              value={72}
              title="کیفیت اطلاعات مشتری"
              description="کامل بودن داده‌ها و کیفیت لیدها"
            />
          </div>
        </section>

        {/* SERVICE SELECTOR */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                تحلیل هر بخش
              </h2>

              <p className="mt-1 text-sm text-white/40">
                بخش موردنظر را برای مشاهده جزئیات انتخاب کن.
              </p>
            </div>

            <span className="text-sm text-white/35">
              بازه انتخاب‌شده: {period}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            {services.map((service) => {
              const Icon = service.icon;
              const active =
                service.id === activeService;

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() =>
                    setActiveService(service.id)
                  }
                  className={`rounded-[22px] border p-4 text-right transition ${
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

                    {service.change !== 0 && (
                      <span className="text-xs text-emerald-300">
                        +{service.change}٪
                      </span>
                    )}
                  </div>

                  <div className="mt-4 text-sm font-semibold">
                    {service.title}
                  </div>

                  <div className="mt-1 text-xs text-white/35">
                    {service.metric}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* MAIN CHART */}
        <section className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {currentService.title}
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  {currentService.subtitle}
                </p>
              </div>

              <div className="text-left">
                <div className="text-3xl font-bold">
                  {currentService.value}
                </div>

                {currentService.change !== 0 && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-emerald-300">
                    <ArrowUp size={14} />
                    {currentService.change}٪
                  </div>
                )}
              </div>
            </div>

            <div className="relative mt-8 h-[330px] overflow-hidden rounded-[24px] border border-white/[0.05] bg-black/20 p-6">
              <div className="pointer-events-none absolute inset-0 grid grid-rows-4">
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div />
              </div>

              <div className="relative flex h-full items-end gap-3">
                {currentData.map(
                  (point, index) => {
                    const height =
                      maxValue === 0
                        ? 0
                        : (point.value /
                            maxValue) *
                          100;

                    return (
                      <div
                        key={`${point.label}-${index}`}
                        className="group flex h-full flex-1 flex-col justify-end"
                      >
                        <div className="relative flex flex-1 items-end justify-center">
                          <div
                            className="w-full max-w-[58px] rounded-t-xl bg-gradient-to-t from-violet-600/60 via-blue-500/80 to-cyan-300/90 transition duration-300 group-hover:opacity-75"
                            style={{
                              height: `${Math.max(
                                height,
                                point.value > 0
                                  ? 5
                                  : 0
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="mt-3 text-center text-xs text-white/30">
                          {point.label.replace(
                            "هفته ",
                            "هـ"
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[28px] border border-white/[0.08] bg-[#080d1d]/65 p-6 backdrop-blur-xl">
              <h3 className="text-lg font-semibold">
                وضعیت {currentService.title}
              </h3>

              <div className="mt-5 space-y-3">
                <MetricRow
                  title="رشد این دوره"
                  value={
                    currentService.change
                      ? `+${currentService.change}٪`
                      : "—"
                  }
                />

                <MetricRow
                  title="وضعیت"
                  value={
                    activeService === "app"
                      ? "در انتظار اتصال"
                      : "مثبت"
                  }
                />

                <MetricRow
                  title="کیفیت داده"
                  value={
                    activeService === "app"
                      ? "۰٪"
                      : "۹۲٪"
                  }
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-400/10 bg-cyan-500/[0.04] p-6">
              <div className="flex items-center gap-3">
                <Sparkle
                  size={20}
                  weight="fill"
                  className="text-cyan-300"
                />

                <h3 className="text-lg font-semibold">
                  تحلیل هوشمند
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                {getInsight(activeService)}
              </p>
            </div>
          </aside>
        </section>

        {/* VISUAL INTELLIGENCE */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              نمایش تصویری عملکرد
            </h2>

            <p className="mt-1 text-sm text-white/40">
              مسیر مشتری و سهم منابع رشد
            </p>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <SalesFunnel />

            <div className="grid gap-4 md:grid-cols-2">
              <DonutCard
                value={42}
                title="تبلیغات پولی"
                description="سهم تبلیغات در ایجاد مشتری بالقوه"
              />

              <DonutCard
                value={58}
                title="ورودی طبیعی"
                description="شبکه اجتماعی، جست‌وجو و ورود مستقیم"
              />

              <DonutCard
                value={36}
                title="مشتری بازگشتی"
                description="سهم مشتریان قبلی از خریدها"
              />

              <DonutCard
                value={64}
                title="مشتری جدید"
                description="سهم مشتریان جدید از خریدها"
              />
            </div>
          </div>
        </section>

        {/* SERVICE SNAPSHOT */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              تصویر سریع کسب‌وکار
            </h2>

            <p className="mt-1 text-sm text-white/40">
              مقایسه منابع اصلی داده
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MiniChart
              title="وب‌سایت"
              icon={Globe}
              value="۴۸.۲K"
              label="بازدید"
              data={chartData.website}
            />

            <MiniChart
              title="شبکه‌های اجتماعی"
              icon={InstagramLogo}
              value="۱۱۸K"
              label="دسترسی"
              data={chartData.social}
            />

            <MiniChart
              title="تبلیغات"
              icon={Megaphone}
              value="۴.۸ برابر"
              label="بازده"
              data={chartData.ads}
            />

            <MiniChart
              title="مشتریان"
              icon={UsersThree}
              value="۱,۲۴۸"
              label="مشتری"
              data={chartData.crm}
            />

            <MiniChart
              title="فروش"
              icon={ShoppingCart}
              value="۳۸۴M"
              label="درآمد"
              data={chartData.sales}
            />

            <MiniChart
              title="اپلیکیشن"
              icon={DeviceMobile}
              value="—"
              label="آماده اتصال"
              data={chartData.app}
              disabled
            />
          </div>
        </section>

        {/* ALERTS */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <InsightCard
            icon={CheckCircle}
            title="نقطه قوت"
            text="رشد فروش و مشتری در وضعیت مثبت قرار دارد."
            tone="success"
          />

          <InsightCard
            icon={WarningCircle}
            title="نیاز به توجه"
            text="نرخ تبدیل سایت هنوز پایین‌تر از ظرفیت فعلی است."
            tone="warning"
          />

          <InsightCard
            icon={Brain}
            title="فرصت هوشمند"
            text="جابجایی بخشی از بودجه تبلیغات می‌تواند بازده را افزایش دهد."
            tone="ai"
          />
        </section>

        {/* LOADDER INTELLIGENCE */}
        <section className="mt-8 overflow-hidden rounded-[32px] border border-violet-400/15 bg-gradient-to-l from-violet-500/[0.10] via-[#080d1d]/70 to-cyan-500/[0.05] p-8 backdrop-blur-xl">
          <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
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
                    هوشمندی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    تبدیل تحلیل به اقدام
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                Loadder فقط وضعیت را گزارش نمی‌کند.
                در آینده، بر اساس داده‌های واقعی تشخیص
                می‌دهد چه چیزی باید تقویت، اصلاح یا متوقف
                شود و نتیجه احتمالی هر تصمیم را پیش‌بینی
                می‌کند.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <ActionCard
                  title="افزایش بودجه"
                  value="کانال پربازده"
                />

                <ActionCard
                  title="پیگیری فوری"
                  value="۳۲ لید داغ"
                />

                <ActionCard
                  title="محتوای پیشنهادی"
                  value="آموزشی"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="flex items-center gap-2">
                <Gauge
                  size={20}
                  weight="duotone"
                  className="text-cyan-300"
                />

                <span className="font-semibold">
                  حالت تصمیم‌گیری
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60"
                >
                  فقط تحلیل کن
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-3 text-sm text-cyan-200"
                >
                  پیشنهاد بده
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold"
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

function KPICard({
  title,
  value,
  change,
  icon: Icon,
  reversePositive = false,
}: {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  reversePositive?: boolean;
}) {
  const positive = reversePositive
    ? change < 0
    : change > 0;

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/40">
          {title}
        </span>

        <Icon
          size={21}
          weight="duotone"
          className="text-violet-300"
        />
      </div>

      <div className="mt-4 text-2xl font-bold">
        {value}
      </div>

      <div
        className={`mt-2 flex items-center gap-1 text-xs ${
          positive
            ? "text-emerald-300"
            : "text-red-300"
        }`}
      >
        {change >= 0 ? (
          <ArrowUp size={13} />
        ) : (
          <ArrowDown size={13} />
        )}

        {Math.abs(change)}٪ نسبت به دوره قبل
      </div>
    </div>
  );
}

function GaugeCard({
  value,
  title,
  description,
}: {
  value: number;
  title: string;
  description: string;
}) {
  const safeValue = Math.max(
    0,
    Math.min(100, value)
  );

  const degrees =
    -90 + (safeValue / 100) * 180;

  return (
    <div className="rounded-[26px] border border-white/[0.08] bg-[#080d1d]/62 p-6 backdrop-blur-xl">
      <div className="text-sm font-semibold">
        {title}
      </div>

      <div className="relative mx-auto mt-5 h-[125px] w-[190px] overflow-hidden">
        <div className="absolute left-1/2 top-4 h-[150px] w-[150px] -translate-x-1/2 rounded-full border-[15px] border-white/[0.05]" />

        <div
          className="absolute left-1/2 top-[78px] h-[4px] w-[58px] origin-left rounded-full bg-gradient-to-l from-violet-400 to-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.5)] transition duration-500"
          style={{
            transform: `rotate(${degrees}deg)`,
          }}
        />

        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="text-3xl font-bold">
            {safeValue}٪
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-7 text-white/40">
        {description}
      </p>
    </div>
  );
}

function MetricRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.05] bg-black/20 p-4">
      <span className="text-sm text-white/40">
        {title}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}

function SalesFunnel() {
  return (
    <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/62 p-7 backdrop-blur-xl">
      <h3 className="text-xl font-semibold">
        قیف تبدیل مشتری
      </h3>

      <p className="mt-1 text-sm text-white/40">
        مسیر حرکت مخاطب تا خرید
      </p>

      <div className="mt-7 space-y-3">
        {funnel.map((item, index) => (
          <div
            key={item.title}
            className="flex justify-center"
          >
            <div
              className="rounded-2xl border border-violet-400/15 bg-gradient-to-l from-violet-500/20 via-blue-500/10 to-cyan-500/10 px-5 py-4"
              style={{
                width: item.width,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-white/30">
                    مرحله {index + 1}
                  </div>

                  <div className="mt-1 text-sm font-semibold">
                    {item.title}
                  </div>
                </div>

                <div className="text-lg font-bold">
                  {item.value}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutCard({
  value,
  title,
  description,
}: {
  value: number;
  title: string;
  description: string;
}) {
  const safeValue = Math.max(
    0,
    Math.min(100, value)
  );

  return (
    <div className="flex items-center gap-5 rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div
        className="relative flex h-[105px] w-[105px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(
            #22d3ee 0deg,
            #8b5cf6 ${safeValue * 3.6}deg,
            rgba(255,255,255,.06) ${
              safeValue * 3.6
            }deg
          )`,
        }}
      >
        <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[#080d1d]">
          <span className="text-lg font-bold">
            {safeValue}٪
          </span>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-7 text-white/40">
          {description}
        </p>
      </div>
    </div>
  );
}

function MiniChart({
  title,
  icon: Icon,
  value,
  label,
  data,
  disabled = false,
}: {
  title: string;
  icon: React.ElementType;
  value: string;
  label: string;
  data: ChartPoint[];
  disabled?: boolean;
}) {
  const max = Math.max(
    ...data.map((item) => item.value),
    1
  );

  return (
    <div
      className={`rounded-[26px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon
            size={21}
            weight="duotone"
            className="text-cyan-300"
          />

          <span className="font-semibold">
            {title}
          </span>
        </div>

        <div className="text-left">
          <div className="font-semibold">
            {value}
          </div>

          <div className="text-xs text-white/30">
            {label}
          </div>
        </div>
      </div>

      <div className="mt-5 flex h-[85px] items-end gap-2">
        {data.map((point, index) => {
          const height =
            max > 0
              ? (point.value / max) * 100
              : 0;

          return (
            <div
              key={index}
              className="flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-violet-500/35 to-cyan-300/80"
                style={{
                  height: `${Math.max(
                    height,
                    point.value > 0 ? 6 : 0
                  )}%`,
                }}
              />
            </div>
          );
        })}
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
  const styles =
    tone === "success"
      ? "border-emerald-400/15 bg-emerald-500/[0.05]"
      : tone === "warning"
        ? "border-amber-400/15 bg-amber-500/[0.05]"
        : "border-violet-400/15 bg-violet-500/[0.05]";

  return (
    <div
      className={`rounded-[24px] border p-5 ${styles}`}
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

function getInsight(service: ServiceId) {
  switch (service) {
    case "website":
      return "رشد بازدید مثبت است، اما مهم‌ترین فرصت فعلی افزایش نرخ تبدیل صفحات فروش است.";

    case "social":
      return "محتوای آموزشی بیشترین دیده‌شدن و تعامل را ایجاد کرده و بهترین گزینه برای توسعه کمپین بعدی است.";

    case "ads":
      return "بازده تبلیغات در حال افزایش است. جابه‌جایی بخشی از بودجه به کانال‌های پربازده می‌تواند نتیجه را بهتر کند.";

    case "crm":
      return "تعداد مشتریان افزایش یافته است. مرحله بعد شناسایی مشتریان آماده خرید مجدد است.";

    case "sales":
      return "درآمد رو به رشد است، اما باید مشخص شود هر کانال بازاریابی چه سهمی در این افزایش داشته است.";

    case "app":
      return "پس از اتصال اپلیکیشن، نصب، کاربران فعال، بازگشت و عملکرد کمپین‌های نصب در این بخش تحلیل خواهد شد.";

    default:
      return "وضعیت کلی مثبت است. مهم‌ترین فرصت فعلی اتصال دقیق‌تر داده‌های تبلیغات، مشتری و فروش به یکدیگر است.";
  }
}