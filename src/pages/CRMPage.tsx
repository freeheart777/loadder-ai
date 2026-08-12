import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  UsersThree,
  UserPlus,
  TrendUp,
  CurrencyCircleDollar,
  Target,
  MagnifyingGlass,
  Funnel,
  Phone,
  ChatCircleText,
  CalendarBlank,
  Sparkle,
  Brain,
  CheckCircle,
  WarningCircle,
  Lightning,
  ShoppingCart,
  ArrowUp,
  Clock,
  Star,
  UserCircle,
} from "@phosphor-icons/react";

import { businessData } from "../data/businessData";

type LeadStatus =
  | "جدید"
  | "در حال پیگیری"
  | "آماده خرید"
  | "مشتری";

type Lead = {
  id: number;
  name: string;
  company: string;
  source: string;
  score: number;
  status: LeadStatus;
  value: string;
  lastAction: string;
};

const leads: Lead[] = [
  {
    id: 1,
    name: "علی رضایی",
    company: "فروشگاه آریا",
    source: "تبلیغات گوگل",
    score: 92,
    status: "آماده خرید",
    value: "۱۸ میلیون",
    lastAction: "۱۰ دقیقه پیش",
  },
  {
    id: 2,
    name: "سارا کریمی",
    company: "استودیو هشت",
    source: "اینستاگرام",
    score: 84,
    status: "در حال پیگیری",
    value: "۱۲ میلیون",
    lastAction: "۴۰ دقیقه پیش",
  },
  {
    id: 3,
    name: "محمد نادری",
    company: "پارس تجارت",
    source: "وب‌سایت",
    score: 78,
    status: "جدید",
    value: "۲۴ میلیون",
    lastAction: "۱ ساعت پیش",
  },
  {
    id: 4,
    name: "مریم احمدی",
    company: "کلینیک ویستا",
    source: "پیامک",
    score: 88,
    status: "آماده خرید",
    value: "۱۵ میلیون",
    lastAction: "۲ ساعت پیش",
  },
  {
    id: 5,
    name: "رضا مرادی",
    company: "مدیا پلاس",
    source: "معرفی مشتری",
    score: 70,
    status: "در حال پیگیری",
    value: "۹ میلیون",
    lastAction: "۳ ساعت پیش",
  },
];

const stats = [
  {
    title: "کل مشتریان",
    value: businessData.crm.totalCustomers.toLocaleString("fa-IR"),
    change: "+۹٪",
    icon: UsersThree,
  },
  {
    title: "مشتریان بالقوه جدید",
    value: businessData.crm.newLeads.toLocaleString("fa-IR"),
    change: "+۱۲٪",
    icon: UserPlus,
  },
  {
    title: "لیدهای داغ",
    value: businessData.crm.hotLeads.toLocaleString("fa-IR"),
    change: "+۱۸٪",
    icon: Target,
  },
  {
    title: "ارزش فرصت‌های فروش",
    value: businessData.sales.opportunityValueLabel,
    change: "+۲۱٪",
    icon: CurrencyCircleDollar,
  },
];

const funnelSteps = [
  {
    title: "ورودی جدید",
    value: businessData.crm.newLeads.toLocaleString("fa-IR"),
    width: "100%",
  },
  {
    title: "واجد شرایط",
    value: "۱۵۸",
    width: "82%",
  },
  {
    title: "در حال مذاکره",
    value: "۹۲",
    width: "64%",
  },
  {
    title: "آماده خرید",
    value: businessData.crm.hotLeads.toLocaleString("fa-IR"),
    width: "46%",
  },
  {
    title: "تبدیل به مشتری",
    value: "۲۹",
    width: "32%",
  },
];

const activities = [
  {
    title: "پیگیری مشتری بالقوه",
    description: "علی رضایی برای تماس فروش آماده است.",
    time: "۱۰ دقیقه پیش",
    icon: Phone,
  },
  {
    title: "پیام جدید",
    description: "سارا کریمی به پیشنهاد فروش پاسخ داده است.",
    time: "۴۰ دقیقه پیش",
    icon: ChatCircleText,
  },
  {
    title: "مشتری جدید",
    description: "مریم احمدی به مشتری فعال تبدیل شد.",
    time: "۲ ساعت پیش",
    icon: CheckCircle,
  },
  {
    title: "یادآوری تماس",
    description: "تماس پیگیری پارس تجارت امروز انجام شود.",
    time: "۳ ساعت پیش",
    icon: CalendarBlank,
  },
];

export default function CRMPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<"همه" | LeadStatus>("همه");

  const [notice, setNotice] = useState("");

  const activeCustomerPercent = Math.round(
    (businessData.crm.activeCustomers /
      businessData.crm.totalCustomers) *
      100
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchQuery =
        lead.name.includes(query) ||
        lead.company.includes(query) ||
        lead.source.includes(query);

      const matchStatus =
        activeFilter === "همه" ||
        lead.status === activeFilter;

      return matchQuery && matchStatus;
    });
  }, [query, activeFilter]);

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
              <UsersThree
                size={25}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                ارتباط با مشتری
              </h1>

              <p className="mt-1 text-sm text-white/45">
                مدیریت مشتریان، لیدها و فرصت‌های فروش
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              showNotice(
                "ساخت مشتری جدید در مرحله اتصال CRM واقعی فعال می‌شود."
              )
            }
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,.18)]"
          >
            <UserPlus size={17} />
            مشتری جدید
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_370px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-2 text-sm text-cyan-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                مدیریت هوشمند مشتری
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                هر مشتری فقط یک رکورد نیست؛
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  یک فرصت رشد است.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                Loadder اطلاعات مشتری، رفتار، تعامل، منبع جذب و سابقه
                خرید را در یک تصویر واحد جمع می‌کند تا تیم فروش سریع‌تر
                تصمیم بگیرد و هیچ فرصت مهمی از دست نرود.
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
                  پیشنهاد امروز Loadder
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                {businessData.crm.hotLeads.toLocaleString("fa-IR")} مشتری
                بالقوه با امتیاز بالا آماده پیگیری هستند. اولویت امروز
                روی لیدهای داغ و فرصت‌های نزدیک به خرید قرار دارد.
              </p>

              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "فهرست لیدهای داغ در مرحله اتصال CRM واقعی فعال می‌شود."
                  )
                }
                className="mt-5 flex items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-500/[0.08] px-4 py-3 text-sm text-violet-200"
              >
                <Lightning
                  size={16}
                  weight="fill"
                />
                مشاهده اولویت‌ها
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <StatCard
              key={item.title}
              {...item}
            />
          ))}
        </section>

        <section className="mt-8 rounded-[28px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full max-w-xl">
              <MagnifyingGlass
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="جست‌وجوی نام، شرکت یا منبع جذب..."
                className="w-full rounded-2xl border border-white/[0.08] bg-black/20 py-3.5 pr-11 pl-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/30"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                "همه",
                "جدید",
                "در حال پیگیری",
                "آماده خرید",
                "مشتری",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setActiveFilter(
                      item as "همه" | LeadStatus
                    )
                  }
                  className={`rounded-xl border px-4 py-2.5 text-sm transition ${
                    activeFilter === item
                      ? "border-violet-400/25 bg-violet-500/[0.10] text-violet-200"
                      : "border-white/[0.07] bg-white/[0.03] text-white/45"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  مشتریان بالقوه
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اولویت‌بندی بر اساس احتمال خرید
                </p>
              </div>

              <span className="text-xs text-white/35">
                {filteredLeads.length.toLocaleString("fa-IR")} مورد
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {filteredLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onOpen={() =>
                    showNotice(
                      `پروفایل «${lead.name}» در مرحله اتصال CRM واقعی باز می‌شود.`
                    )
                  }
                />
              ))}
            </div>
          </div>

          <aside className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Funnel
                size={23}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  قیف فروش
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  از مشتری بالقوه تا خرید
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              {funnelSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex justify-center"
                >
                  <div
                    className="rounded-2xl border border-violet-400/15 bg-gradient-to-l from-violet-500/20 via-blue-500/10 to-cyan-500/10 px-4 py-3.5"
                    style={{
                      width: step.width,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/30">
                          مرحله {(index + 1).toLocaleString("fa-IR")}
                        </div>

                        <div className="mt-0.5 text-sm font-semibold">
                          {step.title}
                        </div>
                      </div>

                      <div className="text-lg font-bold">
                        {step.value}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold">
              سلامت مشتریان
            </h2>

            <p className="mt-1 text-sm text-white/40">
              وضعیت ارتباط و احتمال خرید یا ریزش
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HealthCard
              title="مشتریان وفادار"
              value={businessData.crm.retentionRate}
              text="خرید مجدد و تعامل بالا"
              icon={Star}
            />

            <HealthCard
              title="مشتریان فعال"
              value={activeCustomerPercent}
              text="تعامل مناسب در دوره فعلی"
              icon={UsersThree}
            />

            <HealthCard
              title="مشتریان در معرض ریزش"
              value={businessData.crm.churnRate}
              text="نیازمند ارتباط مجدد"
              icon={WarningCircle}
              danger
            />

            <HealthCard
              title="کیفیت داده مشتری"
              value={businessData.business.dataQuality}
              text="اطلاعات کامل و قابل اتکا"
              icon={CheckCircle}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  فعالیت‌های اخیر
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  آخرین تعامل‌های مهم
                </p>
              </div>

              <Clock
                size={22}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div className="mt-6 space-y-3">
              {activities.map((activity) => (
                <ActivityRow
                  key={activity.title}
                  {...activity}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Target
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  اولویت‌های امروز
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  کارهایی که بیشترین احتمال اثرگذاری دارند
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <PriorityRow
                title={`تماس با ${businessData.crm.hotLeads.toLocaleString(
                  "fa-IR"
                )} لید داغ`}
                value="اولویت بالا"
              />

              <PriorityRow
                title="پیگیری پیشنهادهای فروش"
                value="امروز"
              />

              <PriorityRow
                title="بازگشت مشتریان غیرفعال"
                value="پیشنهاد AI"
              />

              <PriorityRow
                title="تکمیل اطلاعات مشتریان"
                value={`کیفیت داده ${businessData.business.dataQuality.toLocaleString(
                  "fa-IR"
                )}٪`}
              />
            </div>
          </div>
        </section>

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
                    هوشمندی مشتری Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    شناخت مشتری و پیشنهاد اقدام بعدی
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                Loadder رفتار مشتری، تعاملات، سابقه خرید، منبع جذب و
                نتایج کمپین‌ها را کنار هم قرار می‌دهد تا احتمال خرید،
                ریزش و ارزش هر مشتری را پیش‌بینی کند.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <SmartCard
                  icon={Target}
                  title="امتیاز مشتری"
                  value="احتمال خرید"
                />

                <SmartCard
                  icon={ShoppingCart}
                  title="خرید بعدی"
                  value="پیش‌بینی زمان"
                />

                <SmartCard
                  icon={TrendUp}
                  title="ارزش مشتری"
                  value="ارزش طول عمر"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="flex items-center gap-2">
                <Sparkle
                  size={20}
                  weight="fill"
                  className="text-cyan-300"
                />

                <span className="font-semibold">
                  پیشنهاد بعدی
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <ActionButton
                  text={`نمایش ${businessData.crm.hotLeads.toLocaleString(
                    "fa-IR"
                  )} لید آماده خرید`}
                  onClick={() =>
                    showNotice(
                      "فهرست لیدهای داغ بعداً از داده واقعی CRM ساخته می‌شود."
                    )
                  }
                />

                <ActionButton
                  text="ساخت کمپین بازگشت مشتری"
                  onClick={() =>
                    showNotice(
                      "کمپین بازگشت بعداً به Ads و Automation متصل می‌شود."
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    showNotice(
                      "اجرای هوشمند پس از اتصال Business Brain فعال می‌شود."
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

function StatCard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
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

      <div className="mt-4 text-3xl font-bold">
        {value}
      </div>

      <div className="mt-2 flex items-center gap-1 text-xs text-emerald-300">
        <ArrowUp size={13} />
        {change} نسبت به دوره قبل
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: () => void;
}) {
  const statusStyle =
    lead.status === "آماده خرید"
      ? "border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-300"
      : lead.status === "در حال پیگیری"
        ? "border-blue-400/15 bg-blue-500/[0.07] text-blue-300"
        : lead.status === "مشتری"
          ? "border-violet-400/15 bg-violet-500/[0.07] text-violet-300"
          : "border-white/[0.07] bg-white/[0.03] text-white/45";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-4 rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-right transition hover:border-violet-300/20 hover:bg-white/[0.04] xl:flex-row xl:items-center"
    >
      <div className="flex flex-1 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/10 bg-violet-500/[0.08]">
          <UserCircle
            size={25}
            weight="duotone"
            className="text-violet-300"
          />
        </div>

        <div>
          <div className="font-semibold">
            {lead.name}
          </div>

          <div className="mt-1 text-xs text-white/35">
            {lead.company} • {lead.source}
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <div className="text-xs text-white/30">
            امتیاز
          </div>

          <div className="mt-1 text-sm font-bold text-cyan-300">
            {lead.score.toLocaleString("fa-IR")}
          </div>
        </div>

        <div>
          <div className="text-xs text-white/30">
            ارزش فرصت
          </div>

          <div className="mt-1 text-sm font-semibold">
            {lead.value}
          </div>
        </div>

        <div>
          <div className="text-xs text-white/30">
            آخرین فعالیت
          </div>

          <div className="mt-1 text-sm text-white/55">
            {lead.lastAction}
          </div>
        </div>

        <div className="flex items-end">
          <span
            className={`rounded-full border px-3 py-1.5 text-xs ${statusStyle}`}
          >
            {lead.status}
          </span>
        </div>
      </div>
    </button>
  );
}

function HealthCard({
  title,
  value,
  text,
  icon: Icon,
  danger = false,
}: {
  title: string;
  value: number;
  text: string;
  icon: React.ElementType;
  danger?: boolean;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="rounded-[26px] border border-white/[0.08] bg-[#080d1d]/62 p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-white/40">
            {title}
          </div>

          <div
            className={`mt-4 text-4xl font-bold ${
              danger
                ? "text-amber-300"
                : "text-cyan-300"
            }`}
          >
            {safeValue.toLocaleString("fa-IR")}٪
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
            width: `${safeValue}%`,
          }}
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-white/40">
        {text}
      </p>
    </div>
  );
}

function ActivityRow({
  title,
  description,
  time,
  icon: Icon,
}: {
  title: string;
  description: string;
  time: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/[0.08]">
        <Icon
          size={19}
          weight="duotone"
          className="text-cyan-300"
        />
      </div>

      <div className="flex-1">
        <div className="font-semibold">
          {title}
        </div>

        <p className="mt-1 text-sm text-white/40">
          {description}
        </p>
      </div>

      <span className="text-xs text-white/25">
        {time}
      </span>
    </div>
  );
}

function PriorityRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <span className="text-sm text-white/55">
        {title}
      </span>

      <span className="rounded-full border border-violet-300/10 bg-violet-500/[0.06] px-3 py-1.5 text-xs text-violet-200">
        {value}
      </span>
    </div>
  );
}

function SmartCard({
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

function ActionButton({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60 transition hover:bg-white/[0.06]"
    >
      {text}
    </button>
  );
}