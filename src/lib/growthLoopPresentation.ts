export function describeGrowthGoal(goalRef?: string | null) {
  return goalRef ? "هدف ثبت‌شدهٔ آزمایش" : "نامشخص";
}

export function describeGrowthContext(contextVersionId?: string | null) {
  return contextVersionId ? "زمینهٔ ثبت‌شده برای آزمایش" : "نامشخص";
}

export function formatGrowthWindowDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "نامشخص"
    : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export type GrowthDecisionReference = { id: string; supersedesDecisionId: string | null };

export function resolveGrowthDecisionHead<T extends GrowthDecisionReference>(decisions: T[], truncated = false): T | null | "AMBIGUOUS" {
  if (truncated) return "AMBIGUOUS";
  const superseded = new Set(decisions.map((item) => item.supersedesDecisionId).filter((id): id is string => Boolean(id)));
  const heads = decisions.filter((item) => !superseded.has(item.id));
  return heads.length === 0 ? null : heads.length === 1 ? heads[0] : "AMBIGUOUS";
}

export function observedEvidenceCount(status: "idle" | "loading" | "ready" | "failed", count: number) {
  return status === "ready" ? count : undefined;
}
