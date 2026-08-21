import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  UsersThree,
  UserPlus,
  Target,
  MagnifyingGlass,
  Funnel,
  Sparkle,
  Brain,
  CheckCircle,
  Lightning,
  ShoppingCart,
  Storefront,
  Repeat,
  Receipt,
  Package,
  UserCircle,
  CurrencyCircleDollar,
  ClockCounterClockwise,
  ArrowClockwise,
} from "@phosphor-icons/react";

type CRMStats = {
  totalCustomers: number;
  totalLeads: number;
  hotLeads: number;
  completedOrders: number;
  onlineRevenue: number;
  abandonedCarts: number;
};

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

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  score: number;
  status: string;
  opportunityValue: number;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
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

type ApiListResponse<T> = {
  ok: boolean;
  count: number;
  data: T[];
};

type ApiDataResponse<T> = {
  ok: boolean;
  data: T;
};

type CustomerView = {
  id: string;
  name: string;
  company: string;
  source: string;
  type: "customer" | "lead";
  score: number | null;
  status: string;
  totalSpent: number;
  ordersCount: number;
  lifetimeValue: number;
  riskScore: number;
  phone: string | null;
  lastPurchaseAt: string | null;
};

const API_BASE = "http://localhost:3001";

function faNumber(value: number) {
  return value.toLocaleString("fa-IR");
}

function faMoney(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("fa-IR", {
      maximumFractionDigits: 1,
    })} میلیارد تومان`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fa-IR", {
      maximumFractionDigits: 1,
    })} میلیون تومان`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString("fa-IR", {
      maximumFractionDigits: 0,
    })} هزار تومان`;
  }

  return `${faNumber(value)} تومان`;
}

function faDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("fa-IR");
}

function sourceToFa(source: string | null) {
  const map: Record<string, string> = {
    website: "وب‌سایت",
    referral: "معرفی مشتری",
    google_ads: "تبلیغات گوگل",
    instagram: "اینستاگرام",
    sms: "پیامک",
  };

  if (!source) {
    return "نامشخص";
  }

  return map[source] ?? source;
}

function leadStatusToFa(status: string) {
  const map: Record<string, string> = {
    new: "جدید",
    hot: "لید داغ",
    qualified: "واجد شرایط",
    negotiating: "در حال مذاکره",
    converted: "تبدیل‌شده",
  };

  return map[status] ?? status;
}

function customerStatusToFa(status: string) {
  const map: Record<string, string> = {
    active: "مشتری فعال",
    inactive: "غیرفعال",
    churn_risk: "در معرض ریزش",
    vip: "مشتری ویژه",
  };

  return map[status] ?? status;
}

export default function CRMPage() {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "همه" | "مشتریان" | "لیدها" | "لید داغ"
  >("همه");

  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [notice, setNotice] = useState("");

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2600);
  };

  async function loadCRM() {
    try {
      setLoading(true);

      const [
        statsResponse,
        customersResponse,
        leadsResponse,
        ordersResponse,
        cartsResponse,
      ] = await Promise.all([
        fetch(`${API_BASE}/api/crm/stats`),
        fetch(`${API_BASE}/api/customers`),
        fetch(`${API_BASE}/api/leads`),
        fetch(`${API_BASE}/api/orders`),
        fetch(`${API_BASE}/api/carts`),
      ]);

      if (
        !statsResponse.ok ||
        !customersResponse.ok ||
        !leadsResponse.ok ||
        !ordersResponse.ok ||
        !cartsResponse.ok
      ) {
        throw new Error("CRM API request failed");
      }

      const statsResult: ApiDataResponse<CRMStats> =
        await statsResponse.json();

      const customersResult: ApiListResponse<Customer> =
        await customersResponse.json();

      const leadsResult: ApiListResponse<Lead> =
        await leadsResponse.json();

      const ordersResult: ApiListResponse<Order> =
        await ordersResponse.json();

      const cartsResult: ApiListResponse<Cart> =
        await cartsResponse.json();

      setStats(statsResult.data);
      setCustomers(customersResult.data);
      setLeads(leadsResult.data);
      setOrders(ordersResult.data);
      setCarts(cartsResult.data);

      setBackendOnline(true);
    } catch (error) {
      console.error(error);

      setBackendOnline(false);

      showNotice(
        "اتصال CRM به Backend برقرار نشد. مطمئن شو سرور روی پورت 3001 روشن است."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCRM();
  }, []);

  const customerViews = useMemo<CustomerView[]>(() => {
    const customerItems: CustomerView[] = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      company: customer.company ?? "بدون شرکت",
      source: sourceToFa(customer.source),
      type: "customer",
      score: null,
      status: customerStatusToFa(customer.status),
      totalSpent: customer.totalSpent,
      ordersCount: customer.ordersCount,
      lifetimeValue: customer.lifetimeValue,
      riskScore: customer.riskScore,
      phone: customer.phone,
      lastPurchaseAt: customer.lastPurchaseAt,
    }));

    const leadItems: CustomerView[] = leads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      company: lead.company ?? "بدون شرکت",
      source: sourceToFa(lead.source),
      type: "lead",
      score: lead.score,
      status: leadStatusToFa(lead.status),
      totalSpent: 0,
      ordersCount: 0,
      lifetimeValue: lead.opportunityValue,
      riskScore: 0,
      phone: lead.phone,
      lastPurchaseAt: null,
    }));

    return [...customerItems, ...leadItems];
  }, [customers, leads]);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim();

    return customerViews.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.name.includes(normalizedQuery) ||
        item.company.includes(normalizedQuery) ||
        item.source.includes(normalizedQuery) ||
        item.phone?.includes(normalizedQuery);

      const matchesFilter =
        filter === "همه" ||
        (filter === "مشتریان" && item.type === "customer") ||
        (filter === "لیدها" && item.type === "lead") ||
        (filter === "لید داغ" &&
          item.type === "lead" &&
          (item.score ?? 0) >= 80);

      return matchesQuery && matchesFilter;
    });
  }, [customerViews, query, filter]);

  const abandonedCarts = useMemo(
    () => carts.filter((cart) => cart.status === "abandoned"),
    [carts]
  );

  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "completed"),
    [orders]
  );

  const totalRevenue = useMemo(
    () =>
      completedOrders.reduce(
        (sum, order) => sum + order.totalAmount,
        0
      ),
    [completedOrders]
  );

  const averageOrderValue =
    completedOrders.length > 0
      ? Math.round(totalRevenue / completedOrders.length)
      : 0;

  const repeatCustomers = customers.filter(
    (customer) => customer.ordersCount >= 2
  );

  const totalLifetimeValue = customers.reduce(
    (sum, customer) => sum + customer.lifetimeValue,
    0
  );

  const averageLifetimeValue =
    customers.length > 0
      ? Math.round(totalLifetimeValue / customers.length)
      : 0;

  const highRiskCustomers = customers.filter(
    (customer) => customer.riskScore >= 70
  );

  const hotLeads = leads.filter((lead) => lead.score >= 80);

  const totalOpportunityValue = leads.reduce(
    (sum, lead) => sum + lead.opportunityValue,
    0
  );

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
                CRM واقعی متصل به مشتری، فروشگاه و Workflow Engine
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
                  backendOnline ? "bg-emerald-300" : "bg-red-300"
                }`}
              />

              {backendOnline ? "CRM متصل" : "CRM قطع"}
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  "فرم ساخت مشتری جدید در مرحله بعد به API متصل می‌شود."
                )
              }
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold"
            >
              <UserPlus size={17} />
              مشتری جدید
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1550px] px-8 py-8">
        <section className="relative overflow-hidden rounded-[34px] border border-violet-400/15 bg-[#080d1d]/68 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-violet-600/[0.13] blur-[130px]" />

          <div className="pointer-events-none absolute -bottom-32 left-[20%] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.08] blur-[120px]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[1fr_390px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/[0.08] px-4 py-2 text-sm text-cyan-200">
                <DatabaseBadge />
                CRM + SQLite + E-commerce
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.55]">
                مشتری را از اولین لید تا
                <span className="bg-gradient-to-l from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  {" "}
                  خرید، خرید مجدد و ارزش طول عمر ببین.
                </span>
              </h2>

              <p className="mt-4 max-w-3xl text-base leading-9 text-white/50">
                این صفحه حالا داده مشتری، لید، سفارش و سبد خرید را
                مستقیم از SQLite و Backend Loadder دریافت می‌کند.
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
                  فرصت فوری فروش
                </h3>
              </div>

              <p className="mt-4 text-sm leading-8 text-white/55">
                {faNumber(abandonedCarts.length)} سبد خرید رهاشده و{" "}
                {faNumber(hotLeads.length)} لید داغ در داده فعلی وجود
                دارد.
              </p>

              <Link
                to="/dashboard/automation"
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-500/[0.08] px-4 py-3 text-sm text-violet-200"
              >
                <Lightning size={16} weight="fill" />
                مشاهده اتوماسیون
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="کل مشتریان"
            value={faNumber(stats?.totalCustomers ?? customers.length)}
            icon={UsersThree}
          />

          <StatCard
            title="کل لیدها"
            value={faNumber(stats?.totalLeads ?? leads.length)}
            icon={UserPlus}
          />

          <StatCard
            title="لیدهای داغ"
            value={faNumber(stats?.hotLeads ?? hotLeads.length)}
            icon={Target}
          />

          <StatCard
            title="ارزش فرصت‌های فروش"
            value={faMoney(totalOpportunityValue)}
            icon={CurrencyCircleDollar}
          />
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                فروش آنلاین سایت
              </h2>

              <p className="mt-1 text-sm text-white/40">
                داده واقعی سفارش و سبد خرید از Backend
              </p>
            </div>

            <button
              type="button"
              onClick={loadCRM}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs text-white/55"
            >
              <ArrowClockwise size={15} />
              بروزرسانی
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CommerceStatCard
              title="فروش آنلاین"
              value={faMoney(stats?.onlineRevenue ?? totalRevenue)}
              description="درآمد سفارش‌های موفق"
              icon={Storefront}
            />

            <CommerceStatCard
              title="سفارش موفق"
              value={faNumber(
                stats?.completedOrders ?? completedOrders.length
              )}
              description="سفارش‌های تکمیل‌شده"
              icon={CheckCircle}
            />

            <CommerceStatCard
              title="سبد رهاشده"
              value={faNumber(
                stats?.abandonedCarts ?? abandonedCarts.length
              )}
              description="فرصت بازیابی فروش"
              icon={ShoppingCart}
            />

            <CommerceStatCard
              title="مشتری تکرارشونده"
              value={faNumber(repeatCustomers.length)}
              description="حداقل دو خرید ثبت‌شده"
              icon={Repeat}
            />
          </div>
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جست‌وجوی مشتری، شرکت، شماره یا منبع جذب..."
                className="w-full rounded-2xl border border-white/[0.08] bg-black/20 py-3.5 pr-11 pl-4 text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["همه", "مشتریان", "لیدها", "لید داغ"] as const).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-xl border px-4 py-2.5 text-sm transition ${
                      filter === item
                        ? "border-violet-400/25 bg-violet-500/[0.10] text-violet-200"
                        : "border-white/[0.07] bg-white/[0.03] text-white/45"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.55fr_0.8fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7 backdrop-blur-xl">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  مشتریان و لیدها
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اطلاعات واقعی ثبت‌شده در CRM
                </p>
              </div>

              <span className="text-xs text-white/35">
                {faNumber(filteredPeople.length)} مورد
              </span>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-8 text-center text-sm text-white/35">
                در حال دریافت اطلاعات CRM...
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-8 text-center text-sm text-white/35">
                موردی پیدا نشد.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {filteredPeople.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    onClick={() =>
                      showNotice(
                        `پروفایل کامل «${person.name}» برای لیدها در مرحله بعد ساخته می‌شود.`
                      )
                    }
                  />
                ))}
              </div>
            )}
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
                  قیف CRM
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  از لید تا خرید
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              <FunnelRow
                title="کل لیدها"
                value={stats?.totalLeads ?? leads.length}
                width="100%"
              />

              <FunnelRow
                title="لیدهای داغ"
                value={stats?.hotLeads ?? hotLeads.length}
                width="80%"
              />

              <FunnelRow
                title="مشتریان"
                value={stats?.totalCustomers ?? customers.length}
                width="62%"
              />

              <FunnelRow
                title="سفارش موفق"
                value={stats?.completedOrders ?? completedOrders.length}
                width="48%"
              />

              <FunnelRow
                title="مشتری تکرارشونده"
                value={repeatCustomers.length}
                width="34%"
              />
            </div>
          </aside>
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
                  اقتصاد مشتری
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  شاخص‌های واقعی خرید مشتریان
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <MetricCard
                title="میانگین سفارش"
                value={faMoney(averageOrderValue)}
              />

              <MetricCard
                title="میانگین ارزش طول عمر"
                value={faMoney(averageLifetimeValue)}
              />

              <MetricCard
                title="مجموع فروش ثبت‌شده"
                value={faMoney(totalRevenue)}
              />

              <MetricCard
                title="مشتریان پرریسک"
                value={faNumber(highRiskCustomers.length)}
              />
            </div>
          </div>

          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center gap-3">
              <Package
                size={22}
                weight="duotone"
                className="text-violet-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  وضعیت فروشگاه
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  Order و Cartهای ثبت‌شده
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <OrderRow title="کل سفارش‌ها" value={orders.length} />
              <OrderRow
                title="سفارش موفق"
                value={completedOrders.length}
              />
              <OrderRow title="کل سبدها" value={carts.length} />
              <OrderRow
                title="سبد رهاشده"
                value={abandonedCarts.length}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[30px] border border-white/[0.08] bg-[#080d1d]/65 p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  آخرین سفارش‌ها
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  سفارش‌های ثبت‌شده در دیتابیس
                </p>
              </div>

              <ClockCounterClockwise
                size={22}
                weight="duotone"
                className="text-violet-300"
              />
            </div>

            <div className="mt-6 space-y-3">
              {orders.slice(0, 6).map((order) => {
                const customer = customers.find(
                  (item) => item.id === order.customerId
                );

                return (
                  <RecentOrderRow
                    key={order.id}
                    order={order}
                    customerName={customer?.name ?? "مشتری ناشناس"}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-[30px] border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-[#080d1d]/70 to-cyan-500/[0.04] p-7">
            <div className="flex items-center gap-3">
              <Target
                size={23}
                weight="duotone"
                className="text-cyan-300"
              />

              <div>
                <h2 className="text-xl font-semibold">
                  فرصت‌های فوری
                </h2>

                <p className="mt-1 text-sm text-white/40">
                  اولویت‌های واقعی از داده CRM
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <PriorityRow
                title={`${faNumber(abandonedCarts.length)} سبد خرید رهاشده`}
                value="بازیابی"
              />

              <PriorityRow
                title={`${faNumber(hotLeads.length)} لید داغ`}
                value="پیگیری"
              />

              <PriorityRow
                title={`${faNumber(repeatCustomers.length)} مشتری تکرارشونده`}
                value="بیش‌فروشی"
              />

              <PriorityRow
                title={`${faNumber(highRiskCustomers.length)} مشتری پرریسک`}
                value="بازگشت"
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
                    CRM واقعی Loadder
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    SQLite → API → CRM → Automation
                  </p>
                </div>
              </div>

              <p className="mt-5 max-w-4xl text-base leading-9 text-white/55">
                حالا مشتری‌های واقعی مستقیم به پروفایل ۳۶۰ خودشان
                متصل‌اند. روی هر مشتری کلیک کنی، خرید، سبد، رفتار و ارزش
                طول عمر همان مشتری باز می‌شود.
              </p>
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
                  to="/dashboard/automation"
                  className="block w-full rounded-xl bg-gradient-to-l from-violet-600 via-blue-600 to-cyan-500 px-4 py-3 text-center text-sm font-semibold"
                >
                  مدیریت اتوماسیون‌ها
                </Link>

                <button
                  type="button"
                  onClick={loadCRM}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60"
                >
                  بروزرسانی داده CRM
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

function DatabaseBadge() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300/30">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
    </span>
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
        <span className="text-sm text-white/40">{title}</span>

        <Icon
          size={21}
          weight="duotone"
          className="text-cyan-300"
        />
      </div>

      <div className="mt-4 text-2xl font-bold">{value}</div>
    </div>
  );
}

function CommerceStatCard({
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
    <div className="rounded-[24px] border border-cyan-400/10 bg-cyan-500/[0.04] p-5">
      <Icon
        size={22}
        weight="duotone"
        className="text-cyan-300"
      />

      <div className="mt-4 text-sm text-white/40">{title}</div>

      <div className="mt-2 text-2xl font-bold">{value}</div>

      <div className="mt-3 text-xs text-white/35">
        {description}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  onClick,
}: {
  person: CustomerView;
  onClick: () => void;
}) {
  const isLead = person.type === "lead";

  const content = (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
      <div className="flex min-w-[220px] items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/[0.08]">
          <UserCircle
            size={25}
            weight="duotone"
            className="text-violet-300"
          />
        </div>

        <div>
          <div className="font-semibold">
            {person.name}
          </div>

          <div className="mt-1 text-xs text-white/35">
            {person.company} • {person.source}
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
        <SmallMetric
          title={isLead ? "امتیاز لید" : "تعداد سفارش"}
          value={
            isLead
              ? faNumber(person.score ?? 0)
              : faNumber(person.ordersCount)
          }
        />

        <SmallMetric
          title={isLead ? "ارزش فرصت" : "مجموع خرید"}
          value={
            isLead
              ? faMoney(person.lifetimeValue)
              : faMoney(person.totalSpent)
          }
        />

        <SmallMetric
          title={isLead ? "شماره تماس" : "آخرین خرید"}
          value={
            isLead
              ? person.phone ?? "—"
              : faDate(person.lastPurchaseAt)
          }
        />

        <div>
          <div className="text-xs text-white/30">
            وضعیت
          </div>

          <span
            className={`mt-1 inline-block rounded-full border px-3 py-1.5 text-xs ${
              isLead
                ? "border-cyan-400/15 bg-cyan-500/[0.07] text-cyan-300"
                : person.riskScore >= 70
                  ? "border-amber-400/15 bg-amber-500/[0.07] text-amber-300"
                  : "border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-300"
            }`}
          >
            {person.status}
          </span>
        </div>
      </div>
    </div>
  );

  if (!isLead) {
    return (
      <Link
        to={`/dashboard/crm/customer/${person.id}`}
        className="block w-full rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-right transition hover:border-violet-300/20 hover:bg-white/[0.03]"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-right transition hover:border-violet-300/20 hover:bg-white/[0.03]"
    >
      {content}
    </button>
  );
}

function SmallMetric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs text-white/30">{title}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function FunnelRow({
  title,
  value,
  width,
}: {
  title: string;
  value: number;
  width: string;
}) {
  return (
    <div className="flex justify-center">
      <div
        className="rounded-2xl border border-violet-400/15 bg-gradient-to-l from-violet-500/20 via-blue-500/10 to-cyan-500/10 px-4 py-3.5"
        style={{ width }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-lg font-bold">
            {faNumber(value)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
      <div className="text-xs text-white/35">{title}</div>
      <div className="mt-2 text-lg font-bold text-cyan-300">
        {value}
      </div>
    </div>
  );
}

function OrderRow({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <span className="text-sm text-white/45">{title}</span>
      <span className="font-semibold">{faNumber(value)}</span>
    </div>
  );
}

function RecentOrderRow({
  order,
  customerName,
}: {
  order: Order;
  customerName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div>
        <div className="font-semibold">{customerName}</div>

        <div className="mt-1 text-xs text-white/35">
          {faDate(order.createdAt)} • {sourceToFa(order.source)}
        </div>
      </div>

      <div className="text-left">
        <div className="font-semibold text-cyan-300">
          {faMoney(order.totalAmount)}
        </div>

        <div className="mt-1 text-xs text-emerald-300">
          {order.paymentStatus === "paid"
            ? "پرداخت‌شده"
            : order.paymentStatus ?? "نامشخص"}
        </div>
      </div>
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
      <span className="text-sm text-white/55">{title}</span>

      <span className="rounded-full border border-violet-300/10 bg-violet-500/[0.06] px-3 py-1.5 text-xs text-violet-200">
        {value}
      </span>
    </div>
  );
}