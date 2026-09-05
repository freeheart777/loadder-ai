import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type OutboxState = "all" | "pending" | "processing" | "stale_claim" | "retrying" | "dead_letter" | "delivered";

type OutboxEvent = {
  id: string;
  event_id: string;
  event_type: string;
  order_id?: string | null;
  business_builder_project_id?: string | null;
  status: string;
  attempts: number;
  last_error?: string | null;
  available_at?: string | null;
  dead_lettered_at?: string | null;
  dead_letter_reason?: string | null;
  claim_expires_at?: string | null;
  operational_state: Exclude<OutboxState, "all">;
  claim_state: "unclaimed" | "active" | "stale" | "unknown";
};

type OutboxSummary = {
  total: number;
  pending: number;
  retrying: number;
  processing: number;
  staleClaim: number;
  delivered: number;
  deadLetter: number;
  maxAttempts: number;
};

type RecoveryHistory = {
  id: string;
  actorId: string | null;
  action: string;
  outboxId: string | null;
  metadata: {
    eventId?: string;
    eventType?: string | null;
    attempts?: number;
    beforeState?: string;
    reason?: string | null;
  };
  createdAt: string;
};

type Reconciliation = {
  event: OutboxEvent;
  lease: {
    state: OutboxEvent["claim_state"];
    claimedAt: string | null;
    expiresAt: string | null;
    retrySafeNow: boolean;
  };
  consumers: Array<{ consumer: string; status: "processed" | "missing"; processedAt: string | null }>;
  processed: number;
  missing: string[];
  complete: boolean;
  recoveryHistory: RecoveryHistory[];
};

type ApiError = { code?: string; message?: string };

const states: Array<{ value: OutboxState; label: string }> = [
  { value: "all", label: "همه" },
  { value: "pending", label: "در صف" },
  { value: "processing", label: "در حال پردازش" },
  { value: "retrying", label: "در انتظار Retry" },
  { value: "stale_claim", label: "Claim منقضی" },
  { value: "dead_letter", label: "Dead-letter" },
  { value: "delivered", label: "تحویل‌شده" },
];

const stateLabels: Record<string, string> = {
  pending: "در صف",
  processing: "در حال پردازش",
  retrying: "Retry",
  stale_claim: "Claim منقضی",
  dead_letter: "Dead-letter",
  delivered: "تحویل‌شده",
};

const stateClasses: Record<string, string> = {
  pending: "bg-sky-500/15 text-sky-300",
  processing: "bg-violet-500/15 text-violet-300",
  retrying: "bg-amber-500/15 text-amber-300",
  stale_claim: "bg-orange-500/15 text-orange-300",
  dead_letter: "bg-rose-500/15 text-rose-300",
  delivered: "bg-emerald-500/15 text-emerald-300",
};

function fmt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fa-IR");
}

function errorText(code?: string, fallback?: string) {
  const messages: Record<string, string> = {
    COMMERCE_OUTBOX_IN_FLIGHT: "این رویداد همین حالا توسط Worker در حال پردازش است و قابل بازیابی دستی نیست.",
    COMMERCE_OUTBOX_REQUEUE_REASON_REQUIRED: "برای فعال‌کردن دوباره Dead-letter باید دلیل عملیاتی وارد شود.",
    COMMERCE_OUTBOX_ALREADY_DELIVERED: "این رویداد قبلاً با موفقیت تحویل شده است.",
    COMMERCE_OUTBOX_DEAD_LETTERED: "برای این رویداد باید از Requeue استفاده شود، نه Retry.",
    COMMERCE_OUTBOX_NOT_DEAD_LETTERED: "این رویداد در Dead-letter نیست.",
    COMMERCE_OUTBOX_EVENT_NOT_FOUND: "رویداد پیدا نشد یا متعلق به Workspace فعلی نیست.",
  };
  return (code && messages[code]) || fallback || code || "عملیات ناموفق بود.";
}

export default function CommerceOutboxOperationsPanel() {
  const [summary, setSummary] = useState<OutboxSummary | null>(null);
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [filter, setFilter] = useState<OutboxState>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async (state: OutboxState = filter) => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/business-builder/commerce/outbox?state=${encodeURIComponent(state)}&limit=100`);
      if (response.status === 403) {
        setForbidden(true);
        setEvents([]);
        setSummary(null);
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || "Commerce outbox query failed");
      setForbidden(false);
      setSummary(data.summary || null);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "دریافت وضعیت Commerce ناموفق بود." });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setReason("");
    try {
      const response = await apiFetch(`/api/business-builder/commerce/outbox/${encodeURIComponent(id)}/reconciliation`);
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(errorText(data?.code, data?.message));
      setReconciliation(data.reconciliation || null);
    } catch (error) {
      setReconciliation(null);
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "دریافت Reconciliation ناموفق بود." });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  const selected = useMemo(
    () => reconciliation?.event || events.find((event) => event.id === selectedId) || null,
    [events, reconciliation, selectedId],
  );

  async function mutate(action: "retry" | "requeue") {
    if (!selected) return;
    if (action === "requeue" && !reason.trim()) {
      setNotice({ kind: "error", text: "برای Requeue کردن Dead-letter دلیل عملیاتی را وارد کنید." });
      return;
    }
    setMutating(true);
    setNotice(null);
    try {
      const response = await apiFetch(`/api/business-builder/commerce/outbox/${encodeURIComponent(selected.id)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = (await response.json()) as { success?: boolean } & ApiError;
      if (!response.ok || !data.success) throw new Error(errorText(data.code, data.message));
      setNotice({ kind: "ok", text: action === "requeue" ? "رویداد با ثبت سابقه بازیابی دوباره فعال شد." : "رویداد برای Retry آماده شد." });
      setReason("");
      await load(filter);
      await loadDetail(selected.id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "عملیات بازیابی ناموفق بود." });
      await load(filter);
      await loadDetail(selected.id);
    } finally {
      setMutating(false);
    }
  }

  if (forbidden) {
    return <section className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-sm text-amber-200">مانیتورینگ و بازیابی Commerce فقط برای Owner و Admin فعال Workspace در دسترس است.</section>;
  }

  const cards: Array<[string, number | undefined, string]> = [
    ["در صف", summary?.pending, "pending"],
    ["در حال پردازش", summary?.processing, "processing"],
    ["Retry", summary?.retrying, "retrying"],
    ["Claim منقضی", summary?.staleClaim, "stale_claim"],
    ["Dead-letter", summary?.deadLetter, "dead_letter"],
    ["تحویل‌شده", summary?.delivered, "delivered"],
  ];

  return <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs text-slate-500">COMMERCE OUTBOX</p>
        <h2 className="mt-1 text-lg font-semibold">مانیتورینگ و بازیابی همگام‌سازی</h2>
        <p className="mt-1 text-sm text-slate-400">وضعیت انتقال رویدادهای فروشگاه به CRM، حسابداری و Analytics</p>
      </div>
      <button type="button" onClick={() => void load(filter)} disabled={loading} className="rounded-xl border border-slate-700 px-4 py-2 text-xs disabled:opacity-50">{loading ? "در حال دریافت…" : "به‌روزرسانی"}</button>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(([label, value, state]) => <button type="button" key={state} onClick={() => setFilter(state as OutboxState)} className={`rounded-xl border p-3 text-right transition ${filter === state ? "border-slate-500 bg-slate-800" : "border-slate-800 bg-slate-950/50"}`}>
        <b className="text-xl">{value ?? "—"}</b><p className="mt-1 text-[11px] text-slate-500">{label}</p>
      </button>)}
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {states.map((state) => <button type="button" key={state.value} onClick={() => setFilter(state.value)} className={`rounded-full px-3 py-1.5 text-xs ${filter === state.value ? "bg-white text-slate-950" : "bg-slate-800 text-slate-300"}`}>{state.label}</button>)}
    </div>

    {notice && <div className={`mt-4 rounded-xl border p-3 text-sm ${notice.kind === "ok" ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-200" : "border-rose-900/50 bg-rose-950/20 text-rose-200"}`}>{notice.text}</div>}

    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-right text-xs">
        <thead className="bg-slate-950/80 text-slate-500"><tr><th className="p-3">وضعیت</th><th className="p-3">Event</th><th className="p-3">Order</th><th className="p-3">Attempts</th><th className="p-3">زمان / Lease</th><th className="p-3">خطا</th><th className="p-3" /></tr></thead>
        <tbody>{events.map((event) => <tr key={event.id} className="border-t border-slate-800 bg-slate-900/40 align-top">
          <td className="p-3"><span className={`rounded-full px-2 py-1 ${stateClasses[event.operational_state] || "bg-slate-800 text-slate-300"}`}>{stateLabels[event.operational_state] || event.operational_state}</span></td>
          <td className="p-3"><div className="font-medium text-slate-200">{event.event_type}</div><div className="mt-1 max-w-52 truncate text-slate-500" title={event.event_id}>{event.event_id}</div></td>
          <td className="p-3 text-slate-400">{event.order_id || "—"}</td>
          <td className="p-3 text-slate-300">{event.attempts}</td>
          <td className="p-3 text-slate-500"><div>Available: {fmt(event.available_at)}</div>{event.claim_expires_at && <div className="mt-1">Lease: {fmt(event.claim_expires_at)}</div>}</td>
          <td className="p-3"><div className="max-w-72 whitespace-normal text-rose-300">{event.dead_letter_reason || event.last_error || "—"}</div></td>
          <td className="p-3"><button type="button" onClick={() => void loadDetail(event.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200">جزئیات</button></td>
        </tr>)}</tbody>
      </table>
      {!loading && events.length === 0 && <div className="p-6 text-center text-sm text-slate-500">رویدادی در این وضعیت وجود ندارد.</div>}
    </div>

    {selectedId && <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">RECONCILIATION</p><h3 className="mt-1 font-medium">{selected?.event_type || selectedId}</h3><p className="mt-1 text-xs text-slate-500">{selected?.event_id}</p></div><button type="button" onClick={() => { setSelectedId(null); setReconciliation(null); setReason(""); }} className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs">بستن</button></div>
      {detailLoading ? <p className="mt-4 text-sm text-slate-500">در حال دریافت جزئیات…</p> : reconciliation && <>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {reconciliation.consumers.map((consumer) => <div key={consumer.consumer} className="rounded-xl bg-slate-900 p-3"><div className="flex items-center justify-between"><b className="text-sm uppercase">{consumer.consumer}</b><span className={consumer.status === "processed" ? "text-emerald-300" : "text-amber-300"}>{consumer.status === "processed" ? "پردازش‌شده" : "باقی‌مانده"}</span></div><p className="mt-2 text-[11px] text-slate-500">{fmt(consumer.processedAt)}</p></div>)}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 p-4 text-sm"><h4 className="font-medium">Lease</h4><div className="mt-3 space-y-2 text-xs text-slate-400"><p>State: <b className="text-slate-200">{reconciliation.lease.state}</b></p><p>Expires: {fmt(reconciliation.lease.expiresAt)}</p><p>بازیابی دستی: <b className={reconciliation.lease.retrySafeNow ? "text-emerald-300" : "text-amber-300"}>{reconciliation.lease.retrySafeNow ? "ایمن" : "قفل‌شده تا پایان پردازش"}</b></p></div></div>
          <div className="rounded-xl border border-slate-800 p-4 text-sm"><h4 className="font-medium">نتیجه مصرف‌کننده‌ها</h4><div className="mt-3 text-xs text-slate-400"><p>{reconciliation.processed} از {reconciliation.consumers.length} مصرف‌کننده تکمیل شده.</p>{reconciliation.missing.length > 0 && <p className="mt-2 text-amber-300">باقی‌مانده: {reconciliation.missing.join("، ")}</p>}</div></div>
        </div>

        {(selected?.operational_state === "dead_letter" || selected?.operational_state === "retrying" || selected?.operational_state === "stale_claim" || selected?.operational_state === "pending") && <div className="mt-4 rounded-xl border border-slate-800 p-4">
          <h4 className="font-medium">بازیابی دستی</h4>
          {selected?.operational_state === "dead_letter" && <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="دلیل Requeue را بنویسید؛ مثلاً mapping حسابداری اصلاح شد." className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm outline-none placeholder:text-slate-600" />}
          <div className="mt-3 flex flex-wrap gap-2">
            {selected?.operational_state === "dead_letter" ? <button type="button" disabled={mutating || !reconciliation.lease.retrySafeNow || !reason.trim()} onClick={() => void mutate("requeue")} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{mutating ? "در حال اجرا…" : "Requeue با ثبت دلیل"}</button> : <button type="button" disabled={mutating || !reconciliation.lease.retrySafeNow} onClick={() => void mutate("retry")} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40">{mutating ? "در حال اجرا…" : "Retry امن"}</button>}
          </div>
        </div>}

        <div className="mt-4 rounded-xl border border-slate-800 p-4"><h4 className="font-medium">سابقه بازیابی</h4>{reconciliation.recoveryHistory.length === 0 ? <p className="mt-3 text-xs text-slate-500">اقدام دستی ثبت‌شده‌ای وجود ندارد.</p> : <div className="mt-3 space-y-2">{reconciliation.recoveryHistory.map((entry) => <div key={entry.id} className="rounded-lg bg-slate-900 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-slate-200">{entry.action === "commerce_outbox.requeue" ? "Requeue" : "Retry"} · {entry.actorId || "system"}</span><span className="text-slate-500">{fmt(entry.createdAt)}</span></div>{entry.metadata.reason && <p className="mt-2 text-slate-400">{entry.metadata.reason}</p>}</div>)}</div>}</div>
      </>}
    </div>}
  </section>;
}
