// Loadder Diagnosis Evidence Engine v1
// Never returns diagnosis without evidence.

export function buildEvidenceSnapshot(observations = {}) {
  const evidence = [];

  if (observations.revenueChange < 0) {
    evidence.push({ signal: "revenue_down", value: observations.revenueChange });
  }

  if (observations.conversionChange < 0) {
    evidence.push({ signal: "conversion_down", value: observations.conversionChange });
  }

  if (observations.repeatPurchaseChange < 0) {
    evidence.push({ signal: "repeat_purchase_down", value: observations.repeatPurchaseChange });
  }

  return evidence;
}

export function hasEvidence(evidence, requiredSignals = []) {
  return requiredSignals.every(signal =>
    evidence.some(item => item.signal === signal)
  );
}
