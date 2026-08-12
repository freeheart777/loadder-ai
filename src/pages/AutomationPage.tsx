import { useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Lightning,
  Sparkle,
  Plus,
  UsersThree,
  InstagramLogo,
  ShoppingCart,
  Megaphone,
  ChatCircleText,
  Clock,
  CheckCircle,
  WarningCircle,
  Play,
  Pause,
  ArrowDown,
  Funnel,
  Brain,
  Target,
  Gear,
  CalendarBlank,
} from "@phosphor-icons/react";

type AutomationTemplate = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: "فعال" | "آماده";
};

type WorkflowStep = {
  type: string;
  title: string;
  description: string;
};

const templates: AutomationTemplate[] = [
  {
    id: "lead-followup",
    title: "پیگیری خودکار مشتری بالقوه",
    description:
      "وقتی مشتری بالقوه جدید وارد شد، امتیازدهی و برای پیگیری آماده شود.",
    icon: UsersThree,
    status: "فعال",
  },
  {
    id: "social-lead",
    title: "انتقال مشتری از شبکه اجتماعی",
    description:
      "دایرکت یا تعامل مهم را شناسایی و وارد ارتباط با مشتری کن.",
    icon: InstagramLogo,
    status: "آماده",
  },
  {
    id: "abandoned-cart",
    title: "سبد خرید رهاشده",
    description:
      "اگر خرید کامل نشد، پیام یا پیشنهاد بازگشت برای مشتری آماده شود.",
    icon: ShoppingCart,
    status: "آماده",
  },
  {
    id: "campaign-watch",
    title: "پایش عملکرد کمپین",
    description:
      "اگر عملکرد تبلیغات افت کرد، هشدار و پیشنهاد اصلاح ایجاد شود.",
    icon: Megaphone,
    status: "فعال",
  },
  {
    id: "reengagement",
    title: "بازگشت مشتری غیرفعال",
    description:
      "مشتری غیرفعال را شناسایی و کمپین بازگشت برای او پیشنهاد بده.",
    icon: ChatCircleText,
    status: "آماده",
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    type: "شروع",
    title: "مشتری بالقوه جدید وارد شد",
    description: "منبع: سایت، شبکه اجتماعی یا تبلیغات",
  },
  {
    type: "شرط",
    title: "امتیاز مشتری بیشتر از ۷۰ باشد",
    description: "فقط مشتریان با احتمال خرید بالا",
  },
  {
    type: "اقدام",
    title: "پیام پیگیری ساخته شود",
    description: "بر اساس اطلاعات برند و رفتار مشتری",
  },
  {
    type: "تأیید",
    title: "تأیید مدیر فروش",
    description: "قبل از ارسال نهایی",
  },
];

const stats = [
  {
    title: "اتوماسیون‌های فعال",
    value: "۶",
    icon: Lightning,
  },
  {
    title: "اجرای امروز",
    value: "۱۲۸",
    icon: Play,
  },
  {
    title: "صرفه‌جویی زمانی",
    value: "۳۴ ساعت",
    icon: Clock,
  },
  {
    title: "موفقیت اجرا",
    value: "۹۴٪",
    icon: CheckCircle,
  },
];

export default function AutomationPage() {
  const [activeTemplate, setActiveTemplate] =
    useState("lead-followup");

  const [automationEnabled, setAutomationEnabled] =
    useState(true);

  const [notice, setNotice] = useState("");

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

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/15 bg-gradient-to-br from-violet-500/20 to-amber-500/10">
              <Lightning
                size={25}
                weight="duotone"
                className="text-amber-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                مرکز اتوماسیون
              </h1>

              <p className="mt-1 text-sm text-white/45">
                اتصال هوشمند ابزارها و اجرای جریان‌های کاری
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              showNotice(
                "ساخت جریان کاری سفارشی در مرحله بعد فعال می‌شود."
              )
            }
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(99,102,241,.18)]"
          >
            <Plus size={16} />
            اتوماسیون جدید
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1550px] px-8 py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[25%] h-[320px] w-[320px] rounded-full bg-amber-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_370px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-500/[0.08] px-4 py-2 text-sm text-amber-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                اتوماسیون هوشمند کسب‌وکار
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                وقتی یک اتفاق می‌افتد،
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  Loadder بداند بعدش چه کاری باید انجام دهد.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                اتوماسیون جایی است که ارتباط با مشتری، شبکه اجتماعی،
                تبلیغات، محتوا، تحلیل و در آینده ایجنت‌های هوش مصنوعی
                واقعاً به یکدیگر متصل می‌شوند.
              </p>
            </div>

            <div className="rounded-[26px] border border-violet-300/15 bg-violet-500/[0.06] p-6">
              <div className="flex items-center gap-3">
                <Brain
                  size={22}
                  weight="duotone"
                  className="text-violet-300"
                />

                <h3 className="text-lg font-semibold">
                  مغز اتوماسیون
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                در آینده فقط هدف را می‌نویسی و Loadder خودش
                شروع، شرط و اقدام مناسب را پیشنهاد می‌دهد.
              </p>

              <div className="mt-5 flex items-center gap-2 text-xs text-cyan-300/70">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.8)]" />
                آماده توسعه هوشمند
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <StatCard
              key={item.title}
              {...item}
            />
          ))}
        </section>

        {/* TEMPLATES */}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                اتوماسیون‌های آماده
              </h2>

              <p className="mt-1 text-sm text-white/40">
                یک جریان آماده انتخاب کن یا بعداً جریان مخصوص خودت را بساز.
              </p>
            </div>

            <span className="rounded-full border border-violet-300/10 bg-violet-500/[0.06] px-4 py-2 text-xs text-violet-200/70">
              قالب‌های آماده
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {templates.map((template) => {
              const Icon = template.icon;
              const active =
                activeTemplate === template.id;

              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() =>
                    setActiveTemplate(template.id)
                  }
                  className={`group min-h-[245px] rounded-[26px] border p-5 text-right backdrop-blur-xl transition ${
                    active
                      ? "border-amber-400/30 bg-amber-500/[0.07]"
                      : "border-white/[0.08] bg-[#080d1d]/62 hover:-translate-y-1 hover:border-violet-300/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20">
                      <Icon
                        size={22}
                        weight="duotone"
                        className="text-cyan-300"
                      />
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-xs ${
                        template.status === "فعال"
                          ? "border border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
                          : "border border-white/[0.06] bg-white/[0.04] text-white/40"
                      }`}
                    >
                      {template.status}
                    </span>
                  </div>

                  <h3 className="mt-5 text-[16px] font-semibold">
                    {template.title}
                  </h3>

                  <p className="mt-2 text-sm leading-7 text-white/45">
                    {template.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* WORKFLOW BUILDER */}
        <section className="mt-8 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  سازنده جریان کاری
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  نمونه جریان پیگیری مشتری بالقوه
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAutomationEnabled(
                    (current) => !current
                  )
                }
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition ${
                  automationEnabled
                    ? "border-emerald-400/15 bg-emerald-500/[0.08] text-emerald-300"
                    : "border-white/[0.07] bg-white/[0.03] text-white/45"
                }`}
              >
                {automationEnabled ? (
                  <Pause size={16} />
                ) : (
                  <Play size={16} />
                )}

                {automationEnabled
                  ? "فعال"
                  : "متوقف"}
              </button>
            </div>

            <div className="mt-7">
              {workflowSteps.map(
                (step, index) => (
                  <div
                    key={step.title}
                    className="relative"
                  >
                    <WorkflowNode
                      index={index + 1}
                      type={step.type}
                      title={step.title}
                      description={
                        step.description
                      }
                    />

                    {index <
                      workflowSteps.length - 1 && (
                      <div className="flex h-12 items-center justify-center">
                        <ArrowDown
                          size={22}
                          className="text-violet-300/50"
                        />
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "افزودن مرحله جدید در نسخه بعد فعال می‌شود."
                )
              }
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.02] py-4 text-sm text-white/45 transition hover:bg-white/[0.05]"
            >
              <Plus size={16} />
              افزودن مرحله
            </button>
          </div>

          {/* LOGIC PANEL */}
          <aside className="space-y-5">
            <div className="rounded-[28px] border border-white/[0.08] bg-[#080d1d]/65 p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Funnel
                  size={22}
                  weight="duotone"
                  className="text-violet-300"
                />

                <h2 className="text-xl font-semibold">
                  منطق اتوماسیون
                </h2>
              </div>

              <div className="mt-5 space-y-3">
                <LogicRow
                  title="شروع"
                  value="مشتری جدید"
                />

                <LogicRow
                  title="شرط"
                  value="امتیاز بیشتر از ۷۰"
                />

                <LogicRow
                  title="اقدام"
                  value="ساخت پیام پیگیری"
                />

                <LogicRow
                  title="تأیید"
                  value="لازم است"
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-amber-400/15 bg-amber-500/[0.05] p-6">
              <div className="flex items-center gap-3">
                <WarningCircle
                  size={21}
                  weight="duotone"
                  className="text-amber-300"
                />

                <h3 className="text-lg font-semibold">
                  کنترل انسانی
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                هر اقدام می‌تواند روی یکی از سه حالت «اجرا خودکار»،
                «اجرا با تأیید» یا «فقط پیشنهاد» تنظیم شود.
              </p>
            </div>

            <div className="rounded-[28px] border border-cyan-400/10 bg-cyan-500/[0.04] p-6">
              <div className="flex items-center gap-3">
                <Target
                  size={21}
                  weight="duotone"
                  className="text-cyan-300"
                />

                <h3 className="text-lg font-semibold">
                  نتیجه مورد انتظار
                </h3>
              </div>

              <div className="mt-5 space-y-3">
                <LogicRow
                  title="کاهش زمان پاسخ"
                  value="۳۸٪"
                />

                <LogicRow
                  title="افزایش پیگیری"
                  value="۲۱٪"
                />

                <LogicRow
                  title="کاهش کار دستی"
                  value="۴۶٪"
                />
              </div>
            </div>
          </aside>
        </section>

        {/* AUTOMATION MAP */}
        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                نقشه اتصال ابزارها
              </h2>

              <p className="mt-1 text-sm text-white/40">
                هر اتوماسیون می‌تواند چند بخش Loadder را به هم وصل کند.
              </p>
            </div>

            <Gear
              size={23}
              weight="duotone"
              className="text-violet-300"
            />
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <ConnectionCard
              title="شبکه اجتماعی"
              description="دریافت پیام و تعامل"
              icon={InstagramLogo}
            />

            <ConnectionCard
              title="ارتباط با مشتری"
              description="ثبت و امتیازدهی مشتری"
              icon={UsersThree}
            />

            <ConnectionCard
              title="محتوا"
              description="ساخت پیام مناسب"
              icon={Sparkle}
            />

            <ConnectionCard
              title="تبلیغات"
              description="فعال‌سازی کمپین"
              icon={Megaphone}
            />

            <ConnectionCard
              title="زمان‌بندی"
              description="اجرای خودکار"
              icon={CalendarBlank}
            />
          </div>
        </section>

        {/* AI COPILOT */}
        <section className="mt-8 overflow-hidden rounded-[32px] border border-violet-400/15 bg-gradient-to-l from-violet-500/[0.10] via-[#080d1d]/70 to-cyan-500/[0.05] p-8 backdrop-blur-xl">
          <div className="grid gap-8 xl:grid-cols-[1fr_390px]">
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
                    دستیار اتوماسیون Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    ساخت جریان کاری با توضیح ساده
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                در آینده فقط می‌گویی: «اگر مشتری بالقوه داغ وارد شد
                و تا دو روز خرید نکرد، یک پیام مناسب بساز و برای تأیید
                مدیر فروش بفرست.» Loadder خودش جریان کامل را می‌سازد.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <AIActionCard
                  title="ساخت خودکار جریان"
                  value="با توضیح ساده"
                />

                <AIActionCard
                  title="تشخیص شرط"
                  value="بر اساس داده"
                />

                <AIActionCard
                  title="پیشنهاد اقدام"
                  value="با کنترل انسانی"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "ساخت اتوماسیون با AI در مرحله اتصال Business Brain فعال می‌شود."
                )
              }
              className="flex min-h-[150px] items-center justify-center gap-3 rounded-[26px] border border-violet-300/15 bg-violet-500/[0.07] px-6 text-base font-semibold transition hover:bg-violet-500/[0.12]"
            >
              <Sparkle
                size={22}
                weight="fill"
                className="text-violet-300"
              />

              ساخت اتوماسیون با هوش مصنوعی
            </button>
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
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#080d1d]/62 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/40">
          {title}
        </span>

        <Icon
          size={20}
          weight="duotone"
          className="text-amber-300"
        />
      </div>

      <div className="mt-4 text-3xl font-bold">
        {value}
      </div>

      <div className="mt-4 h-1 rounded-full bg-gradient-to-l from-violet-500 via-blue-500 to-cyan-300" />
    </div>
  );
}

function WorkflowNode({
  index,
  type,
  title,
  description,
}: {
  index: number;
  type: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-[22px] border border-white/[0.08] bg-black/20 p-5 text-right transition hover:border-violet-300/20 hover:bg-white/[0.04]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/10 bg-violet-500/[0.08] text-violet-300">
        {index}
      </div>

      <div className="flex-1">
        <div className="text-xs text-white/35">
          {type}
        </div>

        <h3 className="mt-1 text-base font-semibold">
          {title}
        </h3>

        <p className="mt-1 text-sm text-white/45">
          {description}
        </p>
      </div>
    </button>
  );
}

function LogicRow({
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

function ConnectionCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <Icon
        size={22}
        weight="duotone"
        className="text-cyan-300"
      />

      <h3 className="mt-4 font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-white/40">
        {description}
      </p>
    </div>
  );
}

function AIActionCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="text-sm font-semibold">
        {title}
      </div>

      <div className="mt-2 text-xs text-cyan-300/70">
        {value}
      </div>
    </div>
  );
}