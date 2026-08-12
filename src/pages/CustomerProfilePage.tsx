import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  ArrowRight,
  UserCircle,
  Phone,
  EnvelopeSimple,
  Buildings,
  Globe,
  ShoppingCart,
  Receipt,
  CurrencyCircleDollar,
  TrendUp,
  WarningCircle,
  CheckCircle,
  ClockCounterClockwise,
  Lightning,
  Brain,
  PaperPlaneTilt,
  X,
} from "@phosphor-icons/react";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  status: string;
  totalSpent: number;
  ordersCount: number;
  lastPurchaseAt: string | null;
  lifetimeValue: number;
  riskScore: number;
  createdAt: string;
  updatedAt: string;
};

type CustomerSummary = {
  ordersCount: number;
  completedOrders: number;
  totalRevenue: number;
  abandonedCarts: number;
  activeCarts: number;
  lifetimeValue: number;
  riskScore: number;
  workflowExecutions: number;
};

type Order = {
  id: string;
  customerId: string;
  totalAmount: number;
  status: string;
  source: string | null;
  paymentStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

type Cart = {
  id: string;
  customerId: string | null;
  totalAmount: number;
  status: string;
  abandonedAt: string | null;
  recoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerEvent = {
  id: string;
  customerId: string | null;
  type: string;
  metadata: Record<
    string,
    unknown
  >;
  createdAt: string;
};

type WorkflowExecution = {
  id: string;
  timestamp: string;

  eventId:
    | string
    | null;

  eventType: string;

  workflowId:
    | string
    | null;

  workflowTitle:
    | string
    | null;

  actionType: string;

  channel:
    | string
    | null;

  template:
    | string
    | null;

  recipient:
    | string
    | null;

  status: string;

  result: Record<
    string,
    unknown
  >;
};

type Customer360Data = {
  customer: Customer;

  summary:
    CustomerSummary;

  orders:
    Order[];

  carts:
    Cart[];

  events:
    CustomerEvent[];

  executions:
    WorkflowExecution[];
};

type Customer360Response = {
  ok: boolean;
  data: Customer360Data;
};

type TimelineItem = {
  id: string;

  type:
    | "order"
    | "cart"
    | "event";

  title: string;
  description: string;
  date: string;
};

const API_BASE =
  "http://localhost:3001";

function faNumber(
  value: number
) {
  return value.toLocaleString(
    "fa-IR"
  );
}

function faMoney(
  value: number
) {
  if (
    value >=
    1_000_000_000
  ) {
    return `${(
      value /
      1_000_000_000
    ).toLocaleString(
      "fa-IR",
      {
        maximumFractionDigits:
          1,
      }
    )} میلیارد تومان`;
  }

  if (
    value >=
    1_000_000
  ) {
    return `${(
      value /
      1_000_000
    ).toLocaleString(
      "fa-IR",
      {
        maximumFractionDigits:
          1,
      }
    )} میلیون تومان`;
  }

  if (
    value >= 1_000
  ) {
    return `${(
      value / 1_000
    ).toLocaleString(
      "fa-IR",
      {
        maximumFractionDigits:
          0,
      }
    )} هزار تومان`;
  }

  return `${faNumber(
    value
  )} تومان`;
}

function faDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString(
    "fa-IR"
  );
}

function sourceToFa(
  source: string | null
) {
  const map: Record<
    string,
    string
  > = {
    website:
      "وب‌سایت",

    referral:
      "معرفی مشتری",

    google_ads:
      "تبلیغات گوگل",

    instagram:
      "اینستاگرام",
  };

  if (!source) {
    return "نامشخص";
  }

  return (
    map[source] ??
    source
  );
}

function eventToFa(
  type: string
) {
  const map: Record<
    string,
    string
  > = {
    "cart.abandoned":
      "سبد خرید رها شد",

    "order.completed":
      "خرید با موفقیت انجام شد",

    "customer.repeat_purchase":
      "خرید مجدد ثبت شد",

    "customer.churn_risk":
      "ریسک ریزش افزایش یافت",

    "lead.hot":
      "لید داغ شناسایی شد",

    "customer.direct_message":
      "پیام مستقیم ارسال شد",
  };

  return (
    map[type] ??
    type
  );
}

function eventDescription(
  event: CustomerEvent
) {
  if (
    event.type ===
    "cart.abandoned"
  ) {
    const value =
      typeof event
        .metadata
        .cartValue ===
      "number"
        ? event
            .metadata
            .cartValue
        : typeof event
              .metadata
              .amount ===
            "number"
          ? event
              .metadata
              .amount
          : null;

    return value
      ? `ارزش سبد: ${faMoney(
          value
        )}`
      : "سبد خرید رهاشده ثبت شد";
  }

  if (
    event.type ===
    "order.completed"
  ) {
    const value =
      typeof event
        .metadata
        .amount ===
      "number"
        ? event
            .metadata
            .amount
        : null;

    return value
      ? `مبلغ خرید: ${faMoney(
          value
        )}`
      : "خرید با موفقیت ثبت شد";
  }

  if (
    event.type ===
    "customer.direct_message"
  ) {
    const channel =
      typeof event
        .metadata
        .channel ===
      "string"
        ? event
            .metadata
            .channel
        : null;

    return channel ===
      "email"
      ? "ایمیل مستقیم از CRM ارسال شد"
      : "پیامک مستقیم از CRM ارسال شد";
  }

  return "رویداد مشتری در CRM ثبت شد";
}

export default function CustomerProfilePage() {
  const { id } =
    useParams();

  const [
    data,
    setData,
  ] =
    useState<Customer360Data | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    backendOnline,
    setBackendOnline,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    messageModalOpen,
    setMessageModalOpen,
  ] =
    useState(false);

  const [
    messageChannel,
    setMessageChannel,
  ] =
    useState<
      "sms" | "email"
    >("sms");

  const [
    messageText,
    setMessageText,
  ] =
    useState("");

  const [
    sendingMessage,
    setSendingMessage,
  ] =
    useState(false);

  const showNotice = (
    message: string
  ) => {
    setNotice(
      message
    );

    window.setTimeout(
      () => {
        setNotice("");
      },
      2500
    );
  };

  async function loadCustomer() {
    if (!id) {
      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          `${API_BASE}/api/customers/${id}/360`
        );

      const result:
        Customer360Response =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          "Customer 360 request failed"
        );
      }

      setData(
        result.data
      );

      setBackendOnline(
        true
      );
    } catch (error) {
      console.error(
        error
      );

      setBackendOnline(
        false
      );

      setData(null);

      showNotice(
        "پروفایل مشتری از Backend دریافت نشد."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function sendCustomerMessage() {
    if (
      !id ||
      !data
    ) {
      return;
    }

    if (
      !messageText.trim()
    ) {
      showNotice(
        "لطفاً متن پیام را وارد کن."
      );

      return;
    }

    if (
      messageChannel ===
        "sms" &&
      !data.customer.phone
    ) {
      showNotice(
        "برای این مشتری شماره موبایل ثبت نشده است."
      );

      return;
    }

    if (
      messageChannel ===
        "email" &&
      !data.customer.email
    ) {
      showNotice(
        "برای این مشتری ایمیل ثبت نشده است."
      );

      return;
    }

    try {
      setSendingMessage(
        true
      );

      const response =
        await fetch(
          `${API_BASE}/api/customers/${id}/message`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  channel:
                    messageChannel,

                  message:
                    messageText.trim(),
                }
              ),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result?.message ||
            "Message request failed"
        );
      }

      setMessageText(
        ""
      );

      setMessageModalOpen(
        false
      );

      showNotice(
        messageChannel ===
          "sms"
          ? "پیامک به Messaging Engine ارسال شد."
          : "ایمیل به Messaging Engine ارسال شد."
      );

      await loadCustomer();
    } catch (error) {
      console.error(
        error
      );

      showNotice(
        "ارسال پیام انجام نشد."
      );
    } finally {
      setSendingMessage(
        false
      );
    }
  }

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const timeline =
    useMemo<
      TimelineItem[]
    >(() => {
      if (!data) {
        return [];
      }

      const orderItems:
        TimelineItem[] =
        data.orders.map(
          (order) => ({
            id: `order-${order.id}`,

            type:
              "order",

            title:
              "خرید موفق",

            description:
              `${faMoney(
                order.totalAmount
              )} از ${sourceToFa(
                order.source
              )}`,

            date:
              order.createdAt,
          })
        );

      const cartItems:
        TimelineItem[] =
        data.carts.map(
          (cart) => ({
            id: `cart-${cart.id}`,

            type:
              "cart",

            title:
              cart.status ===
              "abandoned"
                ? "سبد خرید رهاشده"
                : "سبد خرید فعال",

            description:
              faMoney(
                cart.totalAmount
              ),

            date:
              cart.createdAt,
          })
        );

      const eventItems:
        TimelineItem[] =
        data.events.map(
          (event) => ({
            id: `event-${event.id}`,

            type:
              "event",

            title:
              eventToFa(
                event.type
              ),

            description:
              eventDescription(
                event
              ),

            date:
              event.createdAt,
          })
        );

      return [
        ...orderItems,
        ...cartItems,
        ...eventItems,
      ].sort(
        (a, b) =>
          new Date(
            b.date
          ).getTime() -
          new Date(
            a.date
          ).getTime()
      );
    }, [data]);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="loadder-dashboard-bg flex min-h-screen items-center justify-center text-white"
      >
        <div className="rounded-2xl border border-white/[0.08] bg-[#080d1d]/70 px-6 py-5 text-sm text-white/50">
          در حال دریافت پروفایل کامل مشتری...
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main
        dir="rtl"
        className="loadder-dashboard-bg flex min-h-screen items-center justify-center px-6 text-white"
      >
        <div className="max-w-lg rounded-[28px] border border-red-400/15 bg-red-500/[0.04] p-8 text-center">
          <WarningCircle
            size={34}
            weight="duotone"
            className="mx-auto text-red-300"
          />

          <h1 className="mt-4 text-xl font-bold">
            مشتری پیدا نشد
          </h1>

          <p className="mt-2 text-sm leading-7 text-white/45">
            پروفایل این مشتری از Backend دریافت نشد.
          </p>

          <Link
            to="/dashboard/crm"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm"
          >
            <ArrowRight
              size={16}
            />

            بازگشت به CRM
          </Link>
        </div>
      </main>
    );
  }

  const {
    customer,
    summary,
    orders,
    carts,
    executions,
  } = data;

  return (
    <main
      dir="rtl"
      className="loadder-dashboard-bg min-h-screen text-white"
    >
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1550px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard/crm"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight
                size={18}
              />
            </Link>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <UserCircle
                size={26}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                پروفایل ۳۶۰ مشتری
              </h1>

              <p className="mt-1 text-sm text-white/45">
                تصویر کامل رفتار، خرید، ارزش و اتوماسیون مشتری
              </p>
            </div>
          </div>

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
              ? "Customer 360 متصل"
              : "اتصال قطع"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-[340px] w-[340px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_410px]">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-violet-400/15 bg-violet-500/[0.08]">
                <UserCircle
                  size={54}
                  weight="duotone"
                  className="text-violet-300"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-bold">
                    {customer.name}
                  </h2>

                  <span className="rounded-full border border-emerald-400/15 bg-emerald-500/[0.07] px-3 py-1.5 text-xs text-emerald-300">
                    {customer.status ===
                    "active"
                      ? "مشتری فعال"
                      : customer.status}
                  </span>
                </div>

                <p className="mt-2 text-sm text-white/45">
                  {customer.company ??
                    "بدون شرکت"}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <InfoChip
                    icon={
                      Phone
                    }
                    value={
                      customer.phone ??
                      "شماره ثبت نشده"
                    }
                  />

                  <InfoChip
                    icon={
                      EnvelopeSimple
                    }
                    value={
                      customer.email ??
                      "ایمیل ثبت نشده"
                    }
                  />

                  <InfoChip
                    icon={
                      Globe
                    }
                    value={sourceToFa(
                      customer.source
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-cyan-400/10 bg-cyan-500/[0.04] p-6">
              <div className="flex items-center gap-3">
                <Brain
                  size={22}
                  weight="duotone"
                  className="text-cyan-300"
                />

                <h3 className="font-semibold">
                  برداشت سریع Loadder
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/50">
                این مشتری{" "}
                {faNumber(
                  summary.completedOrders
                )}{" "}
                خرید موفق،{" "}
                {faNumber(
                  summary.abandonedCarts
                )}{" "}
                سبد رهاشده و{" "}
                {faNumber(
                  summary.workflowExecutions
                )}{" "}
                اجرای Workflow دارد.
                ارزش طول عمر او{" "}
                {faMoney(
                  summary.lifetimeValue
                )}{" "}
                و ریسک ریزش{" "}
                {faNumber(
                  summary.riskScore
                )}{" "}
                است.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="درآمد ثبت‌شده"
            value={faMoney(
              summary.totalRevenue
            )}
            icon={
              CurrencyCircleDollar
            }
          />

          <StatCard
            title="ارزش طول عمر"
            value={faMoney(
              summary.lifetimeValue
            )}
            icon={
              TrendUp
            }
          />

          <StatCard
            title="خرید موفق"
            value={faNumber(
              summary.completedOrders
            )}
            icon={
              CheckCircle
            }
          />

          <StatCard
            title="اجرای Workflow"
            value={faNumber(
              summary.workflowExecutions
            )}
            icon={
              Lightning
            }
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[0.9fr_1.25fr]">
          <aside className="space-y-5">
            <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
              <div className="flex items-center gap-3">
                <Buildings
                  size={22}
                  weight="duotone"
                  className="text-violet-300"
                />

                <h2 className="text-xl font-semibold">
                  مشخصات مشتری
                </h2>
              </div>

              <div className="mt-6 space-y-3">
                <DetailRow
                  title="نام"
                  value={
                    customer.name
                  }
                />

                <DetailRow
                  title="شرکت"
                  value={
                    customer.company ??
                    "—"
                  }
                />

                <DetailRow
                  title="شماره تماس"
                  value={
                    customer.phone ??
                    "—"
                  }
                />

                <DetailRow
                  title="ایمیل"
                  value={
                    customer.email ??
                    "—"
                  }
                />

                <DetailRow
                  title="منبع جذب"
                  value={sourceToFa(
                    customer.source
                  )}
                />

                <DetailRow
                  title="آخرین خرید"
                  value={faDate(
                    customer.lastPurchaseAt
                  )}
                />
              </div>
            </div>

            <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
              <div className="flex items-center gap-3">
                <WarningCircle
                  size={22}
                  weight="duotone"
                  className={
                    summary.riskScore >=
                    70
                      ? "text-amber-300"
                      : "text-emerald-300"
                  }
                />

                <h2 className="text-xl font-semibold">
                  سلامت رابطه
                </h2>
              </div>

              <div className="mt-6">
                <div className="text-sm text-white/40">
                  ریسک ریزش
                </div>

                <div className="mt-2 text-3xl font-bold">
                  {faNumber(
                    summary.riskScore
                  )}
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-violet-500 to-cyan-400"
                    style={{
                      width: `${Math.min(
                        summary.riskScore,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Timeline مشتری
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  خریدها، سبدها و Eventهای ثبت‌شده
                </p>
              </div>

              <ClockCounterClockwise
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />
            </div>

            <div className="mt-7 space-y-4">
              {timeline.length ===
              0 ? (
                <EmptyState text="هنوز رویدادی ثبت نشده است." />
              ) : (
                timeline.map(
                  (item) => (
                    <TimelineRow
                      key={
                        item.id
                      }
                      item={
                        item
                      }
                    />
                  )
                )
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <Receipt
                size={22}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  سفارش‌ها
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  تاریخچه خرید واقعی
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {orders.length ===
              0 ? (
                <EmptyState text="هنوز سفارشی ثبت نشده است." />
              ) : (
                orders.map(
                  (order) => (
                    <OrderRow
                      key={
                        order.id
                      }
                      order={
                        order
                      }
                    />
                  )
                )
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <ShoppingCart
                size={22}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  سبدهای خرید
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  فعال، رهاشده و بازیابی‌شده
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {carts.length ===
              0 ? (
                <EmptyState text="سبد خریدی ثبت نشده است." />
              ) : (
                carts.map(
                  (cart) => (
                    <CartRow
                      key={
                        cart.id
                      }
                      cart={
                        cart
                      }
                    />
                  )
                )
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Lightning
                  size={23}
                  weight="duotone"
                  className="text-violet-300"
                />

                <h2 className="text-xl font-semibold">
                  تاریخچه اتوماسیون مشتری
                </h2>
              </div>

              <p className="mt-2 text-sm text-white/40">
                Workflowها و Actionهایی که Loadder برای این مشتری اجرا کرده
              </p>
            </div>

            <div className="rounded-full border border-violet-400/15 bg-violet-500/[0.07] px-4 py-2 text-xs text-violet-200">
              {faNumber(
                executions.length
              )}{" "}
              اجرا
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {executions.length ===
            0 ? (
              <EmptyState text="هنوز هیچ Workflowی برای این مشتری اجرا نشده است." />
            ) : (
              executions.map(
                (
                  execution
                ) => (
                  <WorkflowExecutionRow
                    key={
                      execution.id
                    }
                    execution={
                      execution
                    }
                  />
                )
              )
            )}
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
                    Customer 360 آماده اقدام است
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    CRM → پیام → Messaging Engine → History
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                حالا می‌توانی از همین پروفایل مستقیماً برای مشتری
                پیامک یا ایمیل بسازی و نتیجه آن را داخل تاریخچه
                همان مشتری ثبت کنی.
              </p>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-6">
              <div className="font-semibold">
                اقدام‌های مشتری
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    setMessageModalOpen(
                      true
                    )
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold"
                >
                  <PaperPlaneTilt
                    size={17}
                    weight="duotone"
                  />

                  ارسال پیام به مشتری
                </button>

                <Link
                  to="/dashboard/automation"
                  className="block rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-center text-sm text-white/60"
                >
                  مشاهده Workflowها
                </Link>

                <button
                  type="button"
                  onClick={
                    loadCustomer
                  }
                  className="w-full rounded-xl border border-cyan-400/10 bg-cyan-500/[0.05] px-4 py-3 text-sm text-cyan-200"
                >
                  بروزرسانی پروفایل
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {messageModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 backdrop-blur-md">
          <div
            dir="rtl"
            className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/[0.10] bg-[#080d1d] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.08]">
                  <PaperPlaneTilt
                    size={22}
                    weight="duotone"
                    className="text-violet-300"
                  />
                </div>

                <div>
                  <h3 className="font-semibold">
                    ارسال پیام به مشتری
                  </h3>

                  <p className="mt-1 text-xs text-white/35">
                    {customer.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMessageModalOpen(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03] text-white/40 transition hover:text-white"
              >
                <X
                  size={16}
                />
              </button>
            </div>

            <div className="p-6">
              <div>
                <div className="mb-3 text-sm font-medium text-white/60">
                  کانال ارسال
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setMessageChannel(
                        "sms"
                      )
                    }
                    className={`rounded-2xl border p-4 text-right transition ${
                      messageChannel ===
                      "sms"
                        ? "border-violet-400/30 bg-violet-500/[0.10]"
                        : "border-white/[0.07] bg-black/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Phone
                        size={18}
                        weight="duotone"
                        className="text-violet-300"
                      />

                      <span className="font-semibold">
                        پیامک
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-white/35">
                      {customer.phone ??
                        "شماره ثبت نشده"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMessageChannel(
                        "email"
                      )
                    }
                    className={`rounded-2xl border p-4 text-right transition ${
                      messageChannel ===
                      "email"
                        ? "border-cyan-400/30 bg-cyan-500/[0.08]"
                        : "border-white/[0.07] bg-black/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <EnvelopeSimple
                        size={18}
                        weight="duotone"
                        className="text-cyan-300"
                      />

                      <span className="font-semibold">
                        ایمیل
                      </span>
                    </div>

                    <div className="mt-2 truncate text-xs text-white/35">
                      {customer.email ??
                        "ایمیل ثبت نشده"}
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white/60">
                    متن پیام
                  </span>

                  <span className="text-xs text-white/25">
                    {faNumber(
                      messageText.length
                    )}{" "}
                    کاراکتر
                  </span>
                </div>

                <textarea
                  value={
                    messageText
                  }
                  onChange={(
                    event
                  ) =>
                    setMessageText(
                      event.target
                        .value
                    )
                  }
                  rows={6}
                  placeholder={`${customer.name} عزیز، یک پیشنهاد ویژه برای شما داریم...`}
                  className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/25 p-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/20 focus:border-violet-400/25"
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <div className="text-xs text-white/35">
                  مقصد ارسال
                </div>

                <div className="mt-2 font-semibold">
                  {messageChannel ===
                  "sms"
                    ? customer.phone ??
                      "شماره موبایل موجود نیست"
                    : customer.email ??
                      "ایمیل موجود نیست"}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={
                    sendCustomerMessage
                  }
                  disabled={
                    sendingMessage ||
                    !messageText.trim()
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PaperPlaneTilt
                    size={18}
                    weight="fill"
                  />

                  {sendingMessage
                    ? "در حال ارسال..."
                    : "ارسال پیام"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMessageModalOpen(
                      false
                    )
                  }
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3.5 text-sm text-white/55"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-7 left-7 z-[100] max-w-md rounded-2xl border border-violet-300/20 bg-[#090e1e]/95 px-5 py-4 text-sm shadow-2xl backdrop-blur-xl">
          {notice}
        </div>
      )}
    </main>
  );
}

function InfoChip({
  icon: Icon,
  value,
}: {
  icon: React.ElementType;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-xs text-white/45">
      <Icon
        size={15}
        weight="duotone"
        className="text-cyan-300"
      />

      {value}
    </div>
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

      <div className="mt-4 text-2xl font-bold">
        {value}
      </div>
    </div>
  );
}

function DetailRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <span className="text-sm text-white/40">
        {title}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
    </div>
  );
}

function TimelineRow({
  item,
}: {
  item: TimelineItem;
}) {
  const Icon =
    item.type ===
    "order"
      ? CheckCircle
      : item.type ===
          "cart"
        ? ShoppingCart
        : Lightning;

  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-500/[0.06]">
        <Icon
          size={18}
          weight="duotone"
          className="text-violet-300"
        />
      </div>

      <div className="flex-1 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">
              {item.title}
            </div>

            <div className="mt-2 text-xs leading-6 text-white/35">
              {item.description}
            </div>
          </div>

          <div className="shrink-0 text-xs text-white/25">
            {faDate(
              item.date
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderRow({
  order,
}: {
  order: Order;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">
            {faMoney(
              order.totalAmount
            )}
          </div>

          <div className="mt-1 text-xs text-white/35">
            {sourceToFa(
              order.source
            )}{" "}
            •{" "}
            {faDate(
              order.createdAt
            )}
          </div>
        </div>

        <span className="rounded-full border border-emerald-400/15 bg-emerald-500/[0.07] px-3 py-1.5 text-xs text-emerald-300">
          {order.paymentStatus ===
          "paid"
            ? "پرداخت‌شده"
            : order.paymentStatus ??
              order.status}
        </span>
      </div>
    </div>
  );
}

function CartRow({
  cart,
}: {
  cart: Cart;
}) {
  const isAbandoned =
    cart.status ===
    "abandoned";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">
            {faMoney(
              cart.totalAmount
            )}
          </div>

          <div className="mt-1 text-xs text-white/35">
            {faDate(
              cart.createdAt
            )}
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs ${
            isAbandoned
              ? "border-amber-400/15 bg-amber-500/[0.07] text-amber-300"
              : "border-cyan-400/15 bg-cyan-500/[0.07] text-cyan-300"
          }`}
        >
          {isAbandoned
            ? "رهاشده"
            : "فعال"}
        </span>
      </div>
    </div>
  );
}

function WorkflowExecutionRow({
  execution,
}: {
  execution:
    WorkflowExecution;
}) {
  const actionMap: Record<
    string,
    string
  > = {
    send_message:
      "ارسال پیام",

    send_offer:
      "ارسال پیشنهاد",

    create_task:
      "ساخت وظیفه",

    create_campaign:
      "ساخت کمپین",

    create_alert:
      "ایجاد هشدار",
  };

  const channelMap: Record<
    string,
    string
  > = {
    sms:
      "پیامک",

    email:
      "ایمیل",

    crm:
      "CRM",

    dashboard:
      "داشبورد",
  };

  const isSuccess =
    execution.status ===
      "completed" ||
    execution.status ===
      "simulated";

  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/20 p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              isSuccess
                ? "border-emerald-400/15 bg-emerald-500/[0.07]"
                : "border-amber-400/15 bg-amber-500/[0.07]"
            }`}
          >
            <Lightning
              size={20}
              weight="duotone"
              className={
                isSuccess
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            />
          </div>

          <div>
            <div className="font-semibold">
              {execution.workflowTitle ??
                "Workflow بدون عنوان"}
            </div>

            <div className="mt-2 text-xs text-white/35">
              {actionMap[
                execution.actionType
              ] ??
                execution.actionType}

              {execution.channel
                ? ` • ${
                    channelMap[
                      execution.channel
                    ] ??
                    execution.channel
                  }`
                : ""}
            </div>

            {execution.recipient && (
              <div className="mt-1 text-xs text-white/30">
                مقصد:{" "}
                {
                  execution.recipient
                }
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-white/30">
            {faDate(
              execution.timestamp
            )}
          </div>

          <span
            className={`rounded-full border px-3 py-1.5 text-xs ${
              isSuccess
                ? "border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-300"
                : "border-amber-400/15 bg-amber-500/[0.07] text-amber-300"
            }`}
          >
            {execution.status ===
            "simulated"
              ? "آزمایشی"
              : execution.status ===
                  "completed"
                ? "انجام‌شده"
                : execution.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-6 text-center text-sm text-white/35">
      {text}
    </div>
  );
}