import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Lightning,
  Brain,
  Sparkle,
  ShoppingCart,
  UsersThree,
  Repeat,
  WarningCircle,
  CheckCircle,
  Megaphone,
  Target,
  Clock,
  Play,
  Pause,
  Plus,
  Funnel,
  Storefront,
  CurrencyCircleDollar,
  TrendDown,
  TrendUp,
  ChatCircleText,
  Phone,
  EnvelopeSimple,
} from "@phosphor-icons/react";

import { businessData } from "../data/businessData";

type AutomationStatus = "فعال" | "متوقف" | "پیشنهادی";

type AutomationItem = {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  status: AutomationStatus;
  icon: React.ElementType;
  audience: string;
};

function faNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

function faPercent(value: number) {
  return `${value.toLocaleString("fa-IR")}٪`;
}

const automationItems: AutomationItem[] = [
  {
    id: "abandoned-cart",
    title: "بازیابی سبد خرید رهاشده",
    description:
      "اگر مشتری خرید را کامل نکرد، بعد از ۲ ساعت پیام یادآوری ارسال شود.",
    trigger: `${faNumber(
      businessData.ecommerce.abandonedCarts
    )} سبد رهاشده`,
    action: "پیام یادآوری خرید",
    status: "فعال",
    icon: ShoppingCart,
    audience: "بازدیدکنندگان فروشگاه",
  },
  {
    id: "hot-lead",
    title: "پیگیری لیدهای داغ",
    description:
      "لیدهایی با امتیاز بالا به تیم فروش اختصاص داده شوند و یادآوری پیگیری ساخته شود.",
    trigger: `${faNumber(
      businessData.crm.hotLeads
    )} لید داغ`,
    action: "اختصاص به فروش + یادآوری",
    status: "فعال",
    icon: Target,
    audience: "مشتریان بالقوه",
  },
  {
    id: "purchase-followup",
    title: "پیگیری پس از خرید",
    description:
      "بعد از خرید موفق، پیام تشکر و پیشنهاد خرید بعدی برای مشتری ارسال شود.",
    trigger: `${faNumber(
      businessData.ecommerce.completedPurchases
    )} خرید موفق`,
    action: "تشکر + پیشنهاد بعدی",
    status: "فعال",
    icon: CheckCircle,
    audience: "خریداران آنلاین",
  },
  {
    id: "repeat-buyer",
    title: "پیشنهاد ویژه مشتری تکرارشونده",
    description:
      "مشتریانی که چند بار خرید کرده‌اند پیشنهاد اختصاصی دریافت کنند.",
    trigger: `${faNumber(
      businessData.ecommerce.repeatCustomers
    )} مشتری تکرارشونده`,
    action: "پیشنهاد ویژه",
    status: "فعال",
    icon: Repeat,
    audience: "مشتریان وفادار",
  },
  {
    id: "churn-risk",
    title: "بازگشت مشتری در معرض ریزش",
    description:
      "اگر مشتری برای مدت مشخصی تعامل یا خرید نداشت، کمپین بازگشت فعال شود.",
    trigger: `ریزش ${faPercent(
      businessData.crm.churnRate
    )}`,
    action: "کمپین بازگشت مشتری",
    status: "پیشنهادی",
    icon: WarningCircle,
    audience: "مشتریان غیرفعال",
  },
  {
    id: "high-cac",
    title: "هشدار افزایش هزینه جذب",
    description:
      "اگر هزینه جذب مشتری از حد تعیین‌شده عبور کرد، تیم بازاریابی هشدار دریافت کند.",
    trigger: businessData.marketing.cacLabel,
    action: "هشدار بازاریابی",
    status: "پیشنهادی",
    icon: CurrencyCircleDollar,
    audience: "تیم بازاریابی",
  },
  {
    id: "conversion-drop",
    title: "هشدار افت نرخ تبدیل",
    description:
      "اگر نرخ تبدیل سایت کاهش پیدا کرد، تحلیل و پیشنهاد بهینه‌سازی ساخته شود.",
    trigger: faPercent(
      businessData.website.conversionRate
    ),
    action: "تحلیل + پیشنهاد بهینه‌سازی",
    status: "پیشنهادی",
    icon: TrendDown,
    audience: "تیم رشد",
  },
];

const triggerFlow = [
  {
    number: "۱",
    title: "رویداد",
    description: "اتفاقی در سایت، CRM یا تبلیغات رخ می‌دهد",
  },
  {
    number: "۲",
    title: "شرط",
    description: "Loadder بررسی می‌کند آیا شرایط اجرا برقرار است",
  },
  {
    number: "۳",
    title: "تصمیم",
    description: "قانون یا Business Brain اقدام مناسب را انتخاب می‌کند",
  },
  {
    number: "۴",
    title: "اجرا",
    description: "پیام، هشدار یا وظیفه ایجاد می‌شود",
  },
  {
    number: "۵",
    title: "اندازه‌گیری",
    description: "نتیجه به KPI و Analytics برمی‌گردد",
  },
];

export default function AutomationPage() {
  const [selectedId, setSelectedId] = useState(
    "abandoned-cart"
  );
  const [notice, setNotice] = useState("");

  const selectedAutomation = useMemo(
    () =>
      automationItems.find(
        (item) => item.id === selectedId
      ) ?? automationItems[0],
    [selectedId]
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

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <Lightning
                size={25}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                اتوماسیون هوشمند
              </h1>

              <p className="mt-1 text-sm text-white/45">
                تبدیل رفتار مشتری و فروش به اقدام خودکار
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              showNotice(
                "ساخت اتوماسیون جدید در مرحله اتصال موتور واقعی فعال می‌شود."
              )
            }
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold"
          >
            <Plus size={17} />
            اتوماسیون جدید
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />
          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_380px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-2 text-sm text-cyan-200">
                <Brain size={16} weight="duotone" />
                Automation + CRM + E-commerce
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                وقتی مشتری کاری انجام می‌دهد،
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  Loadder باید بداند قدم بعدی چیست.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                سبد خرید رهاشده، لید داغ، خرید موفق، خرید مجدد، ریزش
                مشتری و تغییر شاخص‌های بازاریابی می‌توانند به Trigger
                تبدیل شوند و اقدام بعدی را خودکار کنند.
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
                  فرصت فوری
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                {faNumber(
                  businessData.ecommerce.abandonedCarts
                )}{" "}
                سبد خرید رهاشده آماده ورود به جریان بازیابی فروش هستند.
              </p>

              <button
                type="button"
                onClick={() =>
                  setSelectedId("abandoned-cart")
                }
                className="mt-5 rounded-xl border border-violet-300/15 bg-violet-500/[0.08] px-4 py-3 text-sm text-violet-200"
              >
                مشاهده جریان پیشنهادی
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="اتوماسیون‌های فعال"
            value={faNumber(
              automationItems.filter(
                (item) => item.status === "فعال"
              ).length
            )}
            icon={Lightning}
          />

          <StatCard
            title="سبدهای قابل بازیابی"
            value={faNumber(
              businessData.ecommerce.abandonedCarts
            )}
            icon={ShoppingCart}
          />

          <StatCard
            title="لیدهای داغ"
            value={faNumber(
              businessData.crm.hotLeads
            )}
            icon={Target}
          />

          <StatCard
            title="خریدهای موفق"
            value={faNumber(
              businessData.ecommerce.completedPurchases
            )}
            icon={Storefront}
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div>
              <h2 className="text-xl font-semibold">
                جریان‌های هوشمند
              </h2>

              <p className="mt-1 text-sm text-white/40">
                سناریوهای پیشنهادی بر اساس داده فعلی کسب‌وکار
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {automationItems.map((item) => (
                <AutomationRow
                  key={item.id}
                  item={item}
                  active={selectedId === item.id}
                  onClick={() =>
                    setSelectedId(item.id)
                  }
                />
              ))}
            </div>
          </div>

          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7">
            <div className="flex items-center gap-3">
              <Funnel
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  جزئیات جریان
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  {selectedAutomation.title}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <FlowDetail
                title="محرک"
                value={selectedAutomation.trigger}
              />

              <FlowDetail
                title="مخاطب"
                value={selectedAutomation.audience}
              />

              <FlowDetail
                title="اقدام"
                value={selectedAutomation.action}
              />

              <FlowDetail
                title="وضعیت"
                value={selectedAutomation.status}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
              <div className="text-xs text-white/35">
                توضیح
              </div>

              <p className="mt-2 text-sm leading-8 text-white/50">
                {selectedAutomation.description}
              </p>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "فعال‌سازی واقعی جریان بعد از اتصال Workflow Engine انجام می‌شود."
                  )
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold"
              >
                <Play size={16} />
                فعال‌سازی
              </button>

              <button
                type="button"
                onClick={() =>
                  showNotice(
                    "توقف جریان بعد از اتصال Workflow Engine فعال می‌شود."
                  )
                }
                className="flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-white/55"
              >
                <Pause size={17} />
              </button>
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                منطق اتوماسیون Loadder
              </h2>

              <p className="mt-1 text-sm text-white/40">
                هر جریان چگونه از داده به اجرا می‌رسد
              </p>
            </div>

            <Brain
              size={24}
              weight="duotone"
              className="text-violet-300"
            />
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {triggerFlow.map((step) => (
              <FlowStep
                key={step.number}
                {...step}
              />
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <ShoppingCart
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  اتوماسیون فروش آنلاین
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  جریان‌های مخصوص رفتار خرید سایت
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <AutomationMetric
                title="سبد رهاشده"
                value={faNumber(
                  businessData.ecommerce.abandonedCarts
                )}
                description="قابل ورود به جریان بازیابی"
              />

              <AutomationMetric
                title="خرید موفق"
                value={faNumber(
                  businessData.ecommerce.completedPurchases
                )}
                description="آماده پیگیری پس از خرید"
              />

              <AutomationMetric
                title="خرید مجدد"
                value={faPercent(
                  businessData.ecommerce.repeatCustomerRate
                )}
                description="فرصت پیشنهاد شخصی"
              />

              <AutomationMetric
                title="نرخ رهاشدن سبد"
                value={faPercent(
                  businessData.ecommerce.abandonedCartRate
                )}
                description="شاخص مهم برای بهینه‌سازی"
              />
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <UsersThree
                size={23}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  اتوماسیون CRM
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  جریان‌های مخصوص مشتری و فروش
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <AutomationMetric
                title="لیدهای داغ"
                value={faNumber(
                  businessData.crm.hotLeads
                )}
                description="نیازمند پیگیری سریع"
              />

              <AutomationMetric
                title="مشتریان فعال"
                value={faNumber(
                  businessData.crm.activeCustomers
                )}
                description="قابل سگمنت‌بندی"
              />

              <AutomationMetric
                title="حفظ مشتری"
                value={faPercent(
                  businessData.crm.retentionRate
                )}
                description="فرصت توسعه وفاداری"
              />

              <AutomationMetric
                title="ریزش مشتری"
                value={faPercent(
                  businessData.crm.churnRate
                )}
                description="نیازمند کمپین بازگشت"
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
                    اتوماسیون پیشنهادی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    سریع‌ترین فرصت اجرایی
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                بیشترین فرصت کوتاه‌مدت در بازیابی سبدهای خرید رهاشده
                و پیگیری لیدهای داغ قرار دارد. این دو جریان مستقیماً
                می‌توانند به افزایش فروش منجر شوند.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <DecisionCard
                  icon={ShoppingCart}
                  title="اولویت ۱"
                  value="بازیابی سبد خرید"
                />

                <DecisionCard
                  icon={Target}
                  title="اولویت ۲"
                  value="پیگیری لید داغ"
                />

                <DecisionCard
                  icon={Repeat}
                  title="اولویت ۳"
                  value="خرید مجدد"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="font-semibold">
                کانال‌های اجرا
              </div>

              <div className="mt-5 space-y-3">
                <ChannelRow
                  icon={ChatCircleText}
                  title="پیام‌رسان"
                  status="آماده اتصال"
                />

                <ChannelRow
                  icon={EnvelopeSimple}
                  title="ایمیل"
                  status="آماده اتصال"
                />

                <ChannelRow
                  icon={Phone}
                  title="تماس فروش"
                  status="آماده اتصال"
                />

                <ChannelRow
                  icon={Megaphone}
                  title="تبلیغات مجدد"
                  status="آماده اتصال"
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

      <div className="mt-4 text-3xl font-bold">
        {value}
      </div>
    </div>
  );
}

function AutomationRow({
  item,
  active,
  onClick,
}: {
  item: AutomationItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  const statusClass =
    item.status === "فعال"
      ? "border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
      : item.status === "متوقف"
        ? "border-red-400/10 bg-red-500/[0.07] text-red-300"
        : "border-amber-400/10 bg-amber-500/[0.07] text-amber-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] border p-5 text-right transition ${
        active
          ? "border-violet-400/30 bg-violet-500/[0.08]"
          : "border-white/[0.07] bg-black/20 hover:border-violet-300/20"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/[0.08]">
          <Icon
            size={21}
            weight="duotone"
            className="text-cyan-300"
          />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">
                {item.title}
              </div>

              <p className="mt-2 text-sm leading-7 text-white/40">
                {item.description}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${statusClass}`}
            >
              {item.status}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function FlowDetail({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="text-xs text-white/35">
        {title}
      </div>

      <div className="mt-1 font-semibold">
        {value}
      </div>
    </div>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/[0.10] text-sm font-bold text-violet-300">
        {number}
      </div>

      <div className="mt-4 font-semibold">
        {title}
      </div>

      <p className="mt-2 text-xs leading-6 text-white/35">
        {description}
      </p>
    </div>
  );
}

function AutomationMetric({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <div className="text-xs text-white/35">
        {title}
      </div>

      <div className="mt-2 text-xl font-bold text-cyan-300">
        {value}
      </div>

      <p className="mt-2 text-xs leading-6 text-white/35">
        {description}
      </p>
    </div>
  );
}

function DecisionCard({
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

function ChannelRow({
  icon: Icon,
  title,
  status,
}: {
  icon: React.ElementType;
  title: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center gap-3">
        <Icon
          size={19}
          weight="duotone"
          className="text-violet-300"
        />

        <span className="text-sm">
          {title}
        </span>
      </div>

      <span className="text-xs text-cyan-300/70">
        {status}
      </span>
    </div>
  );
}