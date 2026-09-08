import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChartBar,
  Clock,
  CurrencyCircleDollar,
  Funnel,
  Target,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";
import { withDemo } from "../lib/demoMode";

type StageMetric = { stage: string; currentCount: number; enteredCount: number; averageTimeDays: number };
type Conversion = { fromStage: string; toStage: string; count: number; conversionRate: number };
type LostReason = { reason: string; count: number; share: number };
type StuckDeal = { id: string; title: string; stage: string; owner: string; idleDays: number; amount: number };
type PipelineAnalytics = {
  generatedAt: string;
  summary: {
    totalDeals: number;
    openDeals: number;
    wonCount: number;
    lostCount: number;
    closedCount: number;
    winRate: number;
    lossRate: number;
    stuckCount: number;
    pipelineValue: number;
  };
  stageMetrics: StageMetric[];
  conversions: Conversion[];
  lostReasons: LostReason[];
  stuckDeals: StuckDeal[];
};

const STAGE_LABELS: Record<string, string> = {
  new: "جدید",
  hot: "لید داغ",
  qualified: "واجد شرایط",
  negotiating: "مذاکره",
  converted: "برنده",
  lost: "از دست رفته",
};

function money(value: number) {
  return `${value.toLocaleString("fa-IR")} تومان`;
}

function stageLabel(stage: string) {
  return STAGE_LABELS[stage] || stage;
}

export default function CRMPipelineAnalyticsPage() {
  const [analytics, setAnalytics] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    apiFetch("/api/crm/pipeline/analytics")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || "Analytics load failed");
        setAnalytics(result.data);
      })
      .catch((error) => {
        console.error(error);
        setNotice("دریافت تحلیل Pipeline ناموفق بود.");
      })
      .finally(() => setLoading(false));
  }, []);

  const maxStageTime = useMemo(
    () => Math.max(1, ...(analytics?.stageMetrics.map((item) => item.averageTimeDays) || [1])),
    [analytics]
  );

  return (
    <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link to={withDemo("/dashboard/crm/pipeline")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white">
              <ArrowRight size={18} />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <ChartBar size={25} weight="duotone" className="text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold md:text-2xl">تحلیل Pipeline فروش</h1>
              <p className="mt-1 text-xs text-white/45 md:text-sm">محاسبه‌شده از تاریخچه immutable جابه‌جایی Dealها</p>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 py-7 md:px-8">
        {notice && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200"><WarningCircle size={19} />{notice}</div>}
        {loading ? <div className="py-24 text-center text-white/45">در حال محاسبه تحلیل Pipeline...</div> : analytics && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Kpi icon={<CurrencyCircleDollar size={20} />} label="ارزش Pipeline" value={money(analytics.summary.pipelineValue)} />
              <Kpi icon={<Target size={20} />} label="Win Rate" value={`${analytics.summary.winRate.toLocaleString("fa-IR")}%`} />
              <Kpi icon={<Funnel size={20} />} label="Deal باز" value={analytics.summary.openDeals.toLocaleString("fa-IR")} />
              <Kpi icon={<TrendUp size={20} />} label="Won" value={analytics.summary.wonCount.toLocaleString("fa-IR")} />
              <Kpi icon={<WarningCircle size={20} />} label="Stuck" value={analytics.summary.stuckCount.toLocaleString("fa-IR")} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="mb-5 flex items-center gap-2"><Clock size={20} className="text-cyan-300" /><h2 className="font-semibold">میانگین زمان در Stage</h2></div>
                <div className="space-y-4">
                  {analytics.stageMetrics.filter((item) => !["converted", "lost"].includes(item.stage)).map((item) => (
                    <div key={item.stage}>
                      <div className="mb-2 flex items-center justify-between text-sm"><span>{stageLabel(item.stage)}</span><span className="text-white/50">{item.averageTimeDays.toLocaleString("fa-IR")} روز</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-l from-cyan-400/80 to-violet-500/80" style={{ width: `${Math.max(3, (item.averageTimeDays / maxStageTime) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5">
                <h2 className="mb-5 font-semibold">علل Lost</h2>
                <div className="space-y-3">
                  {analytics.lostReasons.length ? analytics.lostReasons.map((item) => (
                    <div key={item.reason} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-4"><span className="text-sm">{item.reason}</span><strong>{item.share.toLocaleString("fa-IR")}%</strong></div>
                      <div className="mt-2 text-xs text-white/35">{item.count.toLocaleString("fa-IR")} Deal</div>
                    </div>
                  )) : <div className="py-10 text-center text-sm text-white/30">هنوز Deal از دست‌رفته‌ای ثبت نشده است.</div>}
                </div>
              </section>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5">
                <h2 className="mb-5 font-semibold">Conversion بین Stageها</h2>
                <div className="space-y-3">
                  {analytics.conversions.length ? analytics.conversions.map((item) => (
                    <div key={`${item.fromStage}-${item.toStage}`} className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
                      <div className="text-sm"><span>{stageLabel(item.fromStage)}</span><span className="mx-2 text-white/25">←</span><span>{stageLabel(item.toStage)}</span></div>
                      <div className="text-left"><strong>{item.conversionRate.toLocaleString("fa-IR")}%</strong><div className="mt-1 text-[11px] text-white/35">{item.count.toLocaleString("fa-IR")} انتقال</div></div>
                    </div>
                  )) : <div className="py-10 text-center text-sm text-white/30">هنوز transition کافی برای تحلیل وجود ندارد.</div>}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5">
                <h2 className="mb-5 font-semibold">Dealهای Stuck</h2>
                <div className="space-y-3">
                  {analytics.stuckDeals.length ? analytics.stuckDeals.map((deal) => (
                    <div key={deal.id} className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.04] p-4">
                      <div className="flex items-start justify-between gap-4"><div><div className="font-medium">{deal.title}</div><div className="mt-1 text-xs text-white/40">{stageLabel(deal.stage)} · {deal.owner}</div></div><div className="text-left"><strong className="text-amber-200">{deal.idleDays.toLocaleString("fa-IR")} روز</strong><div className="mt-1 text-[11px] text-white/35">بدون تغییر</div></div></div>
                      <div className="mt-3 text-xs text-white/45">{money(deal.amount)}</div>
                    </div>
                  )) : <div className="py-10 text-center text-sm text-white/30">Deal گیرکرده‌ای وجود ندارد.</div>}
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-4"><div className="flex items-center gap-2 text-xs text-white/40">{icon}{label}</div><div className="mt-3 text-lg font-bold">{value}</div></div>;
}
