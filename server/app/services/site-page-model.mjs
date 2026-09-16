// The canonical page model for a V16 site document.
//
// One document holds one page collection. The server is the authority for slug
// normalisation and uniqueness; the Studio normalises for UX but never decides.
// A legacy single-page document is READ as a one-page collection — it is never
// rewritten just by being read.

export class SitePageError extends Error {
  constructor(message, code = "SITE_PAGE_ERROR", status = 400) {
    super(message);
    this.name = "SitePageError";
    this.code = code;
    this.status = status;
  }
}

// Paths the platform owns, plus anything that could be mistaken for one.
export const RESERVED_SLUGS = Object.freeze([
  "api", "admin", "dashboard", "site", "sites", "store", "preview", "assets",
  "static", "public", "auth", "login", "logout", "health", "well-known",
]);

const MAX_SLUG = 60;
const MAX_PAGES = 50;

/**
 * Normalise a slug to its canonical form. Home is the empty string.
 * Returns null when the input cannot be made into a safe single segment.
 */
export function normalizeSlug(value) {
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

export const isReservedSlug = (slug) => RESERVED_SLUGS.includes(String(slug || "").toLowerCase());

const text = (value, max, fallback = "") => {
  const next = String(value ?? "").trim();
  return next ? next.slice(0, max) : fallback;
};

const pageSeo = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return { title: text(source.title, 160), description: text(source.description, 320) };
};

/** True when a document already carries an explicit page collection. */
export const hasPages = (v16) => Array.isArray(v16?.pages) && v16.pages.length > 0;

/**
 * Read a V16 document as a page collection. A document without `pages` is read
 * as a single Home page built from its existing `sections` — no rewrite.
 */
export function readPages(v16) {
  const source = v16 && typeof v16 === "object" ? v16 : {};
  if (!hasPages(source)) {
    return [{
      id: "page-home",
      title: text(source.seo?.title, 120) || "خانه",
      slug: "",
      isHome: true,
      showInNav: true,
      navLabel: "خانه",
      seo: pageSeo(source.seo),
      sections: Array.isArray(source.sections) ? source.sections : [],
    }];
  }
  return source.pages.map((page, index) => ({
    id: text(page?.id, 60) || `page-${index + 1}`,
    title: text(page?.title, 120) || `صفحه ${index + 1}`,
    slug: index === 0 ? "" : (normalizeSlug(page?.slug) ?? ""),
    isHome: index === 0,
    showInNav: page?.showInNav !== false,
    navLabel: text(page?.navLabel, 120),
    seo: pageSeo(page?.seo),
    sections: Array.isArray(page?.sections) ? page.sections : [],
  }));
}

/** Resolve a public request path segment to a page, or null. */
export function findPageBySlug(pages, slug) {
  const wanted = normalizeSlug(slug);
  if (wanted === null) return null;
  return pages.find((page) => page.slug === wanted) || null;
}

/** Navigation is derived from page identity, never from duplicated content. */
export const navigationPages = (pages) => pages.filter((page) => page.showInNav !== false);

/**
 * Validate a page collection on write. Throws SitePageError on anything the
 * site cannot safely serve. Returns the normalised collection.
 */
export function validatePages(pages) {
  if (!Array.isArray(pages)) throw new SitePageError("Pages must be a list.", "SITE_PAGES_INVALID", 400);
  if (!pages.length) throw new SitePageError("A site needs at least one page.", "SITE_PAGES_EMPTY", 400);
  if (pages.length > MAX_PAGES) throw new SitePageError(`A site supports at most ${MAX_PAGES} pages.`, "SITE_PAGES_TOO_MANY", 400);

  const seenIds = new Set();
  const seenSlugs = new Set();
  return pages.map((page, index) => {
    const id = text(page?.id, 60);
    if (!id) throw new SitePageError("Every page needs an id.", "SITE_PAGE_ID_REQUIRED", 400);
    if (seenIds.has(id)) throw new SitePageError("Page ids must be unique.", "SITE_PAGE_ID_DUPLICATE", 409);
    seenIds.add(id);

    // The first page is Home and always owns the canonical root.
    const slug = index === 0 ? "" : normalizeSlug(page?.slug);
    if (index === 0 && normalizeSlug(page?.slug)) {
      throw new SitePageError("The home page must use the site root.", "SITE_PAGE_HOME_SLUG", 400);
    }
    if (index > 0) {
      if (slug === null) throw new SitePageError("Page address is not a valid single path segment.", "SITE_PAGE_SLUG_INVALID", 400);
      if (!slug) throw new SitePageError("Only the home page may use the site root.", "SITE_PAGE_SLUG_REQUIRED", 400);
      if (isReservedSlug(slug)) throw new SitePageError(`"${slug}" is reserved by the platform.`, "SITE_PAGE_SLUG_RESERVED", 400);
    }
    if (seenSlugs.has(slug)) throw new SitePageError(`Duplicate page address "${slug || "/"}".`, "SITE_PAGE_SLUG_DUPLICATE", 409);
    seenSlugs.add(slug);

    return {
      id,
      title: text(page?.title, 120) || `صفحه ${index + 1}`,
      slug,
      showInNav: page?.showInNav !== false,
      navLabel: text(page?.navLabel, 120),
      seo: pageSeo(page?.seo),
      sections: Array.isArray(page?.sections) ? page.sections : [],
    };
  });
}

/**
 * Validate the page collection inside a site document on write, and keep the
 * legacy `sections` mirror pointing at Home so older readers stay correct.
 * A document without `pages` passes through untouched.
 */
export function validateSiteDocument(content) {
  const source = content && typeof content === "object" && !Array.isArray(content) ? content : {};
  const v16 = source.storeBuilderV16;
  if (!v16 || typeof v16 !== "object" || !hasPages(v16)) return source;
  const pages = validatePages(v16.pages);
  return { ...source, storeBuilderV16: { ...v16, pages, sections: pages[0].sections } };
}
