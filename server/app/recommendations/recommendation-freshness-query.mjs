export function createRecommendationFreshnessQuery({ recommendationRepository, currentContextState }) {
  return Object.freeze({ resolve(recommendation) {
    if (recommendationRepository.findNewerForIdentity(recommendation)) return "SUPERSEDED";
    const context = currentContextState();
    return !context.isStale && context.contextVersionId === recommendation.contextVersionId ? "CURRENT" : "STALE_CONTEXT";
  }});
}
