import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { withDemo } from "../lib/demoMode";
import { demoBusiness } from "../data/demoBusiness";

import {
  ArrowRight,
  Brain,
  Sparkle,
  MagnifyingGlass,
  InstagramLogo,
  VideoCamera,
  DeviceMobile,
  Image,
  ChatCircleText,
  Gift,
  UsersThree,
  Check,
  ArrowLeft,
  CurrencyDollar,
  Target,
  ChartLineUp,
  Megaphone,
  Lightning,
  Gauge,
  Funnel,
  CalendarBlank,
} from "@phosphor-icons/react";

type AdChannel = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: "آماده اتصال" | "در حال توسعه";
  accent: "violet" | "cyan" | "blue" | "pink";
};

type CampaignMetric = {
  title: string;
  value: string;
  subtitle: string;
};

const channels: AdChannel[] = [
  {
    id: "google",
    title: "تبلیغات گوگل",
    description:
      "تبلیغات جست‌وجویی، جذب مشتری و کمپین‌های عملکردی",
    icon: MagnifyingGlass,
    status: "آماده اتصال",
    accent: "blue",
  },
  {
    id: "social",
    title: "تبلیغات شبکه‌های اجتماعی",
    description:
      "اجرای کمپین در شبکه‌های اجتماعی و جذب مخاطب هدف",
    icon: InstagramLogo,
    status: "در حال توسعه",
    accent: "pink",
  },
  {
    id: "video",
    title: "تبلیغات ویدیویی",
    description:
      "تبلیغات پیش‌نمایش ویدیویی و کمپین‌های ویدیو مارکتینگ",
    icon: VideoCamera,
    status: "آماده اتصال",
    accent: "violet",
  },
  {
    id: "inapp",
    title: "تبلیغات داخل اپلیکیشن",
    description:
      "تبلیغات درون‌برنامه‌ای و کمپین‌های نصب اپلیکیشن",
    icon: DeviceMobile,
    status: "آماده اتصال",
    accent: "cyan",
  },
  {
    id: "banner",
    title: "تبلیغات بنری",
    description:
      "کمپین‌های نمایشی و تبلیغات بنری در شبکه‌های تبلیغاتی",
    icon: Image,
    status: "آماده اتصال",
    accent: "blue",
  },
  {
    id: "sms",
    title: "پیامک",
    description:
      "کمپین پیامکی، اطلاع‌رسانی، بازگشت مشتری و فروش",
    icon: ChatCircleText,
    status: "آماده اتصال",
    accent: "cyan",
  },
  {
    id: "promotion",
    title: "پروموشن",
    description:
      "تخفیف، پیشنهاد ویژه، کمپین فروش و تحریک خرید",
    icon: Gift,
    status: "در حال توسعه",
    accent: "pink",
  },
  {
    id: "affiliate",
    title: "همکاری در فروش",
    description:
      "لینک اختصاصی، همکاری با ناشران و پرداخت بر اساس نتیجه",
    icon: UsersThree,
    status: "در حال توسعه",
    accent: "violet",
  },
];

const campaignMetrics: CampaignMetric[] = [
  {
    title: "بودجه پیشنهادی",
    value: "۱۲۰ میلیون",
    subtitle: "برای ۳۰ روز",
  },
  {
    title: "مشتری بالقوه",
    value: "۳۸۰ نفر",
    subtitle: "برآورد اولیه",
  },
  {
    title: "بازده احتمالی",
    value: "۴.۶ برابر",
    subtitle: "بر اساس داده نمونه",
  },
  {
    title: "نرخ تبدیل هدف",
    value: "۷.۲٪",
    subtitle: "هدف کمپین",
  },
];

export default function AdsCenterPage() {

  const isDemo =
    new URLSearchParams(window.location.search).get("demo") === "1";

  const demoCampaigns =
    isDemo ? demoBusiness.demoCampaigns : [];


  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [budgetMode, setBudgetMode] = useState<
    "manual" | "smart"
  >("smart");

  const toggleChannel = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2200);
  };

  const selectedChannels = useMemo(
    () =>
      channels.filter((channel) =>
        selected.includes(channel.id)
      ),
    [selected]
  );

  const selectionMessage =
    selected.length === 0
      ? "هنوز کانالی انتخاب نشده"
      : selected.length === 1
        ? "یک سرویس برای کمپین انتخاب شده"
        : `${selected.length} سرویس برای کمپین انتخاب شده`;

  return (
    <main
      dir="rtl"
      className="loadder-dashboard-bg min-h-screen text-white"
    >
      {isDemo && (
        <section className="mx-auto max-w-[1500px] px-8 pt-6">
          <div className="rounded-[26px] border border-violet-300/15 bg-violet-500/[0.05] p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-violet-200">
                  کمپین‌های فعال دمو
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {demoBusiness.name}
                </div>
              </div>

              <div className="text-left">
                <div className="text-2xl font-bold">
                  {demoBusiness.ads.roas}
                </div>

                <div className="text-sm text-white/40">
                  ROAS
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {demoCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {campaign.name}
                    </div>

                    <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                      {campaign.status}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-white/45">
                    {campaign.channel}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-white/35">
                      هزینه
                    </span>

                    <span>
                      {campaign.spend}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-white/35">
                      بازده
                    </span>

                    <span className="text-cyan-300">
                      {campaign.roas}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              to={withDemo("/dashboard")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight size={18} />
            </Link>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/15 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
              <Megaphone
                size={25}
                weight="duotone"
                className="text-fuchsia-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مرکز تبلیغات
              </h1>

              <p className="mt-1 text-sm text-white/45">
                مدیریت تبلیغات و کمپین‌های چندکاناله
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-violet-300/10 bg-violet-500/[0.06] px-4 py-2 text-xs text-violet-200/80 md:block">
              {selectionMessage}
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "ساخت کمپین هوشمند در مرحله اتصال داده‌ها فعال می‌شود."
                )
              }
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,.18)]"
            >
              <Sparkle
                size={16}
                weight="fill"
              />
              کمپین جدید
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[22%] h-[320px] w-[320px] rounded-full bg-fuchsia-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_360px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/15 bg-fuchsia-500/[0.08] px-4 py-2 text-sm text-fuchsia-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                تبلیغات هوشمند
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                فقط همان سرویس تبلیغاتی را استفاده کن که
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {" "}
                  واقعاً نیاز داری.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                می‌توانی یک سرویس را مستقل انتخاب کنی یا چند کانال
                تبلیغاتی را کنار هم قرار بدهی تا Loadder در آینده بودجه،
                پیام، مخاطب و عملکرد کمپین را به‌صورت یکپارچه مدیریت کند.
              </p>
            </div>

            <div className="relative flex min-h-[220px] items-center justify-center">
              <div className="absolute h-[190px] w-[190px] rounded-full border border-violet-400/15 bg-violet-500/[0.05]" />

              <div className="absolute h-[135px] w-[135px] rounded-full border border-fuchsia-400/10 bg-fuchsia-500/[0.04]" />

              <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 shadow-[0_0_50px_rgba(139,92,246,.18)]">
                <Target
                  size={45}
                  weight="duotone"
                  className="text-violet-200"
                />
              </div>
            </div>
          </div>
        </section>

        {/* TOP METRICS */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {campaignMetrics.map((metric) => (
            <MetricCard
              key={metric.title}
              {...metric}
            />
          ))}
        </section>

        {/* CHANNELS */}
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                سرویس‌های تبلیغاتی
              </h2>

              <p className="mt-1 text-sm text-white/40">
                هر سرویس مستقل است و می‌تواند در کمپین ترکیبی هم استفاده شود.
              </p>
            </div>

            <div className="rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs text-white/45">
              {selected.length} سرویس انتخاب شده
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                selected={selected.includes(
                  channel.id
                )}
                onToggle={() =>
                  toggleChannel(channel.id)
                }
                onOpen={() =>
                  showNotice(
                    `ورود مستقیم به «${channel.title}» پس از اتصال سرویس فعال می‌شود.`
                  )
                }
              />
            ))}
          </div>
        </section>

        {/* CAMPAIGN BUILDER */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Funnel
                  size={23}
                  weight="duotone"
                  className="text-violet-300"
                />

                <div>
                  <h2 className="text-xl font-semibold">
                    کمپین ترکیبی
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    سرویس‌های انتخاب‌شده را در یک کمپین کنار هم قرار بده.
                  </p>
                </div>
              </div>

              <div className="rounded-full border border-violet-300/10 bg-violet-500/[0.06] px-4 py-2 text-xs text-violet-200/70">
                {selected.length} کانال
              </div>
            </div>

            {selected.length === 0 ? (
              <div className="mt-6 flex min-h-[180px] items-center justify-center rounded-[22px] border border-dashed border-white/[0.09] bg-black/15 p-6 text-center">
                <div>
                  <Target
                    size={28}
                    weight="duotone"
                    className="mx-auto text-white/25"
                  />

                  <p className="mt-4 text-sm leading-7 text-white/40">
                    از کارت‌های بالا حداقل یک سرویس را انتخاب کن.
                    <br />
                    می‌توانی فقط یک کانال یا چند کانال تبلیغاتی را انتخاب کنی.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex flex-wrap gap-2">
                  {selectedChannels.map(
                    (channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() =>
                          toggleChannel(
                            channel.id
                          )
                        }
                        className="flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200"
                      >
                        <Check
                          size={14}
                          weight="bold"
                        />
                        {channel.title}
                      </button>
                    )
                  )}
                </div>

                <div className="mt-7 grid gap-4 md:grid-cols-3">
                  <CampaignStep
                    number="۱"
                    title="هدف کمپین"
                    description="فروش، لید یا آگاهی"
                  />

                  <CampaignStep
                    number="۲"
                    title="بودجه"
                    description="کل یا تفکیک کانال"
                  />

                  <CampaignStep
                    number="۳"
                    title="مخاطب"
                    description="انتخاب جامعه هدف"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "مرحله بعد: ساخت شرح کمپین، بودجه و هدف برای سرویس‌های انتخاب‌شده."
                    )
                  }
                  className="mt-7 flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-fuchsia-500 px-6 py-4 text-sm font-semibold"
                >
                  <Sparkle
                    size={17}
                    weight="fill"
                  />
                  ادامه ساخت کمپین
                </button>
              </div>
            )}
          </div>

          {/* SMART BUDGET */}
          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <CurrencyDollar
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  مدیریت بودجه
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  نحوه تقسیم بودجه را انتخاب کن.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() =>
                  setBudgetMode("smart")
                }
                className={`rounded-2xl border p-4 text-right transition ${
                  budgetMode === "smart"
                    ? "border-violet-400/25 bg-violet-500/[0.10]"
                    : "border-white/[0.07] bg-black/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Brain
                    size={20}
                    weight="duotone"
                    className="text-violet-300"
                  />

                  <div>
                    <div className="font-semibold">
                      تقسیم هوشمند
                    </div>

                    <p className="mt-1 text-xs leading-6 text-white/40">
                      Loadder بودجه را بر اساس عملکرد کانال‌ها پیشنهاد می‌دهد.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setBudgetMode("manual")
                }
                className={`rounded-2xl border p-4 text-right transition ${
                  budgetMode === "manual"
                    ? "border-cyan-400/25 bg-cyan-500/[0.08]"
                    : "border-white/[0.07] bg-black/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Gauge
                    size={20}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <div>
                    <div className="font-semibold">
                      تقسیم دستی
                    </div>

                    <p className="mt-1 text-xs leading-6 text-white/40">
                      بودجه هر سرویس را خودت مشخص کن.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/20 p-5">
              <div className="text-xs text-white/35">
                پیشنهاد فعلی
              </div>

              <div className="mt-4 space-y-3">
                <BudgetRow
                  title="تبلیغات گوگل"
                  value="۳۰٪"
                />

                <BudgetRow
                  title="شبکه‌های اجتماعی"
                  value="۲۵٪"
                />

                <BudgetRow
                  title="ویدیو"
                  value="۲۰٪"
                />

                <BudgetRow
                  title="بنر و داخل اپ"
                  value="۱۵٪"
                />

                <BudgetRow
                  title="پیامک و پروموشن"
                  value="۱۰٪"
                />
              </div>
            </div>
          </aside>
        </section>

        {/* INTELLIGENCE */}
        <section className="mt-8 overflow-hidden rounded-[32px] border border-violet-400/15 bg-gradient-to-l from-violet-500/[0.10] via-[#080d1d]/70 to-fuchsia-500/[0.05] p-8 backdrop-blur-xl">
          <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
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
                    مغز تبلیغاتی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    انتخاب کانال، پیام و بودجه بر اساس داده
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                در نسخه هوشمند، Loadder اطلاعات برند، محصول، مشتری،
                عملکرد محتوایی و نتایج فروش را کنار هم قرار می‌دهد تا
                بهترین ترکیب کانال تبلیغاتی و بودجه را پیشنهاد دهد.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <IntelligenceCard
                  icon={Target}
                  title="انتخاب مخاطب"
                  value="پیشنهاد خودکار"
                />

                <IntelligenceCard
                  icon={ChartLineUp}
                  title="اندازه‌گیری نتیجه"
                  value="فروش و بازده"
                />

                <IntelligenceCard
                  icon={Lightning}
                  title="بهینه‌سازی"
                  value="پیشنهاد لحظه‌ای"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="text-sm font-semibold">
                نحوه استفاده
              </div>

              <div className="mt-5 space-y-3">
                <ModeRow
                  number="۱"
                  text="یک یا چند سرویس را انتخاب کن"
                />

                <ModeRow
                  number="۲"
                  text="هدف و بودجه را مشخص کن"
                />

                <ModeRow
                  number="۳"
                  text="کمپین را بساز و نتیجه را تحلیل کن"
                />
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

function ChannelCard({
  channel,
  selected,
  onToggle,
  onOpen,
}: {
  channel: AdChannel;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const Icon = channel.icon;

  const accentClasses = {
    violet: {
      icon: "text-violet-300",
      background:
        "from-violet-500/[0.10] via-blue-500/[0.04] to-transparent",
    },
    cyan: {
      icon: "text-cyan-300",
      background:
        "from-cyan-500/[0.10] via-blue-500/[0.04] to-transparent",
    },
    blue: {
      icon: "text-blue-300",
      background:
        "from-blue-500/[0.10] via-violet-500/[0.04] to-transparent",
    },
    pink: {
      icon: "text-fuchsia-300",
      background:
        "from-fuchsia-500/[0.10] via-violet-500/[0.04] to-transparent",
    },
  };

  const accent =
    accentClasses[channel.accent];

  return (
    <div
      className={`group relative min-h-[275px] overflow-hidden rounded-[26px] border p-5 backdrop-blur-xl transition ${
        selected
          ? "border-violet-400/35 bg-[#0b1124]/80"
          : "border-white/[0.08] bg-[#080d1d]/62 hover:-translate-y-1 hover:border-violet-300/20"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.background}`}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/25">
            <Icon
              size={23}
              weight="duotone"
              className={accent.icon}
            />
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-label={`انتخاب ${channel.title}`}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
              selected
                ? "border-violet-400 bg-violet-500 text-white"
                : "border-white/15 bg-white/[0.03] text-transparent hover:border-violet-300/40"
            }`}
          >
            <Check
              size={15}
              weight="bold"
            />
          </button>
        </div>

        <h3 className="mt-5 text-[17px] font-semibold">
          {channel.title}
        </h3>

        <p className="mt-2 text-sm leading-7 text-white/45">
          {channel.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span
            className={`rounded-full px-3 py-1.5 text-xs ${
              channel.status ===
              "آماده اتصال"
                ? "border border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
                : "border border-amber-400/10 bg-amber-500/[0.07] text-amber-300"
            }`}
          >
            {channel.status}
          </span>

          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-1.5 text-xs text-violet-300/80 transition hover:text-white"
          >
            ورود مستقیم
            <ArrowLeft size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
}: CampaignMetric) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div className="text-sm text-white/40">
        {title}
      </div>

      <div className="mt-3 text-2xl font-bold">
        {value}
      </div>

      <div className="mt-2 text-xs text-cyan-300/65">
        {subtitle}
      </div>

      <div className="mt-4 h-1 rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300" />
    </div>
  );
}

function CampaignStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/[0.10] text-sm font-bold text-violet-300">
        {number}
      </div>

      <div className="mt-4 font-semibold">
        {title}
      </div>

      <div className="mt-1 text-xs text-white/35">
        {description}
      </div>
    </div>
  );
}

function BudgetRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
      <span className="text-xs text-white/45">
        {title}
      </span>

      <span className="text-sm font-semibold text-cyan-300">
        {value}
      </span>
    </div>
  );
}

function IntelligenceCard({
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

      <div className="mt-3 text-sm font-semibold">
        {title}
      </div>

      <div className="mt-1 text-xs text-white/35">
        {value}
      </div>
    </div>
  );
}

function ModeRow({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/[0.10] text-sm font-bold text-violet-300">
        {number}
      </div>

      <span className="text-sm text-white/55">
        {text}
      </span>
    </div>
  );
}