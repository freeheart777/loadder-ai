import { useCallback, useEffect, useState } from "react";
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

type Props = {
  counters?: {
    active: number;
    disabled: number;
    publishedUnbound: number;
    publishedDisabled: number;
  };
};

const healthLabel: Record<BindingDiagnostic["health"], string> = {
  critical: "نیازمند اقدام",
  warning: "هشدار",
  healthy: "سالم",
  info: "اطلاعات",
};

const healthClass: Record<BindingDiagnostic["health"], string> = {
  critical: "border-rose-900/60 bg-rose-950/20 text-rose-200",
  warning: "border-amber-900/60 bg-amber-950/20 text-amber-200",
  healthy: "border-emerald-900/50 bg-emerald-950/10 text-emerald-200",
  info: "border-slate-800 bg-slate-950/40 text-slate-300",
};

const issueText: Record<string, string> = {
  PUBLISHED_STORE_UNBOUND: "فروشگاه منتشر شده اما به App Builder متصل نیست.",
  PUBLISHED_STORE_BINDING_DISABLED: "فروشگاه منتشر شده اما Binding آن غیرفعال است.",
  DRAFT_STORE_UNBOUND: "فروشگاه هنوز منتشر نشده و Binding ندارد.",
  STORE_BINDING_DISABLED: "Binding این فروشگاه غیرفعال است.",
};

function fmt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fa-IR");
}

export default function CommerceBindingDiagnosticsPanel({ counters }: Props) {
  const [rows, setRows] = useState<BindingDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/business-builder/commerce/bindings?limit=100");
      if (response.status === 403) {
        setForbidden(true);
        setRows([]);
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || "Commerce binding diagnostics failed");
      setForbidden(false);
      setRows(Array.isArray(data.bindings) ? data.bindings : []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "دریافت جزئیات Binding ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs text-slate-500">STORE ↔ APP BUILDER</p>
        <h2 className="mt-1 font-medium">سلامت و جزئیات Binding فروشگاه</h2>
        <p className="mt-1 text-sm text-slate-400">مشخص می‌کند کدام Store به کدام اپ متصل است و کدام اتصال نیاز به اقدام دارد.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-700 px-4 py-2 text-xs disabled:opacity-50">{loading ? "در حال دریافت…" : "به‌روزرسانی"}</button>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl bg-slate-950/60 p-4"><b className="text-2xl">{counters?.active ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Binding فعال</p></div>
      <div className="rounded-xl bg-slate-950/60 p-4"><b className="text-2xl">{counters?.disabled ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Binding غیرفعال</p></div>
      <div className="rounded-xl bg-slate-950/60 p-4"><b className={counters?.publishedUnbound ? "text-2xl text-rose-300" : "text-2xl"}>{counters?.publishedUnbound ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Store منتشرشده بدون Binding</p></div>
      <div className="rounded-xl bg-slate-950/60 p-4"><b className={counters?.publishedDisabled ? "text-2xl text-amber-300" : "text-2xl"}>{counters?.publishedDisabled ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Store منتشرشده با Binding غیرفعال</p></div>
    </div>

    {forbidden && <div className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-200">جزئیات Binding فقط برای Owner و Admin فعال Workspace قابل مشاهده است.</div>}
    {error && <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</div>}

    {!forbidden && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-right text-xs">
        <thead className="bg-slate-950/80 text-slate-500"><tr><th className="p-3">سلامت</th><th className="p-3">Store</th><th className="p-3">وضعیت Store</th><th className="p-3">Binding</th><th className="p-3">App Builder مقصد</th><th className="p-3">آخرین تغییر</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.siteProjectId} className="border-t border-slate-800 bg-slate-900/40 align-top">
          <td className="p-3"><span className={`inline-flex rounded-full border px-2 py-1 ${healthClass[row.health]}`}>{healthLabel[row.health]}</span>{row.issue && <p className="mt-2 max-w-64 whitespace-normal text-[11px] text-slate-500">{issueText[row.issue] || row.issue}</p>}</td>
          <td className="p-3"><div className="font-medium text-slate-200">{row.siteName}</div><div className="mt-1 text-slate-500">/{row.siteSlug}</div><div className="mt-1 max-w-52 truncate text-[10px] text-slate-600" title={row.siteProjectId}>{row.siteProjectId}</div></td>
          <td className="p-3"><span className={row.published ? "text-emerald-300" : "text-slate-400"}>{row.siteStatus}</span></td>
          <td className="p-3"><span className={row.bindingState === "active" ? "text-emerald-300" : row.bindingState === "disabled" ? "text-amber-300" : "text-rose-300"}>{row.bindingState === "active" ? "فعال" : row.bindingState === "disabled" ? "غیرفعال" : "بدون اتصال"}</span></td>
          <td className="p-3">{row.businessBuilderProjectId ? <><div className="font-medium text-slate-200">{row.businessBuilderProjectName || row.businessBuilderProjectId}</div><div className="mt-1 text-slate-500">{row.businessBuilderProjectStatus || "—"}</div><div className="mt-1 max-w-52 truncate text-[10px] text-slate-600" title={row.businessBuilderProjectId}>{row.businessBuilderProjectId}</div></> : <span className="text-slate-500">—</span>}</td>
          <td className="p-3 text-slate-500">{fmt(row.bindingUpdatedAt)}</td>
        </tr>)}</tbody>
      </table>
      {!loading && rows.length === 0 && !error && <div className="p-6 text-center text-sm text-slate-500">Storeای برای Workspace فعلی وجود ندارد.</div>}
    </div>}
  </section>;
}
