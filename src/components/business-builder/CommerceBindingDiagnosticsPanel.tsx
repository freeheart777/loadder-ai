import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type BindingDiagnostic = {
  siteProjectId: string;
  siteName: string;
  siteSlug: string;
  siteStatus: string;
  published: boolean;
  bindingId: string | null;
  bindingState: "active" | "disabled" | "unbound" | string;
  bindingUpdatedAt: string | null;
  businessBuilderProjectId: string | null;
  businessBuilderProjectName: string | null;
  businessBuilderProjectStatus: string | null;
  health: "critical" | "warning" | "healthy" | "info";
  issue: string | null;
};

type BindingTarget = {
  id: string;
  name: string;
  status: string;
  activeVersionId: string | null;
  eligible: boolean;
};

type Props = {
  counters?: {
    active: number;
    disabled: number;
    publishedUnbound: number;
    publishedDisabled: number;
  };
  onChanged?: () => void | Promise<void>;
};

const healthLabel: Record<BindingDiagnostic["health"], string> = { critical: "نیازمند اقدام", warning: "هشدار", healthy: "سالم", info: "اطلاعات" };
const healthClass: Record<BindingDiagnostic["health"], string> = { critical: "border-rose-900/60 bg-rose-950/20 text-rose-200", warning: "border-amber-900/60 bg-amber-950/20 text-amber-200", healthy: "border-emerald-900/50 bg-emerald-950/10 text-emerald-200", info: "border-slate-800 bg-slate-950/40 text-slate-300" };
const issueText: Record<string, string> = {
  PUBLISHED_STORE_UNBOUND: "فروشگاه منتشر شده اما به App Builder متصل نیست.",
  PUBLISHED_STORE_BINDING_DISABLED: "فروشگاه منتشر شده اما Binding آن غیرفعال است.",
  DRAFT_STORE_UNBOUND: "فروشگاه هنوز منتشر نشده و Binding ندارد.",
  STORE_BINDING_DISABLED: "Binding این فروشگاه غیرفعال است.",
};
const errorText: Record<string,string> = {
  COMMERCE_STORE_NOT_FOUND: "Store پیدا نشد یا متعلق به Workspace فعلی نیست.",
  COMMERCE_BINDING_TARGET_NOT_FOUND: "App Builder انتخاب‌شده پیدا نشد یا متعلق به Workspace فعلی نیست.",
  COMMERCE_BINDING_TARGET_ARCHIVED: "App آرشیوشده قابل اتصال نیست.",
  COMMERCE_BINDING_TARGET_NOT_RUNNABLE: "این App هنوز Active Version ندارد و قابل اتصال عملیاتی نیست.",
  COMMERCE_BINDING_REBIND_CONFIRMATION_REQUIRED: "تغییر App مقصد نیاز به تأیید صریح دارد.",
  COMMERCE_BINDING_REBIND_REASON_REQUIRED: "برای تغییر App مقصد باید دلیل عملیاتی ثبت شود.",
};

function fmt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fa-IR");
}

function mutationError(data: any) {
  if (data?.code === "COMMERCE_BINDING_OUTBOX_NOT_DRAINED") {
    const count = Number(data?.unresolvedOutbox?.count || 0);
    return `${count.toLocaleString("fa-IR")} event حل‌نشده هنوز به App قبلی متصل است. ابتدا در بخش Commerce Outbox پایین صفحه آن‌ها را drain/reconcile کنید و سپس تغییر اتصال را دوباره انجام دهید.`;
  }
  return errorText[data?.code] || data?.message || data?.code || "Binding update failed";
}

export default function CommerceBindingDiagnosticsPanel({ counters, onChanged }: Props) {
  const [rows, setRows] = useState<BindingDiagnostic[]>([]);
  const [targets, setTargets] = useState<BindingTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<BindingDiagnostic | null>(null);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmRebind, setConfirmRebind] = useState(false);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bindingsResponse, targetsResponse] = await Promise.all([
        apiFetch("/api/business-builder/commerce/bindings?limit=100"),
        apiFetch("/api/business-builder/commerce/binding-targets?limit=100"),
      ]);
      if (bindingsResponse.status === 403 || targetsResponse.status === 403) {
        setForbidden(true); setRows([]); setTargets([]); return;
      }
      const bindingsData = await bindingsResponse.json();
      const targetsData = await targetsResponse.json();
      if (!bindingsResponse.ok || !bindingsData?.success) throw new Error(bindingsData?.message || "Commerce binding diagnostics failed");
      if (!targetsResponse.ok || !targetsData?.success) throw new Error(targetsData?.message || "Commerce binding targets failed");
      setForbidden(false);
      setRows(Array.isArray(bindingsData.bindings) ? bindingsData.bindings : []);
      setTargets(Array.isArray(targetsData.targets) ? targetsData.targets : []);
    } catch (err) {
      setRows([]); setTargets([]);
      setError(err instanceof Error ? err.message : "دریافت جزئیات Binding ناموفق بود.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedTarget = useMemo(() => targets.find(target => target.id === targetProjectId) || null, [targets, targetProjectId]);
  const isRebind = Boolean(editing?.businessBuilderProjectId && targetProjectId && editing.businessBuilderProjectId !== targetProjectId);
  const canSubmit = Boolean(editing && selectedTarget?.eligible && (!isRebind || (confirmRebind && reason.trim())) && !mutating);

  function beginRemediation(row: BindingDiagnostic) {
    setEditing(row);
    setTargetProjectId(row.businessBuilderProjectId || "");
    setReason("");
    setConfirmRebind(false);
    setNotice(null);
  }

  function closeRemediation() {
    setEditing(null); setTargetProjectId(""); setReason(""); setConfirmRebind(false);
  }

  async function applyBinding() {
    if (!editing || !selectedTarget || !canSubmit) return;
    setMutating(true); setError(null); setNotice(null);
    try {
      const response = await apiFetch(`/api/business-builder/commerce/bindings/${encodeURIComponent(editing.siteProjectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedTarget.id, confirmRebind: isRebind && confirmRebind, reason: reason.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(mutationError(data));
      setNotice(data.changed === false ? "Binding از قبل فعال بود و تغییری لازم نشد." : isRebind ? "App مقصد با ثبت Audit تغییر کرد." : editing.bindingState === "disabled" ? "Binding دوباره فعال شد." : "Store با موفقیت به App Builder متصل شد.");
      closeRemediation();
      await load();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "به‌روزرسانی Binding ناموفق بود.");
      await load();
      await onChanged?.();
    } finally { setMutating(false); }
  }

  return <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs text-slate-500">STORE ↔ APP BUILDER</p><h2 className="mt-1 font-medium">سلامت و جزئیات Binding فروشگاه</h2><p className="mt-1 text-sm text-slate-400">اتصال Store به App Builder را مشاهده و در صورت نیاز با guardهای امن اصلاح کنید.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-700 px-4 py-2 text-xs disabled:opacity-50">{loading ? "در حال دریافت…" : "به‌روزرسانی"}</button>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl bg-slate-950/60 p-4"><b className="text-2xl">{counters?.active ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Binding فعال</p></div>
      <div className="rounded-xl bg-slate-950/60 p-4"><b className="text-2xl">{counters?.disabled ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Binding غیرفعال</p></div>
      <div className="rounded-xl bg-slate-950/60 p-4"><b className={counters?.publishedUnbound ? "text-2xl text-rose-300" : "text-2xl"}>{counters?.publishedUnbound ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Store منتشرشده بدون Binding</p></div>
      <div className="rounded-xl bg-slate-950/60 p-4"><b className={counters?.publishedDisabled ? "text-2xl text-amber-300" : "text-2xl"}>{counters?.publishedDisabled ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Store منتشرشده با Binding غیرفعال</p></div>
    </div>

    {forbidden && <div className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-200">جزئیات و اصلاح Binding فقط برای Owner و Admin فعال Workspace قابل دسترسی است.</div>}
    {error && <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</div>}
    {notice && <div className="mt-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</div>}

    {!forbidden && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-right text-xs">
        <thead className="bg-slate-950/80 text-slate-500"><tr><th className="p-3">سلامت</th><th className="p-3">Store</th><th className="p-3">وضعیت Store</th><th className="p-3">Binding</th><th className="p-3">App Builder مقصد</th><th className="p-3">آخرین تغییر</th><th className="p-3" /></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.siteProjectId} className="border-t border-slate-800 bg-slate-900/40 align-top">
          <td className="p-3"><span className={`inline-flex rounded-full border px-2 py-1 ${healthClass[row.health]}`}>{healthLabel[row.health]}</span>{row.issue && <p className="mt-2 max-w-64 whitespace-normal text-[11px] text-slate-500">{issueText[row.issue] || row.issue}</p>}</td>
          <td className="p-3"><div className="font-medium text-slate-200">{row.siteName}</div><div className="mt-1 text-slate-500">/{row.siteSlug}</div><div className="mt-1 max-w-52 truncate text-[10px] text-slate-600" title={row.siteProjectId}>{row.siteProjectId}</div></td>
          <td className="p-3"><span className={row.published ? "text-emerald-300" : "text-slate-400"}>{row.siteStatus}</span></td>
          <td className="p-3"><span className={row.bindingState === "active" ? "text-emerald-300" : row.bindingState === "disabled" ? "text-amber-300" : "text-rose-300"}>{row.bindingState === "active" ? "فعال" : row.bindingState === "disabled" ? "غیرفعال" : "بدون اتصال"}</span></td>
          <td className="p-3">{row.businessBuilderProjectId ? <><div className="font-medium text-slate-200">{row.businessBuilderProjectName || row.businessBuilderProjectId}</div><div className="mt-1 text-slate-500">{row.businessBuilderProjectStatus || "—"}</div><div className="mt-1 max-w-52 truncate text-[10px] text-slate-600" title={row.businessBuilderProjectId}>{row.businessBuilderProjectId}</div></> : <span className="text-slate-500">—</span>}</td>
          <td className="p-3 text-slate-500">{fmt(row.bindingUpdatedAt)}</td>
          <td className="p-3"><button type="button" onClick={() => beginRemediation(row)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200">{row.bindingState === "unbound" ? "اتصال" : row.bindingState === "disabled" ? "فعال‌سازی" : "مدیریت"}</button></td>
        </tr>)}</tbody>
      </table>
      {!loading && rows.length === 0 && !error && <div className="p-6 text-center text-sm text-slate-500">Storeای برای Workspace فعلی وجود ندارد.</div>}
    </div>}

    {editing && <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">BINDING REMEDIATION</p><h3 className="mt-1 font-medium">{editing.siteName}</h3><p className="mt-1 text-xs text-slate-500">اتصال فعلی: {editing.businessBuilderProjectName || "بدون اتصال"}</p></div><button type="button" onClick={closeRemediation} disabled={mutating} className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs">بستن</button></div>
      <label className="mt-4 block text-xs text-slate-400">App Builder مقصد</label>
      <select value={targetProjectId} onChange={(event)=>{setTargetProjectId(event.target.value);setConfirmRebind(false);setReason("");}} disabled={mutating} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm outline-none">
        <option value="">انتخاب App Builder</option>
        {targets.map(target=><option key={target.id} value={target.id} disabled={!target.eligible}>{target.name} · {target.status}{target.eligible ? "" : " · بدون Active Version"}</option>)}
      </select>
      {selectedTarget && !selectedTarget.eligible && <p className="mt-2 text-xs text-amber-300">این App هنوز Active Version ندارد و نمی‌تواند target عملیاتی Commerce باشد.</p>}
      {isRebind && <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/15 p-4"><p className="text-sm text-rose-200">این انتخاب App مقصد فعلی را تغییر می‌دهد. rebind فقط زمانی انجام می‌شود که Outbox حل‌نشده‌ای برای App قبلی باقی نمانده باشد.</p><textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} rows={3} placeholder="دلیل تغییر اتصال را ثبت کنید." className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm outline-none placeholder:text-slate-600"/><label className="mt-3 flex items-start gap-2 text-xs text-slate-300"><input type="checkbox" checked={confirmRebind} onChange={event=>setConfirmRebind(event.target.checked)} className="mt-0.5"/><span>تأیید می‌کنم که App مقصد این Store عمداً تغییر کند و Audit ثبت شود.</span></label></div>}
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!canSubmit} onClick={()=>void applyBinding()} className={`rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 ${isRebind ? "bg-rose-500 text-white" : "bg-white text-slate-950"}`}>{mutating ? "در حال اعمال…" : isRebind ? "تغییر اتصال با Audit" : editing.bindingState === "disabled" ? "فعال‌سازی Binding" : "اتصال Store"}</button></div>
    </div>}
  </section>;
}
