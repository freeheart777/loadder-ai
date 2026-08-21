export const ONBOARDING_STEPS = Object.freeze({
  BUSINESS: "BUSINESS",
  OFFERING: "OFFERING",
  AUDIENCE: "AUDIENCE",
  BRAND: "BRAND",
  REVIEW: "REVIEW",
  COMPLETE: "COMPLETE",
});

const textLength = (value) => typeof value === "string" ? value.trim().length : 0;
const boundedList = (value, { min, max, itemMax }) =>
  Array.isArray(value) && value.length >= min && value.length <= max &&
  value.every((item) => textLength(item) > 0 && textLength(item) <= itemMax);

export function profileMeetsOnboardingMinimum(profile) {
  return Boolean(profile) &&
    textLength(profile.name) >= 2 && textLength(profile.name) <= 120 &&
    textLength(profile.industry) >= 2 && textLength(profile.industry) <= 120 &&
    textLength(profile.description) >= 20 && textLength(profile.description) <= 1000;
}

export function offeringMeetsOnboardingMinimum(dna) {
  return Boolean(dna) &&
    boundedList(dna.offerings, { min: 1, max: 10, itemMax: 200 }) &&
    textLength(dna.valueProposition) >= 20 && textLength(dna.valueProposition) <= 500 &&
    boundedList(dna.differentiators, { min: 1, max: 5, itemMax: 300 });
}

export function audienceMeetsOnboardingMinimum(dna, brand) {
  return Boolean(dna && brand) &&
    boundedList(dna.targetAudiences, { min: 1, max: 1, itemMax: 1000 }) &&
    (!dna.goals || boundedList(dna.goals, { min: 0, max: 3, itemMax: 500 })) &&
    textLength(brand.brandIdentity?.audienceProblem) > 0 &&
    textLength(brand.brandIdentity?.audienceProblem) <= 1000;
}

export function brandMeetsOnboardingMinimum(brand) {
  return Boolean(brand) &&
    boundedList(brand.brandPersonality, { min: 2, max: 4, itemMax: 100 }) &&
    textLength(brand.toneOfVoice) > 0 && textLength(brand.toneOfVoice) <= 3000 &&
    (!brand.keyPhrases || boundedList(brand.keyPhrases, { min: 0, max: 10, itemMax: 500 })) &&
    (!brand.prohibitedPatterns || boundedList(brand.prohibitedPatterns, { min: 0, max: 10, itemMax: 300 }));
}

export function deriveOnboardingStatus({ profile, dnaState, brandState, contextState }) {
  const dnaCandidate = dnaState.latestDraft || dnaState.activeVersion;
  const brandCandidate = brandState.latestDraft || brandState.activeVersion;
  const profileComplete = profileMeetsOnboardingMinimum(profile);
  const offeringComplete = offeringMeetsOnboardingMinimum(dnaCandidate);
  const audienceComplete = audienceMeetsOnboardingMinimum(dnaCandidate, brandCandidate);
  const brandComplete = brandMeetsOnboardingMinimum(brandCandidate);
  const activeSourcesComplete = offeringMeetsOnboardingMinimum(dnaState.activeVersion) &&
    audienceMeetsOnboardingMinimum(dnaState.activeVersion, brandState.activeVersion) &&
    brandMeetsOnboardingMinimum(brandState.activeVersion);
  const contextStale = Boolean(contextState.activeContext && contextState.isStale);
  const contextReady = Boolean(
    contextState.activeContext && !contextStale &&
    contextState.activeContext.contextSchemaVersion === "1.0"
  );
  const complete = profileComplete && activeSourcesComplete && contextReady;
  const currentStep = !profileComplete ? ONBOARDING_STEPS.BUSINESS
    : !offeringComplete ? ONBOARDING_STEPS.OFFERING
      : !audienceComplete ? ONBOARDING_STEPS.AUDIENCE
        : !brandComplete ? ONBOARDING_STEPS.BRAND
          : complete ? ONBOARDING_STEPS.COMPLETE : ONBOARDING_STEPS.REVIEW;

  return Object.freeze({
    complete,
    currentStep,
    profileComplete,
    offeringComplete,
    audienceComplete,
    brandComplete,
    contextReady,
    contextStale,
    dnaDraftId: dnaState.latestDraft?.id || null,
    brandDraftId: brandState.latestDraft?.id || null,
  });
}
