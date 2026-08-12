import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Brain,
  Sparkle,
  TrendUp,
  Warning,
  Rocket,
  Target,
  ChartLineUp,
  ShieldCheck,
  Lightning,
  CalendarBlank,
  CurrencyCircleDollar,
  UsersThree,
  Megaphone,
  ShoppingCart,
  Gauge,
  CheckCircle,
  WarningCircle,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react";

type Scenario = {
  id: "growth" | "current" | "risk";
  title: string;
  probability: number;
  description: string;
  icon: React.ElementType;
};

type ForecastMetric = {
  title: string;
  current: string;
  future: string;
  change: string;
  positive: boolean;
};

type WarningItem = {
  title: string;
  description: string;
  action: string;
  severity: "medium" | "high";
};

const scenarios: Scenario[] = [
  {
    id: "growth",
    title: "مسیر رشد",
    probability: 82,
    description:
      "اگر پیشنهادهای هوشمند اجرا شوند، احتمال رشد سریع‌تر و پایدارتر وجود دارد.",
    icon: Rocket,
  },
  {
    id: "current",
    title: "مسیر فعلی",
    probability: 65,
    description:
      "اگر بدون تغییر ادامه دهید، کسب‌وکار همچنان رشد می‌کند اما با سرعت کمتر.",
    icon: ChartLineUp,
  },
  {
    id: "risk",
    title: "مسیر خطر",
    probability: 18,
    description:
      "اگر مشکلات فعلی ادامه پیدا کنند، احتمال کاهش رشد و افزایش هزینه‌ها وجود دارد.",
    icon: Warning,
  },
];

const forecastMetrics: ForecastMetric[] = [
  {
    title: "فروش",
    current: "۳۸۴ میلیون",
    future: "۶۲۰ میلیون",
    change: "+۶۱٪",
    positive: true,
  },
  {
    title: "مشتریان جدید",
    current: "۸۶ نفر",
    future: "۱۵۰ نفر",
    change: "+۷۴٪",
    positive: true,
  },
  {
    title: "نرخ تبدیل",
    current: "۶.۸٪",
    future: "۸.۵٪",
    change: "+۱.۷٪",
    positive: true,
  },
  {
    title: "هزینه جذب مشتری",
    current: "۴۸۰ هزار",
    future: "۴۱۰ هزار",
    change: "-۱۵٪",
    positive: true,
  },
];

const warnings: WarningItem[] = [
  {
    title: "کاهش نرخ تبدیل صفحه فروش",
    description:
      "در سه هفته اخیر نرخ تبدیل کاهش داشته و می‌تواند روی فروش ماه آینده اثر بگذارد.",
    action:
      "پیام صفحه فروش را بازطراحی و تست A/B اجرا کن.",
    severity: "high",
  },
  {
    title: "افزایش هزینه جذب مشتری",
    description:
      "هزینه جذب در یکی از کانال‌های تبلیغاتی در حال افزایش است.",
    action:
      "بخشی از بودجه را به کانال پربازده‌تر منتقل کن.",
    severity: "medium",
  },
  {
    title: "کاهش سرعت پیگیری مشتریان",
    description:
      "بخشی از مشتریان بالقوه با تأخیر پیگیری می‌شوند و احتمال از دست رفتن آن‌ها وجود دارد.",
    action:
      "اتوماسیون پیگیری لیدهای داغ را فعال کن.",
    severity: "medium",
  },
];

const forecastBars = [42, 48, 55, 63, 70, 77, 84, 92];

export default function PredictivePage() {
  const [activeScenario, setActiveScenario] =
    useState<Scenario["id"]>("growth");

  const [period, setPeriod] = useState("۹۰ روز");

  const [notice, setNotice] = useState("");

  const currentScenario = useMemo(
    () =>
      scenarios.find(
        (scenario) => scenario.id === activeScenario
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
              <Brain
                size={25}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                پیش‌بینی هوشمند کسب‌وکار
              </h1>

              <p className="mt-1 text-sm text-white/45">
                آینده کسب‌وکار را قبل از وقوع ببین
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {["۳۰ روز", "۶۰ روز", "۹۰ روز"].map(
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

          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_380px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200">
                <Sparkle
                  size={16}
                  weight="fill"
                />
                آینده‌نگری با هوش مصنوعی
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                Loadder فقط نمی‌گوید الان کجایی؛
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  پیش‌بینی می‌کند به کجا می‌روی.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                با تحلیل روند فروش، مشتری، تبلیغات، محتوا و شاخص‌های
                عملکرد، مسیرهای احتمالی آینده شناسایی می‌شوند تا قبل
                از ایجاد مشکل بتوانی تصمیم بهتری بگیری.
              </p>
            </div>

            <div className="rounded-[28px] border border-violet-300/15 bg-violet-500/[0.06] p-6">
              <div className="text-sm text-white/40">
                احتمال رشد در {period} آینده
              </div>

              <div className="mt-4 text-6xl font-bold text-cyan-300">
                ۸۲٪
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
                <TrendUp
                  size={17}
                  weight="bold"
                />
                مسیر فعلی مثبت است
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full w-[82%] rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300" />
              </div>
            </div>
          </div>
        </section>

        {/* SCENARIOS */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              سناریوهای آینده
            </h2>

            <p className="mt-1 text-sm text-white/40">
              ببین در هر مسیر چه نتیجه‌ای محتمل است.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                active={
                  activeScenario === scenario.id
                }
                onClick={() =>
                  setActiveScenario(scenario.id)
                }
              />
            ))}
          </div>
        </section>

        {/* FORECAST + DETAILS */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  روند پیش‌بینی رشد
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  مسیر احتمالی بر اساس داده‌های فعلی
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/10 bg-cyan-500/[0.07] px-4 py-2 text-xs text-cyan-300">
                {period}
              </span>
            </div>

            <div className="relative mt-8 h-[320px] overflow-hidden rounded-[24px] border border-white/[0.05] bg-black/20 p-6">
              <div className="pointer-events-none absolute inset-0 grid grid-rows-4">
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div className="border-b border-white/[0.04]" />
                <div />
              </div>

              <div className="relative flex h-full items-end gap-4">
                {forecastBars.map(
                  (height, index) => (
                    <div
                      key={index}
                      className="group flex h-full flex-1 items-end"
                    >
                      <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-violet-600/60 via-blue-500/80 to-cyan-300/90 transition duration-300 group-hover:opacity-75"
                        style={{
                          height: `${height}%`,
                        }}
                      />
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 text-center text-xs text-white/35">
              <span>امروز</span>
              <span>۳۰ روز</span>
              <span>۶۰ روز</span>
              <span>۹۰ روز</span>
            </div>
          </div>

          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Target
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  {currentScenario.title}
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  نتیجه احتمالی این سناریو
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-end gap-2">
              <div className="text-5xl font-bold">
                {currentScenario.probability}٪
              </div>

              <div className="pb-1 text-sm text-white/35">
                احتمال
              </div>
            </div>

            <p className="mt-5 text-sm leading-8 text-white/55">
              {currentScenario.description}
            </p>

            <div className="mt-6 space-y-3">
              <ForecastRow
                title="فروش"
                value={
                  currentScenario.id === "growth"
                    ? "+۶۱٪"
                    : currentScenario.id === "current"
                      ? "+۱۸٪"
                      : "-۱۲٪"
                }
              />

              <ForecastRow
                title="مشتریان جدید"
                value={
                  currentScenario.id === "growth"
                    ? "+۷۴٪"
                    : currentScenario.id === "current"
                      ? "+۲۲٪"
                      : "-۸٪"
                }
              />

              <ForecastRow
                title="ریسک"
                value={
                  currentScenario.id === "growth"
                    ? "کم"
                    : currentScenario.id === "current"
                      ? "متوسط"
                      : "بالا"
                }
              />
            </div>
          </aside>
        </section>

        {/* FUTURE METRICS */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              تصویر احتمالی آینده
            </h2>

            <p className="mt-1 text-sm text-white/40">
              مقایسه وضعیت فعلی با سناریوی رشد
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {forecastMetrics.map((metric) => (
              <ForecastMetricCard
                key={metric.title}
                metric={metric}
              />
            ))}
          </div>
        </section>

        {/* BUSINESS ENGINES */}
        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              پیش‌بینی موتورهای کسب‌وکار
            </h2>

            <p className="mt-1 text-sm text-white/40">
              وضعیت احتمالی هر بخش در ادامه مسیر
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <EnginePrediction
              icon={Megaphone}
              title="بازاریابی"
              score={85}
              status="وضعیت خوب"
              insight="بازده تبلیغات در مسیر مثبت قرار دارد."
            />

            <EnginePrediction
              icon={ShoppingCart}
              title="فروش"
              score={72}
              status="نیاز به بهبود"
              insight="سرعت تبدیل مشتری بالقوه باید افزایش پیدا کند."
            />

            <EnginePrediction
              icon={UsersThree}
              title="مشتریان"
              score={88}
              status="پایدار"
              insight="احتمال خرید مجدد در حال افزایش است."
            />

            <EnginePrediction
              icon={CurrencyCircleDollar}
              title="درآمد"
              score={81}
              status="رو به رشد"
              insight="در صورت حفظ روند، درآمد ماه آینده افزایش خواهد داشت."
            />
          </div>
        </section>

        {/* WARNINGS */}
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <WarningCircle
              size={24}
              weight="duotone"
              className="text-amber-300"
            />

            <div>
              <h2 className="text-xl font-semibold">
                هشدارهای زودهنگام
              </h2>

              <p className="mt-1 text-sm text-white/40">
                مشکلاتی که قبل از تأثیر جدی شناسایی شده‌اند.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            {warnings.map((item) => (
              <WarningCard
                key={item.title}
                item={item}
              />
            ))}
          </div>
        </section>

        {/* SIMULATOR */}
        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                شبیه‌ساز تصمیم کسب‌وکار
              </h2>

              <p className="mt-1 text-sm text-white/40">
                ببین تغییر یک تصمیم چه اثری روی آینده می‌گذارد.
              </p>
            </div>

            <Gauge
              size={24}
              weight="duotone"
              className="text-violet-300"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SimulatorCard
              title="اگر بودجه تبلیغات ۲۰٪ بیشتر شود"
              result="+۳۲٪ مشتری بالقوه"
              onClick={() =>
                showNotice(
                  "این شبیه‌سازی بعداً با داده‌های واقعی کسب‌وکار محاسبه می‌شود."
                )
              }
            />

            <SimulatorCard
              title="اگر نرخ تبدیل ۱٪ افزایش یابد"
              result="+۴۶ میلیون فروش احتمالی"
              onClick={() =>
                showNotice(
                  "مدل پیش‌بینی نرخ تبدیل در مرحله اتصال داده فعال می‌شود."
                )
              }
            />

            <SimulatorCard
              title="اگر پیگیری مشتری سریع‌تر شود"
              result="+۸ مشتری احتمالی"
              onClick={() =>
                showNotice(
                  "این سناریو بعداً به CRM و اتوماسیون متصل می‌شود."
                )
              }
            />
          </div>
        </section>

        {/* AI FUTURE ADVISOR */}
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
                    مشاور آینده‌نگر Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    پیش‌بینی، هشدار و پیشنهاد اقدام
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                بر اساس روند فعلی، بیشترین فرصت رشد در بهبود نرخ تبدیل
                و افزایش سرعت پیگیری مشتریان بالقوه قرار دارد. در عین حال،
                ادامه افزایش هزینه جذب مشتری می‌تواند در ماه آینده فشار
                بیشتری روی سودآوری ایجاد کند.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <AdvisorAction
                  icon={Target}
                  title="اولویت اول"
                  value="بهبود نرخ تبدیل"
                />

                <AdvisorAction
                  icon={UsersThree}
                  title="اولویت دوم"
                  value="پیگیری لیدهای داغ"
                />

                <AdvisorAction
                  icon={Megaphone}
                  title="اولویت سوم"
                  value="بهینه‌سازی بودجه"
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
                  اقدام پیشنهادی
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "تحلیل کامل سناریو در مرحله اتصال Business Brain فعال می‌شود."
                    )
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60"
                >
                  مشاهده تحلیل کامل
                </button>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "پیشنهادهای اجرایی بر اساس داده واقعی تولید خواهند شد."
                    )
                  }
                  className="w-full rounded-xl border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-3 text-sm text-cyan-200"
                >
                  پیشنهاد اقدامات
                </button>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "اجرای پیشنهادها بعداً به Automation Center متصل می‌شود."
                    )
                  }
                  className="w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold"
                >
                  اجرا با تأیید من
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

  const style =
    scenario.id === "growth"
      ? "border-emerald-400/20 bg-emerald-500/[0.05]"
      : scenario.id === "current"
        ? "border-blue-400/20 bg-blue-500/[0.05]"
        : "border-red-400/20 bg-red-500/[0.05]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[28px] border p-6 text-right backdrop-blur-xl transition hover:-translate-y-1 ${style} ${
        active
          ? "ring-1 ring-violet-400/40"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/20">
          <Icon
            size={23}
            weight="duotone"
            className="text-cyan-300"
          />
        </div>

        {active && (
          <CheckCircle
            size={20}
            weight="fill"
            className="text-violet-300"
          />
        )}
      </div>

      <h3 className="mt-5 text-lg font-semibold">
        {scenario.title}
      </h3>

      <div className="mt-3 text-4xl font-bold">
        {scenario.probability}٪
      </div>

      <p className="mt-3 text-sm leading-7 text-white/45">
        {scenario.description}
      </p>
    </button>
  );
}

function ForecastRow({
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

function ForecastMetricCard({
  metric,
}: {
  metric: ForecastMetric;
}) {
  return (
    <div className="rounded-[26px] border border-white/[0.08] bg-[#080d1d]/62 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/40">
          {metric.title}
        </span>

        <span
          className={`flex items-center gap-1 text-xs ${
            metric.positive
              ? "text-emerald-300"
              : "text-red-300"
          }`}
        >
          {metric.positive ? (
            <ArrowUp size={13} />
          ) : (
            <ArrowDown size={13} />
          )}

          {metric.change}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-white/30">
            امروز
          </div>

          <div className="mt-1 text-sm font-semibold">
            {metric.current}
          </div>
        </div>

        <ArrowLeftIcon />

        <div className="text-left">
          <div className="text-xs text-white/30">
            پیش‌بینی
          </div>

          <div className="mt-1 text-lg font-bold text-cyan-300">
            {metric.future}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <div className="text-lg text-violet-300">
      ←
    </div>
  );
}

function EnginePrediction({
  icon: Icon,
  title,
  score,
  status,
  insight,
}: {
  icon: React.ElementType;
  title: string;
  score: number;
  status: string;
  insight: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/[0.08] bg-[#080d1d]/62 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-500/[0.08]">
          <Icon
            size={21}
            weight="duotone"
            className="text-violet-300"
          />
        </div>

        <span className="text-2xl font-bold text-cyan-300">
          {score}٪
        </span>
      </div>

      <h3 className="mt-5 font-semibold">
        {title}
      </h3>

      <div className="mt-2 text-xs text-emerald-300">
        {status}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300"
          style={{
            width: `${score}%`,
          }}
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-white/40">
        {insight}
      </p>
    </div>
  );
}

function WarningCard({
  item,
}: {
  item: WarningItem;
}) {
  return (
    <div
      className={`rounded-[26px] border p-6 ${
        item.severity === "high"
          ? "border-red-400/15 bg-red-500/[0.05]"
          : "border-amber-400/15 bg-amber-500/[0.05]"
      }`}
    >
      <div className="flex items-center justify-between">
        <WarningCircle
          size={23}
          weight="duotone"
          className={
            item.severity === "high"
              ? "text-red-300"
              : "text-amber-300"
          }
        />

        <span className="rounded-full border border-white/[0.07] bg-black/20 px-3 py-1.5 text-xs text-white/45">
          {item.severity === "high"
            ? "مهم"
            : "نیاز به توجه"}
        </span>
      </div>

      <h3 className="mt-5 font-semibold">
        {item.title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-white/45">
        {item.description}
      </p>

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <div className="text-xs text-white/30">
          پیشنهاد Loadder
        </div>

        <div className="mt-2 text-sm text-cyan-300">
          {item.action}
        </div>
      </div>
    </div>
  );
}

function SimulatorCard({
  title,
  result,
  onClick,
}: {
  title: string;
  result: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-right transition hover:border-violet-300/20 hover:bg-white/[0.04]"
    >
      <div className="text-sm leading-7 text-white/50">
        {title}
      </div>

      <div className="mt-4 text-lg font-bold text-cyan-300">
        {result}
      </div>
    </button>
  );
}

function AdvisorAction({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <Icon
        size={20}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-3 text-xs text-white/35">
        {title}
      </div>

      <div className="mt-1 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}