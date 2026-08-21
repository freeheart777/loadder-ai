import { LISTENING_ANOMALY_POLICY } from "./listening-intelligence-contracts.mjs";

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function calculateListeningAnomaly({ repository, mention, currentCount, request, calculatedAt, hash }) {
  const history = repository.listAggregates({ metricType: "mention_count", limit: 100 })
    .filter((aggregate) => aggregate.id !== mention.id && aggregate.window === request.window && aggregate.windowEnd <= request.start && aggregate.state === "available")
    .slice(0, 30)
    .map((aggregate) => aggregate.value);
  const common = { metricType: "mention_count", aggregateId: mention.id, current: currentCount, sampleCount: history.length, method: "median_mad", baselineStart: null, baselineEnd: request.start, at: calculatedAt, producerKey: hash([mention.id, "median_mad", 1]), provenance: { policy: LISTENING_ANOMALY_POLICY, noFutureLeakage: true } };
  if (history.length < LISTENING_ANOMALY_POLICY.minimumSamples) {
    return repository.createAnomaly({ ...common, state: "insufficient_data", score: null, center: null, dispersion: null, explanation: `At least ${LISTENING_ANOMALY_POLICY.minimumSamples} prior observations are required.` });
  }
  const center = median(history);
  const mad = median(history.map((value) => Math.abs(value - center)));
  const score = mad === 0 ? (currentCount === center ? 0 : null) : 0.6745 * Math.abs(currentCount - center) / mad;
  const state = score === null ? "normal" : score >= 3 ? "anomalous" : score >= 2 ? "elevated" : "normal";
  return repository.createAnomaly({ ...common, state, score, center, dispersion: mad, explanation: mad === 0 ? "Baseline MAD is zero; no finite anomaly score is asserted." : `Robust z-score ${score.toFixed(4)} from prior windows only.` });
}
