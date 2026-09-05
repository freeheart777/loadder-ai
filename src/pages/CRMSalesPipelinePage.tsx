import { type DragEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarBlank,
  Clock,
  CurrencyCircleDollar,
  Kanban,
  Lightning,
  NotePencil,
  UserCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";
import { withDemo } from "../lib/demoMode";

type PipelineStage = {
  id: string;
  label: string;
  probability: number;
  nextAction: string;
  allowedTargets: string[];
  dealCount: number;
  totalValue: number;
};

type PipelineDeal = {
  id: string;
  title: string;
  company: string;
  amount: number;
  currency: string;
  stage: string;
  ownerId?: string | null;
  owner: string;
  lastActivityAt?: string;
  updatedAt: string;
  nextAction: string;
  nextActionDueAt?: string | null;
  ageDays: number;
  idleDays: number;
  isStuck: boolean;
  probability: number;
  expectedVersion: number;
  lostReason?: string | null;
};

type PipelineBoard = {
  stages: PipelineStage[];
  deals: PipelineDeal[];
  summary: {
    dealCount: number;
    openDealCount: number;
    totalValue: number;
    weightedValue: number;
    stuckCount: number;
    wonCount: number;
    lostCount: number;
  };
};

type DragPayload = {
  dealId: string;
  fromStage: string;
  expectedVersion: number;
};

type StageHistoryEntry = {
  id: string;
  fromStage: string | null;
  toStage: string;
  reason: string | null;
  actorType: string;
  actorId: string | null;
  occurredAt: string;
  version: number;
};

type EditDraft = {
  owner: string;
  nextAction: string;
  nextActionDueAt: string;
};

function money(value: number) {
  return `${value.toLocaleString("fa-IR")} تومان`;
}

function relativeActivity(iso?: string) {
  const timestamp = Date.parse(iso || "");
  if (!Number.isFinite(timestamp)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return "امروز";
  if (days === 1) return "دیروز";
  return `${days.toLocaleString("fa-IR")} روز پیش`;
}

function formatDateTime(iso?: string | null) {
  const timestamp = Date.parse(iso || "");
  if (!Number.isFinite(timestamp)) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function CRMSalesPipelinePage() {
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [movingDealId, setMovingDealId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [editingDeal, setEditingDeal] = useState<PipelineDeal | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ owner: "", nextAction: "", nextActionDueAt: "" });
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [historyDeal, setHistoryDeal] = useState<PipelineDeal | null>(null);
  const [history, setHistory] = useState<StageHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingLost, setPendingLost] = useState<DragPayload | null>(null);
  const [lostReason, setLostReason] = useState("");

  async function loadBoard() {
    try {
      const response = await apiFetch("/api/crm/pipeline");
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Pipeline load failed");
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

  const stageLabels = useMemo(
    () => new Map((board?.stages || []).map((stage) => [stage.id, stage.label])),
    [board]
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    board?.stages.forEach((stage) => map.set(stage.id, []));
    board?.deals.forEach((deal) => map.get(deal.stage)?.push(deal));
    return map;
  }, [board]);

  function onDragStart(event: DragEvent, deal: PipelineDeal) {
    const payload: DragPayload = {
      dealId: deal.id,
      fromStage: deal.stage,
      expectedVersion: deal.expectedVersion,
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
  }

  async function transitionDeal(payload: DragPayload, targetStage: string, reason?: string) {
    if (movingDealId) return;
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
            expectedVersion: payload.expectedVersion,
            reason: reason?.trim() || undefined,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setNotice(result.message || "جابه‌جایی Deal مجاز نیست.");
      }
      await loadBoard();
    } catch (error) {
      console.error(error);
      setNotice("ثبت تغییر مرحله ناموفق بود.");
      await loadBoard();
    } finally {
      setMovingDealId(null);
    }
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
    if (targetStage === "lost") {
      setLostReason("");
      setPendingLost(payload);
      return;
    }
    await transitionDeal(payload, targetStage);
  }

  function openEditor(deal: PipelineDeal) {
    setEditingDeal(deal);
    setEditDraft({
      owner: deal.owner || "",
      nextAction: deal.nextAction || "",
      nextActionDueAt: toLocalInputValue(deal.nextActionDueAt),
    });
  }

  async function saveMetadata() {
    if (!editingDeal || savingMetadata) return;
    try {
      setSavingMetadata(true);
      setNotice("");
      const response = await apiFetch(`/api/crm/pipeline/deals/${encodeURIComponent(editingDeal.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: editingDeal.expectedVersion,
          owner: editDraft.owner.trim() || "تیم فروش",
          nextAction: editDraft.nextAction.trim() || null,
          nextActionDueAt: editDraft.nextActionDueAt
            ? new Date(editDraft.nextActionDueAt).toISOString()
            : null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setNotice(result.message || "ویرایش Deal ناموفق بود.");
        await loadBoard();
        return;
      }
      setEditingDeal(null);
      await loadBoard();
    } catch (error) {
      console.error(error);
      setNotice("ویرایش Deal ناموفق بود.");
      await loadBoard();
    } finally {
      setSavingMetadata(false);
    }
  }

  async function openHistory(deal: PipelineDeal) {
    setHistoryDeal(deal);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const response = await apiFetch(`/api/crm/pipeline/deals/${encodeURIComponent(deal.id)}/history`);
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "History load failed");
      setHistory(result.data);
    } catch (error) {
      console.error(error);
      setNotice("دریافت تاریخچه Deal ناموفق بود.");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <main dir="rtl" className="loadder-dashboard-bg min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#030617]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link to={withDemo("/dashboard/crm")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white">
              <ArrowRight size={18} />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-violet-500/20 to-cyan-500/10">
              <Kanban size={25} weight="duotone" className="text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold md:text-2xl">Pipeline فروش</h1>
              <p className="mt-1 text-xs text-white/45 md:text-sm">Kanban فقط View است؛ تغییرات Deal توسط Pipeline Engine ثبت می‌شوند.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3"><span className="text-white/45">Pipeline </span><strong className="mr-2">{money(board?.summary.totalValue ?? 0)}</strong></div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3"><span className="text-white/45">ارزش وزنی </span><strong className="mr-2">{money(board?.summary.weightedValue ?? 0)}</strong></div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3"><span className="text-white/45">Stuck </span><strong className="mr-2">{(board?.summary.stuckCount ?? 0).toLocaleString("fa-IR")}</strong></div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1700px] px-5 py-7 md:px-8">
        {notice && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200"><WarningCircle size={19} />{notice}</div>}
        {loading ? (
          <div className="py-24 text-center text-white/45">در حال دریافت Pipeline...</div>
        ) : (
          <div className="flex min-w-full gap-4 overflow-x-auto pb-6">
            {board?.stages.map((stage) => {
              const deals = dealsByStage.get(stage.id) || [];
              return (
                <section key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, stage.id)} className="min-h-[620px] w-[315px] shrink-0 rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="mb-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3"><div className="font-semibold">{stage.label}</div><span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-white/55">{stage.dealCount.toLocaleString("fa-IR")}</span></div>
                    <div className="mt-2 text-xs text-white/35">{money(stage.totalValue)}</div>
                  </div>
                  <div className="space-y-3">
                    {deals.map((deal) => (
                      <article key={deal.id} draggable={!movingDealId} onDragStart={(event) => onDragStart(event, deal)} className={`cursor-grab rounded-[22px] border bg-[#080d20] p-4 shadow-lg shadow-black/10 transition active:cursor-grabbing ${deal.isStuck ? "border-amber-400/20" : "border-white/[0.08]"} ${movingDealId === deal.id ? "opacity-45" : "hover:border-cyan-400/20"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div><h3 className="font-semibold leading-6">{deal.title}</h3><p className="mt-1 text-xs text-white/40">{deal.company}</p></div>
                          <div className="rounded-xl bg-cyan-500/[0.08] px-2 py-1 text-xs text-cyan-200">%{deal.probability.toLocaleString("fa-IR")}</div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/90"><CurrencyCircleDollar size={17} className="text-emerald-300" />{money(deal.amount)}</div>
                        <div className="mt-4 grid gap-2 text-xs text-white/50">
                          <div className="flex items-center gap-2"><UserCircle size={16} /><span>{deal.owner}</span></div>
                          <div className="flex items-center gap-2"><Clock size={16} /><span>آخرین فعالیت: {relativeActivity(deal.updatedAt || deal.lastActivityAt)}</span></div>
                          <div className="flex items-start gap-2"><Lightning size={16} className="mt-0.5 shrink-0" /><span>اقدام بعدی: {deal.nextAction || "تعیین نشده"}</span></div>
                          {deal.nextActionDueAt && <div className="flex items-center gap-2"><CalendarBlank size={16} /><span>موعد: {formatDateTime(deal.nextActionDueAt)}</span></div>}
                        </div>
                        {deal.lostReason && <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-200">علت شکست: {deal.lostReason}</div>}
                        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-white/35"><span>سن Deal: {deal.ageDays.toLocaleString("fa-IR")} روز</span>{deal.isStuck && <span className="flex items-center gap-1 text-amber-300"><WarningCircle size={14} />Stuck · {deal.idleDays.toLocaleString("fa-IR")} روز</span>}</div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => openEditor(deal)} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-white/65 hover:bg-white/[0.07]"><NotePencil size={15} />ویرایش</button>
                          <button type="button" onClick={() => openHistory(deal)} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-white/65 hover:bg-white/[0.07]"><Clock size={15} />تاریخچه</button>
                        </div>
                      </article>
                    ))}
                    {deals.length === 0 && <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-xs text-white/25">Deal را به این ستون بکشید</div>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {editingDeal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-white/[0.1] bg-[#080d20] p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="font-bold">ویرایش Deal</h2><p className="mt-1 text-xs text-white/40">{editingDeal.title}</p></div><button onClick={() => setEditingDeal(null)} className="rounded-full p-2 text-white/45 hover:bg-white/[0.06]"><X size={20} /></button></div>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm text-white/65">Owner<input value={editDraft.owner} onChange={(e) => setEditDraft((draft) => ({ ...draft, owner: e.target.value }))} className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-cyan-400/40" /></label>
              <label className="grid gap-2 text-sm text-white/65">اقدام بعدی<textarea value={editDraft.nextAction} onChange={(e) => setEditDraft((draft) => ({ ...draft, nextAction: e.target.value }))} rows={3} className="resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-cyan-400/40" /></label>
              <label className="grid gap-2 text-sm text-white/65">موعد اقدام<input type="datetime-local" value={editDraft.nextActionDueAt} onChange={(e) => setEditDraft((draft) => ({ ...draft, nextActionDueAt: e.target.value }))} className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-cyan-400/40" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setEditingDeal(null)} className="rounded-xl px-4 py-2 text-sm text-white/50">انصراف</button><button onClick={saveMetadata} disabled={savingMetadata} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{savingMetadata ? "در حال ثبت..." : "ثبت تغییرات"}</button></div>
          </div>
        </div>
      )}

      {pendingLost && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-rose-400/20 bg-[#100b18] p-6 shadow-2xl">
            <div className="flex items-center gap-3"><WarningCircle size={28} className="text-rose-300" /><div><h2 className="font-bold">ثبت علت از دست رفتن Deal</h2><p className="mt-1 text-xs text-white/40">بدون علت، انتقال به Lost ثبت نمی‌شود.</p></div></div>
            <textarea autoFocus value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={4} placeholder="مثلاً قیمت، زمان‌بندی، انتخاب رقیب، عدم پاسخ..." className="mt-5 w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-white outline-none focus:border-rose-400/40" />
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setPendingLost(null)} className="rounded-xl px-4 py-2 text-sm text-white/50">انصراف</button><button disabled={!lostReason.trim() || Boolean(movingDealId)} onClick={async () => { const payload = pendingLost; const reason = lostReason; setPendingLost(null); await transitionDeal(payload, "lost", reason); }} className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">ثبت Lost</button></div>
          </div>
        </div>
      )}

      {historyDeal && (
        <div className="fixed inset-0 z-[85] bg-black/55 backdrop-blur-sm" onClick={() => setHistoryDeal(null)}>
          <aside className="mr-auto h-full w-full max-w-lg overflow-y-auto border-r border-white/[0.08] bg-[#070b18] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><div><h2 className="font-bold">تاریخچه Deal</h2><p className="mt-1 text-xs text-white/40">{historyDeal.title}</p></div><button onClick={() => setHistoryDeal(null)} className="rounded-full p-2 text-white/45 hover:bg-white/[0.06]"><X size={20} /></button></div>
            <div className="mt-6 space-y-3">
              {historyLoading && <div className="py-10 text-center text-sm text-white/40">در حال دریافت تاریخچه...</div>}
              {!historyLoading && history.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold">{entry.fromStage ? `${stageLabels.get(entry.fromStage) || entry.fromStage} ← ` : "شروع → "}{stageLabels.get(entry.toStage) || entry.toStage}</div><span className="text-[11px] text-white/35">v{entry.version}</span></div>
                  <div className="mt-2 text-xs text-white/40">{formatDateTime(entry.occurredAt)} · {entry.actorType}</div>
                  {entry.reason && <div className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/60">{entry.reason}</div>}
                </div>
              ))}
              {!historyLoading && history.length === 0 && <div className="py-10 text-center text-sm text-white/35">تاریخچه‌ای ثبت نشده است.</div>}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
