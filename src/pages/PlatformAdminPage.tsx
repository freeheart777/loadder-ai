import { useEffect, useState } from "react";

type CountMetric = { total?: number; active?: number; evidence?: string };
type StatusMetric = { status?: string; reason?: string };
type Overview = {
  users?: CountMetric;
  workspaces?: CountMetric;
  sessions?: { active?: number; evidence?: string };
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

  return <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-black tracking-[.2em] text-emerald-300">LOADDER INTERNAL CONTROL PLANE</div>
          <h1 className="mt-2 text-3xl font-black">مرکز فرمان پلتفرم لودر</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/50">نسخهٔ اول فقط خواندنی است. وضعیت‌های ناموجود، ناشناخته و خطا از دادهٔ سالم تفکیک می‌شوند.</p>
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

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <StatusPanel title="پروژه‌ها" metric={data.overview.projects} />
          <StatusPanel title="آمادگی پلتفرم" metric={data.overview.readiness} />
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black">گام بعدی مرکز فرمان</h2>
              <p className="mt-2 text-xs leading-6 text-white/40">دایرکتوری کاربران و فضاهای کاری فقط بعد از اتصال API صفحه‌بندی‌شده و redacted نمایش داده می‌شود.</p>
            </div>
            <div className="text-xs font-bold text-white/40">Issue #197 → #198</div>
          </div>
        </section>
      </> : null}
    </div>
  </main>;
}
