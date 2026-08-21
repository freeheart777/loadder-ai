const definitions = [
  {
    recommendationType: "attention_evidence_review", recommendationVersion: 1, schemaVersion: 1,
    producer: "deterministic_attention_evidence_review", producerVersion: "1.0", policyVersion: "1.0",
    subjectTypes: ["listening_scope"], scopeKeys: ["window"], scopeWindows: ["1h", "24h", "7d", "30d"],
    allowedConsiderationCodes: ["REVIEW_ATTENTION_SPIKE", "REVIEW_ATTENTION_INCREASE", "REVIEW_ATTENTION_DECLINE"],
    allowedRationaleCodes: ["ATTENTION_RISING_WITH_ELEVATED_ANOMALY", "ATTENTION_RISING", "ATTENTION_FALLING"],
    allowedReviewPriorities: ["MEDIUM", "HIGH"], semanticType: "listening_attention_state",
    recommendationStates: ["SURGING", "RISING", "FALLING"], noRecommendationStates: ["STABLE", "INSUFFICIENT_EVIDENCE"], contextRequired: true,
  },
  {
    recommendationType: "competitive_visibility_evidence_review", recommendationVersion: 1, schemaVersion: 1,
    producer: "deterministic_competitive_visibility_evidence_review", producerVersion: "1.0", policyVersion: "1.0",
    subjectTypes: ["listening_scope"], scopeKeys: ["window"], scopeWindows: ["1h", "24h", "7d", "30d"],
    allowedConsiderationCodes: ["REVIEW_COMPETITIVE_VISIBILITY_GAP"],
    allowedRationaleCodes: ["TRACKED_COMPETITOR_VISIBILITY_EXCEEDS_BRAND"], allowedReviewPriorities: ["MEDIUM"],
    semanticType: "competitive_visibility_state", recommendationStates: ["TRAILING"],
    noRecommendationStates: ["LEADING", "PARITY", "INSUFFICIENT_EVIDENCE"], contextRequired: true,
  },
].map((entry) => Object.freeze(Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze(value) : value]))));

const contracts = new Map(definitions.map((entry) => [entry.recommendationType, entry]));
export const recommendationContractRegistry = Object.freeze({
  get: (type) => contracts.get(type) || null,
  list: () => [...contracts.values()],
});
