import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ArrowRight,
  Bank,
  CheckCircle,
  ClockCounterClockwise,
  Coins,
  Receipt,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Project = { id: string; name: string; siteType: string };
type Order = {
  id: string;
  email?: string | null;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  totalMinor: number;
  createdAt: string;
};
type LedgerEntry = {
  id: string;
  orderId: string;
  sourceType: string;
  sourceId: string;
  entryType: "PAYMENT_CAPTURED" | "REFUND" | "ADJUSTMENT";
  amountMinor: number;
  currency: string;
  occurredAt: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
type FinancialSummary = {
  id: string;
  siteProjectId: string;
  currency: string;
  orderTotalMinor: number;
  paymentStatus: string;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  paidMinor: number;
  refundedMinor: number;
  netMinor: number;
  orderCreatedAt: string;
  orderUpdatedAt: string;
};
type Financials = { summary: FinancialSummary; entries: LedgerEntry[] };
type ApiError = Error & { code?: string; status?: number; payload?: Record<string, unknown> };

async function read(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "خطا در دریافت اطلاعات مالی") as ApiError;
    error.code = payload.code;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const money = (minor: number, currency: string) => {
  const amount = (Number(minor) || 0) / 100;
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(amount)} ${currency === "IRT" ? "تومان" : currency}`;
};

const dateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function totalsByCurrency(entries: LedgerEntry[]) {
  const totals = new Map<string, { captured: number; refunded: number; net: number }>();
  for (const entry of entries) {
    const current = totals.get(entry.currency) || { captured: 0, refunded: 0, net: 0 };
    if (entry.entryType === "PAYMENT_CAPTURED") current.captured += entry.amountMinor;
    if (entry.entryType === "REFUND") current.refunded += Math.abs(entry.amountMinor);
    current.net = current.captured - current.refunded;
    totals.set(entry.currency, current);
  }
  return [...totals.entries()].map(([currency, total]) => ({ currency, ...total }));
}

export default function StoreFinancialsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [message, setMessage] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reconcileStatus, setReconcileStatus] = useState("");

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!selectedOrderId || forbidden) {
      setFinancials(null);
      return;
    }
    void loadFinancials(selectedOrderId);
  }, [selectedOrderId, forbidden]);

  async function boot() {
    setMessage("");
    setForbidden(false);
    try {
      const projectsPayload = await read(await apiFetch("/api/site-projects"));
      const store = (projectsPayload.projects || []).find(
        (item: Project) => String(item.siteType).toUpperCase() === "STORE"
      );
      if (!store) throw new Error("پروژه فروشگاهی پیدا نشد.");
      setProject(store);
      await refresh(store.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "خطا در بارگذاری بخش مالی");
    }
  }

  async function refresh(siteProjectId = project?.id) {
    if (!siteProjectId) return;
    setBusy(true);
    setMessage("");
    try {
      const [ordersPayload, ledgerPayload] = await Promise.all([
        read(await apiFetch(`/api/stores/${siteProjectId}/orders`)),
        read(await apiFetch(`/api/stores/${siteProjectId}/financial-ledger?limit=500`)),
      ]);
      const nextOrders: Order[] = ordersPayload.orders || [];
      const nextEntries: LedgerEntry[] = ledgerPayload.entries || [];
      setOrders(nextOrders);
      setEntries(nextEntries);
      const currentStillExists = nextOrders.some((order) => order.id === selectedOrderId);
      if (!currentStillExists) {
        const firstPaid = nextOrders.find((order) => order.paymentStatus === "PAID");
        setSelectedOrderId(firstPaid?.id || nextOrders[0]?.id || "");
      } else if (selectedOrderId) {
        await loadFinancials(selectedOrderId);
      }
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 403 || apiError.code === "FINANCIAL_ADMIN_REQUIRED") {
        setForbidden(true);
        setEntries([]);
        setFinancials(null);
      } else {
        setMessage(error instanceof Error ? error.message : "خطا در بارگذاری دفتر مالی");
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadFinancials(orderId: string) {
    setMessage("");
    try {
      const payload = await read(
        await apiFetch(`/api/commerce/orders/${encodeURIComponent(orderId)}/financials`)
      );
      setFinancials(payload.financials || null);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 403 || apiError.code === "FINANCIAL_ADMIN_REQUIRED") {
        setForbidden(true);
        setFinancials(null);
      } else {
        setFinancials(null);
        setMessage(error instanceof Error ? error.message : "خطا در دریافت جزئیات مالی سفارش");
      }
    }
  }

  async function reconcile() {
    if (!selectedOrderId || busy) return;
    setBusy(true);
    setMessage("");
    setReconcileStatus("");
    try {
      const payload = await read(
        await apiFetch(
          `/api/commerce/orders/${encodeURIComponent(selectedOrderId)}/financials/reconcile`,
          { method: "POST" }
        )
      );
      const status = String(payload.reconciliation?.status || "");
      setReconcileStatus(status);
      if (status === "repaired") {
        setMessage("رکورد Capture گمشده بدون تغییر تاریخچه، به Ledger اضافه شد.");
      } else if (status === "already_consistent") {
        setMessage("سفارش و Ledger با هم سازگار هستند؛ تغییری انجام نشد.");
      }
      await refresh();
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 403 || apiError.code === "FINANCIAL_ADMIN_REQUIRED") {
        setForbidden(true);
        return;
      }
      if (apiError.code === "FINANCIAL_LEDGER_CONFLICT") {
        setReconcileStatus("conflict");
        setMessage("تعارض مالی پیدا شد. Ledger immutable است و سیستم عمداً تاریخچه را بازنویسی نکرد.");
        return;
      }
      if (apiError.code === "FINANCIAL_ORDER_NOT_PAID") {
        setReconcileStatus("not_paid");
        setMessage("این سفارش هنوز PAID نیست و Capture مالی برای آن ساخته نمی‌شود.");
        return;
      }
      setMessage(error instanceof Error ? error.message : "Reconciliation انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  const currencyTotals = useMemo(() => totalsByCurrency(entries), [entries]);
  const capturedCount = useMemo(
    () => entries.filter((entry) => entry.entryType === "PAYMENT_CAPTURED").length,
    [entries]
  );
  const refundCount = useMemo(
    () => entries.filter((entry) => entry.entryType === "REFUND").length,
    [entries]
  );
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6fa] text-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/websites/admin" className="rounded-xl border p-2">
              <ArrowRight />
            </Link>
            <div>
              <div className="text-xs text-slate-400">{project?.name || "فروشگاه"}</div>
              <h1 className="flex items-center gap-2 text-xl font-black">
                <Bank className="text-violet-700" /> دفتر مالی فروشگاه
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 md:flex">
              <ShieldCheck /> Immutable Ledger
            </span>
            <button
              onClick={() => void refresh()}
              disabled={busy || forbidden}
              className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              <ArrowClockwise className={busy ? "animate-spin" : ""} /> بروزرسانی
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7">
        {forbidden ? (
          <section className="mx-auto mt-12 max-w-2xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto text-amber-600" size={48} />
            <h2 className="mt-4 text-xl font-black">دسترسی مالی محدود است</h2>
            <p className="mt-2 leading-7 text-slate-500">
              Ledger، Timeline و Reconciliation فقط برای Owner و Admin فضای کاری نمایش داده می‌شوند.
              محدودیت در سمت سرور enforce شده و صرفاً یک محدودیت رابط کاربری نیست.
            </p>
            <Link
              to="/dashboard/websites/admin"
              className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white"
            >
              بازگشت به مدیریت فروشگاه
            </Link>
          </section>
        ) : (
          <>
            {message && (
              <div
                className={`mb-5 rounded-2xl border p-4 text-sm leading-7 ${
                  reconcileStatus === "conflict"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : reconcileStatus === "repaired"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-violet-200 bg-violet-50 text-violet-800"
                }`}
              >
                {message}
              </div>
            )}

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat icon={<Receipt />} title="رکوردهای Ledger" value={String(entries.length)} />
              <Stat icon={<CheckCircle />} title="Capture ثبت‌شده" value={String(capturedCount)} />
              <Stat icon={<ClockCounterClockwise />} title="Refund ثبت‌شده" value={String(refundCount)} />
              <Stat icon={<Coins />} title="سفارش‌های PAID" value={String(orders.filter((o) => o.paymentStatus === "PAID").length)} />
            </section>

            <section className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">جمع مالی به تفکیک ارز</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    ارزهای مختلف عمداً با هم جمع نمی‌شوند.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  {currencyTotals.length} ارز فعال
                </span>
              </div>
              {currencyTotals.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {currencyTotals.map((total) => (
                    <div key={total.currency} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="mb-3 text-xs font-black text-violet-700">{total.currency}</div>
                      <Metric label="Captured" value={money(total.captured, total.currency)} />
                      <Metric label="Refunded" value={money(total.refunded, total.currency)} />
                      <Metric label="Net" value={money(total.net, total.currency)} strong />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-400">
                  هنوز رویداد مالی ثبت نشده است.
                </div>
              )}
            </section>

            <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-black">سفارش‌ها</h2>
                  <p className="mt-1 text-xs text-slate-400">برای مشاهده Timeline مالی یک سفارش را انتخاب کن.</p>
                </div>
                <div className="max-h-[620px] space-y-2 overflow-auto pl-1">
                  {orders.length ? (
                    orders.map((order) => {
                      const active = order.id === selectedOrderId;
                      return (
                        <button
                          key={order.id}
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setReconcileStatus("");
                          }}
                          className={`w-full rounded-2xl border p-4 text-right transition ${
                            active
                              ? "border-violet-300 bg-violet-50"
                              : "border-slate-100 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <b className="truncate text-sm">{order.id}</b>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                order.paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                            <span>{dateTime(order.createdAt)}</span>
                            <b className="text-slate-700">{money(order.totalMinor, order.currency)}</b>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-400">
                      هنوز سفارشی وجود ندارد.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border bg-white p-5 shadow-sm">
                {selectedOrder && financials ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
                      <div>
                        <div className="text-xs text-slate-400">Order Financial Timeline</div>
                        <h2 className="mt-1 max-w-xl break-all text-lg font-black">{selectedOrder.id}</h2>
                        <div className="mt-2 text-xs text-slate-400">
                          {selectedOrder.email || "بدون ایمیل"} · {dateTime(selectedOrder.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => void reconcile()}
                        disabled={busy}
                        className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                      >
                        <ArrowClockwise className={busy ? "animate-spin" : ""} /> Reconcile
                      </button>
                    </div>

                    <div className="my-5 grid gap-3 sm:grid-cols-3">
                      <MiniStat label="Order Total" value={money(financials.summary.orderTotalMinor, financials.summary.currency)} />
                      <MiniStat label="Captured" value={money(financials.summary.paidMinor, financials.summary.currency)} />
                      <MiniStat label="Net" value={money(financials.summary.netMinor, financials.summary.currency)} />
                    </div>

                    <div className="mb-5 grid gap-2 rounded-2xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
                      <Metric label="Payment status" value={financials.summary.paymentStatus} />
                      <Metric label="Provider" value={financials.summary.paymentProvider || "—"} />
                      <Metric label="Reference" value={financials.summary.paymentReference || "—"} />
                      <Metric label="Last order update" value={dateTime(financials.summary.orderUpdatedAt)} />
                    </div>

                    <div className="space-y-3">
                      {financials.entries.length ? (
                        financials.entries.map((entry) => (
                          <article key={entry.id} className="relative rounded-2xl border border-slate-100 p-4 pr-12">
                            <span
                              className={`absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full ${
                                entry.entryType === "PAYMENT_CAPTURED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : entry.entryType === "REFUND"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {entry.entryType === "PAYMENT_CAPTURED" ? <CheckCircle /> : <Receipt />}
                            </span>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <b className="text-sm">{entry.entryType}</b>
                                <div className="mt-1 break-all text-[11px] text-slate-400">{entry.id}</div>
                              </div>
                              <b className="text-sm">{money(entry.amountMinor, entry.currency)}</b>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
                              <span>{dateTime(entry.occurredAt)}</span>
                              <span>{entry.sourceType}</span>
                              {entry.metadata?.reconciled === true && (
                                <span className="font-bold text-violet-600">reconciled</span>
                              )}
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-400">
                          برای این سفارش هنوز Ledger entry وجود ندارد.
                        </div>
                      )}
                    </div>
                  </>
                ) : selectedOrder ? (
                  <div className="grid min-h-80 place-items-center text-sm text-slate-400">در حال دریافت Timeline مالی…</div>
                ) : (
                  <div className="grid min-h-80 place-items-center text-center text-slate-400">
                    <div>
                      <WarningCircle className="mx-auto mb-3" size={36} />
                      <p>برای مشاهده جزئیات مالی، یک سفارش را انتخاب کن.</p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 text-2xl text-violet-700">{icon}</span>
      <div>
        <div className="text-xs text-slate-400">{title}</div>
        <b className="text-xl">{value}</b>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-[11px] text-slate-400">{label}</div>
      <b className="mt-1 block text-sm">{value}</b>
    </div>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={strong ? "font-black text-slate-900" : "font-bold text-slate-700"}>{value}</span>
    </div>
  );
}
