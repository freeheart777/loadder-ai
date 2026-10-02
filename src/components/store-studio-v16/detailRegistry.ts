// Client mirror of server/app/services/public-detail-registry.mjs. Which
// published pages of a vertical expose per-item detail routes.
const DETAIL_PAGES_BY_SITE_TYPE: Record<string, readonly string[]> = {
  EDUCATION: ["courses", "teachers", "magazine", "performances"],
  MEDICAL: ["services", "doctors", "magazine"],
};

export const detailPagesFor = (siteType?: string | null): readonly string[] => DETAIL_PAGES_BY_SITE_TYPE[String(siteType || "").toUpperCase()] || [];
export const isVerticalSite = (siteType?: string | null) => detailPagesFor(siteType).length > 0;
export const hasDetailPage = (siteType: string | null | undefined, slug: string) => detailPagesFor(siteType).includes(slug);
