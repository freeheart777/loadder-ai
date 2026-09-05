import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CommerceOutboxOperationsPanel from "../components/business-builder/CommerceOutboxOperationsPanel";
import { apiFetch } from "../lib/api";

type Summary = {
  projects: number;
  deployments: number;
  failedDeployments: number;
  pendingActions: number;
  runtimeRecords: number;
  members: number;
  commerceOutbox?: {
    total: number;
    pending: number;
    retrying: number;
    deadLetter: number;
    delivered: number;
    claimedActive: number;
    claimedStale: number;
  };
  commerceBindings?: {
    active: number;
    disabled: number;
    publishedUnbound: number;
    publishedDisabled: number;
  };
};

export default function BusinessBuilderOperationsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    apiFetch("/api/business-builder/operations")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setSummary(data?.summary || null))
      .catch(() => setSummary(null));
  }, []);

  const cards: Array<[string, number | undefined]> = [
    ["اپ‌ها", summary?.projects],
    ["استقرارها", summary?.deployments],
    ["استقرار ناموفق", summary?.failedDeployments],
    ["تأییدهای معلق", summary?.pendingActions],
    ["رکوردهای عملیاتی", summary?.runtimeRecords],
    ["اعضای فعال", summary?.members],
  ];

  return <main dir="rtl" className="min-h-screen bg-slate-950 p-6 text-white">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">عملیات اپ‌بیلدر</h1>
          <p className="mt-1 text-sm text-slate-400">وضعیت واقعی ساخت، اجرا، انتشار و همگام‌سازی Commerce در یک نگاه</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/business-builder" className="rounded-xl bg-white px-4 py-2 text-sm text-slate-950">ساخت اپ</Link>
          <Link to="/dashboard/business-builder/admin" className="rounded-xl border border-slate-700 px-4 py-2 text-sm">ادمین</Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-sm text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold">{value ?? "—"}</div>
        </div>)}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">STORE ↔ APP BUILDER</p>
            <h2 className="mt-1 font-medium">سلامت Binding فروشگاه</h2>
          </div>
          <Link to="/dashboard/business-builder/admin" className="text-xs text-slate-400 underline underline-offset-4">جزئیات سلامت سیستم</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-950/60 p-4"><b className="text-2xl">{summary?.commerceBindings?.active ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Binding فعال</p></div>
          <div className="rounded-xl bg-slate-950/60 p-4"><b className="text-2xl">{summary?.commerceBindings?.disabled ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Binding غیرفعال</p></div>
          <div className="rounded-xl bg-slate-950/60 p-4"><b className={summary?.commerceBindings?.publishedUnbound ? "text-2xl text-rose-300" : "text-2xl"}>{summary?.commerceBindings?.publishedUnbound ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Store منتشرشده بدون Binding</p></div>
          <div className="rounded-xl bg-slate-950/60 p-4"><b className={summary?.commerceBindings?.publishedDisabled ? "text-2xl text-amber-300" : "text-2xl"}>{summary?.commerceBindings?.publishedDisabled ?? "—"}</b><p className="mt-1 text-xs text-slate-500">Store منتشرشده با Binding غیرفعال</p></div>
        </div>
      </section>

      <CommerceOutboxOperationsPanel />

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="font-medium">اصل لودر</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">موتور می‌سازد، AI راهنمایی می‌کند. این داشبورد فقط داده‌ای را نشان می‌دهد که از Runtime، Deployment، Commerce و Governance واقعی آمده باشد.</p>
      </section>
    </div>
  </main>;
}
