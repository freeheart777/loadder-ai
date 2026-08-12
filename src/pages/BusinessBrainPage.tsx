import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Brain,
  Sparkle,
  Target,
  UsersThree,
  Package,
  TrendUp,
  WarningCircle,
  CheckCircle,
  Lightning,
  Database,
  BookOpenText,
  Megaphone,
  ChartLineUp,
  Funnel,
  Gear,
  Plus,
  PencilSimple,
  ShieldCheck,
  Clock,
  Globe,
} from "@phosphor-icons/react";

type MemoryItem = {
  id: number;
  title: string;
  description: string;
  time: string;
  category: string;
};

type DataSource = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: "متصل" | "آماده اتصال" | "در حال توسعه";
};

type BusinessSignal = {
  title: string;
  value: string;
  description: string;
  tone: "positive" | "warning" | "neutral";
};

const memories: MemoryItem[] = [
  {
    id: 1,
    title: "هدف اصلی رشد",
    description:
      "تمرکز فعلی روی افزایش فروش و بهبود نرخ تبدیل است.",
    time: "امروز",
    category: "هدف",
  },
  {
    id: 2,
    title: "مخاطب اصلی",
    description:
      "مدیران و صاحبان کسب‌وکار با نیاز به رشد دیجیتال.",
    time: "۲ روز پیش",
    category: "مخاطب",
  },
  {
    id: 3,
    title: "کانال پربازده",
    description:
      "تبلیغات جست‌وجویی بیشترین کیفیت لید را ایجاد کرده است.",
    time: "۳ روز پیش",
    category: "تبلیغات",
  },
  {
    id: 4,
    title: "موضوع محتوایی موفق",
    description:
      "محتوای آموزشی بیشترین تعامل را ایجاد کرده است.",
    time: "۵ روز پیش",
    category: "محتوا",
  },
];

const dataSources: DataSource[] = [
  {
    id: "brand",
    title: "برند بوک",
    description:
      "لحن، شخصیت، پیام و هویت برند",
    icon: BookOpenText,
    status: "متصل",
  },
  {
    id: "crm",
    title: "اطلاعات مشتریان",
    description:
      "مشتریان، لیدها و رفتار فروش",
    icon: UsersThree,
    status: "متصل",
  },
  {
    id: "ads",
    title: "تبلیغات",
    description:
      "کمپین‌ها، بودجه و عملکرد کانال‌ها",
    icon: Megaphone,
    status: "متصل",
  },
  {
    id: "analytics",
    title: "تحلیل و گزارش",
    description:
      "روند رشد و شاخص‌های عملکرد",
    icon: ChartLineUp,
    status: "متصل",
  },
  {
    id: "website",
    title: "وب‌سایت",
    description:
      "رفتار کاربران و نرخ تبدیل",
    icon: Globe,
    status: "آماده اتصال",
  },
  {
    id: "automation",
    title: "اتوماسیون",
    description:
      "جریان‌های کاری و اقدامات خودکار",
    icon: Lightning,
    status: "در حال توسعه",
  },
];

const businessSignals: BusinessSignal[] = [
  {
    title: "سلامت کلی کسب‌وکار",
    value: "۸۶٪",
    description:
      "وضعیت کلی مثبت و رو به رشد",
    tone: "positive",
  },
  {
    title: "آمادگی برای رشد",
    value: "۸۱٪",
    description:
      "زیرساخت رشد مناسب است",
    tone: "positive",
  },
  {
    title: "ریسک فعلی",
    value: "۱۸٪",
    description:
      "نیاز به بهبود نرخ تبدیل",
    tone: "warning",
  },
  {
    title: "کیفیت داده",
    value: "۷۸٪",
    description:
      "بخشی از داده‌ها هنوز کامل نیست",
    tone: "neutral",
  },
];

export default function BusinessBrainPage() {
  const [activeGoal, setActiveGoal] =
    useState("افزایش فروش");

  const [notice, setNotice] =
    useState("");

  const [memoryFilter, setMemoryFilter] =
    useState("همه");

  const filteredMemories = useMemo(() => {
    if (memoryFilter === "همه") {
      return memories;
    }

    return memories.filter(
      (item) =>
        item.category === memoryFilter
    );
  }, [memoryFilter]);

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
              <Brain
                size={25}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مغز هوشمند کسب‌وکار
              </h1>

              <p className="mt-1 text-sm text-white/45">
                مرکز شناخت، حافظه و تصمیم‌گیری Loadder
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              showNotice(
                "ویرایش پروفایل هوشمند در مرحله بعد فعال می‌شود."
              )
            }
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,.18)]"
          >
            <PencilSimple size={17} />
            ویرایش شناخت کسب‌وکار
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[22%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200">
                <Sparkle
                  size={16}
                  weight="fill"
                />
                هسته هوشمندی Loadder
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                Loadder باید کسب‌وکار را
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  بشناسد، به خاطر بسپارد و از آن یاد بگیرد.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                مغز هوشمند اطلاعات برند، مشتری، محصول، محتوا، تبلیغات،
                فروش و عملکرد را به یک تصویر واحد تبدیل می‌کند تا تمام
                ابزارها و ایجنت‌های آینده Loadder از یک شناخت مشترک
                استفاده کنند.
              </p>
            </div>

            <div className="relative flex min-h-[250px] items-center justify-center">
              <div className="absolute h-[210px] w-[210px] rounded-full border border-violet-400/15 bg-violet-500/[0.05]" />

              <div className="absolute h-[155px] w-[155px] rounded-full border border-cyan-400/10 bg-cyan-500/[0.04]" />

              <div className="relative flex h-28 w-28 items-center justify-center rounded-[32px] border border-violet-300/20 bg-gradient-to-br from-violet-500/20 to-cyan-500/10 shadow-[0_0_55px_rgba(139,92,246,.2)]">
                <Brain
                  size={52}
                  weight="duotone"
                  className="text-violet-200"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SIGNALS */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {businessSignals.map(
            (signal) => (
              <SignalCard
                key={signal.title}
                {...signal}
              />
            )
          )}
        </section>

        {/* BUSINESS PROFILE */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  شناخت کسب‌وکار
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اطلاعاتی که مغز Loadder از کسب‌وکار می‌داند
                </p>
              </div>

              <Database
                size={23}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ProfileCard
                icon={Target}
                title="هدف اصلی"
                value={activeGoal}
              />

              <ProfileCard
                icon={UsersThree}
                title="مخاطب اصلی"
                value="مدیران و صاحبان کسب‌وکار"
              />

              <ProfileCard
                icon={Package}
                title="پیشنهاد اصلی"
                value="رشد یکپارچه با هوش مصنوعی"
              />

              <ProfileCard
                icon={TrendUp}
                title="مزیت رقابتی"
                value="اتصال همه ابزارهای رشد"
              />
            </div>

            <div className="mt-6">
              <div className="mb-3 text-sm text-white/45">
                هدف فعلی کسب‌وکار
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  "افزایش فروش",
                  "جذب مشتری",
                  "رشد برند",
                  "کاهش هزینه",
                  "افزایش وفاداری",
                ].map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() =>
                      setActiveGoal(goal)
                    }
                    className={`rounded-xl border px-4 py-2.5 text-sm transition ${
                      activeGoal === goal
                        ? "border-violet-400/25 bg-violet-500/[0.10] text-violet-200"
                        : "border-white/[0.07] bg-white/[0.03] text-white/40"
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI READINESS */}
          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <ShieldCheck
                size={24}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  آمادگی هوش مصنوعی
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  میزان شناخت فعلی Loadder
                </p>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-center">
              <div
                className="relative flex h-[190px] w-[190px] items-center justify-center rounded-full"
                style={{
                  background:
                    "conic-gradient(#22d3ee 0deg, #8b5cf6 288deg, rgba(255,255,255,.06) 288deg)",
                }}
              >
                <div className="flex h-[145px] w-[145px] flex-col items-center justify-center rounded-full bg-[#080d1d]">
                  <div className="text-4xl font-bold">
                    ۸۰٪
                  </div>

                  <div className="mt-1 text-xs text-white/35">
                    آمادگی
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-sm leading-7 text-white/45">
              با اتصال کامل داده‌های وب‌سایت، فروش و اتوماسیون،
              کیفیت تصمیم‌گیری AI بیشتر می‌شود.
            </p>
          </aside>
        </section>

        {/* DATA SOURCES */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                منابع شناخت
              </h2>

              <p className="mt-1 text-sm text-white/40">
                داده‌هایی که مغز Loadder از آن‌ها یاد می‌گیرد.
              </p>
            </div>

            <span className="text-xs text-cyan-300/70">
              ۴ منبع متصل
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dataSources.map(
              (source) => (
                <DataSourceCard
                  key={source.id}
                  source={source}
                  onClick={() =>
                    showNotice(
                      `${source.title}: ${source.status}`
                    )
                  }
                />
              )
            )}
          </div>
        </section>

        {/* MEMORY */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  حافظه کسب‌وکار
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  تصمیم‌ها و شناخت‌های مهم که Loadder باید به خاطر بسپارد.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "افزودن حافظه جدید در مرحله بعد فعال می‌شود."
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-500/[0.07] px-4 py-2.5 text-sm text-violet-200"
              >
                <Plus size={15} />
                افزودن حافظه
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "همه",
                "هدف",
                "مخاطب",
                "تبلیغات",
                "محتوا",
              ].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() =>
                    setMemoryFilter(filter)
                  }
                  className={`rounded-xl border px-4 py-2 text-xs transition ${
                    memoryFilter === filter
                      ? "border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-200"
                      : "border-white/[0.06] bg-white/[0.02] text-white/35"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {filteredMemories.map(
                (memory) => (
                  <MemoryRow
                    key={memory.id}
                    memory={memory}
                  />
                )
              )}
            </div>
          </div>

          {/* BUSINESS RISKS */}
          <aside className="space-y-5">
            <div className="rounded-[28px] border border-emerald-400/15 bg-emerald-500/[0.05] p-6">
              <div className="flex items-center gap-3">
                <CheckCircle
                  size={22}
                  weight="duotone"
                  className="text-emerald-300"
                />

                <h3 className="text-lg font-semibold">
                  نقاط قوت
                </h3>
              </div>

              <div className="mt-5 space-y-3">
                <SimpleRow
                  title="رشد فروش"
                  value="مثبت"
                />

                <SimpleRow
                  title="کیفیت محتوا"
                  value="بالا"
                />

                <SimpleRow
                  title="تعامل مشتری"
                  value="خوب"
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-amber-400/15 bg-amber-500/[0.05] p-6">
              <div className="flex items-center gap-3">
                <WarningCircle
                  size={22}
                  weight="duotone"
                  className="text-amber-300"
                />

                <h3 className="text-lg font-semibold">
                  ریسک‌ها
                </h3>
              </div>

              <div className="mt-5 space-y-3">
                <SimpleRow
                  title="نرخ تبدیل"
                  value="نیاز به بهبود"
                />

                <SimpleRow
                  title="هزینه جذب"
                  value="رو به افزایش"
                />

                <SimpleRow
                  title="داده وب‌سایت"
                  value="ناقص"
                />
              </div>
            </div>
          </aside>
        </section>

        {/* DECISION MAP */}
        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                نقشه تصمیم‌گیری Loadder
              </h2>

              <p className="mt-1 text-sm text-white/40">
                اطلاعات چگونه تبدیل به تصمیم می‌شوند.
              </p>
            </div>

            <Funnel
              size={23}
              weight="duotone"
              className="text-violet-300"
            />
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DecisionStep
              number="۱"
              title="شناخت برند"
              value="هویت و پیام"
            />

            <DecisionStep
              number="۲"
              title="شناخت مشتری"
              value="رفتار و نیاز"
            />

            <DecisionStep
              number="۳"
              title="تحلیل عملکرد"
              value="داده و KPI"
            />

            <DecisionStep
              number="۴"
              title="پیش‌بینی"
              value="رشد و ریسک"
            />

            <DecisionStep
              number="۵"
              title="اقدام"
              value="پیشنهاد یا اجرا"
            />
          </div>
        </section>

        {/* AI BRAIN */}
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
                    تصمیم هوشمند Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    تحلیل مشترک تمام بخش‌های کسب‌وکار
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                بر اساس داده‌های فعلی، مهم‌ترین فرصت رشد در بهبود نرخ تبدیل
                و افزایش سرعت پیگیری مشتریان بالقوه قرار دارد. Loadder در
                آینده می‌تواند این تحلیل را به اتوماسیون و ایجنت‌های تخصصی
                منتقل کند تا اقدامات بعدی به‌صورت هماهنگ اجرا شوند.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <AIInsightCard
                  icon={Target}
                  title="اولویت اول"
                  value="بهبود نرخ تبدیل"
                />

                <AIInsightCard
                  icon={UsersThree}
                  title="اولویت دوم"
                  value="پیگیری لیدهای داغ"
                />

                <AIInsightCard
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
                  سطح اختیار AI
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "حالت تحلیل انتخاب شد."
                    )
                  }
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60"
                >
                  فقط تحلیل کن
                </button>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "حالت پیشنهاد انتخاب شد."
                    )
                  }
                  className="w-full rounded-xl border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-3 text-sm text-cyan-200"
                >
                  پیشنهاد بده
                </button>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "اجرای هوشمند بعداً به Automation و AI Agents متصل می‌شود."
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

function SignalCard({
  title,
  value,
  description,
  tone,
}: BusinessSignal) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "warning"
        ? "text-amber-300"
        : "text-cyan-300";

  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div className="text-sm text-white/40">
        {title}
      </div>

      <div
        className={`mt-3 text-3xl font-bold ${toneClass}`}
      >
        {value}
      </div>

      <p className="mt-2 text-xs leading-6 text-white/35">
        {description}
      </p>
    </div>
  );
}

function ProfileCard({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <Icon
        size={21}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-4 text-xs text-white/35">
        {title}
      </div>

      <div className="mt-1 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}

function DataSourceCard({
  source,
  onClick,
}: {
  source: DataSource;
  onClick: () => void;
}) {
  const Icon = source.icon;

  const statusClass =
    source.status === "متصل"
      ? "border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
      : source.status ===
          "آماده اتصال"
        ? "border-cyan-400/10 bg-cyan-500/[0.07] text-cyan-300"
        : "border-amber-400/10 bg-amber-500/[0.07] text-amber-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 text-right backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-300/20"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20">
          <Icon
            size={21}
            weight="duotone"
            className="text-violet-300"
          />
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs ${statusClass}`}
        >
          {source.status}
        </span>
      </div>

      <h3 className="mt-4 font-semibold">
        {source.title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-white/40">
        {source.description}
      </p>
    </button>
  );
}

function MemoryRow({
  memory,
}: {
  memory: MemoryItem;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {memory.title}
            </span>

            <span className="rounded-full border border-violet-300/10 bg-violet-500/[0.06] px-2.5 py-1 text-[11px] text-violet-200">
              {memory.category}
            </span>
          </div>

          <p className="mt-2 text-sm leading-7 text-white/45">
            {memory.description}
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs text-white/25">
          <Clock size={13} />
          {memory.time}
        </div>
      </div>
    </div>
  );
}

function SimpleRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-black/20 p-3">
      <span className="text-sm text-white/45">
        {title}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}

function DecisionStep({
  number,
  title,
  value,
}: {
  number: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/[0.10] text-sm font-bold text-violet-300">
        {number}
      </div>

      <div className="mt-4 font-semibold">
        {title}
      </div>

      <div className="mt-1 text-xs text-white/35">
        {value}
      </div>
    </div>
  );
}

function AIInsightCard({
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