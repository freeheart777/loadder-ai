import { useEffect, useMemo, useState } from "react";
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
  Play,
  Pause,
  Plus,
  Funnel,
  Storefront,
  CurrencyCircleDollar,
  TrendDown,
  ChatCircleText,
  Phone,
  EnvelopeSimple,
  Database,
  ClockCounterClockwise,
  Trash,
  X,
  CaretDown,
} from "@phosphor-icons/react";

import { businessData } from "../data/businessData";
import { withDemo } from "../lib/demoMode";
import { apiFetch } from "../lib/api";
import { demoBusiness } from "../data/demoBusiness";

type AutomationStatus = "فعال" | "متوقف";

type BackendCondition = {
  field: string;
  operator: string;
  value: string | number;
};

type BackendAction = {
  type: string;
  channel?: string;
  template?: string;
  assignee?: string;
};

type BackendAutomation = {
  id: string;
  title: string;
  trigger: string;
  enabled: boolean;
  delayMinutes: number;
  conditions: BackendCondition[];
  actions: BackendAction[];
};

type ExecutionItem = {
  id: string;
  timestamp: string;
  eventType: string;
  actionType: string;
  channel: string | null;
  template: string | null;
  status: string;
};

type AutomationResponse = {
  ok: boolean;
  count: number;
  data: BackendAutomation[];
};

type ExecutionResponse = {
  ok: boolean;
  count: number;
  data: ExecutionItem[];
};

type TriggerOption = {
  value: string;
  title: string;
};

type ActionOption = {
  value: string;
  title: string;
};

const triggerOptions: TriggerOption[] = [
  {
    value: "cart.abandoned",
    title: "سبد خرید رها شد",
  },
  {
    value: "checkout.started",
    title: "پرداخت شروع شد",
  },
  {
    value: "order.completed",
    title: "خرید با موفقیت انجام شد",
  },
  {
    value: "customer.repeat_purchase",
    title: "مشتری دوباره خرید کرد",
  },
  {
    value: "lead.hot",
    title: "لید داغ شناسایی شد",
  },
  {
    value: "customer.churn_risk",
    title: "ریسک ریزش مشتری بالا رفت",
  },
  {
    value: "marketing.cac_high",
    title: "هزینه جذب مشتری بالا رفت",
  },
  {
    value: "website.conversion_drop",
    title: "نرخ تبدیل سایت افت کرد",
  },
];

const actionOptions: ActionOption[] = [
  {
    value: "send_message",
    title: "پیام ارسال کن",
  },
  {
    value: "create_task",
    title: "برای تیم فروش وظیفه بساز",
  },
  {
    value: "send_offer",
    title: "پیشنهاد ویژه ارسال کن",
  },
  {
    value: "create_campaign",
    title: "کمپین بازگشت بساز",
  },
  {
    value: "create_alert",
    title: "هشدار داخل داشبورد بساز",
  },
];

function faNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

function faPercent(value: number) {
  return `${value.toLocaleString("fa-IR")}٪`;
}

function triggerToFa(trigger: string) {
  return (
    triggerOptions.find((item) => item.value === trigger)?.title ??
    trigger
  );
}

function actionToFa(action: BackendAction) {
  const found = actionOptions.find(
    (item) => item.value === action.type
  );

  if (action.type === "send_message") {
    const channel =
      action.channel === "sms"
        ? "پیامک"
        : action.channel === "email"
          ? "ایمیل"
          : action.channel ?? "";

    return `${found?.title ?? "ارسال پیام"} ${
      channel ? `از طریق ${channel}` : ""
    }`;
  }

  if (action.type === "create_task") {
    return "برای تیم فروش وظیفه بساز";
  }

  return found?.title ?? action.type;
}

function getAutomationIcon(trigger: string) {
  switch (trigger) {
    case "cart.abandoned":
      return ShoppingCart;

    case "lead.hot":
      return Target;

    case "order.completed":
      return CheckCircle;

    case "customer.repeat_purchase":
      return Repeat;

    case "customer.churn_risk":
      return WarningCircle;

    case "marketing.cac_high":
      return CurrencyCircleDollar;

    case "website.conversion_drop":
      return TrendDown;

    default:
      return Lightning;
  }
}

function getStatus(item: BackendAutomation): AutomationStatus {
  return item.enabled ? "فعال" : "متوقف";
}

function getAudience(trigger: string) {
  switch (trigger) {
    case "cart.abandoned":
      return "بازدیدکنندگان فروشگاه";

    case "checkout.started":
      return "کاربران در حال پرداخت";

    case "lead.hot":
      return "مشتریان بالقوه";

    case "order.completed":
      return "خریداران آنلاین";

    case "customer.repeat_purchase":
      return "مشتریان وفادار";

    case "customer.churn_risk":
      return "مشتریان در معرض ریزش";

    case "marketing.cac_high":
      return "تیم بازاریابی";

    case "website.conversion_drop":
      return "تیم رشد";

    default:
      return "کسب‌وکار";
  }
}

function getSuggestedPayload(trigger: string) {
  switch (trigger) {
    case "cart.abandoned":
      return {
        customerId: "customer-101",
        cartValue: 4500000,
      };

    case "checkout.started":
      return {
        customerId: "customer-101",
        checkoutValue: 4500000,
      };

    case "lead.hot":
      return {
        leadId: "lead-101",
        score: 92,
      };

    case "order.completed":
      return {
        orderId: "order-101",
        customerId: "customer-101",
        amount: 3200000,
      };

    case "customer.repeat_purchase":
      return {
        customerId: "customer-101",
        orderCount: 4,
      };

    case "customer.churn_risk":
      return {
        customerId: "customer-101",
        riskScore: 82,
      };

    case "marketing.cac_high":
      return {
        cac: 550000,
      };

    case "website.conversion_drop":
      return {
        conversionRate: 4.9,
      };

    default:
      return {};
  }
}

export default function AutomationPage() {
  const isDemo =
    new URLSearchParams(window.location.search).get("demo") === "1";

  const demoAutomation =
    isDemo ? demoBusiness.demoAutomation : null;

  const [automations, setAutomations] =
    useState<BackendAutomation[]>([]);

  const [executions, setExecutions] =
    useState<ExecutionItem[]>([]);

  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  const [runningId, setRunningId] =
    useState<string | null>(null);

  const [backendOnline, setBackendOnline] =
    useState(false);

  const [notice, setNotice] = useState("");

  const [builderOpen, setBuilderOpen] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [builderTitle, setBuilderTitle] =
    useState("بازیابی فروش");

  const [builderTrigger, setBuilderTrigger] =
    useState("cart.abandoned");

  const [builderDelay, setBuilderDelay] =
    useState("120");

  const [builderAction, setBuilderAction] =
    useState("send_message");

  const [builderChannel, setBuilderChannel] =
    useState("sms");

  const [builderConditionEnabled, setBuilderConditionEnabled] =
    useState(true);

  const [builderConditionField, setBuilderConditionField] =
    useState("cartValue");

  const [builderConditionOperator, setBuilderConditionOperator] =
    useState("gte");

  const [builderConditionValue, setBuilderConditionValue] =
    useState("2000000");

  const selectedAutomation = useMemo(() => {
    return (
      automations.find((item) => item.id === selectedId) ??
      automations[0] ??
      null
    );
  }, [automations, selectedId]);

  const activeCount = automations.filter(
    (item) => item.enabled
  ).length;

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2500);
  };

  async function loadAutomations() {
    try {
      const response = await apiFetch("/api/automations");

      if (!response.ok) {
        throw new Error(
          "خطا در دریافت اتوماسیون‌ها"
        );
      }

      const result: AutomationResponse =
        await response.json();

      setAutomations(result.data);

      if (!selectedId && result.data.length > 0) {
        setSelectedId(result.data[0].id);
      }

      setBackendOnline(true);
    } catch (error) {
      console.error(error);

      setBackendOnline(false);

      showNotice(
        "اتصال به Backend برقرار نشد. مطمئن شو سرور روی پورت 3001 فعال است."
      );
    }
  }

  async function loadExecutions() {
    try {
      const response = await apiFetch("/api/executions");

      if (!response.ok) {
        throw new Error(
          "خطا در دریافت اجراها"
        );
      }

      const result: ExecutionResponse =
        await response.json();

      setExecutions(result.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    async function loadPage() {
      setLoading(true);

      await Promise.all([
        loadAutomations(),
        loadExecutions(),
      ]);

      setLoading(false);
    }

    loadPage();
  }, []);

  async function runAutomation(
    item: BackendAutomation
  ) {
    try {
      setRunningId(item.id);

      const response = await apiFetch(
        `/api/automations/${item.id}/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload: getSuggestedPayload(
              item.trigger
            ),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ??
            "اجرای Workflow ناموفق بود"
        );
      }

      showNotice(
        `جریان «${item.title}» با موفقیت اجرا شد.`
      );

      await loadExecutions();
    } catch (error) {
      console.error(error);

      showNotice(
        "اجرای Workflow ناموفق بود."
      );
    } finally {
      setRunningId(null);
    }
  }

  async function toggleAutomation(
    item: BackendAutomation
  ) {
    try {
      const response = await apiFetch(
        `/api/automations/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: !item.enabled,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ??
            "تغییر وضعیت ناموفق بود"
        );
      }

      setAutomations((current) =>
        current.map((automation) =>
          automation.id === item.id
            ? result.data
            : automation
        )
      );

      showNotice(
        result.data.enabled
          ? `«${item.title}» فعال شد.`
          : `«${item.title}» متوقف شد.`
      );
    } catch (error) {
      console.error(error);

      showNotice(
        "تغییر وضعیت Workflow انجام نشد."
      );
    }
  }

  async function deleteAutomation(
    item: BackendAutomation
  ) {
    const confirmed = window.confirm(
      `Workflow «${item.title}» حذف شود؟`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(
        `/api/automations/${item.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "حذف ناموفق بود"
        );
      }

      await loadAutomations();

      showNotice(
        `Workflow «${item.title}» حذف شد.`
      );
    } catch (error) {
      console.error(error);

      showNotice(
        "حذف Workflow انجام نشد."
      );
    }
  }

  async function createAutomation() {
    if (!builderTitle.trim()) {
      showNotice(
        "برای Workflow یک نام وارد کن."
      );

      return;
    }

    try {
      setCreating(true);

      const conditions: BackendCondition[] =
        builderConditionEnabled
          ? [
              {
                field:
                  builderConditionField.trim(),
                operator:
                  builderConditionOperator,
                value:
                  Number(
                    builderConditionValue
                  ) ||
                  builderConditionValue,
              },
            ]
          : [];

      const action: BackendAction = {
        type: builderAction,
      };

      if (
        builderAction === "send_message" ||
        builderAction === "send_offer"
      ) {
        action.channel = builderChannel;

        action.template =
          builderAction === "send_message"
            ? "custom_message"
            : "custom_offer";
      }

      if (builderAction === "create_task") {
        action.assignee = "sales";
        action.template =
          "custom_sales_task";
      }

      if (
        builderAction === "create_campaign"
      ) {
        action.channel = "crm";
        action.template =
          "custom_campaign";
      }

      if (
        builderAction === "create_alert"
      ) {
        action.channel = "dashboard";
        action.template =
          "custom_alert";
      }

      const response = await apiFetch(
        "/api/automations",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: builderTitle.trim(),
            trigger: builderTrigger,
            enabled: true,
            delayMinutes:
              Number(builderDelay) || 0,
            conditions,
            actions: [action],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ??
            "ساخت Workflow ناموفق بود"
        );
      }

      await loadAutomations();

      setSelectedId(result.data.id);
      setBuilderOpen(false);

      showNotice(
        `Workflow «${result.data.title}» ساخته شد.`
      );
    } catch (error) {
      console.error(error);

      showNotice(
        "ساخت Workflow انجام نشد."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="loadder-dashboard-bg min-h-screen text-white"
    >
      {isDemo && demoAutomation && (
        <section className="mx-auto max-w-[1500px] px-8 pt-6">
          <div className="rounded-[28px] border border-amber-300/15 bg-amber-500/[0.04] p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-amber-200">
                  اتوماسیون — نسخه دمو
                </div>

                <h2 className="mt-1 text-xl font-semibold">
                  {demoBusiness.name}
                </h2>
              </div>

              <div className="grid grid-cols-4 gap-5 text-left">
                <div>
                  <div className="text-xl font-bold">
                    {demoAutomation.active}
                  </div>
                  <div className="text-xs text-white/35">
                    فعال
                  </div>
                </div>

                <div>
                  <div className="text-xl font-bold">
                    {demoAutomation.executionsToday}
                  </div>
                  <div className="text-xs text-white/35">
                    اجرای امروز
                  </div>
                </div>

                <div>
                  <div className="text-xl font-bold">
                    {demoAutomation.savedHours}
                  </div>
                  <div className="text-xs text-white/35">
                    ساعت ذخیره‌شده
                  </div>
                </div>

                <div>
                  <div className="text-xl font-bold text-emerald-300">
                    {demoAutomation.successRate}٪
                  </div>
                  <div className="text-xs text-white/35">
                    موفقیت
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {demoAutomation.workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {workflow.title}
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        workflow.status === "فعال"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-white/[0.05] text-white/45"
                      }`}
                    >
                      {workflow.status}
                    </span>
                  </div>

                  <div className="mt-4 text-xs text-white/35">
                    Trigger
                  </div>

                  <div className="mt-1 text-sm text-white/55">
                    {workflow.trigger}
                  </div>

                  <div className="mt-4 text-xs text-white/35">
                    Action
                  </div>

                  <div className="mt-1 text-sm leading-7 text-white/55">
                    {workflow.action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              to={withDemo("/dashboard")}
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
                Workflowهای واقعی + سازنده بدون کدنویسی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs ${
                backendOnline
                  ? "border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-300"
                  : "border-red-400/15 bg-red-500/[0.07] text-red-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backendOnline
                    ? "bg-emerald-300"
                    : "bg-red-300"
                }`}
              />

              {backendOnline
                ? "Backend متصل"
                : "Backend قطع"}
            </div>

            <button
              type="button"
              onClick={() =>
                setBuilderOpen(true)
              }
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold"
            >
              <Plus size={17} />
              ساخت اتوماسیون
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_380px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-2 text-sm text-cyan-200">
                <Brain
                  size={16}
                  weight="duotone"
                />
                Workflow Builder فارسی
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                قانون کسب‌وکارت را با زبان ساده بساز،
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  Backend آن را اجرا می‌کند.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                Trigger، شرط، زمان انتظار و اقدام را انتخاب کن.
                Workflow ساخته‌شده مستقیماً داخل Backend ثبت می‌شود و
                بعداً می‌تواند به پیامک، ایمیل، CRM و تبلیغات واقعی
                متصل شود.
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
                  مثال
                </h3>
              </div>

              <div className="mt-5 space-y-3 text-sm text-white/55">
                <BuilderSentence
                  label="اگر"
                  value="سبد خرید رها شد"
                />

                <BuilderSentence
                  label="و"
                  value="ارزش سبد بیشتر از ۲ میلیون بود"
                />

                <BuilderSentence
                  label="بعد"
                  value="۲ ساعت صبر کن"
                />

                <BuilderSentence
                  label="سپس"
                  value="پیامک یادآوری بفرست"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="اتوماسیون‌های فعال"
            value={faNumber(activeCount)}
            icon={Lightning}
          />

          <StatCard
            title="Workflowهای ثبت‌شده"
            value={faNumber(
              automations.length
            )}
            icon={Database}
          />

          <StatCard
            title="اجرای Backend"
            value={faNumber(
              executions.length
            )}
            icon={ClockCounterClockwise}
          />

          <StatCard
            title="سبدهای قابل بازیابی"
            value={faNumber(
              businessData.ecommerce
                .abandonedCarts
            )}
            icon={ShoppingCart}
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Workflowهای Backend
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اتوماسیون‌های واقعی ثبت‌شده
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  loadAutomations();
                  loadExecutions();
                }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-white/55"
              >
                بروزرسانی
              </button>
            </div>

            {loading ? (
              <div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/20 p-8 text-center text-sm text-white/40">
                در حال دریافت Workflowها...
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {automations.map((item) => (
                  <AutomationRow
                    key={item.id}
                    item={item}
                    active={
                      selectedId === item.id
                    }
                    running={
                      runningId === item.id
                    }
                    onSelect={() =>
                      setSelectedId(item.id)
                    }
                    onRun={() =>
                      runAutomation(item)
                    }
                    onToggle={() =>
                      toggleAutomation(item)
                    }
                    onDelete={() =>
                      deleteAutomation(item)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7">
            {selectedAutomation ? (
              <>
                <div className="flex items-center gap-3">
                  <Funnel
                    size={23}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <div>
                    <h2 className="text-xl font-semibold">
                      جزئیات Workflow
                    </h2>

                    <p className="mt-1 text-sm text-white/40">
                      {selectedAutomation.title}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <FlowDetail
                    title="اگر"
                    value={triggerToFa(
                      selectedAutomation.trigger
                    )}
                  />

                  <FlowDetail
                    title="مخاطب"
                    value={getAudience(
                      selectedAutomation.trigger
                    )}
                  />

                  <FlowDetail
                    title="زمان انتظار"
                    value={
                      selectedAutomation.delayMinutes ===
                      0
                        ? "بدون انتظار"
                        : `${faNumber(
                            selectedAutomation.delayMinutes
                          )} دقیقه`
                    }
                  />

                  <FlowDetail
                    title="وضعیت"
                    value={
                      selectedAutomation.enabled
                        ? "فعال"
                        : "متوقف"
                    }
                  />
                </div>

                {selectedAutomation.conditions.length >
                  0 && (
                  <div className="mt-6">
                    <div className="text-sm font-semibold">
                      شرط‌ها
                    </div>

                    <div className="mt-3 space-y-2">
                      {selectedAutomation.conditions.map(
                        (condition, index) => (
                          <div
                            key={`${condition.field}-${index}`}
                            className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-white/55"
                          >
                            {condition.field}{" "}
                            {condition.operator}{" "}
                            {String(
                              condition.value
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <div className="text-sm font-semibold">
                    اقدام‌ها
                  </div>

                  <div className="mt-3 space-y-2">
                    {selectedAutomation.actions.map(
                      (action, index) => (
                        <div
                          key={`${action.type}-${index}`}
                          className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-white/55"
                        >
                          {actionToFa(action)}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    runningId ===
                    selectedAutomation.id
                  }
                  onClick={() =>
                    runAutomation(
                      selectedAutomation
                    )
                  }
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <Play size={16} />
                  اجرای آزمایشی Workflow
                </button>
              </>
            ) : (
              <div className="flex min-h-[300px] items-center justify-center text-sm text-white/35">
                یک Workflow انتخاب کن.
              </div>
            )}
          </aside>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  تاریخچه اجرای Backend
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  آخرین Actionهای ثبت‌شده
                </p>
              </div>

              <ClockCounterClockwise
                size={23}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div className="mt-6 space-y-3">
              {executions.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-6 text-center text-sm text-white/35">
                  هنوز Workflowی اجرا نشده است.
                </div>
              ) : (
                executions
                  .slice(0, 8)
                  .map((item) => (
                    <ExecutionRow
                      key={item.id}
                      item={item}
                    />
                  ))
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <Storefront
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  Triggerهای مهم کسب‌وکار
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اتفاق‌هایی که می‌توانند Workflow بسازند
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <TriggerCard
                icon={ShoppingCart}
                title="سبد خرید رهاشده"
                value={`${faNumber(
                  businessData.ecommerce
                    .abandonedCarts
                )} مورد`}
              />

              <TriggerCard
                icon={Target}
                title="لید داغ"
                value={`${faNumber(
                  businessData.crm.hotLeads
                )} مورد`}
              />

              <TriggerCard
                icon={Repeat}
                title="خرید مجدد"
                value={faPercent(
                  businessData.ecommerce
                    .repeatCustomerRate
                )}
              />

              <TriggerCard
                icon={WarningCircle}
                title="ریزش مشتری"
                value={faPercent(
                  businessData.crm.churnRate
                )}
              />
            </div>
          </div>
        </section>
      </div>

      {builderOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-violet-400/20 bg-[#080d1d] p-7 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Lightning
                    size={23}
                    weight="duotone"
                    className="text-cyan-300"
                  />

                  <h2 className="text-2xl font-bold">
                    ساخت اتوماسیون
                  </h2>
                </div>

                <p className="mt-2 text-sm text-white/40">
                  قانون کسب‌وکارت را بدون کدنویسی بساز.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setBuilderOpen(false)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-7 space-y-5">
              <BuilderField
                label="نام اتوماسیون"
              >
                <input
                  value={builderTitle}
                  onChange={(event) =>
                    setBuilderTitle(
                      event.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-white outline-none"
                />
              </BuilderField>

              <BuilderField label="اگر این اتفاق افتاد">
                <SelectField
                  value={builderTrigger}
                  onChange={
                    setBuilderTrigger
                  }
                  options={triggerOptions}
                />
              </BuilderField>

              <div className="rounded-[24px] border border-white/[0.07] bg-black/20 p-5">
                <label className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      شرط اضافه شود
                    </div>

                    <div className="mt-1 text-xs text-white/35">
                      فقط وقتی شرط برقرار بود Workflow اجرا شود.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={
                      builderConditionEnabled
                    }
                    onChange={(event) =>
                      setBuilderConditionEnabled(
                        event.target.checked
                      )
                    }
                    className="h-5 w-5"
                  />
                </label>

                {builderConditionEnabled && (
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <input
                      value={
                        builderConditionField
                      }
                      onChange={(event) =>
                        setBuilderConditionField(
                          event.target.value
                        )
                      }
                      placeholder="مثلاً cartValue"
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm outline-none"
                    />

                    <select
                      value={
                        builderConditionOperator
                      }
                      onChange={(event) =>
                        setBuilderConditionOperator(
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-white/[0.08] bg-[#0b1020] px-4 py-3 text-sm"
                    >
                      <option value="gte">
                        بیشتر یا مساوی
                      </option>

                      <option value="gt">
                        بیشتر از
                      </option>

                      <option value="lte">
                        کمتر یا مساوی
                      </option>

                      <option value="lt">
                        کمتر از
                      </option>

                      <option value="eq">
                        برابر
                      </option>
                    </select>

                    <input
                      value={
                        builderConditionValue
                      }
                      onChange={(event) =>
                        setBuilderConditionValue(
                          event.target.value
                        )
                      }
                      placeholder="مقدار"
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm outline-none"
                    />
                  </div>
                )}
              </div>

              <BuilderField label="چقدر صبر کند؟">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={builderDelay}
                    onChange={(event) =>
                      setBuilderDelay(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 pl-20 outline-none"
                  />

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
                    دقیقه
                  </span>
                </div>
              </BuilderField>

              <BuilderField label="بعد چه کاری انجام دهد؟">
                <SelectField
                  value={builderAction}
                  onChange={
                    setBuilderAction
                  }
                  options={actionOptions}
                />
              </BuilderField>

              {(builderAction ===
                "send_message" ||
                builderAction ===
                  "send_offer") && (
                <BuilderField label="کانال اجرا">
                  <select
                    value={builderChannel}
                    onChange={(event) =>
                      setBuilderChannel(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-white/[0.08] bg-[#0b1020] px-4 py-3"
                  >
                    <option value="sms">
                      پیامک
                    </option>

                    <option value="email">
                      ایمیل
                    </option>
                  </select>
                </BuilderField>
              )}

              <div className="rounded-[24px] border border-cyan-400/10 bg-cyan-500/[0.04] p-5">
                <div className="text-xs text-cyan-300">
                  پیش‌نمایش قانون
                </div>

                <div className="mt-4 space-y-3">
                  <BuilderSentence
                    label="اگر"
                    value={triggerToFa(
                      builderTrigger
                    )}
                  />

                  {builderConditionEnabled && (
                    <BuilderSentence
                      label="و"
                      value={`${builderConditionField} ${builderConditionOperator} ${builderConditionValue}`}
                    />
                  )}

                  <BuilderSentence
                    label="بعد"
                    value={
                      Number(builderDelay) >
                      0
                        ? `${Number(
                            builderDelay
                          ).toLocaleString(
                            "fa-IR"
                          )} دقیقه صبر کن`
                        : "بدون انتظار اجرا کن"
                    }
                  />

                  <BuilderSentence
                    label="سپس"
                    value={
                      actionOptions.find(
                        (item) =>
                          item.value ===
                          builderAction
                      )?.title ??
                      builderAction
                    }
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={creating}
                onClick={createAutomation}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-4 font-semibold disabled:opacity-50"
              >
                <Plus size={18} />

                {creating
                  ? "در حال ساخت..."
                  : "ساخت Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-7 left-7 z-[300] max-w-md rounded-2xl border border-violet-300/20 bg-[#090e1e]/95 px-5 py-4 text-sm shadow-2xl backdrop-blur-xl">
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
  running,
  onSelect,
  onRun,
  onToggle,
  onDelete,
}: {
  item: BackendAutomation;
  active: boolean;
  running: boolean;
  onSelect: () => void;
  onRun: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const Icon = getAutomationIcon(
    item.trigger
  );

  return (
    <div
      className={`rounded-[22px] border p-5 transition ${
        active
          ? "border-violet-400/30 bg-violet-500/[0.08]"
          : "border-white/[0.07] bg-black/20"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-right"
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {item.title}
                </div>

                <div className="mt-1 text-xs text-white/35">
                  {triggerToFa(
                    item.trigger
                  )}
                </div>
              </div>

              <span
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  item.enabled
                    ? "border-emerald-400/10 bg-emerald-500/[0.07] text-emerald-300"
                    : "border-red-400/10 bg-red-500/[0.07] text-red-300"
                }`}
              >
                {getStatus(item)}
              </span>
            </div>
          </div>
        </div>
      </button>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={running}
          onClick={onRun}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-500/[0.07] px-3 py-2.5 text-xs text-cyan-200 disabled:opacity-40"
        >
          <Play size={14} />
          اجرا
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs text-white/50"
        >
          {item.enabled ? (
            <>
              <Pause size={14} />
              توقف
            </>
          ) : (
            <>
              <Play size={14} />
              فعال
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center rounded-xl border border-red-400/10 bg-red-500/[0.04] px-3 py-2.5 text-red-300/70"
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
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

function ExecutionRow({
  item,
}: {
  item: ExecutionItem;
}) {
  const time =
    new Date(
      item.timestamp
    ).toLocaleString("fa-IR");

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold">
            {triggerToFa(
              item.eventType
            )}
          </div>

          <div className="mt-1 text-xs text-white/35">
            {item.actionType} •{" "}
            {item.channel ?? "داخلی"}
          </div>
        </div>

        <span className="rounded-full border border-cyan-400/10 bg-cyan-500/[0.06] px-3 py-1 text-xs text-cyan-300">
          {item.status === "simulated"
            ? "آزمایشی"
            : item.status}
        </span>
      </div>

      <div className="mt-3 text-xs text-white/25">
        {time}
      </div>
    </div>
  );
}

function TriggerCard({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-black/20 p-4">
      <Icon
        size={20}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-3 text-xs text-white/35">
        {title}
      </div>

      <div className="mt-1 font-semibold">
        {value}
      </div>
    </div>
  );
}

function BuilderSentence({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <span className="rounded-lg bg-violet-500/[0.10] px-3 py-1.5 text-xs text-violet-300">
        {label}
      </span>

      <span className="text-sm text-white/60">
        {value}
      </span>
    </div>
  );
}

function BuilderField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">
        {label}
      </div>

      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    title: string;
  }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full appearance-none rounded-2xl border border-white/[0.08] bg-[#0b1020] px-4 py-3 pl-12 outline-none"
      >
        {options.map((item) => (
          <option
            key={item.value}
            value={item.value}
          >
            {item.title}
          </option>
        ))}
      </select>

      <CaretDown
        size={17}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
      />
    </div>
  );
}
