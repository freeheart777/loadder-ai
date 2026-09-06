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
      <header className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-black tracking-[.2em] text-emerald-300">LOADDER INTERNAL CONTROL PLANE</div>
          <h1 className="mt-2 text-3xl font-black">مدیریت پلتفرم لودر</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/50">نسخهٔ اول فقط خواندنی است. اطلاعات ناموجود به‌صورت ناموجود نمایش داده می‌شوند و به صفر سالم تبدیل نمی‌شوند.</p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-200">READ ONLY</div>
      </header>

      {loading ? <div className="rounded-2xl border border-white/10 p-6 text-sm text-white/50">در حال دریافت وضعیت پلتفرم…</div> : null}
      {error ? <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-sm leading-7 text-rose-100">{error}</div> : null}

      {data?.overview ? <>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span>سطح دسترسی:</span>
          {(data.roles || []).map((role) => <span key={role} className="rounded-full bg-white/10 px-3 py-1 font-bold text-white/70">{role}</span>)}
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="کل کاربران" value={data.overview.users?.total ?? "ناموجود"} hint={data.overview.users?.evidence} />
          <MetricCard title="کاربران فعال" value={data.overview.users?.active ?? "ناموجود"} hint={data.overview.users?.evidence} />
          <MetricCard title="فضاهای کاری فعال" value={data.overview.workspaces?.active ?? "ناموجود"} hint={data.overview.workspaces?.evidence} />
          <MetricCard title="نشست‌های فعال" value={data.overview.sessions?.active ?? "ناموجود"} hint={data.overview.sessions?.evidence} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="text-sm font-black">پروژه‌ها</h2>
            <div className="mt-3 text-sm text-amber-200">{data.overview.projects?.status || "unknown"}</div>
            <p className="mt-2 text-xs leading-6 text-white/40">{data.overview.projects?.reason || "منبع معتبر هنوز به این نما متصل نشده است."}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="text-sm font-black">آمادگی پلتفرم</h2>
            <div className="mt-3 text-sm text-amber-200">{data.overview.readiness?.status || "unknown"}</div>
            <p className="mt-2 text-xs leading-6 text-white/40">{data.overview.readiness?.reason || "منبع معتبر هنوز به این نما متصل نشده است."}</p>
          </div>
        </section>
      </> : null}
    </div>
  </main>;
}
