import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Brain, CaretDown, Database, Pulse, SpinnerGap } from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";

type SystemStatus = "READY" | "NO DATA" | "ERROR";
type ContextVersion = { id: string; versionNumber: number; createdAt: string; activatedAt: string | null };
type ContextResponse = { activeContext: ContextVersion | null; isStale: boolean };
type Aggregate = {
  id: string; metricType: string; state: "available" | "unavailable" | "insufficient_data";
  value: unknown; numerator: number | null; denominator: number | null; window: string;
  windowStart: string; windowEnd: string; pointInTimeCutoff: string; calculatedAt: string;
};
type Trend = { id: string; state: string; calculatedAt: string };
type Anomaly = { id: string; state: string; calculatedAt: string };
type ListeningSummary = { aggregates: Aggregate[]; trends: Trend[]; anomalies: Anomaly[] };
type EvidenceReference = {
  kind: string; id: string; contractVersion: number | null; producer: string;
  producerVersion: string; sourceTimestamp: string | null; windowStart: string | null; windowEnd: string | null;
};
type SemanticFinding = {
  id: string; semanticType: "listening_attention_state" | "competitive_visibility_state";
  semanticVersion: number; state: string; evidenceReferences: EvidenceReference[];
  evidenceManifestHash: string; evidenceCount: number; contextVersionId: string | null;
  pointInTimeCutoff: string; calculatedAt: string;
};

class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status >= 500
      ? "An intelligence service is temporarily unavailable."
      : data.message || "The intelligence service could not complete this request.";
    throw new ApiRequestError(response.status, message);
  }
  return data as T;
}

const displayState = (value: string | null | undefined) => !value ? "NO DATA" : value === "insufficient_data" || value === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT EVIDENCE" : value.replaceAll("_", " ").toUpperCase();
const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not available";
const newest = <T extends { calculatedAt: string }>(items: T[]) => [...items].sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt))[0] || null;

function StatusPill({ status }: { status: string }) {
  const tone = status === "READY" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : status === "ERROR" ? "border-rose-300/20 bg-rose-400/10 text-rose-200" : "border-amber-300/20 bg-amber-400/10 text-amber-100";
  return <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em] ${tone}`}>{status}</span>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  const muted = value === "NO DATA" || value === "INSUFFICIENT EVIDENCE";
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl">
      <div className="text-xs font-medium uppercase tracking-[0.17em] text-white/40">{label}</div>
      <div className={`mt-5 break-words text-2xl font-semibold tracking-tight ${muted ? "text-white/35" : "text-white"}`}>{value}</div>
    </div>
  );
}

const semanticCopy: Record<string, string> = {
  SURGING: "Observed listening volume is rising with elevated anomaly evidence.",
  RISING: "Observed listening volume is rising in the selected window.",
  STABLE: "Observed listening volume is stable in the selected window.",
  FALLING: "Observed listening volume is falling in the selected window.",
  LEADING: "Tracked brand mentions exceed tracked competitor mentions.",
  PARITY: "Tracked brand and competitor mention counts are equal.",
  TRAILING: "Tracked competitor mentions exceed tracked brand mentions.",
  INSUFFICIENT_EVIDENCE: "The canonical evidence is insufficient for this semantic state.",
};

function SemanticCard({ title, finding }: { title: string; finding: SemanticFinding | null }) {
  const state = finding?.state || "NO DATA";
  return (
    <article className="rounded-[28px] border border-violet-300/15 bg-gradient-to-br from-violet-500/[0.09] via-white/[0.035] to-cyan-500/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/65">{title}</div>
      <div className={`mt-7 text-4xl font-bold tracking-[-0.03em] md:text-5xl ${finding ? "text-white" : "text-white/30"}`}>{displayState(state)}</div>
      <p className="mt-4 max-w-xl text-sm leading-7 text-white/50">{finding ? semanticCopy[finding.state] || "Semantic state returned by Loadder." : "No Semantic Finding exists for this workspace."}</p>
      {finding && (
        <details className="group mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-white/65">
            <span>Evidence · {finding.evidenceCount}</span>
            <CaretDown size={16} className="transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-white/[0.07] px-4 py-4">
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <Meta label="Context Version" value={finding.contextVersionId || "Not available"} />
              <Meta label="Point-in-time Cutoff" value={formatDate(finding.pointInTimeCutoff)} />
              <Meta label="Semantic Version" value={String(finding.semanticVersion)} />
              <Meta label="Evidence Count" value={String(finding.evidenceCount)} />
              <div className="sm:col-span-2"><Meta label="Evidence Manifest Hash" value={finding.evidenceManifestHash} mono /></div>
            </dl>
            <div className="mt-4 space-y-3">
              {finding.evidenceReferences.map((evidence) => (
                <div key={`${evidence.kind}:${evidence.id}`} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <Meta label="Evidence type" value={evidence.kind} />
                    <Meta label="Evidence ID" value={evidence.id} mono />
                    <Meta label="Producer" value={evidence.producer} />
                    <Meta label="Producer version" value={evidence.producerVersion} />
                    <Meta label="Contract version" value={evidence.contractVersion === null ? "Not available" : String(evidence.contractVersion)} />
                    <Meta label="Window start" value={formatDate(evidence.windowStart)} />
                    <Meta label="Window end" value={formatDate(evidence.windowEnd)} />
                    <Meta label="Source timestamp" value={formatDate(evidence.sourceTimestamp)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </article>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-white/35">{label}</dt><dd className={`mt-1 break-all text-white/70 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd></div>;
}

export default function IntelligencePreviewPage() {
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [listening, setListening] = useState<ListeningSummary | null>(null);
  const [findings, setFindings] = useState<SemanticFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [authError, setAuthError] = useState(false);

  const loadContext = useCallback(async () => {
    const data = await jsonRequest<ContextResponse & { success: true }>("/api/business-context"); setContext(data); return data;
  }, []);
  const loadListening = useCallback(async () => {
    const data = await jsonRequest<{ summary: ListeningSummary }>("/api/listening/intelligence/summary?limit=100"); setListening(data.summary); return data.summary;
  }, []);
  const loadFindings = useCallback(async () => {
    const data = await jsonRequest<{ findings: SemanticFinding[] }>("/api/intelligence/semantic/findings?limit=100"); setFindings(data.findings || []); return data.findings || [];
  }, []);

  const handleFailure = useCallback((error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 404) return;
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) setAuthError(true);
    const message = error instanceof ApiRequestError ? error.message : "An intelligence service is temporarily unavailable.";
    setErrors((current) => current.includes(message) ? current : [...current, message]);
  }, []);

  const loadPreview = useCallback(async () => {
    setErrors([]); setAuthError(false);
    const results = await Promise.allSettled([loadContext(), loadListening(), loadFindings()]);
    for (const result of results) if (result.status === "rejected") handleFailure(result.reason);
  }, [handleFailure, loadContext, loadFindings, loadListening]);

  useEffect(() => { void loadPreview().finally(() => setLoading(false)); }, [loadPreview]);

  const latestAggregates = useMemo(() => {
    const result = new Map<string, Aggregate>();
    for (const aggregate of listening?.aggregates || []) if (!result.has(aggregate.metricType)) result.set(aggregate.metricType, aggregate);
    return result;
  }, [listening]);
  const mention = latestAggregates.get("mention_count") || null;
  const shareOfVoice = latestAggregates.get("share_of_voice") || null;
  const competitorMentions = latestAggregates.get("competitor_mention_count") || null;
  const trend = newest(listening?.trends || []);
  const anomaly = newest(listening?.anomalies || []);
  const attention = findings.find((finding) => finding.semanticType === "listening_attention_state") || null;
  const competitive = findings.find((finding) => finding.semanticType === "competitive_visibility_state") || null;
  const contextStatus = !context?.activeContext ? "MISSING" : context.isStale ? "STALE" : "READY";
  const listeningStatus: SystemStatus = errors.length && !listening ? "ERROR" : listening?.aggregates.length ? "READY" : "NO DATA";
  const semanticStatus: SystemStatus = errors.length && !findings.length ? "ERROR" : findings.length ? "READY" : "NO DATA";

  const metricValue = (aggregate: Aggregate | null, formatter: (value: number) => string = String) => {
    if (!aggregate) return "NO DATA";
    if (aggregate.state === "insufficient_data") return "INSUFFICIENT EVIDENCE";
    if (aggregate.state !== "available" || typeof aggregate.value !== "number") return "NO DATA";
    return formatter(aggregate.value);
  };

  const refresh = async () => {
    setRefreshing(true); setErrors([]); setAuthError(false);
    let currentListening: ListeningSummary | null = null;
    try { await loadContext(); } catch (error) { handleFailure(error); }
    try { currentListening = await loadListening(); } catch (error) { handleFailure(error); }
    const currentMention = currentListening?.aggregates.find((item) => item.metricType === "mention_count") || null;
    if (currentMention) {
      try {
        await jsonRequest("/api/intelligence/semantic/calculate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ semanticTypes: ["listening_attention_state", "competitive_visibility_state"], subjectType: "listening_scope", subjectKey: "intelligence-preview", pointInTimeCutoff: currentMention.pointInTimeCutoff, window: currentMention.window }),
        });
      } catch (error) { handleFailure(error); }
    }
    try { await loadFindings(); } catch (error) { handleFailure(error); }
    setRefreshing(false);
  };

  return (
    <main className="loadder-dashboard-bg min-h-screen text-white">
      <header className="border-b border-white/[0.07] bg-[#030617]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between gap-5 px-5 py-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" aria-label="Back to dashboard" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.08] hover:text-white"><ArrowLeft size={18} /></Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 text-violet-200"><Brain size={26} weight="duotone" /></div>
            <div><h1 className="text-xl font-semibold md:text-2xl">Intelligence</h1><p className="mt-1 text-sm text-white/45">Live view of Loadder intelligence infrastructure</p></div>
          </div>
          <button onClick={() => void refresh()} disabled={refreshing || loading} className="flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-50">
            {refreshing ? <SpinnerGap size={17} className="animate-spin" /> : <Pulse size={17} />} Refresh Intelligence
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1450px] space-y-8 px-5 py-8 md:px-8">
        {authError && <div className="rounded-2xl border border-rose-300/20 bg-rose-500/[0.08] px-5 py-4 text-sm text-rose-100">Your authenticated session cannot access the active workspace intelligence.</div>}
        {errors.map((error) => <div key={error} className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.06] px-5 py-4 text-sm text-amber-100">{error}</div>)}

        <section className="rounded-[28px] border border-white/[0.08] bg-[#080b14]/80 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div><div className="text-xs uppercase tracking-[0.18em] text-white/35">Business Context</div><h2 className="mt-3 text-2xl font-semibold">Shared business understanding</h2></div>
            <StatusPill status={contextStatus} />
          </div>
          <dl className="mt-7 grid gap-5 border-t border-white/[0.07] pt-6 sm:grid-cols-2">
            <Meta label="Context Version" value={context?.activeContext ? `Version ${context.activeContext.versionNumber} · ${context.activeContext.id}` : "Not available"} />
            <Meta label="Last activated / updated" value={formatDate(context?.activeContext?.activatedAt || context?.activeContext?.createdAt)} />
          </dl>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-3"><Database size={20} className="text-cyan-200" /><div><h2 className="text-lg font-semibold">Listening Intelligence</h2><p className="text-sm text-white/40">Canonical, factual metrics only</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Mentions" value={metricValue(mention, (value) => new Intl.NumberFormat("en").format(value))} />
            <MetricCard label="Trend" value={displayState(trend?.state)} />
            <MetricCard label="Anomaly" value={displayState(anomaly?.state)} />
            <MetricCard label="Share of Voice" value={metricValue(shareOfVoice, (value) => `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value * 100)}%`)} />
            <MetricCard label="Competitor Mentions" value={metricValue(competitorMentions, (value) => new Intl.NumberFormat("en").format(value))} />
          </div>
        </section>

        <section>
          <div className="mb-4"><h2 className="text-lg font-semibold">Semantic Intelligence</h2><p className="mt-1 text-sm text-white/40">Deterministic interpretation of canonical evidence</p></div>
          <div className="grid gap-5 xl:grid-cols-2"><SemanticCard title="Listening Attention" finding={attention} /><SemanticCard title="Competitive Visibility" finding={competitive} /></div>
        </section>

        <footer className="rounded-[24px] border border-white/[0.07] bg-black/20 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">System</div><div className="flex flex-wrap gap-3"><SystemItem label="Context" status={contextStatus === "READY" ? "READY" : contextStatus === "MISSING" ? "NO DATA" : contextStatus === "STALE" ? "ERROR" : "ERROR"} /><SystemItem label="Listening" status={listeningStatus} /><SystemItem label="Semantic" status={semanticStatus} /></div></div>
        </footer>
        {loading && <div className="fixed inset-0 flex items-center justify-center bg-[#030617]/65 backdrop-blur-sm"><SpinnerGap size={30} className="animate-spin text-violet-200" /></div>}
      </div>
    </main>
  );
}

function SystemItem({ label, status }: { label: string; status: SystemStatus }) {
  const dot = status === "READY" ? "bg-emerald-300" : status === "ERROR" ? "bg-rose-300" : "bg-amber-200";
  return <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white/55"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label} <span className="text-white/80">{status}</span></div>;
}
