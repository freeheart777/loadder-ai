import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  TrendUp,
  TrendDown,
  Minus,
  Brain,
  Sparkle,
  CurrencyCircleDollar,
  UsersThree,
  Target,
  Megaphone,
  ShoppingCart,
  Repeat,
  WarningCircle,
  CheckCircle,
  Lightning,
  ChartLineUp,
  Gauge,
  Storefront,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react";

import { businessData } from "../data/businessData";

type ScenarioKey = "growth" | "stable" | "decline";

type Scenario = {
  key: ScenarioKey;
  title: string;
  subtitle: string;
  probability: number;
  revenue: string;
  onlineRevenue: string;
  customers: string;
  conversion: string;
  acquisitionCost: string;
  repeatRate: string;
  icon: React.ElementType;
};

function faNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

function faPercent(value: number) {
  return `${value.toLocaleString("fa-IR")}٪`;
}

const scenarios: Scenario[] = [
  {
    key: "growth",
    title: "سناریوی رشد",
    subtitle: "در صورت ادامه روند مثبت و بهینه‌سازی فروش",
    probability: businessData.predictive.growthProbability,
    revenue: businessData.predictive.predictedRevenueLabel,
    onlineRevenue: businessData.predictive.predictedOnlineRevenueLabel,
    customers: faNumber(businessData.predictive.predictedCustomers),
    conversion: faPercent(
      businessData.predictive.predictedConversionRate
    ),
    acquisitionCost: businessData.predictive.predictedCACLabel,
    repeatRate: faPercent(
      businessData.predictive.predictedRepeatCustomerRate
    ),
    icon: TrendUp,
  },
  {
    key: "stable",
    title: "سناریوی ثبات",
    subtitle: "در صورت حفظ شرایط فعلی بدون تغییر مهم",
    probability: 63,
    revenue: "۴۴۵ میلیون تومان",
    onlineRevenue: "۴۰۲ میلیون تومان",
    customers: "۱۲۹",
    conversion: "۷.۲٪",
    acquisitionCost: "۴۷۰ هزار تومان",
    repeatRate: "۳۳٪",
    icon: Minus,
  },
  {
    key: "decline",
    title: "سناریوی افت",
    subtitle: "در صورت افزایش هزینه جذب و کاهش نرخ تبدیل",
    probability: 24,
    revenue: "۳۲۸ میلیون تومان",
    onlineRevenue: "۲۸۵ میلیون تومان",
    customers: "۹۸",
    conversion: "۵.۴٪",
    acquisitionCost: "۵۹۰ هزار تومان",
    repeatRate: "۲۶٪",
    icon: TrendDown,
  },
];

const riskItems = [
  {
    title: "افزایش هزینه جذب مشتری",
    description:
      "اگر هزینه جذب بدون افزایش نرخ تبدیل رشد کند، سودآوری کاهش پیدا می‌کند.",
    severity: "متوسط",
  },
  {
    title: "سبد خرید رهاشده",
    description: `${faNumber(
      businessData.ecommerce.abandonedCarts
    )} سبد رهاشده می‌تواند بخشی از فروش بالقوه را از بین ببرد.`,
    severity: "بالا",
  },
  {
    title: "خرید مجدد",
    description:
      "اگر نرخ خرید مجدد رشد نکند، وابستگی به جذب مشتری جدید بیشتر می‌شود.",
    severity: "متوسط",
  },
];

const opportunities = [
  {
    title: "بازیابی سبد خرید",
    value: faNumber(businessData.ecommerce.abandonedCarts),
    description: "سریع‌ترین فرصت برای بازیابی فروش از دست‌رفته",
    icon: ShoppingCart,
  },
  {
    title: "لیدهای داغ",
    value: faNumber(businessData.crm.hotLeads),
    description: "مشتریان بالقوه با بیشترین احتمال خرید",
    icon: UsersThree,
  },
  {
    title: "خرید مجدد",
    value: faPercent(businessData.ecommerce.repeatCustomerRate),
    description: "ظرفیت افزایش درآمد از مشتریان فعلی",
    icon: Repeat,
  },
  {
    title: "فروش آنلاین",
    value: businessData.ecommerce.onlineRevenueLabel,
    description: "بخش مهمی از رشد آینده کسب‌وکار",
    icon: Storefront,
  },
];

export default function PredictivePage() {
  const [activeScenario, setActiveScenario] =
    useState<ScenarioKey>("growth");

  const [notice, setNotice] = useState("");

  const currentScenario = useMemo(
    () =>
      scenarios.find(
        (scenario) => scenario.key === activeScenario
      ) ?? scenarios[0],
    [activeScenario]
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
              <TrendUp
                size={25}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                پیش‌بینی آینده
              </h1>

              <p className="mt-1 text-sm text-white/45">
                رشد، ریسک و سناریوهای آینده کسب‌وکار
              </p>
            </div>
          </div>

          <Link
            to="/dashboard/business-brain"
            className="flex items-center gap-2 rounded-2xl border border-violet-300/15 bg-violet-500/[0.08] px-5 py-3 text-sm text-violet-200"
          >
            <Brain size={17} />
            مغز هوشمند
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />
          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-2 text-sm text-cyan-200">
                <Sparkle
                  size={16}
                  weight="fill"
                />
                مدل پیش‌بینی Loadder
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                آینده را حدس نزن؛
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  سناریوهای محتمل را قبل از تصمیم ببین.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                پیش‌بینی Loadder داده‌های فروش، فروش آنلاین سایت،
                مشتری، نرخ تبدیل، هزینه جذب مشتری و خرید مجدد را کنار
                هم قرار می‌دهد تا فرصت رشد و ریسک آینده زودتر دیده شود.
              </p>
            </div>

            <div className="rounded-[28px] border border-cyan-300/15 bg-cyan-500/[0.05] p-6">
              <div className="text-sm text-white/40">
                احتمال رشد
              </div>

              <div className="mt-4 text-6xl font-bold text-cyan-300">
                {faPercent(
                  businessData.predictive.growthProbability
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
                <TrendUp size={17} weight="bold" />
                سناریوی غالب مثبت است
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300"
                  style={{
                    width: `${businessData.predictive.growthProbability}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ForecastCard
            title="درآمد پیش‌بینی‌شده"
            value={businessData.predictive.predictedRevenueLabel}
            description="در سناریوی رشد"
            icon={CurrencyCircleDollar}
          />

          <ForecastCard
            title="فروش آنلاین آینده"
            value={businessData.predictive.predictedOnlineRevenueLabel}
            description="پیش‌بینی درآمد سایت"
            icon={Storefront}
          />

          <ForecastCard
            title="مشتری جدید"
            value={faNumber(
              businessData.predictive.predictedCustomers
            )}
            description="پیش‌بینی جذب مشتری"
            icon={UsersThree}
          />

          <ForecastCard
            title="نرخ تبدیل آینده"
            value={faPercent(
              businessData.predictive.predictedConversionRate
            )}
            description="در صورت اجرای بهینه‌سازی"
            icon={Target}
          />
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              سناریوهای آینده
            </h2>

            <p className="mt-1 text-sm text-white/40">
              سه مسیر محتمل برای دوره آینده
            </p>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.key}
                scenario={scenario}
                active={activeScenario === scenario.key}
                onClick={() =>
                  setActiveScenario(scenario.key)
                }
              />
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {currentScenario.title}
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  {currentScenario.subtitle}
                </p>
              </div>

              <div className="text-3xl font-bold text-cyan-300">
                {faPercent(currentScenario.probability)}
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ScenarioMetric
                title="درآمد"
                value={currentScenario.revenue}
              />

              <ScenarioMetric
                title="فروش آنلاین"
                value={currentScenario.onlineRevenue}
              />

              <ScenarioMetric
                title="مشتری جدید"
                value={currentScenario.customers}
              />

              <ScenarioMetric
                title="نرخ تبدیل"
                value={currentScenario.conversion}
              />

              <ScenarioMetric
                title="هزینه جذب مشتری"
                value={currentScenario.acquisitionCost}
              />

              <ScenarioMetric
                title="خرید مجدد"
                value={currentScenario.repeatRate}
              />
            </div>
          </div>

          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7">
            <div className="flex items-center gap-3">
              <Gauge
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  شاخص‌های حساس
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  عددهایی که بیشترین اثر را روی آینده دارند
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <PredictiveRow
                title="هزینه جذب مشتری"
                value={businessData.marketing.cacLabel}
                trend="down"
              />

              <PredictiveRow
                title="نرخ تبدیل"
                value={faPercent(
                  businessData.website.conversionRate
                )}
                trend="up"
              />

              <PredictiveRow
                title="خرید مجدد"
                value={faPercent(
                  businessData.ecommerce.repeatCustomerRate
                )}
                trend="up"
              />

              <PredictiveRow
                title="سبد رهاشده"
                value={faNumber(
                  businessData.ecommerce.abandonedCarts
                )}
                trend="down"
              />
            </div>
          </aside>
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              فرصت‌های رشد
            </h2>

            <p className="mt-1 text-sm text-white/40">
              اقدام‌هایی که بیشترین اثر احتمالی را دارند
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {opportunities.map((item) => (
              <OpportunityCard
                key={item.title}
                {...item}
              />
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <WarningCircle
                size={23}
                weight="duotone"
                className="text-amber-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  ریسک‌های آینده
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  چه چیزی می‌تواند مسیر رشد را خراب کند؟
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {riskItems.map((risk) => (
                <RiskRow
                  key={risk.title}
                  {...risk}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <ChartLineUp
                size={23}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  اثر اقدامات پیشنهادی
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اگر بهینه‌سازی انجام شود چه اتفاقی می‌افتد؟
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <ImpactRow
                title="بهبود نرخ تبدیل"
                current={businessData.website.conversionRate}
                predicted={
                  businessData.predictive.predictedConversionRate
                }
                suffix="٪"
              />

              <ImpactRow
                title="کاهش هزینه جذب مشتری"
                current={480}
                predicted={410}
                suffix=" هزار تومان"
                reverse
              />

              <ImpactRow
                title="خرید مجدد"
                current={
                  businessData.ecommerce.repeatCustomerRate
                }
                predicted={
                  businessData.predictive.predictedRepeatCustomerRate
                }
                suffix="٪"
              />
            </div>
          </div>
        </section>

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
                    تصمیم پیشنهادی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    از پیش‌بینی به اقدام
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                بر اساس داده فعلی، ترکیب بازیابی سبدهای خرید رهاشده،
                کاهش هزینه جذب مشتری و افزایش خرید مجدد بیشترین شانس
                را برای تحقق سناریوی رشد دارد.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <DecisionCard
                  title="اولویت ۱"
                  value="بازیابی سبد خرید"
                />

                <DecisionCard
                  title="اولویت ۲"
                  value="کاهش هزینه جذب"
                />

                <DecisionCard
                  title="اولویت ۳"
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
                  to="/dashboard/analytics"
                  className="block w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-center text-sm text-white/60"
                >
                  مشاهده تحلیل داده
                </Link>

                <Link
                  to="/dashboard/crm"
                  className="block w-full rounded-xl border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-3 text-center text-sm text-cyan-200"
                >
                  مشاهده مشتریان
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "اجرای سناریو در مرحله اتصال Automation فعال می‌شود."
                    )
                  }
                  className="w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold"
                >
                  اجرای سناریوی رشد
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

function ForecastCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/40">
          {title}
        </span>

        <Icon
          size={21}
          weight="duotone"
          className="text-cyan-300"
        />
      </div>

      <div className="mt-4 text-2xl font-bold">
        {value}
      </div>

      <div className="mt-3 flex items-center gap-1 text-xs text-emerald-300">
        <ArrowUp size={13} />
        {description}
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  active,
  onClick,
}: {
  scenario: Scenario;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = scenario.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[26px] border p-6 text-right transition ${
        active
          ? "border-violet-400/30 bg-violet-500/[0.09]"
          : "border-white/[0.08] bg-[#080d1d]/62 hover:border-violet-300/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon
          size={23}
          weight="duotone"
          className={
            scenario.key === "growth"
              ? "text-emerald-300"
              : scenario.key === "decline"
                ? "text-red-300"
                : "text-cyan-300"
          }
        />

        <span className="text-2xl font-bold">
          {faPercent(scenario.probability)}
        </span>
      </div>

      <div className="mt-5 text-lg font-semibold">
        {scenario.title}
      </div>

      <p className="mt-2 text-sm leading-7 text-white/40">
        {scenario.subtitle}
      </p>
    </button>
  );
}

function ScenarioMetric({
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

function PredictiveRow({
  title,
  value,
  trend,
}: {
  title: string;
  value: string;
  trend: "up" | "down";
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div>
        <div className="text-sm text-white/45">
          {title}
        </div>

        <div className="mt-1 font-semibold">
          {value}
        </div>
      </div>

      {trend === "up" ? (
        <ArrowUp
          size={18}
          className="text-emerald-300"
        />
      ) : (
        <ArrowDown
          size={18}
          className="text-amber-300"
        />
      )}
    </div>
  );
}

function OpportunityCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5">
      <Icon
        size={22}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-4 text-sm text-white/40">
        {title}
      </div>

      <div className="mt-2 text-2xl font-bold">
        {value}
      </div>

      <p className="mt-3 text-xs leading-6 text-white/35">
        {description}
      </p>
    </div>
  );
}

function RiskRow({
  title,
  description,
  severity,
}: {
  title: string;
  description: string;
  severity: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.04] p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold">
          {title}
        </span>

        <span className="rounded-full border border-amber-400/10 bg-amber-500/[0.06] px-3 py-1 text-xs text-amber-300">
          {severity}
        </span>
      </div>

      <p className="mt-2 text-sm leading-7 text-white/40">
        {description}
      </p>
    </div>
  );
}

function ImpactRow({
  title,
  current,
  predicted,
  suffix,
  reverse = false,
}: {
  title: string;
  current: number;
  predicted: number;
  suffix: string;
  reverse?: boolean;
}) {
  const improved = reverse
    ? predicted < current
    : predicted > current;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/45">
          {title}
        </span>

        <span
          className={
            improved
              ? "text-emerald-300"
              : "text-amber-300"
          }
        >
          {improved ? "بهبود" : "نیاز به توجه"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-white/35">
          فعلی: {current.toLocaleString("fa-IR")}
          {suffix}
        </span>

        <span className="font-semibold text-cyan-300">
          پیش‌بینی: {predicted.toLocaleString("fa-IR")}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function DecisionCard({
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