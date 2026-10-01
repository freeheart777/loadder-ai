// Booking site scope (ADR-005 D3). Three modes, one SQL rule each:
//   legacy  - rows with no site (today's operator view, unchanged)
//   compat  - a site's own rows plus legacy rows (Education and other types)
//   strict  - a site's own rows only; never legacy or another site (MEDICAL)
export const STRICT_BOOKING_SITE_TYPES = Object.freeze(new Set(["MEDICAL"]));

export const LEGACY_BOOKING_SCOPE = Object.freeze({ kind: "legacy", siteProjectId: null });

export function siteBookingScope(siteProjectId, { includeLegacy }) {
  if (typeof siteProjectId !== "string" || !siteProjectId) throw new Error("A site scope requires a site project id.");
  return Object.freeze({ kind: includeLegacy ? "compat" : "strict", siteProjectId });
}

export const bookingScopeForSite = (site) => siteBookingScope(site.id, { includeLegacy: !STRICT_BOOKING_SITE_TYPES.has(String(site.siteType || "").toUpperCase()) });

export function normalizeScope(scope) {
  if (!scope) return LEGACY_BOOKING_SCOPE;
  if (scope.kind === "legacy") return LEGACY_BOOKING_SCOPE;
  if ((scope.kind === "compat" || scope.kind === "strict") && typeof scope.siteProjectId === "string" && scope.siteProjectId) return scope;
  throw new Error("Invalid booking scope.");
}

export function scopeClause(scope, column = "site_project_id") {
  const resolved = normalizeScope(scope);
  if (resolved.kind === "legacy") return { sql: `${column} IS NULL`, params: [] };
  if (resolved.kind === "strict") return { sql: `${column} = ?`, params: [resolved.siteProjectId] };
  return { sql: `(${column} = ? OR ${column} IS NULL)`, params: [resolved.siteProjectId] };
}
