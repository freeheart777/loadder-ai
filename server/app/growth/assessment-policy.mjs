export const GROWTH_ASSESSMENT_POLICY = Object.freeze({
  version:'growth-review-readiness/1',
  maxEvidenceLinks:200,
  minimumDistinctOutcomes:1,
  supportedMetric:'lead_count',
  acceptedEvidenceKind:'CRM_CONVERSION',
  acceptedAuthorityClass:'REPORTED', // Existing CRM schema; canonical CRM fact is independently verified.
  completeness:'ALL_RECORDED_LINKS_FOR_PINNED_TREATMENT_NOT_ALL_BUSINESS_OUTCOMES',
  freshness:'CURRENT_CONTEXT_AND_UNSUPERSEDED_EVIDENCE_WITHIN_MEASUREMENT_WINDOW',
  duplicateKey:'CANONICAL_CRM_LEAD_ID',
  actionableMeaning:'READY_FOR_HUMAN_REVIEW_ONLY',
});

export function assessGrowthReadiness({goal,windowComplete,truncated,validCount,invalidCount,baselineValid,hasEvidence}) {
  const reasons=[];
  if(goal.metric!==GROWTH_ASSESSMENT_POLICY.supportedMetric) reasons.push('UNSUPPORTED_METRIC_AUTHORITY');
  if(!windowComplete) reasons.push('INCOMPLETE_WINDOW');
  if(truncated) reasons.push('TRUNCATED_EVIDENCE');
  if(!baselineValid) reasons.push('BASELINE_UNKNOWN_OR_UNVERIFIED');
  if(invalidCount) reasons.push('STALE_OR_UNSUPPORTED_EVIDENCE');
  if(!hasEvidence || validCount<GROWTH_ASSESSMENT_POLICY.minimumDistinctOutcomes) reasons.push('INSUFFICIENT_EVIDENCE');
  return {state:reasons.length?'INCONCLUSIVE':'ACTIONABLE',reasons,
    observedCount:validCount,meaning:GROWTH_ASSESSMENT_POLICY.actionableMeaning,
    baselineComparability:'UNKNOWN',effectiveness:'INCONCLUSIVE',attribution:'UNKNOWN',causality:'INCONCLUSIVE',
    denominator:'NOT_APPLICABLE_ABSOLUTE_COUNT',uplift:null};
}
