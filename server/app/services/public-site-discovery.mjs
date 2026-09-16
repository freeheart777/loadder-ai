import { projectPublicStorePresentation } from "./store-public-presentation.mjs";
import { readPages } from "./site-page-model.mjs";
import { isCorporateV16 } from "./corporate-site-html.mjs";

// sitemap.xml and robots.txt for a published corporate site, derived from the
// same canonical published `pages[]` the renderer uses. There is no second
// content model and no second source of page truth.

const xmlEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

/** A published site is discoverable only when it is a corporate V16 site. */
export function isDiscoverableSite(published) {
  if (!published?.project || !published?.version) return false;
  const content = published.version.content && typeof published.version.content === "object" ? published.version.content : {};
  return isCorporateV16(published.project, content);
}

/**
 * The pages a crawler should be told about: published pages that the site
 * itself surfaces in navigation. A page hidden from navigation stays reachable
 * by address but is not advertised.
 */
export function indexablePages(published) {
  const content = published.version.content || {};
  const presentation = projectPublicStorePresentation(content, { preserveSectionIds: true, includeCommerce: false }).storeBuilderV16 || {};
  return readPages(presentation).filter((page) => page.showInNav !== false);
}

const absolute = (origin, slug) => `${origin}${slug ? `/${encodeURIComponent(slug)}` : "/"}`;

export function renderSitemap(published, origin) {
  const lastmod = published.version.publishedAt || published.version.published_at || null;
  const day = lastmod ? String(lastmod).slice(0, 10) : null;
  const entries = indexablePages(published).map((page) => [
    "<url>",
    `<loc>${xmlEscape(absolute(origin, page.slug))}</loc>`,
    day ? `<lastmod>${xmlEscape(day)}</lastmod>` : "",
    `<priority>${page.slug ? "0.7" : "1.0"}</priority>`,
    "</url>",
  ].join("")).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

/** robots.txt only references a sitemap when a canonical customer origin exists. */
export function renderRobots(origin) {
  const lines = ["User-agent: *", "Allow: /"];
  if (origin) lines.push(`Sitemap: ${origin}/sitemap.xml`);
  return `${lines.join("\n")}\n`;
}
