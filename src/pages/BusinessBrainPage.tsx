import { useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Brain,
  Sparkle,
  Globe,
  BookOpenText,
  UsersThree,
  InstagramLogo,
  Megaphone,
  ShoppingCart,
  Files,
  CheckCircle,
  WarningCircle,
  TrendUp,
  Target,
  Lightning,
  Plus,
  UploadSimple,
  LinkSimple,
  PencilSimple,
  ChartLineUp,
  Package,
  UserFocus,
  Quotes,
  Flag,
  Lightbulb,
  ShieldWarning,
} from "@phosphor-icons/react";

type SourceId =
  | "website"
  | "brand"
  | "crm"
  | "social"
  | "ads"
  | "sales"
  | "files";

type Source = {
  id: SourceId;
  title: string;
  description: string;
  icon: React.ElementType;
  connected: boolean;
  quality: number;
};

const initialSources: Source[] = [
  {
    id: "website",
    title: "وب‌سایت",
    description: "صفحات، خدمات، محصولات و پیام‌های برند",
    icon: Globe,
    connected: true,
    quality: 84,
  },
  {
    id: "brand",
    title: "Brand Book",
    description: "هویت، لحن، شخصیت و قواعد برند",
    icon: BookOpenText,
    connected: true,
    quality: 92,
  },
  {
    id: "crm",
    title: "CRM",
    description: "مشتریان، لیدها، تعامل و تاریخچه ارتباط",
    icon: UsersThree,
    connected: true,
    quality: 73,
  },
  {
    id: "social",
    title: "شبکه‌های اجتماعی",
    description: "محتوا، مخاطب، Reach و Engagement",
    icon: InstagramLogo,
    connected: false,
    quality: 0,
  },
  {
    id: "ads",
    title: "تبلیغات",
    description: "کمپین‌ها، هزینه، ROAS و Conversion",
    icon: Megaphone,
    connected: false,
    quality: 0,
  },
  {
    id: "sales",
    title: "فروش",
    description: "Revenue، محصولات و رفتار خرید",
    icon: ShoppingCart,
    connected: false,
    quality: 0,
  },
  {
    id: "files",
    title: "فایل‌ها و اسناد",
    description: "پروپوزال، کاتالوگ، فایل‌های داخلی و تحقیقات",
    icon: Files,
    connected: false,
    quality: 0,
  },
];

const intelligence = [
  {
    icon: Target,
    title: "ارزش پیشنهادی",
    value:
      "یک پلتفرم یکپارچه برای مدیریت رشد، بازاریابی، فروش و هوشمندسازی کسب‌وکار با AI.",
  },
  {
    icon: UserFocus,
    title: "مخاطب اصلی",
    value:
      "کسب‌وکارهای کوچک و متوسط، مدیران مارکتینگ، تیم‌های فروش و شرکت‌های در حال رشد.",
  },
  {
    icon: Quotes,
    title: "لحن برند",
    value:
      "هوشمند، آینده‌نگر، قدرتمند، حرفه‌ای و در عین حال ساده و قابل استفاده.",
  },
  {
    icon: Flag,
    title: "جایگاه بازار",
    value:
      "AI Business Growth Platform با تمرکز بر اتصال ابزارهای بازاریابی، CRM، Analytics و Automation.",
  },
  {
    icon: Package,
    title: "محصولات و سرویس‌ها",
    value:
      "Brand Book، Content Studio، Social، Ads، CRM، Analytics، KPI، Automation و ابزارهای آینده.",
  },
  {
    icon: TrendUp,
    title: "محرک اصلی رشد",
    value:
      "اتصال داده‌های چند کانال به Business Brain و تبدیل داده به پیشنهاد و اقدام.",
  },
];

const opportunities = [
  {
    title: "اتصال داده‌های CRM به Content Studio",
    description:
      "محتوا بر اساس سگمنت‌های واقعی مشتری و رفتار خرید شخصی‌سازی شود.",
    impact: "بالا",
  },
  {
    title: "ساخت Campaign Brain",
    description:
      "یک Big Idea مرکزی برای تمام کانال‌های Ads، Social، SMS و Content ساخته شود.",
    impact: "بالا",
  },
  {
    title: "AI Lead Prioritization",
    description:
      "لیدهای با احتمال خرید بالاتر به صورت خودکار برای تیم فروش اولویت‌بندی شوند.",
    impact: "متوسط",
  },
];

const risks = [
  {
    title: "کمبود داده واقعی",
    description:
      "بخشی از تحلیل‌ها تا زمان اتصال APIها همچنان بر پایه داده آزمایشی خواهد بود.",
  },
  {
    title: "Data Silos",
    description:
      "اگر سرویس‌ها جدا از Business Brain توسعه پیدا کنند، ارزش پلتفرم کاهش می‌یابد.",
  },
  {
    title: "پیچیدگی بیش از حد",
    description:
      "UI باید برای کاربر ساده بماند حتی اگر زیرساخت محصول بسیار پیچیده شود.",
  },
];

export default function BusinessBrainPage() {
  const [sources, setSources] =
    useState<Source[]>(initialSources);

  const [activeTab, setActiveTab] = useState<
    "dna" | "sources" | "opportunities" | "risks"
  >("dna");

  const [notice, setNotice] = useState("");

  const connectedCount =
    sources.filter((source) => source.connected).length;

  const dnaScore = Math.round(
    sources.reduce(
      (total, source) =>
        total + (source.connected ? source.quality : 0),
      0
    ) / sources.length
  );

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2300);
  };

  const toggleSource = (id: SourceId) => {
    setSources((current) =>
      current.map((source) =>
        source.id === id
          ? {
              ...source,
              connected: !source.connected,
              quality: source.connected
                ? 0
                : source.quality || 65,
            }
          : source
      )
    );
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#05070a] text-white"
    >
      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05070a]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.03] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight size={19} />
            </Link>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 shadow-[0_0_35px_rgba(139,92,246,0.15)]">
              <Brain
                size={27}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مغز هوشمند کسب‌وکار
              </h1>

              <p className="mt-1 text-sm text-white/50">
                لایه شناخت، یادگیری و تصمیم‌گیری Loadder
              </p>
            </div>
          </div>

          <div
            dir="ltr"
            className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-xl font-bold text-transparent"
          >
            Loadder Brain
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">

        {/* HERO */}

        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#090c13] p-8">
          <div className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-violet-600/[0.12] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-28 right-[15%] h-[360px] w-[360px] rounded-full bg-cyan-500/[0.07] blur-[130px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/10 px-4 py-2">
                <Sparkle
                  size={15}
                  weight="fill"
                  className="text-violet-300"
                />

                <span className="text-sm text-violet-200">
                  هوشمندی کسب‌وکار
                </span>
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                قبل از اینکه AI برای کسب‌وکار تصمیم بگیرد،
                <span className="text-violet-300">
                  {" "}
                  باید واقعاً آن کسب‌وکار را بشناسد.
                </span>
              </h2>

              <p className="mt-4 max-w-4xl text-base leading-9 text-white/55">
                Business Brain اطلاعات برند، وب‌سایت، محصولات،
                CRM، Social، Ads، فروش و اسناد را به یک Business
                DNA واحد تبدیل می‌کند. تمام متخصص‌های AI در آینده
                از همین مغز مشترک تغذیه می‌شوند.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "تحلیل خودکار وب‌سایت در مرحله اتصال AI فعال می‌شود."
                    )
                  }
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-semibold"
                >
                  <LinkSimple size={17} />
                  تحلیل وب‌سایت
                </button>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "آپلود فایل و استخراج Business DNA در مرحله بعد فعال می‌شود."
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 py-3.5 text-sm"
                >
                  <UploadSimple size={17} />
                  آپلود اطلاعات برند
                </button>

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "ویرایش دستی Business DNA در مرحله بعد فعال می‌شود."
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 py-3.5 text-sm"
                >
                  <PencilSimple size={17} />
                  تکمیل دستی
                </button>
              </div>
            </div>

            <DNAVisual
              score={dnaScore}
              connected={connectedCount}
              total={sources.length}
            />
          </div>
        </section>

        {/* QUICK STATUS */}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            title="Business DNA"
            value={`${dnaScore}٪`}
            subtitle="سطح شناخت فعلی"
            icon={Brain}
          />

          <StatusCard
            title="منابع متصل"
            value={`${connectedCount}/${sources.length}`}
            subtitle="منبع داده"
            icon={LinkSimple}
          />

          <StatusCard
            title="فرصت‌های رشد"
            value="۳"
            subtitle="فرصت شناسایی‌شده"
            icon={Lightbulb}
          />

          <StatusCard
            title="ریسک‌های مهم"
            value="۳"
            subtitle="نیازمند توجه"
            icon={ShieldWarning}
          />
        </section>

        {/* TABS */}

        <section className="mt-8">
          <div className="grid gap-3 md:grid-cols-4">
            <TabButton
              active={activeTab === "dna"}
              onClick={() => setActiveTab("dna")}
              icon={Brain}
              title="Business DNA"
            />

            <TabButton
              active={activeTab === "sources"}
              onClick={() => setActiveTab("sources")}
              icon={LinkSimple}
              title="منابع داده"
            />

            <TabButton
              active={activeTab === "opportunities"}
              onClick={() => setActiveTab("opportunities")}
              icon={TrendUp}
              title="فرصت‌های رشد"
            />

            <TabButton
              active={activeTab === "risks"}
              onClick={() => setActiveTab("risks")}
              icon={WarningCircle}
              title="ریسک‌ها"
            />
          </div>
        </section>

        {/* BUSINESS DNA */}

        {activeTab === "dna" && (
          <section className="mt-5">
            <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    شناخت فعلی Loadder از کسب‌وکار
                  </h2>

                  <p className="mt-1 text-sm text-white/45">
                    این داده‌ها بعداً توسط AI استخراج، به‌روزرسانی و
                    اعتبارسنجی می‌شوند.
                  </p>
                </div>

                <span className="rounded-full border border-violet-300/15 bg-violet-500/10 px-4 py-2 text-sm text-violet-200">
                  DNA Version 0.1
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {intelligence.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="rounded-[24px] border border-white/[0.07] bg-black/20 p-5 transition hover:border-violet-300/20 hover:bg-white/[0.035]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10">
                        <Icon
                          size={21}
                          weight="duotone"
                          className="text-cyan-300"
                        />
                      </div>

                      <h3 className="mt-4 text-base font-semibold">
                        {item.title}
                      </h3>

                      <p className="mt-2 text-sm leading-8 text-white/50">
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
                <div className="flex items-center gap-3">
                  <ChartLineUp
                    size={23}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <div>
                    <h2 className="text-xl font-semibold">
                      عمق شناخت داده
                    </h2>

                    <p className="mt-1 text-sm text-white/45">
                      هرچه داده بیشتر و معتبرتر باشد، تصمیم AI دقیق‌تر می‌شود.
                    </p>
                  </div>
                </div>

                <div className="mt-7 space-y-5">
                  <KnowledgeBar
                    title="هویت برند"
                    value={92}
                  />

                  <KnowledgeBar
                    title="شناخت مشتری"
                    value={73}
                  />

                  <KnowledgeBar
                    title="محصول و خدمات"
                    value={78}
                  />

                  <KnowledgeBar
                    title="داده عملکرد"
                    value={46}
                  />

                  <KnowledgeBar
                    title="داده فروش"
                    value={28}
                  />
                </div>
              </div>

              <div className="rounded-[30px] border border-violet-400/15 bg-violet-500/[0.05] p-7">
                <div className="flex items-center gap-3">
                  <Sparkle
                    size={22}
                    weight="fill"
                    className="text-violet-300"
                  />

                  <h2 className="text-xl font-semibold">
                    Insight مغز Loadder
                  </h2>
                </div>

                <p className="mt-5 text-base leading-9 text-white/60">
                  شناخت برند در وضعیت مناسبی قرار دارد؛ اما برای تصمیم‌های
                  دقیق رشد، داده واقعی Social، Ads و Sales هنوز کم است.
                  بیشترین افزایش کیفیت Business Brain از اتصال همین سه منبع
                  حاصل خواهد شد.
                </p>

                <button
                  type="button"
                  onClick={() => setActiveTab("sources")}
                  className="mt-6 flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-5 py-3 text-sm"
                >
                  <Plus size={16} />
                  تکمیل منابع داده
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SOURCES */}

        {activeTab === "sources" && (
          <section className="mt-5 rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
            <div>
              <h2 className="text-xl font-semibold">
                منابع داده Business Brain
              </h2>

              <p className="mt-1 text-sm text-white/45">
                هر ماژول می‌تواند هم اطلاعات دریافت کند و هم دانش جدید
                به Business Brain برگرداند.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => {
                const Icon = source.icon;

                return (
                  <div
                    key={source.id}
                    className={`rounded-[24px] border p-5 transition ${
                      source.connected
                        ? "border-emerald-400/15 bg-emerald-500/[0.035]"
                        : "border-white/[0.07] bg-black/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                        <Icon
                          size={23}
                          weight="duotone"
                          className="text-cyan-300"
                        />
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          source.connected
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-white/[0.05] text-white/40"
                        }`}
                      >
                        {source.connected
                          ? "متصل"
                          : "متصل نیست"}
                      </span>
                    </div>

                    <h3 className="mt-5 text-base font-semibold">
                      {source.title}
                    </h3>

                    <p className="mt-2 min-h-[56px] text-sm leading-7 text-white/45">
                      {source.description}
                    </p>

                    {source.connected && (
                      <>
                        <div className="mt-5 flex items-center justify-between text-sm">
                          <span className="text-white/40">
                            کیفیت داده
                          </span>

                          <span>
                            {source.quality}٪
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-300"
                            style={{
                              width: `${source.quality}%`,
                            }}
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        toggleSource(source.id)
                      }
                      className={`mt-5 w-full rounded-xl border px-4 py-3 text-sm transition ${
                        source.connected
                          ? "border-red-300/10 bg-red-500/[0.04] text-red-200"
                          : "border-violet-300/15 bg-violet-500/[0.07] text-violet-200"
                      }`}
                    >
                      {source.connected
                        ? "قطع اتصال آزمایشی"
                        : "اتصال آزمایشی"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* OPPORTUNITIES */}

        {activeTab === "opportunities" && (
          <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <div className="rounded-[30px] border border-white/[0.08] bg-[#0a0d13] p-7">
              <div className="flex items-center gap-3">
                <Lightbulb
                  size={24}
                  weight="duotone"
                  className="text-amber-300"
                />

                <div>
                  <h2 className="text-xl font-semibold">
                    فرصت‌های رشد
                  </h2>

                  <p className="mt-1 text-sm text-white/45">
                    فرصت‌هایی که Business Brain از ترکیب داده‌ها پیدا می‌کند.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {opportunities.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() =>
                      showNotice(
                        `فرصت «${item.title}» انتخاب شد.`
                      )
                    }
                    className="w-full rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-right transition hover:border-violet-300/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                          {index + 1}
                        </div>

                        <div>
                          <h3 className="text-base font-semibold">
                            {item.title}
                          </h3>

                          <p className="mt-2 text-sm leading-7 text-white/50">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-300">
                        اثر {item.impact}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <aside className="rounded-[30px] border border-violet-400/15 bg-violet-500/[0.05] p-7">
              <Brain
                size={30}
                weight="duotone"
                className="text-violet-300"
              />

              <h2 className="mt-5 text-xl font-semibold">
                Growth Opportunity Engine
              </h2>

              <p className="mt-4 text-base leading-9 text-white/55">
                در نسخه نهایی، فرصت‌ها فقط نمایش داده نمی‌شوند؛ هر فرصت
                مستقیماً می‌تواند به Content Studio، Ads، CRM یا Automation
                ارسال شود و به Action تبدیل شود.
              </p>

              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "ساخت Action Plan با AI در مرحله بعد فعال می‌شود."
                  )
                }
                className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-semibold"
              >
                <Lightning size={17} weight="fill" />
                ساخت برنامه اقدام
              </button>
            </aside>
          </section>
        )}

        {/* RISKS */}

        {activeTab === "risks" && (
          <section className="mt-5 grid gap-4 md:grid-cols-3">
            {risks.map((risk) => (
              <div
                key={risk.title}
                className="rounded-[26px] border border-amber-300/10 bg-amber-500/[0.035] p-6"
              >
                <WarningCircle
                  size={24}
                  weight="duotone"
                  className="text-amber-300"
                />

                <h3 className="mt-5 text-lg font-semibold">
                  {risk.title}
                </h3>

                <p className="mt-3 text-sm leading-8 text-white/50">
                  {risk.description}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* BOTTOM AI */}

        <section className="mt-8 rounded-[32px] border border-violet-400/20 bg-gradient-to-l from-violet-500/[0.09] via-[#0a0d13] to-cyan-500/[0.05] p-8">
          <div className="grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="flex items-center gap-3">
                <Brain
                  size={27}
                  weight="duotone"
                  className="text-violet-300"
                />

                <h2 className="text-2xl font-bold">
                  Loadder Business Intelligence
                </h2>
              </div>

              <p className="mt-4 max-w-4xl text-base leading-9 text-white/60">
                هرچه Loadder بیشتر درباره برند، مشتری، محصول و عملکرد
                کسب‌وکار بداند، Content، Ads، CRM، Analytics، KPI و
                Automation خروجی دقیق‌تری خواهند داشت. این صفحه قرار است
                منبع حقیقت مشترک تمام AI Agentهای آینده Loadder باشد.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "بازسازی Business DNA با AI در مرحله اتصال مدل فعال می‌شود."
                )
              }
              className="flex min-h-[120px] items-center justify-center gap-3 rounded-[24px] border border-violet-300/15 bg-violet-500/[0.07] px-6 text-base transition hover:bg-violet-500/[0.12]"
            >
              <Sparkle size={21} weight="fill" />
              بازسازی Business DNA با AI
            </button>
          </div>
        </section>
      </div>

      {notice && (
        <div className="fixed bottom-7 left-7 z-[100] max-w-md rounded-2xl border border-violet-300/20 bg-[#11141c]/95 px-5 py-4 text-sm shadow-2xl backdrop-blur-xl">
          {notice}
        </div>
      )}
    </main>
  );
}

function DNAVisual({
  score,
  connected,
  total,
}: {
  score: number;
  connected: number;
  total: number;
}) {
  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-black/20 p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/45">
          Business DNA Score
        </span>

        <CheckCircle
          size={20}
          className="text-emerald-300"
        />
      </div>

      <div className="relative mx-auto mt-5 flex h-[205px] w-[205px] items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              #8b5cf6 0deg,
              #22d3ee ${score * 3.6}deg,
              rgba(255,255,255,0.06) ${score * 3.6}deg
            )`,
          }}
        />

        <div className="absolute inset-[18px] rounded-full bg-[#0a0d13]" />

        <div className="relative z-10 text-center">
          <Brain
            size={35}
            weight="duotone"
            className="mx-auto text-violet-300"
          />

          <div className="mt-2 text-4xl font-bold">
            {score}٪
          </div>

          <div className="mt-1 text-sm text-white/40">
            شناخت فعلی
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
        <span className="text-sm text-white/45">
          منابع متصل
        </span>

        <span className="text-sm font-semibold">
          {connected} از {total}
        </span>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#0a0d13] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/45">
          {title}
        </span>

        <Icon
          size={21}
          weight="duotone"
          className="text-violet-300"
        />
      </div>

      <div className="mt-4 text-3xl font-semibold">
        {value}
      </div>

      <div className="mt-2 text-sm text-white/35">
        {subtitle}
      </div>
    </div>
  );
}

function TabButton({
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
      className={`flex items-center justify-center gap-3 rounded-[20px] border px-5 py-4 text-sm transition ${
        active
          ? "border-violet-400/40 bg-violet-500/10 text-white"
          : "border-white/[0.07] bg-[#0a0d13] text-white/50 hover:bg-white/[0.04]"
      }`}
    >
      <Icon
        size={19}
        weight="duotone"
        className={
          active
            ? "text-cyan-300"
            : "text-white/35"
        }
      />

      {title}
    </button>
  );
}

function KnowledgeBar({
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
          className="h-full rounded-full bg-gradient-to-l from-violet-500 via-blue-400 to-cyan-300"
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}
