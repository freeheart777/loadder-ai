import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CommerceBindingDiagnosticsPanel from "../components/business-builder/CommerceBindingDiagnosticsPanel";
import CommerceOutboxOperationsPanel from "../components/business-builder/CommerceOutboxOperationsPanel";
import { apiFetch } from "../lib/api";

type Summary = {
  projects: number;
  deployments: number;
  failedDeployments: number;
  pendingActions: number;
  runtimeRecords: number;
  members: number;
  commerceOutbox?: { total: number; pending: number; retrying: number; deadLetter: number; delivered: number; claimedActive: number; claimedStale: number; };
  commerceBindings?: { active: number; disabled: number; publishedUnbound: number; publishedDisabled: number; };
};

export default function BusinessBuilderOperationsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const loadSummary = useCallback(async () => {
    try {
      const response = await apiFetch("/api/business-builder/operations");
      const data = response.ok ? await response.json() : null;
      setSummary(data?.summary || null);
    } catch { setSummary(null); }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const cards: Array<[string, number | undefined]> = [
    ["اپ‌ها", summary?.projects], ["استقرارها", summary?.deployments], ["استقرار ناموفق", summary?.failedDeployments],
    ["تأییدهای معلق", summary?.pendingActions], ["رکوردهای عملیاتی", summary?.runtimeRecords], ["اعضای فعال", summary?.members],
  ];

  return <main dir="rtl" className="min-h-screen bg-slate-950 p-6 text-white">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">عملیات اپ‌بیلدر</h1><p className="mt-1 text-sm text-slate-400">وضعیت واقعی ساخت، اجرا، انتشار و همگام‌سازی Commerce در یک نگاه</p></div>
        <div className="flex gap-2"><Link to="/dashboard/business-builder" className="rounded-xl bg-white px-4 py-2 text-sm text-slate-950">ساخت اپ</Link><Link to="/dashboard/business-builder/admin" className="rounded-xl border border-slate-700 px-4 py-2 text-sm">ادمین</Link></div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label,value])=><div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-3xl font-semibold">{value ?? "—"}</div></div>)}</section>

      <CommerceBindingDiagnosticsPanel counters={summary?.commerceBindings} onChanged={loadSummary} />
      <CommerceOutboxOperationsPanel />

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="font-medium">اصل لودر</h2><p className="mt-2 text-sm leading-6 text-slate-400">موتور می‌سازد، AI راهنمایی می‌کند. این داشبورد فقط داده‌ای را نشان می‌دهد که از Runtime، Deployment، Commerce و Governance واقعی آمده باشد.</p></section>
    </div>
  </main>;
}
