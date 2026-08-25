// Loadder Confidence Engine v1
// Keeps knowledge evidence-driven.

export function calculateConfidence({ evidenceCount = 0, successfulOutcomes = 0, totalOutcomes = 0 }) {
  const outcomeRate = totalOutcomes ? successfulOutcomes / totalOutcomes : 0;
  const evidenceFactor = Math.min(evidenceCount / 10, 1);

  return Number(((outcomeRate * 0.7) + (evidenceFactor * 0.3)).toFixed(2));
}
