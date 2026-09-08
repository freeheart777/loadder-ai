import { useEffect, useState } from "react";

type CountMetric = { total?: number; active?: number; evidence?: string };
type StatusMetric = { status?: string; reason?: string };
type WorkspaceTelemetry = {
  id: string;
  name: string;
  slug: string;
  status: string;
  dealCount: number;
  openDealCount: number;
  wonCount: number;
  lostCount: number;
  stuckDealCount: number;
  pipelineValue: number;
  winRate: number;
  lastCrmActivity?: string | null;
  pendingAutomationEvents?: number | null;
  engagement: { status: string; reason: string; inactiveDays?: number | null };
};
type CrmTelemetry = {
  status: string;
  evidence?: string;
  totals?: {
    dealCount: number;
    openDealCount: number;
    wonCount: number;
    lostCount: number;
    stuckCount: number;
    pipelineValue: number;
    crmWorkspaceCount: number;
    latestCrmActivity?: string | null;
    winRate: number;
  } | null;
  automation?: {
    status: string;
    pendingEvents?: number | null;
    actionCount?: number | null;
    pendingActionCount?: number | null;
  };
  workspaces?: WorkspaceTelemetry[];
};
type Overview = {
  users?: CountMetric;
  workspaces?: CountMetric;
  sessions?: { active?: number; evidence?: string };
  crm?: CrmTelemetry;
  projects?: StatusMetric;
  readiness?: StatusMetric;
};

type AdminResponse = {
  success: boolean;
  mode?: string;
  roles?: string[];
  overview?: Overview;
  code?: string;
  message?: string;
};

function MetricCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5 shadow-sm">
    <div className="text-xs font-bold text-white/50">{title}</div>
    <div className="mt-2 text-3xl font-black tracking-tight text-white">{value}</div>
    {hint ? <div className="mt-2 text-xs leading-5 text-white/40">{hint}</div> : null}
  </div>;
}

function StatusPanel({ title, metric }: { title: string; metric?: StatusMetric }) {
  const status = metric?.status || "unknown";
  const blocked = status === "blocked" || status === "error";
  const healthy = status === "healthy" || status === "ready";
  const tone = blocked
    ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
    : healthy
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : "border-amber-400/20 bg-amber-400/10 text-amber-100";

  return <div className={`rounded-2xl border p-5 ${tone}`}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-black text-white">{title}</h2>
      <span className="rounded-full border border-current/20 px-3 py-1 text-[11px] font-black uppercase tracking-wide">{status}</span>
    </div>
    <p className="mt-3 text-xs leading-6 opacity-70">{metric?.reason || "منبع معتبر هنوز به این نما متصل نشده است."}</p>
  </div>;
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString("fa-IR")} تومان`;
}

function engagementTone(status: string) {
  if (status === "healthy") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "attention") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[.04] text-white/50";
}

export default function PlatformAdminPage() {
  const [data, setData] = useState<AdminResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/platform-admin/overview", { credentials:"include" });
        const body = await response.json().catch(() => ({})) as AdminResponse;
        if (!response.ok) throw new Error(body.message || body.code || "دسترسی به پنل مدیریت پلتفرم ممکن نیست.");
        if (active) setData(body);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "خطای نامشخص در پنل مدیریت.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const crm = data?.overview?.crm;
  const crmTotals = crm?.totals;
  const attentionCount = (crm?.workspaces || []).filter((workspace) => workspace.engagement.status === "attention").length;

  return <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-black tracking-[.2em] text-emerald-300">LOADDER INTERNAL CONTROL PLANE</div>
          <h1 className="mt-2 text-3xl font-black">مرکز فرمان پلتفرم لودر</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">نمای read-only از وضعیت پلتفرم، CRM و Automation. سیگنال‌های بدون evidence به‌صورت unknown نمایش داده می‌شوند و با صفر جعلی جایگزین نمی‌شوند.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-200">READ ONLY</span>
          <span className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-2 text-xs font-bold text-white/60">COMMAND CENTER</span>
        </div>
      </header>

      {loading ? <div className="rounded-2xl border border-white/10 bg-white/[.03] p-6 text-sm text-white/50">در حال دریافت وضعیت پلتفرم…</div> : null}
      {error ? <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-sm leading-7 text-rose-100"><strong className="ml-2">ANDON:</strong>{error}</div> : null}

      {data?.overview ? <>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span>سطح دسترسی:</span>
          {(data.roles || []).map((role) => <span key={role} className="rounded-full bg-white/10 px-3 py-1 font-bold text-white/70">{role}</span>)}
        </div>

        <section aria-label="Platform metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="کل کاربران" value={data.overview.users?.total ?? "ناموجود"} hint={data.overview.users?.evidence} />
          <MetricCard title="کاربران فعال" value={data.overview.users?.active ?? "ناموجود"} hint={data.overview.users?.evidence} />
          <MetricCard title="فضاهای کاری فعال" value={data.overview.workspaces?.active ?? "ناموجود"} hint={data.overview.workspaces?.evidence} />
          <MetricCard title="نشست‌های فعال" value={data.overview.sessions?.active ?? "ناموجود"} hint={data.overview.sessions?.evidence} />
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-black tracking-[.15em] text-cyan-300">CRM / SALES OBSERVABILITY</div>
              <h2 className="mt-2 text-xl font-black">سلامت Pipeline مشتریان</h2>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${crm?.status === "available" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{crm?.status || "unknown"}</span>
          </div>

          {crm?.status === "available" && crmTotals ? <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Dealهای باز" value={crmTotals.openDealCount.toLocaleString("fa-IR")} hint={`${crmTotals.dealCount.toLocaleString("fa-IR")} Deal کل`} />
              <MetricCard title="Win Rate" value={`${crmTotals.winRate.toLocaleString("fa-IR")}%`} hint={`${crmTotals.wonCount.toLocaleString("fa-IR")} برد / ${crmTotals.lostCount.toLocaleString("fa-IR")} شکست`} />
              <MetricCard title="ارزش Pipeline" value={money(crmTotals.pipelineValue)} hint={`${crmTotals.crmWorkspaceCount.toLocaleString("fa-IR")} Workspace دارای CRM`} />
              <MetricCard title="Workspace نیازمند توجه" value={attentionCount.toLocaleString("fa-IR")} hint={`${crmTotals.stuckCount.toLocaleString("fa-IR")} Deal متوقف‌شده`} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <MetricCard title="Automation Event معلق" value={crm.automation?.pendingEvents ?? "ناموجود"} hint={crm.automation?.status} />
              <MetricCard title="Automation Action" value={crm.automation?.actionCount ?? "ناموجود"} hint="follow-up / onboarding / invoice / analysis" />
              <MetricCard title="Action در انتظار" value={crm.automation?.pendingActionCount ?? "ناموجود"} hint="برای worker یا handoff بعدی" />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
              <div className="border-b border-white/10 px-5 py-4">
                <h3 className="text-sm font-black">Workspace CRM Signals</h3>
                <p className="mt-1 text-xs text-white/40">Attention فقط از stuck-heavy pipeline یا ۱۴+ روز بی‌فعالیتی روی Deal باز ساخته می‌شود؛ این برچسب هنوز پیش‌بینی churn نیست.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-right text-xs">
                  <thead className="bg-white/[.035] text-white/40"><tr><th className="px-4 py-3">Workspace</th><th className="px-4 py-3">Deals</th><th className="px-4 py-3">Open</th><th className="px-4 py-3">Win Rate</th><th className="px-4 py-3">Stuck</th><th className="px-4 py-3">Automation</th><th className="px-4 py-3">Signal</th></tr></thead>
                  <tbody className="divide-y divide-white/[.06]">
                    {(crm.workspaces || []).map((workspace) => <tr key={workspace.id} className="text-white/70">
                      <td className="px-4 py-3"><div className="font-bold text-white">{workspace.name}</div><div className="mt-1 text-[11px] text-white/35">{workspace.slug}</div></td>
                      <td className="px-4 py-3">{workspace.dealCount.toLocaleString("fa-IR")}</td>
                      <td className="px-4 py-3">{workspace.openDealCount.toLocaleString("fa-IR")}</td>
                      <td className="px-4 py-3">{workspace.winRate.toLocaleString("fa-IR")}%</td>
                      <td className="px-4 py-3">{workspace.stuckDealCount.toLocaleString("fa-IR")}</td>
                      <td className="px-4 py-3">{workspace.pendingAutomationEvents ?? "—"}</td>
                      <td className="px-4 py-3"><span title={workspace.engagement.reason} className={`rounded-full border px-2.5 py-1 font-bold ${engagementTone(workspace.engagement.status)}`}>{workspace.engagement.status}</span></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </> : <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100">CRM telemetry هنوز evidence قابل اتکا ندارد: {crm?.evidence || "منبع initialize نشده است."}</div>}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <StatusPanel title="پروژه‌ها" metric={data.overview.projects} />
          <StatusPanel title="آمادگی پلتفرم" metric={data.overview.readiness} />
        </section>
      </> : null}
    </div>
  </main>;
}
