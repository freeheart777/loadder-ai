/**
 * Loadder frontend feature flags.
 *
 * No new dependency and no backend contract: a flag is resolved from the build
 * mode, an optional Vite environment override, and an explicit URL override
 * that exists so acceptance tests can prove BOTH branches from one build.
 *
 * `beginner_home_v1` defaults ON in development and OFF in production. With the
 * flag off, /dashboard must render exactly the surface it rendered before.
 */

export const BEGINNER_HOME_V1 = "beginner_home_v1";

function urlOverride(name: string) {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return null;
}

function envOverride(raw: unknown) {
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return null;
}

export function isBeginnerHomeEnabled() {
  return (
    urlOverride(BEGINNER_HOME_V1) ??
    envOverride(import.meta.env.VITE_BEGINNER_HOME_V1) ??
    Boolean(import.meta.env.DEV)
  );
}
