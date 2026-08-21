export const CUSTOMER_ROUTE_ALLOWLIST = Object.freeze([
  "/",
  "/signup",
  "/dashboard",
  "/dashboard/content",
  "/dashboard/brand-book",
  "/dashboard/business-brain",
  "/dashboard/onboarding",
]);

export const INTERNAL_ROUTE_ALLOWLIST = Object.freeze([
  "/intelligence",
  "/legacy-dashboard",
  "/click-test",
]);

export const internalToolsEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_INTERNAL_TOOLS === "true";

export function customerRouteAllowed(pathname: string) {
  return CUSTOMER_ROUTE_ALLOWLIST.includes(pathname);
}
