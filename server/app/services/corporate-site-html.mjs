import { projectPublicStorePresentation } from "./store-public-presentation.mjs";
import { findPageBySlug, navigationPages, readPages } from "./site-page-model.mjs";
import { safePublicHref, safePublicImageUrl } from "./public-link-policy.mjs";

// A published corporate site has exactly one truth: the V16 document, read
// through the same public projection that /api/auth/site/:id serves. This
// module is a serialisation of that projection, not a second source of it, so
// the legacy /sites/:id route, a custom domain and the V16 runtime cannot show
// different content for the same published version.

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const url = (value) => safePublicImageUrl(value) || "";
// A rejected author link is published as plain text, never rewritten into a
// different-but-valid target.
const link = (href, label, className) => {
  const safe = safePublicHref(href);
  return safe
    ? `<a class="${className}" href="${escape(safe)}">${escape(label)}</a>`
    : `<span class="${className}" data-link-rejected="true">${escape(label)}</span>`;
};
const color = (value, fallback) => (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback);
const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/** Mirrors sectionAnchor() in the V16 client so anchors resolve identically. */
const anchorOf = (section) => String(section.anchor || section.id || "").replace(/[^a-zA-Z0-9_-]/g, "-");

/** Mirrors navItemsFor() in the V16 canvas: navigation is derived, never stored. */
export const navigationFor = (sections) => sections
  .filter((section) => section.enabled !== false && section.showInNav !== false && section.type !== "spacer")
  .map((section) => ({ anchor: anchorOf(section), label: section.navLabel || section.title || "" }));

/** Site navigation references page identity; a page is never duplicated into it. */
export const pageNavigationFor = (pages, basePath) => navigationPages(pages)
  .map((page) => ({ href: page.slug ? `${basePath}/${page.slug}` : (basePath || "/"), label: page.navLabel || page.title }));

const CORPORATE_TYPES = new Set(["about", "services", "portfolio", "team", "text-image", "cta", "contact"]);

/** True when this published project is a V16 corporate site. */
export function isCorporateV16(project, content) {
  if (String(project?.siteType || "").toUpperCase() !== "BUSINESS") return false;
  const v16 = content?.storeBuilderV16;
  if (!v16 || typeof v16 !== "object") return false;
  const everySection = [
    ...(Array.isArray(v16.sections) ? v16.sections : []),
    ...(Array.isArray(v16.pages) ? v16.pages.flatMap((page) => (Array.isArray(page?.sections) ? page.sections : [])) : []),
  ];
  return everySection.some((section) => CORPORATE_TYPES.has(section?.type));
}

const itemsHtml = (section, withMedia) => (section.items || []).map((item) => `<article class="card">${
  withMedia ? `<div class="thumb">${url(item.imageUrl) ? `<img src="${escape(url(item.imageUrl))}" alt="${escape(item.title)}" loading="lazy">` : ""}</div>` : ""
}<div class="card-body"><b>${escape(item.title)}</b>${item.subtitle ? `<span>${escape(item.subtitle)}</span>` : ""}${item.body ? `<p>${escape(item.body)}</p>` : ""}</div></article>`).join("");

function sectionHtml(section) {
  const id = anchorOf(section);
  const style = `background:${color(section.backgroundColor, "#ffffff")};color:${color(section.textColor, "#0f172a")};padding-top:${num(section.spacingTop, 32)}px;padding-bottom:${num(section.spacingBottom, 32)}px`;
  const head = `<div class="head">${section.subtitle ? `<span class="eyebrow">${escape(section.subtitle)}</span>` : ""}<h2>${escape(section.title)}</h2></div>`;
  const columns = Math.min(4, Math.max(1, num(section.columns, 3)));
  const open = `<section id="${escape(id)}" data-section-type="${escape(section.type)}" style="${style}"><div class="wrap">`;
  const close = `</div></section>`;

  if (section.type === "spacer") return `<div style="height:${num(section.spacingTop, 0) + num(section.spacingBottom, 0)}px"></div>`;

  if (section.type === "about" || section.type === "text-image") {
    const media = url(section.imageUrl) ? `<div class="media"><img src="${escape(url(section.imageUrl))}" alt="${escape(section.title)}" loading="lazy"></div>` : "";
    const copy = `<div>${head}${section.body ? `<p class="body">${escape(section.body)}</p>` : ""}</div>`;
    return `${open}<div class="split">${section.mediaPosition === "start" ? media + copy : copy + media}</div>${close}`;
  }
  if (section.type === "services" || section.type === "team" || section.type === "portfolio") {
    return `${open}${head}<div class="grid" style="--cols:${columns}">${itemsHtml(section, section.type !== "services")}</div>${close}`;
  }
  if (section.type === "cta") {
    return `${open}<div class="cta"><div><h2>${escape(section.title)}</h2>${section.subtitle ? `<p>${escape(section.subtitle)}</p>` : ""}</div>${section.ctaLabel ? link(section.ctaHref, section.ctaLabel, "cta-btn") : ""}</div>${close}`;
  }
  if (section.type === "contact") {
    const rows = [["تلفن", section.contact?.phone], ["ایمیل", section.contact?.email], ["نشانی", section.contact?.address]]
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => `<div class="card"><div class="card-body"><b>${escape(label)}</b><span>${escape(value)}</span></div></div>`).join("");
    return `${open}${head}<div class="grid" style="--cols:3">${rows}</div>${close}`;
  }
  return `${open}${head}${section.body ? `<p class="body">${escape(section.body)}</p>` : ""}${close}`;
}

/**
 * Render one page of a published corporate site.
 * Returns null when the requested slug does not resolve to a page, so the
 * caller answers 404 rather than silently serving Home.
 */
export function renderCorporateSite(project, version, content, { slug = "", basePath = "", canonicalDomain = null, noindex = false } = {}) {
  // The canonical projection — the same function and options the public
  // /api/auth/site/:id payload is built from.
  const presentation = projectPublicStorePresentation(content, { preserveSectionIds: true, includeCommerce: false }).storeBuilderV16 || {};
  const design = presentation.design || {};
  const header = presentation.header || {};
  const hero = presentation.hero || {};
  const siteSeo = presentation.seo || {};

  // A legacy single-page document reads as one Home page; it is not rewritten.
  const pages = readPages(presentation);
  const page = findPageBySlug(pages, slug);
  if (!page) return null;

  const sections = (page.sections || []).filter((section) => section.enabled !== false);
  const seo = page.seo || {};

  const siteName = header.storeName || project?.name || "";
  // Per-page canonical SEO, falling back only to values the site already has.
  const title = seo.title || page.title || siteSeo.title || siteName;
  const description = seo.description || siteSeo.description || (page.isHome ? hero.subtitle : "") || "";
  const primary = color(design.primaryColor, "#6d5dfc");
  const width = Math.min(1280, Math.max(880, num(design.containerWidth, 1240)));
  const nav = presentation.nav || {};
  const footer = presentation.footer || {};
  const navItems = nav.enabled === false ? [] : pageNavigationFor(pages, basePath);

  const css = `*{box-sizing:border-box}body{margin:0;background:${color(design.backgroundColor, "#f8fafc")};color:${color(design.textColor, "#0f172a")};font-family:${escape(design.fontFamily || "Vazirmatn")},system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.8}`
    + `.wrap{width:min(${width}px,100%);margin:auto;padding:0 16px}`
    + `header.site{background:${color(header.backgroundColor, "#ffffff")};color:${color(header.textColor, "#0f172a")};position:${header.sticky ? "sticky" : "static"};top:0;z-index:20;border-bottom:1px solid rgba(0,0,0,.06)}`
    + `.bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;min-height:64px}`
    + `.brand{display:flex;align-items:center;gap:10px;font-weight:800}.brand img{width:40px;height:40px;border-radius:12px;object-fit:cover}`
    + `nav.menu{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;font-weight:700;opacity:.8}nav.menu a{color:inherit;text-decoration:none}`
    + `.nav-cta{margin-inline-start:auto;background:${primary};color:#fff;border-radius:${num(design.buttonRadius, 12)}px;padding:10px 16px;font-size:13px;font-weight:800;text-decoration:none}`
    + `.hero{background:${color(hero.backgroundColor, "#0f172a")};color:${color(hero.textColor, "#ffffff")}}`
    + `.hero-inner{display:grid;gap:24px;align-items:center;padding:48px 0}.hero h1{font-size:clamp(28px,5vw,52px);line-height:1.15;margin:12px 0}`
    + `.hero p{opacity:.78;margin:0}.hero-cta{display:inline-flex;margin-top:22px;background:${primary};color:#fff;border-radius:${num(design.buttonRadius, 12)}px;padding:12px 22px;font-weight:800;text-decoration:none}`
    + `.hero-media img{width:100%;border-radius:${num(design.cardRadius, 18)}px;display:block}`
    + `.head{margin-bottom:26px}.head h2{font-size:clamp(20px,3vw,30px);margin:6px 0 0}.eyebrow{font-size:12px;font-weight:800;color:${primary}}`
    + `.body{opacity:.78;margin:0}.split{display:grid;gap:26px}`
    + `.grid{display:grid;gap:16px;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr))}`
    + `.card{border:1px solid rgba(0,0,0,.06);background:#fff;border-radius:${num(design.cardRadius, 18)}px;overflow:hidden}`
    + `.thumb{aspect-ratio:4/3;background:#f1f5f9}.thumb img{width:100%;height:100%;object-fit:cover;display:block}`
    + `.card-body{padding:18px}.card-body b{display:block}.card-body span{display:block;font-size:13px;opacity:.6;margin-top:4px}.card-body p{font-size:13px;opacity:.72;margin:10px 0 0}`
    + `.cta{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;padding:28px;border-radius:${num(design.cardRadius, 18)}px;background:inherit}`
    + `.cta h2{margin:0}.cta p{margin:6px 0 0;opacity:.8}.cta-btn{background:#fff;color:#111827;border-radius:${num(design.buttonRadius, 12)}px;padding:12px 22px;font-weight:800;text-decoration:none}`
    + `footer.site{background:${color(footer.backgroundColor, "#0f172a")};color:${color(footer.textColor, "#e2e8f0")}}`
    + `.foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;padding:28px 0;font-size:13px}`
    + `@media(min-width:760px){.split{grid-template-columns:1fr 1fr}.hero-inner{grid-template-columns:1.05fr .95fr}}`
    + `@media(max-width:640px){.grid{grid-template-columns:1fr}}`;

  const heroHtml = (hero.enabled === false || !page.isHome) ? "" : `<section class="hero"><div class="wrap hero-inner"><div>${
    hero.eyebrow ? `<span class="eyebrow" style="color:inherit;opacity:.75">${escape(hero.eyebrow)}</span>` : ""
  }<h1>${escape(hero.title || siteName)}</h1>${hero.subtitle ? `<p>${escape(hero.subtitle)}</p>` : ""}${
    hero.ctaLabel ? link(hero.ctaHref, hero.ctaLabel, "hero-cta") : ""
  }</div>${url(hero.imageUrl) ? `<div class="hero-media"><img src="${escape(url(hero.imageUrl))}" alt="${escape(hero.title || siteName)}"></div>` : ""}</div></section>`;

  // The customer domain is the SEO authority. When none is known, no canonical
  // is invented.
  const canonical = canonicalDomain
    ? `https://${encodeURI(String(canonicalDomain))}${page.slug ? `/${encodeURIComponent(page.slug)}` : "/"}`
    : null;

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escape(title)}</title>${description ? `<meta name="description" content="${escape(description)}">` : ""}`
    + `${canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ""}`
    + `${noindex ? `<meta name="robots" content="noindex, follow">` : ""}`
    + `<meta name="generator" content="Loadder Site Builder"><style>${css}</style></head><body data-site-kind="BUSINESS" data-published-version="${escape(version?.version ?? "draft")}" data-page-slug="${escape(page.slug)}" data-page-id="${escape(page.id)}">`
    + `<header class="site"><div class="wrap bar"><span class="brand">${url(header.logoUrl) ? `<img src="${escape(url(header.logoUrl))}" alt="${escape(siteName)}">` : ""}${escape(siteName)}</span>`
    + `${navItems.length ? `<nav class="menu">${navItems.map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join("")}</nav>` : ""}`
    + `${nav.enabled === false ? "" : link(nav.ctaHref, nav.ctaLabel || "تماس با ما", "nav-cta")}`
    + `</div></header>${heroHtml}<main>${sections.map((section) => sectionHtml(section)).join("")}</main>`
    + `${footer.enabled === false ? "" : `<footer class="site"><div class="wrap foot"><b>${escape(siteName)}</b><span>${escape(footer.text || "")}</span></div></footer>`}`
    + `</body></html>`;
}
