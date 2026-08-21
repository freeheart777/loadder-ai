import { LISTENING_TREND_POLICY } from "./listening-intelligence-contracts.mjs";

export function calculateListeningTrend({ repository, mention, baseline, currentCount, previousCount, request, calculatedAt, contextVersionId, hash }) {
  const delta = currentCount - previousCount;
  const relative = previousCount ? delta / previousCount : null;
  let state = "stable";
  if (relative !== null && relative >= LISTENING_TREND_POLICY.risingRelativeDelta) state = "rising";
  if (relative !== null && relative <= LISTENING_TREND_POLICY.fallingRelativeDelta) state = "falling";
  if (!previousCount) state = "insufficient_data";
  return repository.createTrend({
    signalType: state === "rising" ? "mention_volume_rising" : state === "falling" ? "mention_volume_falling" : "mention_volume_trend",
    currentId: mention.id,
    baselineId: baseline.id,
    state,
    severity: relative !== null && Math.abs(relative) >= 1 ? "high" : state === "stable" ? "info" : "medium",
    current: currentCount,
    baseline: previousCount,
    delta,
    relative,
    confidenceReason: LISTENING_TREND_POLICY.confidenceReason,
    windowStart: request.start,
    windowEnd: request.end,
    at: calculatedAt,
    contextVersionId,
    producerKey: hash([mention.id, baseline.id, LISTENING_TREND_POLICY.version]),
    provenance: { policy: LISTENING_TREND_POLICY },
  });
}
