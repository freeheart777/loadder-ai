const boundedText = (value, maximum) => {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return [...text].slice(0, maximum).join("");
};
const boundedArray = (value, maximumItems, maximumCharacters) => Array.isArray(value)
  ? value.slice(0, maximumItems).map((item) => boundedText(item, maximumCharacters)).filter(Boolean)
  : [];

export function projectGenerationContext(contextResult, brief) {
  const snapshot = contextResult.context;
  if (!snapshot || typeof snapshot !== "object") throw new Error("Business Context projection is unavailable.");
  const identity = snapshot.identity || {};
  const strategy = snapshot.strategy || {};
  const audiences = snapshot.audiences || {};
  const brand = snapshot.brand || {};
  const offeringSummary = boundedArray(snapshot.offerings, 5, 500).join("؛ ") || brief.offering;
  return Object.freeze({
    contextVersionId: contextResult.contextVersionId,
    business: Object.freeze({
      name: boundedText(identity.businessName, 200),
      industry: boundedText(identity.industry, 120),
      description: boundedText(identity.description, 1000),
    }),
    offering: Object.freeze({ summary: boundedText(offeringSummary, 1200) }),
    audience: Object.freeze({
      segments: Object.freeze(boundedArray(audiences.targetAudiences, 10, 300)),
      refinement: brief.audienceRefinement,
    }),
    differentiators: Object.freeze(boundedArray(strategy.differentiators, 10, 300)),
    brand: Object.freeze({
      personality: Object.freeze(boundedArray(brand.personality, 10, 120)),
      tone: boundedText(brand.tone || brand.voice, 300),
      prohibitedClaims: Object.freeze(boundedArray(brand.prohibitedPatterns, 20, 300)),
      requiredPhrases: Object.freeze(boundedArray(brand.keyPhrases, 20, 200)),
    }),
    language: brief.language,
  });
}
