import { apiFetch } from "./api";
import type { OnboardingStatus } from "../components/onboarding/types";

export async function fetchOnboardingStatus(signal?: AbortSignal): Promise<OnboardingStatus> {
  const response = await apiFetch("/api/onboarding/status", { signal });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "وضعیت راه‌اندازی دریافت نشد.");
  return data.onboarding;
}

export function destinationForOnboarding(status: OnboardingStatus) {
  return status.complete || status.contextStale ? "/dashboard" : "/dashboard/onboarding";
}
