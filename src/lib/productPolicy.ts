export const CUSTOMER_ROUTE_ALLOWLIST = Object.freeze([
  "/",
  "/signup",
  "/dashboard",
  "/dashboard/content",
  "/dashboard/library",
  "/dashboard/brand-book",
  "/dashboard/business-brain",
  "/dashboard/onboarding",
  "/dashboard/landings",
  "/dashboard/forms",
  "/dashboard/crm",
  "/dashboard/improvement",
]);

export const INTERNAL_ROUTE_ALLOWLIST = Object.freeze([
  "/intelligence",
  "/legacy-dashboard",
  "/click-test",
  "/dashboard/ai-economy",
  "/dashboard/ai-economy/benchmarks",
  "/dashboard/internal/visual-pilot",
]);

export const internalToolsEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_INTERNAL_TOOLS === "true";

export function customerRouteAllowed(pathname: string) {
  return CUSTOMER_ROUTE_ALLOWLIST.includes(pathname) || /^\/dashboard\/library\/[^/]+$/.test(pathname) || /^\/dashboard\/landings\/(new|[^/]+(?:\/edit)?)$/.test(pathname) || /^\/dashboard\/crm\/[^/]+$/.test(pathname) || /^\/dashboard\/improvement\/[^/]+$/.test(pathname);
}
