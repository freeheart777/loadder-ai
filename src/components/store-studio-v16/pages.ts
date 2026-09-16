import type { PageConfig, SectionConfig, SeoConfig, StudioConfig } from "./types";

// Client-side page helpers. The SERVER is the authority for slug normalisation
// and uniqueness — this mirrors its rules so the Studio can show the canonical
// value while typing, and rejects the same inputs the server would reject.

export const RESERVED_SLUGS = [
  "api", "admin", "dashboard", "site", "sites", "store", "preview", "assets",
  "static", "public", "auth", "login", "logout", "health", "well-known",
];

const MAX_SLUG = 60;

/** Canonical single-segment slug, or null when the input cannot be made safe. */
export function normalizeSlug(value: string): string | null {
  // Surrounding slashes a person may type are trimmed from the RAW value; only
  // then is percent-encoding decoded, so an encoded separator cannot smuggle in
  // structure that trimming would have hidden.
  let raw = String(value ?? "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!raw) return "";
  try { raw = decodeURIComponent(raw).trim(); } catch { return null; }
  if (!raw) return "";
  // A page slug is exactly one path segment: no separators, no traversal.
  if (/[/\\]/.test(raw) || raw.includes("..")) return null;
  if (raw.startsWith(".")) return null;
  const slug = raw
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9؀-ۿ-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug.length > MAX_SLUG) return null;
  return slug;
}

export const isReservedSlug = (slug: string) => RESERVED_SLUGS.includes(slug.toLowerCase());

/** Why a slug cannot be used, or null when it is acceptable. */
export function slugProblem(value: string, pages: PageConfig[], pageId: string): string | null {
  const slug = normalizeSlug(value);
  if (slug === null) return "آدرس صفحه معتبر نیست.";
  if (!slug) return "فقط صفحه خانه می‌تواند از آدرس اصلی استفاده کند.";
  if (isReservedSlug(slug)) return `«${slug}» رزرو شده است.`;
  if (pages.some((page) => page.id !== pageId && page.slug === slug)) return "این آدرس قبلاً استفاده شده است.";
  return null;
}

const emptySeo = (): SeoConfig => ({ title: "", description: "" });

export const homePage = (pages: PageConfig[]) => pages[0];
export const pageById = (pages: PageConfig[], id: string) => pages.find((page) => page.id === id) || pages[0];

/** Pages that appear in site navigation, in document order. */
export const navigationPages = (pages: PageConfig[]) => pages.filter((page) => page.showInNav !== false);

/**
 * Read a persisted document as a page collection. A document with no `pages`
 * is READ as a single Home page built from its existing sections — reading
 * never rewrites what is stored.
 */
export function readPages(v16: Record<string, any>, sections: SectionConfig[]): PageConfig[] {
  const stored = Array.isArray(v16?.pages) ? v16.pages : null;
  if (!stored || !stored.length) {
    return [{
      id: "page-home",
      title: v16?.seo?.title || "خانه",
      slug: "",
      isHome: true,
      showInNav: true,
      navLabel: "خانه",
      seo: { title: v16?.seo?.title || "", description: v16?.seo?.description || "" },
      sections,
    }];
  }
  return stored.map((page: any, index: number) => ({
    id: String(page?.id || `page-${index + 1}`),
    title: String(page?.title || `صفحه ${index + 1}`),
    slug: index === 0 ? "" : (normalizeSlug(String(page?.slug || "")) ?? ""),
    isHome: index === 0,
    showInNav: page?.showInNav !== false,
    navLabel: String(page?.navLabel || ""),
    seo: { title: String(page?.seo?.title || ""), description: String(page?.seo?.description || "") },
    sections: Array.isArray(page?.sections) ? page.sections : [],
  }));
}

export const newPage = (title: string, slug: string, sections: SectionConfig[] = []): PageConfig => ({
  id: `page-${crypto.randomUUID()}`,
  title,
  slug,
  isHome: false,
  showInNav: true,
  navLabel: "",
  seo: emptySeo(),
  sections,
});

/** The sections the canvas is currently editing: those of the selected page. */
export const activePageOf = (config: StudioConfig) => pageById(config.pages, config.activePageId);

/**
 * Keep the legacy `sections` mirror pointing at Home so older readers — and the
 * STORE path, which never uses pages — stay correct.
 */
export function withPages(config: StudioConfig, pages: PageConfig[]): StudioConfig {
  const normalized = pages.map((page, index) => ({ ...page, isHome: index === 0, slug: index === 0 ? "" : page.slug }));
  const activePageId = normalized.some((page) => page.id === config.activePageId) ? config.activePageId : normalized[0].id;
  return { ...config, pages: normalized, activePageId, sections: normalized[0].sections };
}

/** Replace the selected page's sections, keeping the Home mirror in sync. */
export function withActivePageSections(config: StudioConfig, sections: SectionConfig[]): StudioConfig {
  const pages = config.pages.map((page) => (page.id === activePageOf(config).id ? { ...page, sections } : page));
  return { ...config, pages, sections: pages[0].sections };
}
