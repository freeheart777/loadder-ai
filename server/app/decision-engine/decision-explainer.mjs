export function explainDecision({ action, score, evidence = [] }) {
  return {
    action: action?.id ?? null,
    score,
    confidence: action?.confidence ?? 0,
    evidence,
    reason: [
      'Matched business signals',
      'Evaluated historical confidence',
      'Passed decision guardrails',
    ],
  };
}
