import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import {
  SIGNAL_MESSAGES, ZONE_LABELS, moreItemsSentence, scriptFor, statusSentence,
} from "../../lib/beginnerCopy";
import {
  readInProgress, readLearned, readMissionControl,
  type InProgress, type Learned, type MissionControl, type ZoneState,
} from "../../lib/homeData";
import RecommendationCard from "./RecommendationCard";
import { InProgressZone, LearnedZone, ToolsZone, Zone } from "./zones";

const MAX_SECONDARY = 2;

/**
 * Loadder Home — four permanent zones.
 *
 *   1. what needs you        2. what is in progress
 *   3. what Loadder learned  4. business tools, direct access
 *
 * Every zone reads an endpoint that already exists. No new endpoint, no
 * persistence, no workflow state, and no inference. A zone that cannot read its
 * source says so rather than showing an encouraging blank.
 *
 * Zone 1 preserves the canonical Mission Control order: the primary card is
 * simply the first item the server returned.
 */
export default function BeginnerHome({ userName }: { userName?: string | null }) {
  const [mission, setMission] = useState<ZoneState<MissionControl>>({ status: "loading", data: null });
  const [progress, setProgress] = useState<ZoneState<InProgress>>({ status: "loading", data: null });
  const [learned, setLearned] = useState<ZoneState<Learned>>({ status: "loading", data: null });
  const [declined, setDeclined] = useState<string[]>([]);
  const [promoted, setPromoted] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMission({ status: "loading", data: null });
    // Zones fail independently: one unreadable source never blanks the others.
    void readMissionControl().then((data) => setMission({ status: "ready", data })).catch(() => setMission({ status: "failed", data: null }));
    void readInProgress().then((data) => setProgress({ status: "ready", data })).catch(() => setProgress({ status: "failed", data: null }));
    void readLearned().then((data) => setLearned({ status: "ready", data })).catch(() => setLearned({ status: "failed", data: null }));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const data = mission.data;
  const signalsFailed = useMemo(() => data?.signalStatus?.filter((entry) => entry.status === "failed") ?? [], [data]);
  const allSignalsFailed = Boolean(data?.signalStatus?.length && signalsFailed.length === data.signalStatus.length);
  const unreadable = mission.status === "failed" || allSignalsFailed;

  const ordered = useMemo(() => {
    const remaining = (data?.items ?? [])
      .map((item, index) => ({ item, key: `${item.signalId}:${index}` }))
      .filter((entry) => !declined.includes(entry.key));
    const chosen = remaining.findIndex((entry) => entry.key === promoted);
    if (chosen > 0) return [remaining[chosen], ...remaining.filter((_, index) => index !== chosen)];
    return remaining;
  }, [data, declined, promoted]);

  const primary = ordered[0] ?? null;
  const secondary = ordered.slice(1, 1 + MAX_SECONDARY);
  const overflow = Math.max(0, ordered.length - 1 - MAX_SECONDARY);
  const firstName = userName?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-[13px] text-white/35">{firstName ? `سلام ${firstName}` : "سلام"}</p>

      {/* Zone 1 — needs your attention. Exactly one primary item. */}
      <Zone label={ZONE_LABELS.attention}>
        <p data-status-sentence className="mb-6 text-[24px] font-bold leading-[1.6] text-white sm:text-[30px]">
          {mission.status === "loading" ? "دارم نگاه می‌کنم…" : unreadable ? "فعلاً وضعیت کسب‌وکار شما را نمی‌دانم." : statusSentence(ordered.length)}
        </p>

        {unreadable && (
          <div role="alert" data-signal-state="unreadable" className="rounded-[26px] border border-amber-300/25 bg-amber-300/[0.06] p-6 sm:p-7">
            <div className="flex items-center gap-2 font-bold text-amber-100"><WarningCircle size={19} />اطلاعات در دسترس نیست</div>
            <p className="mt-3 text-[15px] leading-[1.95] text-amber-100/75">{SIGNAL_MESSAGES.allFailed}</p>
            <button type="button" onClick={() => void load()} className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-white px-5 text-[14px] font-bold text-slate-950">{SIGNAL_MESSAGES.retry}</button>
          </div>
        )}

        {!unreadable && signalsFailed.length > 0 && (
          <div role="status" data-signal-state="partial" className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] p-4 text-[14px] leading-[1.9] text-amber-100/75">
            <WarningCircle size={17} className="mt-1 shrink-0" />{SIGNAL_MESSAGES.partial}
          </div>
        )}

        {!unreadable && primary && (
          <RecommendationCard
            key={primary.key}
            item={primary.item}
            onDecline={() => { setDeclined((current) => [...current, primary.key]); setPromoted(null); }}
          />
        )}

        {!unreadable && mission.status === "ready" && !primary && (
          <div data-empty-state className="rounded-[26px] border border-emerald-300/15 bg-emerald-300/[0.05] p-7 text-center">
            <CheckCircle size={30} className="mx-auto text-emerald-300/80" />
            <p className="mt-4 text-[15px] leading-[1.95] text-white/65">
              {declined.length > 0 ? SIGNAL_MESSAGES.declined : SIGNAL_MESSAGES.emptyHint}
            </p>
          </div>
        )}

        {!unreadable && secondary.length > 0 && (
          <ul data-secondary-list className="mt-3 space-y-2">
            {secondary.map((entry) => (
              <li key={entry.key}>
                <button type="button" data-recommendation="secondary" onClick={() => setPromoted(entry.key)}
                  className="flex min-h-11 w-full items-center rounded-2xl border border-white/[0.06] bg-white/[0.018] px-5 py-3 text-right text-[14px] leading-[1.9] text-white/50">
                  {scriptFor(entry.item.signalId).saw}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!unreadable && overflow > 0 && (
          <p data-overflow-line className="mt-3 px-2 text-[13px] text-white/30">{moreItemsSentence(overflow)}</p>
        )}
      </Zone>

      {/* Zone 2 — in progress. Counted canonical records, never a progress bar. */}
      <InProgressZone state={progress} />

      {/* Zone 3 — what Loadder learned. Observation plus its boundary, or nothing. */}
      <LearnedZone state={learned} />

      {/* Zone 4 — business tools, always directly reachable. */}
      <ToolsZone />

      {data && (
        <p className="mt-8 px-1 text-[12px] text-white/20">
          آخرین بررسی: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))}
        </p>
      )}
    </div>
  );
}
