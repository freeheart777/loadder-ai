// Which published pages of a vertical expose per-item detail routes
// (/<page>/<item>). Presentation-only: a detail is an address for an
// already-published card, never operational data. The client mirror is
// src/components/store-studio-v16/detailRegistry.ts (kept equal by a test).
const DETAIL_PAGES_BY_SITE_TYPE = Object.freeze({
  EDUCATION: Object.freeze(["courses", "teachers", "magazine", "performances"]),
  MEDICAL: Object.freeze(["services", "doctors", "magazine"]),
});

export const detailPagesFor = (siteType) => DETAIL_PAGES_BY_SITE_TYPE[String(siteType || "").toUpperCase()] || [];
export const isVerticalSite = (siteType) => detailPagesFor(siteType).length > 0;
export const hasDetailPage = (siteType, slug) => detailPagesFor(siteType).includes(slug);
export const DETAIL_REGISTRY = DETAIL_PAGES_BY_SITE_TYPE;
