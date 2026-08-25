export function createPatternExtractor() {
  return {
    fromExperimentOutcome(outcome) {
      if (!outcome) return null;

      return {
        type: 'business_growth_pattern',
        problem: outcome.problem || null,
        intervention: outcome.intervention || null,
        outcome: outcome.metrics || {},
        evidenceCount: 1,
        confidence: outcome.confidence || 0,
      };
    },
  };
}
