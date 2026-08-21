const CONFIDENCE_REASON = "DETERMINISTIC_POLICY_NOT_OUTCOME_CALIBRATED";
const output = (considerationCode, rationaleCode, reviewPriority) => ({ considerationCode, rationaleCode, reviewPriority, confidence: null, confidenceReason: CONFIDENCE_REASON });

export function produceAttentionEvidenceReview(finding) {
  if (finding.state === "SURGING") return output("REVIEW_ATTENTION_SPIKE", "ATTENTION_RISING_WITH_ELEVATED_ANOMALY", "HIGH");
  if (finding.state === "RISING") return output("REVIEW_ATTENTION_INCREASE", "ATTENTION_RISING", "MEDIUM");
  if (finding.state === "FALLING") return output("REVIEW_ATTENTION_DECLINE", "ATTENTION_FALLING", "MEDIUM");
  return null;
}

export function produceCompetitiveVisibilityEvidenceReview(finding) {
  return finding.state === "TRAILING"
    ? output("REVIEW_COMPETITIVE_VISIBILITY_GAP", "TRACKED_COMPETITOR_VISIBILITY_EXCEEDS_BRAND", "MEDIUM")
    : null;
}
