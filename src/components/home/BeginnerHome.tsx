import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CaretLeft, CheckCircle, Toolbox, WarningCircle } from "@phosphor-icons/react";
import { apiFetch } from "../../lib/api";
import {
  BUTTON_LABELS,
  SIGNAL_MESSAGES,
  moreItemsSentence,
  scriptFor,
  statusSentence,
  type MissionControlItem,
} from "../../lib/beginnerCopy";
import RecommendationCard from "./RecommendationCard";

type MissionControl = {
  contractVersion: number;
  generatedAt: string;
  items: MissionControlItem[];
  banners: Array<{ code: string; staleReasons?: string[] }>;
  signalStatus: Array<{ signalId: string; status: "ok" | "failed" }>;
  bounds: { maxItems: number; truncated: boolean };
};

const MAX_SECONDARY = 2;

/**
 * Beginner Home.
 *
 * Reads only the canonical Mission Control contract and preserves its ordering:
 * the primary card is simply the first item the server returned. No client-side
 * ranking, scoring, or business inference happens here.
 */
export default function BeginnerHome({ userName, onOpenAllTools }: { userName?: string | null; onOpenAllTools: () => void }) {
  const [data, setData] = useState<MissionControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [declined, setDeclined] = useState<string[]>([]);
  const [promoted, setPromoted] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await apiFetch("/api/mission-control");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success || !body?.missionControl) throw new Error("MISSION_CONTROL_READ_FAILED");
      setData(body.missionControl as MissionControl);
    } catch {
      setFailed(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signalsFailed = useMemo(() => data?.signalStatus?.filter((entry) => entry.status === "failed") ?? [], [data]);
  const allSignalsFailed = Boolean(data?.signalStatus?.length && signalsFailed.length === data.signalStatus.length);
  const unreadable = failed || allSignalsFailed;

  const ordered = useMemo(() => {
    // Canonical order is the array order returned by the server. Only the
    // locally declined items are removed, and one item may be promoted.
    const remaining = (data?.items ?? []).map((item, index) => ({ item, key: `${item.signalId}:${index}` })).filter((entry) => !declined.includes(entry.key));
    const chosen = remaining.findIndex((entry) => entry.key === promoted);
    if (chosen > 0) return [remaining[chosen], ...remaining.filter((_, index) => index !== chosen)];
    return remaining;
  }, [data, declined, promoted]);

  const primary = ordered[0] ?? null;
  const secondary = ordered.slice(1, 1 + MAX_SECONDARY);
  const overflow = Math.max(0, ordered.length - 1 - MAX_SECONDARY);
  const firstName = userName?.trim().split(/\s+/)[0];

  if (loading && !data) {
    return (
      <Shell greeting={firstName}>
        <div aria-live="polite" className="h-52 animate-pulse rounded-[28px] bg-white/[0.04]" />
      </Shell>
    );
  }

  return (
    <Shell greeting={firstName}>
      {/* A — status sentence, derived only from the actionable item count. */}
      <p data-status-sentence className="text-2xl font-black leading-10 text-white sm:text-3xl">
        {unreadable ? "فعلاً وضعیت کسب‌وکار شما را نمی‌دانم." : statusSentence(ordered.length)}
      </p>

      {unreadable && (
        <div role="alert" data-signal-state="unreadable" className="mt-6 rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-6">
          <div className="flex items-center gap-2 font-bold text-amber-100">
            <WarningCircle size={20} />
            اطلاعات در دسترس نیست
          </div>
          <p className="mt-3 text-sm leading-8 text-amber-100/75">{SIGNAL_MESSAGES.allFailed}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-white px-5 text-sm font-bold text-slate-950"
          >
            {SIGNAL_MESSAGES.retry}
          </button>
        </div>
      )}

      {!unreadable && signalsFailed.length > 0 && (
        <div role="status" data-signal-state="partial" className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-sm leading-7 text-amber-100/80">
          <WarningCircle size={18} className="mt-1 shrink-0" />
          {SIGNAL_MESSAGES.partial}
        </div>
      )}

      {/* B — exactly one visually dominant recommendation. */}
      {!unreadable && primary && (
        <div className="mt-6">
          <RecommendationCard
            key={primary.key}
            item={primary.item}
            onDecline={() => {
              setDeclined((current) => [...current, primary.key]);
              setPromoted(null);
            }}
          />
        </div>
      )}

      {/* Empty state — never presented as proof that the business is healthy. */}
      {!unreadable && !primary && (
        <div data-empty-state className="mt-6 rounded-[28px] border border-emerald-300/15 bg-emerald-300/[0.05] p-8 text-center">
          <CheckCircle size={34} className="mx-auto text-emerald-300" />
          <p className="mt-4 text-base leading-8 text-white/70">
            {declined.length > 0 ? SIGNAL_MESSAGES.declined : SIGNAL_MESSAGES.emptyHint}
          </p>
        </div>
      )}

      {/* C — at most two subordinate, collapsed items. */}
      {!unreadable && secondary.length > 0 && (
        <ul data-secondary-list className="mt-4 space-y-2">
          {secondary.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                data-recommendation="secondary"
                onClick={() => setPromoted(entry.key)}
                className="flex min-h-11 w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-3 text-right"
              >
                <span className="min-w-0 text-sm leading-7 text-white/55">{scriptFor(entry.item.signalId).saw}</span>
                <CaretLeft size={16} className="shrink-0 text-white/30" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* D — one bounded line, never an alert feed. */}
      {!unreadable && overflow > 0 && (
        <p data-overflow-line className="mt-3 px-2 text-sm text-white/40">
          {moreItemsSentence(overflow)}
        </p>
      )}

      {/* F — low-prominence expert entry. */}
      <div className="mt-8 border-t border-white/[0.06] pt-5">
        <button
          type="button"
          onClick={onOpenAllTools}
          data-all-tools
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-2 text-sm text-white/45 transition hover:text-white/75"
        >
          <Toolbox size={18} />
          {BUTTON_LABELS.allTools}
        </button>
        {data && (
          <p className="mt-2 px-2 text-xs text-white/25">
            آخرین بررسی: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))}
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ greeting, children }: { greeting?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="beginner-home-title" className="mx-auto w-full max-w-3xl">
      <h1 id="beginner-home-title" className="text-sm font-bold text-white/40">
        {greeting ? `سلام ${greeting}` : "سلام"}
      </h1>
      <div className="mt-4">{children}</div>
    </section>
  );
}
