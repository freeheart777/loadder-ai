import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Brain, CaretDown, Database, Pulse, SpinnerGap } from "@phosphor-icons/react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

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
type Recommendation = {
  id: string; recommendationType: string; recommendationVersion: number; schemaVersion: number;
  subjectType: string; subjectId: string | null; subjectKey: string; considerationCode: string;
  rationaleCode: string; reviewPriority: string; semanticFindingReferences: unknown[];
  semanticManifestHash: string; semanticFindingCount: number; contextVersionId: string | null;
  pointInTimeCutoff: string; producer: string; producerVersion: string; confidence: number | null;
  confidenceReason: string; provenance: Record<string, unknown>; calculatedAt: string; createdAt: string;
};
type Review = {
  id: string; recommendationId: string; reviewerRole: string; reviewType: string; reviewedAt: string;
};
type Decision = {
  id: string; recommendationId: string; deciderRole: string; decisionType: string;
  authorityClass: string; executionAuthorizing: boolean; observedFreshness: string;
  supersedesDecisionId: string | null; decidedAt: string;
};
type Governance = { reviews: Review[]; decisions: Decision[]; error?: string };
type PendingDecision = {
  recommendationId: string; decisionType: string; supersedesDecisionId: string | null; idempotencyKey: string;
};
type ActionProposal = {
  id: string; decisionId: string; recommendationId: string; actionType: string;
  actionVersion: number; schemaVersion: number; subjectType: string; subjectId: string | null;
  subjectKey: string; targetType: string; targetKey: string; contextVersionId: string;
  pointInTimeCutoff: string; riskClass: string; executionEligible: boolean; executable: boolean;
  requiresAuthorization: boolean; producer: string; producerVersion: string;
  createdByRole: string; inputManifestHash: string; proposalHash: string; createdAt: string;
};
type ExecutionAuthorization = {
  id: string; actionProposalId: string; proposalHash: string; authorizationPolicy: string;
  authorizationPolicyVersion: number; authorizerRole: string; acknowledgementCode: string;
  confirmationHash: string; executionAuthorizing: boolean; authorizedAt: string;
  expiresAt: string; createdAt: string;
};
type ExecutionRequest = {
  id: string; executionAuthorizationId: string; actionProposalId: string; actionType: string;
  actionVersion: number; requestPolicy: string; requestPolicyVersion: number; requestFingerprint: string;
  riskClass: string; requestedByRole: string; requestedAt: string; requestExpiresAt: string;
};

class ApiRequestError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; }
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status >= 500
      ? "An intelligence service is temporarily unavailable."
      : data.message || "The intelligence service could not complete this request.";
    throw new ApiRequestError(response.status, message, data.code);
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
  const { memberships, activeWorkspace } = useAuth();
  const role = memberships.find((membership) => membership.workspace.id === activeWorkspace?.id)?.role;
  const canReview = role === "owner" || role === "admin" || role === "member";
  const canDecide = role === "owner" || role === "admin";
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [listening, setListening] = useState<ListeningSummary | null>(null);
  const [findings, setFindings] = useState<SemanticFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [authError, setAuthError] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [actionProposals, setActionProposals] = useState<ActionProposal[]>([]);
  const [authorizations, setAuthorizations] = useState<ExecutionAuthorization[]>([]);
  const [executionRequests, setExecutionRequests] = useState<ExecutionRequest[]>([]);
  const [governance, setGovernance] = useState<Record<string, Governance>>({});
  const [recommendationError, setRecommendationError] = useState(false);
  const [governanceError, setGovernanceError] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [pendingStale, setPendingStale] = useState<PendingDecision | null>(null);
  const [pendingSupersession, setPendingSupersession] = useState<PendingDecision | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const loadGovernance = useCallback(async (items: Recommendation[]) => {
    const results = await Promise.all(items.map(async (recommendation) => {
      try {
        const [reviewData, decisionData] = await Promise.all([
          jsonRequest<{ reviews: Review[] }>(`/api/intelligence/recommendations/${recommendation.id}/reviews?limit=100`),
          jsonRequest<{ decisions: Decision[] }>(`/api/intelligence/recommendations/${recommendation.id}/decisions?limit=100`),
        ]);
        return [recommendation.id, { reviews: reviewData.reviews || [], decisions: decisionData.decisions || [] }] as const;
      } catch (error) {
        setGovernanceError(true);
        handleFailure(error);
        return [recommendation.id, { reviews: [], decisions: [], error: "Governance history unavailable." }] as const;
      }
    }));
    setGovernance((current) => ({ ...current, ...Object.fromEntries(results) }));
  }, [handleFailure]);

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await jsonRequest<{ recommendations: Recommendation[] }>("/api/intelligence/recommendations?limit=100");
      const items = data.recommendations || [];
      setRecommendations(items);
      setRecommendationError(false);
      await loadGovernance(items);
      return items;
    } catch (error) {
      setRecommendationError(true);
      handleFailure(error);
      return [];
    }
  }, [handleFailure, loadGovernance]);
  const loadActionProposals = useCallback(async () => {
    try {
      const data = await jsonRequest<{ proposals: ActionProposal[] }>("/api/execution/action-proposals?limit=100");
      const proposals = data.proposals || []; setActionProposals(proposals);
      const histories = await Promise.all(proposals.map((proposal) => jsonRequest<{ authorizations: ExecutionAuthorization[] }>(`/api/execution/action-proposals/${proposal.id}/authorizations?limit=100`)));
      setAuthorizations(histories.flatMap((history) => history.authorizations || []));
      return proposals;
    } catch (error) { handleFailure(error); return []; }
  }, [handleFailure]);
  const loadExecutionRequests = useCallback(async () => {
    try {
      const data = await jsonRequest<{ requests: ExecutionRequest[] }>("/api/execution/requests?limit=100");
      const requests = data.requests || []; setExecutionRequests(requests); return requests;
    } catch (error) { handleFailure(error); return []; }
  }, [handleFailure]);

  const loadPreview = useCallback(async () => {
    setErrors([]); setAuthError(false);
    setGovernanceError(false);
    const results = await Promise.allSettled([loadContext(), loadListening(), loadFindings(), loadRecommendations(), loadActionProposals(), loadExecutionRequests()]);
    for (const result of results) if (result.status === "rejected") handleFailure(result.reason);
  }, [handleFailure, loadActionProposals, loadContext, loadExecutionRequests, loadFindings, loadListening, loadRecommendations]);

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
  const recommendationStatus: SystemStatus = recommendationError ? "ERROR" : recommendations.length ? "READY" : "NO DATA";
  const governanceStatus: SystemStatus = governanceError ? "ERROR" : recommendations.length ? "READY" : "NO DATA";

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
    await loadRecommendations();
    await loadActionProposals();
    setRefreshing(false);
  };

  const calculateRecommendations = async () => {
    if (!mention) return;
    setCalculating(true); setNotice(null);
    try {
      await jsonRequest("/api/intelligence/recommendations/calculate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationTypes: ["attention_evidence_review", "competitive_visibility_evidence_review"],
          subjectType: "listening_scope", subjectKey: "intelligence-preview",
          pointInTimeCutoff: mention.pointInTimeCutoff, scope: { window: mention.window },
        }),
      });
      await loadRecommendations();
      setNotice("Recommendation calculation completed. Existing immutable results may have been reused.");
    } catch (error) { handleFailure(error); }
    finally { setCalculating(false); }
  };

  const reloadGovernance = async (id: string) => {
    const recommendation = recommendations.find((item) => item.id === id);
    if (recommendation) await loadGovernance([recommendation]);
  };

  const createReview = async (id: string, reviewType: string) => {
    setActing(`${id}:review`); setNotice(null);
    try {
      await jsonRequest(`/api/intelligence/recommendations/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ reviewType }),
      });
      await reloadGovernance(id);
    } catch (error) { handleFailure(error); }
    finally { setActing(null); }
  };

  const sendDecision = async (pending: PendingDecision, allowStale: boolean) => {
    setActing(`${pending.recommendationId}:decision`); setNotice(null);
    try {
      await jsonRequest(`/api/intelligence/recommendations/${pending.recommendationId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pending.idempotencyKey },
        body: JSON.stringify({
          decisionType: pending.decisionType, allowStale,
          supersedesDecisionId: pending.supersedesDecisionId,
        }),
      });
      setPendingStale(null); setPendingSupersession(null);
      await reloadGovernance(pending.recommendationId);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "RECOMMENDATION_STALE" && !allowStale) {
        setPendingStale(pending);
      } else if (error instanceof ApiRequestError && error.code === "DECISION_CONFLICT") {
        setNotice("The decision history changed before this action completed. History was reloaded; no decision was guessed or retried.");
        setPendingStale(null); setPendingSupersession(null);
        await reloadGovernance(pending.recommendationId);
      } else handleFailure(error);
    } finally { setActing(null); }
  };

  const requestDecision = (id: string, decisionType: string, head: Decision | null) => {
    const pending = {
      recommendationId: id, decisionType, supersedesDecisionId: head?.id || null,
      idempotencyKey: crypto.randomUUID(),
    };
    if (head) setPendingSupersession(pending);
    else void sendDecision(pending, false);
  };

  return (
    <main className="loadder-dashboard-bg min-h-screen text-white">
      <header className="border-b border-white/[0.07] bg-[#030617]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between gap-5 px-5 py-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" aria-label="Back to dashboard" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.08] hover:text-white"><ArrowLeft size={18} /></Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 text-violet-200"><Brain size={26} weight="duotone" /></div>
            <div><h1 className="text-xl font-semibold md:text-2xl">Intelligence Governance</h1><p className="mt-1 text-sm text-white/45">Internal control center for evidence, review, and business intent</p></div>
          </div>
          <button onClick={() => void refresh()} disabled={refreshing || loading} className="flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-50">
            {refreshing ? <SpinnerGap size={17} className="animate-spin" /> : <Pulse size={17} />} Refresh Intelligence
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1450px] space-y-8 px-5 py-8 md:px-8">
        {authError && <div className="rounded-2xl border border-rose-300/20 bg-rose-500/[0.08] px-5 py-4 text-sm text-rose-100">Your authenticated session cannot access the active workspace intelligence.</div>}
        {errors.map((error) => <div key={error} className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.06] px-5 py-4 text-sm text-amber-100">{error}</div>)}
        {notice && <div className="rounded-2xl border border-violet-300/20 bg-violet-500/[0.08] px-5 py-4 text-sm text-violet-100">{notice}</div>}

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

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="text-lg font-semibold">Recommendation Intelligence</h2><p className="mt-1 max-w-2xl text-sm text-white/40">Advisory considerations derived from semantic findings. Recommendations never authorize execution.</p></div>
            <button type="button" onClick={() => void calculateRecommendations()} disabled={!mention || calculating} className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35">
              {calculating && <SpinnerGap size={16} className="animate-spin" />} Calculate Recommendations
            </button>
          </div>
          {!recommendations.length ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <h3 className="font-semibold text-white/65">No recommendation records</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-white/35">{mention ? "Calculation is explicit because it persists immutable recommendation records." : "Listening evidence is required before recommendations can be calculated."}</p>
            </div>
          ) : <div className="space-y-5">{recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id} recommendation={recommendation}
              governance={governance[recommendation.id]} role={role}
              canReview={canReview} canDecide={canDecide}
              busy={Boolean(acting?.startsWith(recommendation.id))}
              onReview={(reviewType) => void createReview(recommendation.id, reviewType)}
              onDecision={(decisionType, head) => requestDecision(recommendation.id, decisionType, head)}
            />
          ))}</div>}
        </section>

        <section>
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/60">Action Proposal</div>
            <h2 className="mt-2 text-lg font-semibold">Controlled Action Proposals</h2>
            <p className="mt-1 max-w-3xl text-sm text-white/40">Immutable previews only. Authorization is required by design, but authorization and execution are not available in Phase 4I v1.</p>
          </div>
          {!actionProposals.length ? (
            <div className="rounded-[24px] border border-dashed border-violet-300/15 bg-violet-500/[0.035] p-7">
              <div className="flex flex-wrap gap-2"><StatusPill status="NON-EXECUTING" /><StatusPill status="EXECUTION ELIGIBLE: NO" /><StatusPill status="AUTHORIZATION REQUIRED" /></div>
              <h3 className="mt-5 font-semibold text-white/70">NO ACTION PROPOSAL CONTRACT IS CURRENTLY APPROVED</h3>
              <p className="mt-2 text-sm text-white/40">The current evidence-review recommendations do not justify a specific external mutation. No external action will occur.</p>
            </div>
          ) : <div className="space-y-4">{actionProposals.map((proposal) => (
            <article key={proposal.id} className="rounded-[24px] border border-violet-300/15 bg-violet-500/[0.035] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-[0.18em] text-violet-200/60">Action Proposal</div><h3 className="mt-2 text-xl font-semibold">{displayState(proposal.actionType)}</h3></div><div className="flex flex-wrap gap-2"><StatusPill status="NON-EXECUTING" /><StatusPill status="EXECUTION ELIGIBLE: NO" /><StatusPill status="AUTHORIZATION REQUIRED" /></div></div>
              <p className="mt-4 text-sm text-white/45">No external action will occur.</p>
              <dl className="mt-5 grid gap-4 border-t border-white/[0.07] pt-5 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <Meta label="Proposal ID" value={proposal.id} mono /><Meta label="Decision ID" value={proposal.decisionId} mono />
                <Meta label="Recommendation ID" value={proposal.recommendationId} mono /><Meta label="Version / schema" value={`${proposal.actionVersion} / ${proposal.schemaVersion}`} />
                <Meta label="Subject" value={`${proposal.subjectType} · ${proposal.subjectKey}`} /><Meta label="Target" value={`${proposal.targetType} · ${proposal.targetKey}`} />
                <Meta label="Risk class" value={proposal.riskClass} /><Meta label="Created by" value={`${proposal.createdByRole} · ${formatDate(proposal.createdAt)}`} />
                <div className="sm:col-span-2"><Meta label="Input manifest hash" value={proposal.inputManifestHash} mono /></div><div className="sm:col-span-2"><Meta label="Proposal hash" value={proposal.proposalHash} mono /></div>
              </dl>
            </article>
          ))}</div>}
        </section>

        <section>
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/60">Authorization</div>
            <h2 className="mt-2 text-lg font-semibold">Authorization History</h2>
            <p className="mt-1 max-w-3xl text-sm text-white/40">Authorization records permission only. It does not perform an action.</p>
          </div>
          {!authorizations.length ? (
            <div className="rounded-[24px] border border-dashed border-sky-300/15 bg-sky-500/[0.035] p-7">
              <div className="flex flex-wrap gap-2"><StatusPill status="AUTHORIZATION — NOT AVAILABLE" /><StatusPill status="NON-EXECUTING" /></div>
              <h3 className="mt-5 font-semibold text-white/70">Current proposals are non-executable.</h3>
              <p className="mt-2 text-sm text-white/40">No authorization policy is currently approved. Authorization records permission only. It does not perform an action.</p>
            </div>
          ) : <div className="space-y-4">{authorizations.map((authorization) => (
            <History key={authorization.id} title={authorization.authorizationPolicy} meta={`owner · ${formatDate(authorization.authorizedAt)}`} id={authorization.id} details={[`Proposal: ${authorization.actionProposalId}`, `Policy version: ${authorization.authorizationPolicyVersion}`, `Expires: ${formatDate(authorization.expiresAt)}`, `Confirmation: ${authorization.confirmationHash}`]} badges={["AUTHORIZED", "EXECUTION NOT STARTED"]} />
          ))}</div>}
        </section>

        <section>
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200/60">Execution Request</div>
            <h2 className="mt-2 text-lg font-semibold">Execution Request History</h2>
            <p className="mt-1 max-w-3xl text-sm text-white/40">Immutable logical intent only. Request persistence does not call a provider, enqueue work, or perform an action.</p>
          </div>
          {!executionRequests.length ? (
            <div className="rounded-[24px] border border-dashed border-fuchsia-300/15 bg-fuchsia-500/[0.035] p-7">
              <div className="flex flex-wrap gap-2"><StatusPill status="EXECUTION REQUEST — NOT AVAILABLE" /><StatusPill status="NON-EXECUTING" /></div>
              <h3 className="mt-5 font-semibold text-white/70">No execution-capable requests available.</h3>
              <p className="mt-2 text-sm text-white/40">No request policy is currently approved. No provider call, job, attempt, result, or external mutation can begin here.</p>
            </div>
          ) : <div className="space-y-4">{executionRequests.map((request) => (
            <History key={request.id} title={request.actionType} meta={`${request.requestedByRole} · ${formatDate(request.requestedAt)}`} id={request.id} details={[`Authorization: ${request.executionAuthorizationId}`, `Proposal: ${request.actionProposalId}`, `Policy: ${request.requestPolicy}@${request.requestPolicyVersion}`, `Expires: ${formatDate(request.requestExpiresAt)}`, `Fingerprint: ${request.requestFingerprint}`]} badges={["REQUEST RECORDED", "EXECUTION NOT STARTED"]} />
          ))}</div>}
        </section>

        <section className="rounded-[28px] border border-amber-300/15 bg-amber-500/[0.045] p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/65">Execution</div>
          <h2 className="mt-3 text-xl font-semibold">NOT AVAILABLE</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/50">Decisions recorded here represent business intent only. No external action, campaign, message, provider operation, automation, or execution is initiated from this page.</p>
        </section>

        <footer className="rounded-[24px] border border-white/[0.07] bg-black/20 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">System</div><div className="flex flex-wrap gap-3"><SystemItem label="Context" status={contextStatus === "READY" ? "READY" : contextStatus === "MISSING" ? "NO DATA" : contextStatus === "STALE" ? "ERROR" : "ERROR"} /><SystemItem label="Listening" status={listeningStatus} /><SystemItem label="Semantic" status={semanticStatus} /><SystemItem label="Recommendations" status={recommendationStatus} /><SystemItem label="Governance" status={governanceStatus} /></div></div>
        </footer>
        {loading && <div className="fixed inset-0 flex items-center justify-center bg-[#030617]/65 backdrop-blur-sm"><SpinnerGap size={30} className="animate-spin text-violet-200" /></div>}
      </div>
      {pendingSupersession && <Confirm title="Supersede the active decision?" body="This creates a new immutable decision linked to the current decision. It does not edit history or authorize execution." confirm="Record superseding decision" onCancel={() => setPendingSupersession(null)} onConfirm={() => void sendDecision(pendingSupersession, false)} />}
      {pendingStale && <Confirm title="Recommendation context is stale" body="The server detected that this recommendation no longer reflects the active context. Confirm deliberately to record the decision with stale context; no execution will occur." confirm="Confirm stale-context decision" onCancel={() => setPendingStale(null)} onConfirm={() => void sendDecision(pendingStale, true)} />}
    </main>
  );
}

function SystemItem({ label, status }: { label: string; status: SystemStatus }) {
  const dot = status === "READY" ? "bg-emerald-300" : status === "ERROR" ? "bg-rose-300" : "bg-amber-200";
  return <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white/55"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label} <span className="text-white/80">{status}</span></div>;
}

function ActionButton({ children, disabled, onClick, active = false }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; active?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-violet-300/35 bg-violet-500/20 text-violet-100" : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.09] hover:text-white"}`}>{children}</button>;
}

function RecommendationCard({ recommendation, governance, role, canReview, canDecide, busy, onReview, onDecision }: {
  recommendation: Recommendation; governance?: Governance; role?: string; canReview: boolean;
  canDecide: boolean; busy: boolean; onReview: (type: string) => void;
  onDecision: (type: string, head: Decision | null) => void;
}) {
  const reviews = governance?.reviews || [];
  const decisions = governance?.decisions || [];
  const superseded = new Set(decisions.map((decision) => decision.supersedesDecisionId).filter(Boolean));
  const head = decisions.find((decision) => !superseded.has(decision.id)) || null;
  return (
    <article className="overflow-hidden rounded-[28px] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/[0.07] via-[#090c16] to-violet-500/[0.06]">
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/60">{displayState(recommendation.recommendationType)}</div><h3 className="mt-3 text-2xl font-semibold">{displayState(recommendation.considerationCode)}</h3><p className="mt-3 max-w-3xl text-sm leading-7 text-white/50">{displayState(recommendation.rationaleCode)}</p></div>
          <StatusPill status={recommendation.reviewPriority} />
        </div>
        <dl className="mt-6 grid gap-4 border-t border-white/[0.07] pt-5 text-xs sm:grid-cols-2 xl:grid-cols-4">
          <Meta label="Recommendation ID" value={recommendation.id} mono />
          <Meta label="Version / schema" value={`${recommendation.recommendationVersion} / ${recommendation.schemaVersion}`} />
          <Meta label="Subject" value={`${recommendation.subjectType} · ${recommendation.subjectKey}`} />
          <Meta label="Calculated" value={formatDate(recommendation.calculatedAt)} />
          <Meta label="Point-in-time cutoff" value={formatDate(recommendation.pointInTimeCutoff)} />
          <Meta label="Context Version" value={recommendation.contextVersionId || "Not available"} mono />
          <Meta label="Semantic findings" value={String(recommendation.semanticFindingCount)} />
          <Meta label="Confidence state" value={recommendation.confidence === null ? `NO CONFIDENCE SCORE · ${displayState(recommendation.confidenceReason)}` : `${recommendation.confidence} · ${displayState(recommendation.confidenceReason)}`} />
          <Meta label="Producer" value={`${recommendation.producer} · ${recommendation.producerVersion}`} />
          <div className="sm:col-span-2 xl:col-span-4"><Meta label="Semantic Manifest Hash" value={recommendation.semanticManifestHash} mono /></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2"><StatusPill status="ADVISORY ONLY" /><StatusPill status="NON-CAUSAL" /><StatusPill status="NOT EXECUTABLE" /></div>
        <details className="group mt-5 rounded-2xl border border-white/[0.07] bg-black/20"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-white/60"><span>Provenance</span><CaretDown size={16} className="transition group-open:rotate-180" /></summary><pre className="overflow-auto border-t border-white/[0.07] p-4 text-xs leading-6 text-white/55">{JSON.stringify(recommendation.provenance, null, 2)}</pre></details>
      </div>
      <div className="grid border-t border-white/[0.08] xl:grid-cols-2">
        <GovernancePanel title="Human Reviews" note={canReview ? `Available to ${role}. Reviews are immutable and do not change recommendation validity.` : "No active review authority."} actions={<><ActionButton disabled={!canReview || busy} onClick={() => onReview("ACKNOWLEDGED")}>Acknowledge</ActionButton><ActionButton disabled={!canReview || busy} onClick={() => onReview("DISMISSED")}>Dismiss</ActionButton><ActionButton disabled={!canReview || busy} onClick={() => onReview("REQUEST_MORE_EVIDENCE")}>Request more evidence</ActionButton></>} empty="No human reviews recorded.">
          {reviews.length ? reviews.map((review) => <History key={review.id} title={displayState(review.reviewType)} meta={`${review.reviewerRole} · ${formatDate(review.reviewedAt)}`} id={review.id} />) : null}
        </GovernancePanel>
        <GovernancePanel title="Business Decisions" note={canDecide ? "Record decision. Freshness is checked by the server at submission." : `Read-only history. Decision authority requires owner or admin; current role: ${role || "unavailable"}.`} actions={<><ActionButton disabled={!canDecide || busy || head?.decisionType === "ADOPT"} onClick={() => onDecision("ADOPT", head)}>Record decision · Adopt</ActionButton><ActionButton disabled={!canDecide || busy || head?.decisionType === "DECLINE"} onClick={() => onDecision("DECLINE", head)}>Record decision · Decline</ActionButton><ActionButton disabled={!canDecide || busy || head?.decisionType === "DEFER"} onClick={() => onDecision("DEFER", head)}>Record decision · Defer</ActionButton></>} empty="No business decisions recorded.">
          <p className="rounded-xl border border-amber-300/10 bg-amber-500/[0.04] p-3 text-xs text-amber-100/70">Recording a decision does not perform any external action.</p>
          {decisions.length ? decisions.map((decision) => <History key={decision.id} title={displayState(decision.decisionType)} meta={`${decision.deciderRole} · ${formatDate(decision.decidedAt)}`} id={decision.id} details={[`Authority: ${displayState(decision.authorityClass)}`, `Supersedes: ${decision.supersedesDecisionId || "None"}`]} badges={[decision.observedFreshness, decision.executionAuthorizing ? "EXECUTION AUTHORIZING" : "NON-EXECUTING"]} />) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/35">No business decisions recorded.</p>}
        </GovernancePanel>
      </div>
    </article>
  );
}

function GovernancePanel({ title, note, actions, children, empty }: { title: string; note: string; actions: React.ReactNode; children: React.ReactNode; empty: string }) {
  return <section className="border-white/[0.08] p-6 xl:first:border-r"><h4 className="font-semibold">{title}</h4><p className="mt-2 text-xs leading-5 text-white/40">{note}</p><div className="mt-4 flex flex-wrap gap-2">{actions}</div><div className="mt-5 space-y-3">{children || <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/35">{empty}</p>}</div></section>;
}

function History({ title, meta, id, badges = [], details = [] }: { title: string; meta: string; id: string; badges?: string[]; details?: string[] }) {
  return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-white/75">{title}</span><div className="flex flex-wrap gap-1">{badges.map((badge) => <StatusPill key={badge} status={badge} />)}</div></div><div className="mt-2 text-xs text-white/40">{meta}</div>{details.map((detail) => <div key={detail} className="mt-1 break-all text-[11px] text-white/35">{detail}</div>)}<div className="mt-2 break-all font-mono text-[10px] text-white/25">{id}</div></div>;
}

function Confirm({ title, body, confirm, onCancel, onConfirm }: { title: string; body: string; confirm: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0a0d18] p-6 shadow-2xl"><h2 id="confirm-title" className="text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-7 text-white/50">{body}</p><div className="mt-6 flex justify-end gap-3"><ActionButton onClick={onCancel}>Cancel</ActionButton><ActionButton active onClick={onConfirm}>{confirm}</ActionButton></div></div></div>;
}
