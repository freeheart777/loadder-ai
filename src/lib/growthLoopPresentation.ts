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
