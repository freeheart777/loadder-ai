import { DragEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  CurrencyCircleDollar,
  Kanban,
  Lightning,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";
import { withDemo } from "../lib/demoMode";

type PipelineStage = {
  id: string;
  label: string;
  probability: number;
  nextAction: string;
  allowedTargets: string[];
};

type PipelineDeal = {
  id: string;
  title: string;
  company: string;
  amount: number;
  currency: string;
  stage: string;
  owner: string;
  lastActivityAt: string;
  nextAction: string;
  ageDays: number;
  idleDays: number;
  isStuck: boolean;
  probability: number;
  expectedUpdatedAt: string;
};

type PipelineBoard = {
  stages: PipelineStage[];
  deals: PipelineDeal[];
};

type DragPayload = {
  dealId: string;
  fromStage: string;
  expectedUpdatedAt: string;
};

function money(value: number) {
  return `${value.toLocaleString("fa-IR")} تومان`;
}

function relativeActivity(iso: string) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "امروز";
  if (days === 1) return "دیروز";
  return `${days.toLocaleString("fa-IR")} روز پیش`;
}

export default function CRMSalesPipelinePage() {
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [movingDealId, setMovingDealId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function loadBoard() {
    try {
      const response = await apiFetch("/api/crm/pipeline");
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Pipeline load failed");
      }
      setBoard(result.data);
    } catch (error) {
      console.error(error);
      setNotice("دریافت Pipeline فروش ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
  }, []);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    board?.stages.forEach((stage) => map.set(stage.id, []));
    board?.deals.forEach((deal) => {
      const list = map.get(deal.stage);
      if (list) list.push(deal);
    });
    return map;
  }, [board]);

  const totalValue = useMemo(
    () => board?.deals.reduce((sum, deal) => sum + deal.amount, 0) ?? 0,
    [board]
  );

  const weightedValue = useMemo(
    () =>
      Math.round(
        board?.deals.reduce(
          (sum, deal) => sum + deal.amount * (deal.probability / 100),
          0
        ) ?? 0
      ),
    [board]
  );

  function onDragStart(event: DragEvent, deal: PipelineDeal) {
    const payload: DragPayload = {
      dealId: deal.id,
      fromStage: deal.stage,
      expectedUpdatedAt: deal.expectedUpdatedAt,
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
  }

  async function onDrop(event: DragEvent, targetStage: string) {
    event.preventDefault();

    let payload: DragPayload;
    try {
      payload = JSON.parse(event.dataTransfer.getData("application/json"));
    } catch {
      return;
    }

    if (!payload?.dealId || payload.fromStage === targetStage || movingDealId) return;

    try {
      setMovingDealId(payload.dealId);
      setNotice("");

      const response = await apiFetch(
        `/api/crm/pipeline/leads/${encodeURIComponent(payload.dealId)}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStage: targetStage,
            expectedUpdatedAt: payload.expectedUpdatedAt,
          }),
        }
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setNotice(result.message || "جابه‌جایی Deal مجاز نیست.");
        await loadBoard();
        return;
      }

      setBoard((current) =>
        current
          ? {
              ...current,
              deals: current.deals.map((deal) =>
                deal.id === result.data.id ? result.data : deal
              ),
            }
          : current
      );
    } catch (error) {
      console.error(error);
      setNotice("ثبت تغییر مرحله ناموفق بود.");
      await loadBoard();
    } finally {
      setMovingDealId(null);
    }
  }

  return (
    <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link
              to={withDemo("/dashboard/crm")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowRight size={18} />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <Kanban size={25} weight="duotone" className="text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold md:text-2xl">Pipeline فروش</h1>
              <p className="mt-1 text-xs text-white/45 md:text-sm">
                Kanban فقط View است؛ تمام جابه‌جایی‌ها توسط Pipeline Engine اعتبارسنجی می‌شوند.
              </p>
            </div>
          </div>

          <div className="flex gap-2 text-xs md:text-sm">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3">
              <span className="text-white/45">ارزش Pipeline </span>
              <strong className="mr-2">{money(totalValue)}</strong>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3">
              <span className="text-white/45">ارزش وزنی </span>
              <strong className="mr-2">{money(weightedValue)}</strong>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1700px] px-5 py-7 md:px-8">
        {notice && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200">
            <WarningCircle size={19} />
            {notice}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-white/45">در حال دریافت Pipeline...</div>
        ) : (
          <div className="flex min-w-full gap-4 overflow-x-auto pb-6">
            {board?.stages.map((stage) => {
              const deals = dealsByStage.get(stage.id) || [];
              const stageValue = deals.reduce((sum, deal) => sum + deal.amount, 0);

              return (
                <section
                  key={stage.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, stage.id)}
                  className="min-h-[620px] w-[315px] shrink-0 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-3"
                >
                  <div className="mb-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{stage.label}</div>
                      <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-white/55">
                        {deals.length.toLocaleString("fa-IR")}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-white/35">{money(stageValue)}</div>
                  </div>

                  <div className="space-y-3">
                    {deals.map((deal) => (
                      <article
                        key={deal.id}
                        draggable={!movingDealId}
                        onDragStart={(event) => onDragStart(event, deal)}
                        className={`cursor-grab rounded-[22px] border bg-[#080d20] p-4 shadow-lg shadow-black/10 transition active:cursor-grabbing ${
                          deal.isStuck
                            ? "border-amber-400/20"
                            : "border-white/[0.08]"
                        } ${movingDealId === deal.id ? "opacity-45" : "hover:border-cyan-400/20"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold leading-6">{deal.title}</h3>
                            <p className="mt-1 text-xs text-white/40">{deal.company}</p>
                          </div>
                          <div className="rounded-xl bg-cyan-500/[0.08] px-2 py-1 text-xs text-cyan-200">
                            %{deal.probability.toLocaleString("fa-IR")}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/90">
                          <CurrencyCircleDollar size={17} className="text-emerald-300" />
                          {money(deal.amount)}
                        </div>

                        <div className="mt-4 grid gap-2 text-xs text-white/50">
                          <div className="flex items-center gap-2">
                            <UserCircle size={16} />
                            <span>{deal.owner}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={16} />
                            <span>آخرین فعالیت: {relativeActivity(deal.lastActivityAt)}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Lightning size={16} className="mt-0.5 shrink-0" />
                            <span>اقدام بعدی: {deal.nextAction}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-white/35">
                          <span>سن Deal: {deal.ageDays.toLocaleString("fa-IR")} روز</span>
                          {deal.isStuck && (
                            <span className="flex items-center gap-1 text-amber-300">
                              <WarningCircle size={14} />
                              Stuck · {deal.idleDays.toLocaleString("fa-IR")} روز
                            </span>
                          )}
                        </div>
                      </article>
                    ))}

                    {deals.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-xs text-white/25">
                        Deal را به این ستون بکشید
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
