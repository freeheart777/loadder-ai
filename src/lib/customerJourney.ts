import type { OnboardingStatus } from "../components/onboarding/types";

export const DIRECT_SERVICE_DESTINATIONS = Object.freeze({
  WEBSITE: "/dashboard/websites/new",
  LANDING: "/dashboard/landings/new",
  CONTENT: "/dashboard/content",
} as const);

export const BUSINESS_DIAGNOSIS_DESTINATION = "/dashboard/diagnosis";
export const BUSINESS_FOUNDATION_DESTINATION = "/dashboard/business-brain";

const SAFE_RETURN_DESTINATIONS = new Set<string>([
  ...Object.values(DIRECT_SERVICE_DESTINATIONS),
  BUSINESS_DIAGNOSIS_DESTINATION,
  BUSINESS_FOUNDATION_DESTINATION,
]);

export function safeReturnDestination(value: string | null | undefined) {
  return typeof value === "string" && SAFE_RETURN_DESTINATIONS.has(value) ? value : null;
}

export function onboardingPathFor(returnTo?: string | null) {
  const safe = safeReturnDestination(returnTo);
  return safe ? `/dashboard/onboarding?returnTo=${encodeURIComponent(safe)}` : "/dashboard/onboarding";
}

export function destinationForIntent(status: OnboardingStatus, destination: string) {
  const safe = safeReturnDestination(destination);
  if (!safe) return "/dashboard/intent";
  return status.complete && !status.contextStale ? safe : onboardingPathFor(safe);
}
