const result = (state) => ({ state, value: null, confidence: null, confidenceReason: "NOT_STATISTICALLY_CALIBRATED" });

export function produceListeningAttention({ mention, trend, anomaly }) {
  if (!mention || mention.state !== "available" || !trend || trend.state === "insufficient_data") return result("INSUFFICIENT_EVIDENCE");
  if (trend.state === "rising" && ["elevated", "anomalous"].includes(anomaly?.state)) return result("SURGING");
  if (trend.state === "rising") return result("RISING");
  if (trend.state === "falling") return result("FALLING");
  if (trend.state === "stable") return result("STABLE");
  return result("INSUFFICIENT_EVIDENCE");
}

export function produceCompetitiveVisibility({ shareOfVoice, competitorMentions }) {
  const scope = shareOfVoice?.provenance?.entitySet;
  const hasCompetitors = Array.isArray(scope?.competitors) && scope.competitors.length > 0;
  if (!hasCompetitors || shareOfVoice?.state !== "available" || !Number.isFinite(shareOfVoice.denominator) || shareOfVoice.denominator <= 0 || competitorMentions?.state !== "available") return result("INSUFFICIENT_EVIDENCE");
  const brand = shareOfVoice.numerator;
  const competitor = competitorMentions.value;
  if (!Number.isFinite(brand) || !Number.isFinite(competitor)) return result("INSUFFICIENT_EVIDENCE");
  return result(brand > competitor ? "LEADING" : brand < competitor ? "TRAILING" : "PARITY");
}
