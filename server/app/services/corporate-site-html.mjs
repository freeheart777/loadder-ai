import { projectPublicStorePresentation } from "./store-public-presentation.mjs";
import { safePublicHref, safePublicImageUrl } from "./public-link-policy.mjs";
import { hasDetailPage, isVerticalSite } from "./public-detail-registry.mjs";
import { findPageBySlug, navigationPages, normalizeSlug, readPages } from "./site-page-model.mjs";

// A published corporate site has exactly one truth: the V16 document, read
// through the same public projection that /api/auth/site/:id serves. This
// module is a serialisation of that projection, not a second source of it, so
// the legacy /sites/:id route, a custom domain and the V16 runtime cannot show
// different content for the same published version.

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const mediaUrl = (value) => (typeof value === "string" && /^https:\/\//i.test(value) ? value : "");
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
  // V16 is the shared presentation document for every non-store business
  // starter.  Education used to fall through to the legacy generic renderer,
  // which meant its persisted V16 draft/publish document was not the public
  // truth.  Keep the renderer shared; verticals only contribute data/theme.
  if (["STORE", "ECOMMERCE"].includes(String(project?.siteType || "").toUpperCase())) return false;
  const v16 = content?.storeBuilderV16;
  if (!v16 || typeof v16 !== "object") return false;
  const everySection = [
    ...(Array.isArray(v16.sections) ? v16.sections : []),
    ...(Array.isArray(v16.pages) ? v16.pages.flatMap((page) => (Array.isArray(page?.sections) ? page.sections : [])) : []),
  ];
  return everySection.some((section) => CORPORATE_TYPES.has(section?.type));
}

const itemsHtml = (section, withMedia, itemHref = null) => (section.items || []).map((item) => `<article class="card">${
  withMedia ? `<div class="thumb">${url(item.imageUrl) ? `<img src="${escape(url(item.imageUrl))}" alt="${escape(item.title)}" loading="lazy">` : ""}</div>` : ""
}<div class="card-body"><b>${escape(item.title)}</b>${item.subtitle ? `<span>${escape(item.subtitle)}</span>` : ""}${item.body ? `<p>${escape(item.body)}</p>` : ""}${itemHref?.(item) ? `<a class="detail-link" href="${escape(itemHref(item))}">بیشتر بخوانید</a>` : ""}</div></article>`).join("");

// Section render functions, dispatched by the stored legacy section type
// (docs/decisions/PR4B-render-boundary.md). Bodies are unchanged from the
// former if-chain; `parts` carries the shared wrapper values computed once.
const spacerHtml = (section) => `<div style="height:${num(section.spacingTop, 0) + num(section.spacingBottom, 0)}px"></div>`;

const splitHtml = (section, { open, close, head }) => {
  const media = url(section.imageUrl) ? `<div class="media"><img src="${escape(url(section.imageUrl))}" alt="${escape(section.title)}" loading="lazy"></div>` : "";
  const copy = `<div>${head}${section.body ? `<p class="body">${escape(section.body)}</p>` : ""}</div>`;
  return `${open}<div class="split">${section.mediaPosition === "start" ? media + copy : copy + media}</div>${close}`;
};

const cardsHtml = (section, { open, close, head, columns, itemHref }) => `${open}${head}<div class="grid" style="--cols:${columns}">${itemsHtml(section, section.type !== "services", itemHref)}</div>${close}`;

const ctaHtml = (section, { open, close, resolveHref = (href) => href }) => `${open}<div class="cta"><div><h2>${escape(section.title)}</h2>${section.subtitle ? `<p>${escape(section.subtitle)}</p>` : ""}</div>${section.ctaLabel ? link(resolveHref(section.ctaHref || "#"), section.ctaLabel, "cta-btn") : ""}</div>${close}`;

const contactHtml = (section, { open, close, head }) => {
  const rows = [["تلفن", section.contact?.phone], ["ایمیل", section.contact?.email], ["نشانی", section.contact?.address]]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<div class="card"><div class="card-body"><b>${escape(label)}</b><span>${escape(value)}</span></div></div>`).join("");
  return `${open}${head}<div class="grid" style="--cols:3">${rows}</div>${close}`;
};

/** Unknown types (including prototype names such as "toString") render this fallback. */
const unknownSectionHtml = (section, { open, close, head }) => `${open}${head}${section.body ? `<p class="body">${escape(section.body)}</p>` : ""}${close}`;

// A Map, never a plain object: lookup is by exact own key only.
const SECTION_RENDERERS = new Map([
  ["spacer", spacerHtml],
  ["about", splitHtml],
  ["text-image", splitHtml],
  ["services", cardsHtml],
  ["team", cardsHtml],
  ["portfolio", cardsHtml],
  ["cta", ctaHtml],
  ["contact", contactHtml],
]);

/** Section types with a dedicated corporate renderer (read-only; for agreement tests). */
export const CORPORATE_SECTION_TYPES = Object.freeze([...SECTION_RENDERERS.keys()]);

function sectionHtml(section, { education = false, itemHref = null, resolveHref } = {}) {
  const id = anchorOf(section);
  const style = `background:${color(section.backgroundColor, education ? "#2e2c28" : "#ffffff")};color:${color(section.textColor, education ? "#f5f0e5" : "#0f172a")};padding-top:${num(section.spacingTop, 32)}px;padding-bottom:${num(section.spacingBottom, 32)}px`;
  const head = `<div class="head">${section.subtitle ? `<span class="eyebrow">${escape(section.subtitle)}</span>` : ""}<h2>${escape(section.title)}</h2></div>`;
  const columns = Math.min(4, Math.max(1, num(section.columns, 3)));
  const open = `<section id="${escape(id)}" data-section-type="${escape(section.type)}" style="${style}"><div class="wrap">`;
  const close = `</div></section>`;
  return (SECTION_RENDERERS.get(section.type) || unknownSectionHtml)(section, { open, close, head, columns, itemHref, resolveHref });
}

const itemSlug = (item) => normalizeSlug(item?.slug || item?.title);

/** Resolve a presentation-only vertical detail from the published V16 page.
 * This deliberately does not model a course, doctor, or article as Website
 * operational data: it is an address for an already-published card only. */
export function findDetail(siteType, page, detailSlug) {
  if (!page || !hasDetailPage(siteType, page.slug)) return null;
  const wanted = normalizeSlug(detailSlug);
  if (!wanted) return null;
  for (const section of page.sections || []) {
    for (const item of section?.items || []) {
      if (itemSlug(item) === wanted) return { page, section, item, slug: wanted };
    }
  }
  return null;
}
export const findEducationDetail = (page, detailSlug) => findDetail("EDUCATION", page, detailSlug);

const MODE_LABELS = Object.freeze({ IN_PERSON: "حضوری", VIDEO: "ویدئویی", AUDIO: "صوتی", TEXT: "متنی", ONLINE: "آنلاین" });
const modeLabel = (mode) => MODE_LABELS[mode] || String(mode);
const bookingHref = (basePath, { serviceId = "", providerId = "" } = {}) => {
  const query = [serviceId && `service=${encodeURIComponent(serviceId)}`, providerId && `provider=${encodeURIComponent(providerId)}`].filter(Boolean).join("&");
  return `${basePath}/booking${query ? `?${query}` : ""}`;
};
// A site-internal path ("/booking") is resolved against the page base so it works
// on /sites/:id as well as on a custom domain (base ""). Vertical sites only.
const internalHref = (basePath, href) => (basePath && typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && href !== basePath && !href.startsWith(`${basePath}/`) ? `${basePath}${href}` : href);
const fa = (value) => Number(value).toLocaleString("fa-IR");

// Category chips are plain links (the public page has no script): ?category=<value>
// filters the cards of a vertical directory page, server-side.
function categoryChips(section, { basePath, pageSlug, active }) {
  const categories = [...new Set((section.items || []).map((item) => String(item?.meta || "").trim()).filter(Boolean))];
  if (categories.length < 2) return "";
  const chip = (label, value) => `<a class="chip${value === active ? " chip-on" : ""}" href="${escape(value ? `${basePath}/${pageSlug}?category=${encodeURIComponent(value)}` : `${basePath}/${pageSlug}`)}"${value === active ? ' aria-current="true"' : ""}>${escape(label)}</a>`;
  return `<nav class="chips" aria-label="فیلتر">${chip("همه", "")}${categories.map((value) => chip(value, value)).join("")}</nav>`;
}

// Canonical Booking facts for a vertical detail: duration, care modes, price and
// the doctors that deliver a service all come from Booking, never from card text.
function bookingFactsHtml(detail, { catalog, pages, basePath, siteType }) {
  if (!catalog?.length) return "";
  const serviceId = detail.item.bookingServiceId, providerId = detail.item.bookingProviderId;
  const cardFor = (key, id) => {
    for (const page of pages) if (hasDetailPage(siteType, page.slug)) for (const section of page.sections || []) for (const item of section.items || []) {
      if (item?.[key] === id) return { page, item };
    }
    return null;
  };
  const linkTo = (card, fallback) => card ? `<a href="${escape(`${basePath}/${card.page.slug}/${encodeURIComponent(itemSlug(card.item))}`)}">${escape(card.item.title)}</a>` : escape(fallback);
  if (serviceId) {
    const service = catalog.find((entry) => entry.id === serviceId);
    if (!service) return "";
    const rows = [["مدت", `${fa(service.durationMinutes)} دقیقه`], service.modalities?.length ? ["شیوه‌های مراجعه", service.modalities.map(modeLabel).join("، ")] : null, service.price ? ["هزینه", `${fa(service.price.amount)} ${service.price.currency || ""}`.trim()] : null].filter(Boolean);
    const doctors = service.providers.map((provider) => `<li>${linkTo(cardFor("bookingProviderId", provider.id), provider.name)}</li>`).join("");
    return `<dl class="facts">${rows.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>${doctors ? `<h2 class="sub">پزشکان این خدمت</h2><ul class="related">${doctors}</ul>` : ""}`;
  }
  if (providerId) {
    const offered = catalog.filter((entry) => entry.providers.some((provider) => provider.id === providerId));
    if (!offered.length) return "";
    const modes = [...new Set(offered.flatMap((entry) => entry.providers.find((provider) => provider.id === providerId)?.modalities ?? entry.modalities ?? []))];
    return `${modes.length ? `<dl class="facts"><div><dt>شیوه‌های مراجعه</dt><dd>${escape(modes.map(modeLabel).join("، "))}</dd></div></dl>` : ""}<h2 class="sub">خدمات این پزشک</h2><ul class="related">${offered.map((entry) => `<li>${linkTo(cardFor("bookingServiceId", entry.id), entry.name)}</li>`).join("")}</ul>`;
  }
  return "";
}

/** Native video for a published Education detail. Only an https address stored
 * on the item is played; without one the page says so instead of faking a player. */
function detailVideoHtml(detail) {
  if (detail.page?.slug !== "performances") return "";
  const src = mediaUrl(detail.item.videoUrl);
  if (!src) return `<p class="video-state" data-video-state="unavailable">ویدئوی این اجرا هنوز منتشر نشده است.</p>`;
  const poster = url(detail.item.imageUrl);
  return `<figure class="video"><video controls playsinline preload="metadata" data-performance-video="true"${poster ? ` poster="${escape(poster)}"` : ""} src="${escape(src)}">این مرورگر پخش ویدئو را پشتیبانی نمی‌کند.</video></figure>`;
}

function detailArticleHtml(detail, { page, basePath, vertical, siteType, catalog, pages }) {
  const { item } = detail;
  const showImage = url(item.imageUrl) && !(detail.page?.slug === "performances" && mediaUrl(item.videoUrl));
  const cta = vertical && (siteType === "MEDICAL" || item.bookingServiceId || item.bookingProviderId)
    ? `<p class="detail-cta">${link(bookingHref(basePath, { serviceId: item.bookingServiceId, providerId: item.bookingProviderId }), "رزرو نوبت", "hero-cta")}</p>` : "";
  return `<article class="wrap detail"><a class="back" href="${escape(`${basePath}/${page.slug}`)}">بازگشت به ${escape(page.title)}</a><p class="eyebrow">${escape(item.meta || detail.section.title || page.title)}</p><h1>${escape(item.title)}</h1>${item.subtitle ? `<p class="lead">${escape(item.subtitle)}</p>` : ""}${showImage ? `<img src="${escape(url(item.imageUrl))}" alt="${escape(item.title)}" loading="lazy">` : ""}${detailVideoHtml(detail)}${item.body ? `<p class="copy">${escape(item.body)}</p>` : ""}${bookingFactsHtml(detail, { catalog, pages, basePath, siteType })}${cta}</article>`;
}

/**
 * Render one page of a published corporate site.
 * Returns null when the requested slug does not resolve to a page, so the
 * caller answers 404 rather than silently serving Home.
 */
export function renderCorporateSite(project, version, content, { slug = "", detailSlug = "", basePath = "", category = "", bookingCatalog = null } = {}) {
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
  const siteType = String(project?.siteType || "").toUpperCase();
  const education = siteType === "EDUCATION", medical = siteType === "MEDICAL", vertical = isVerticalSite(siteType);
  // Per-page canonical SEO, falling back only to values the site already has.
  const title = seo.title || page.title || siteSeo.title || siteName;
  const description = seo.description || siteSeo.description || (page.isHome ? hero.subtitle : "") || "";
  const primary = color(design.primaryColor, "#6d5dfc");
  const width = Math.min(1280, Math.max(880, num(design.containerWidth, 1240)));
  const nav = presentation.nav || {};
  const footer = presentation.footer || {};
  const navItems = nav.enabled === false ? [] : pageNavigationFor(pages, basePath);
  const detail = vertical ? findDetail(siteType, page, detailSlug) : null;
  if (detailSlug && !detail) return null;
  const itemHref = vertical && hasDetailPage(siteType, page.slug)
    ? (item) => {
      const itemAddress = itemSlug(item);
      return itemAddress ? `${basePath}/${page.slug}/${encodeURIComponent(itemAddress)}` : null;
    }
    : null;

  const css = `*{box-sizing:border-box}body{margin:0;background:${color(design.backgroundColor, education ? "#242321" : "#f8fafc")};color:${color(design.textColor, education ? "#f5f0e5" : "#0f172a")};font-family:${escape(design.fontFamily || "Vazirmatn")},system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.8}`
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
    + `.detail-link{display:inline-flex;margin-top:14px;color:${primary};font-size:13px;font-weight:800;text-decoration:none}.detail{padding:54px 0;max-width:760px}.detail h1{font-size:clamp(30px,5vw,48px);line-height:1.25;margin:8px 0 18px}.detail .lead{font-size:18px;opacity:.75}.detail .copy{font-size:16px;white-space:pre-wrap}.detail img{width:100%;max-height:520px;object-fit:cover;border-radius:${num(design.cardRadius, 18)}px;margin:24px 0}.back{display:inline-flex;color:${primary};font-weight:800;text-decoration:none}`
    + (detail?.page?.slug === "performances" ? `.video{margin:24px 0}.video video{display:block;width:100%;max-height:520px;border-radius:${num(design.cardRadius, 18)}px;background:#000}.video-state{margin:24px 0;padding:18px;border:1px dashed rgba(245,240,229,.3);border-radius:14px;opacity:.8}` : "")
    + (medical ? `.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}.chip{border:1px solid rgba(43,42,39,.18);border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;color:inherit;text-decoration:none}.chip-on{background:${primary};border-color:${primary};color:#fff}.facts{display:grid;gap:12px;margin:24px 0;padding:0}.facts div{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid rgba(43,42,39,.12);padding-bottom:10px}.facts dt{opacity:.65}.facts dd{margin:0;font-weight:800}.sub{font-size:20px;margin:28px 0 8px}.related{margin:0;padding-inline-start:20px}.related a{color:${primary};font-weight:800}.detail-cta{margin-top:28px}` : "")
    + `.cta{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;padding:28px;border-radius:${num(design.cardRadius, 18)}px;background:inherit}`
    + `.cta h2{margin:0}.cta p{margin:6px 0 0;opacity:.8}.cta-btn{background:#fff;color:#111827;border-radius:${num(design.buttonRadius, 12)}px;padding:12px 22px;font-weight:800;text-decoration:none}`
    + `footer.site{background:${color(footer.backgroundColor, "#0f172a")};color:${color(footer.textColor, "#e2e8f0")}}`
    + `.foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;padding:28px 0;font-size:13px}`
    + `@media(min-width:760px){.split{grid-template-columns:1fr 1fr}.hero-inner{grid-template-columns:1.05fr .95fr}}`
    + `@media(max-width:640px){.grid{grid-template-columns:1fr}}`;

  const activeCategory = vertical && hasDetailPage(siteType, page.slug) ? String(category || "") : "";
  const resolveHref = vertical ? (href) => internalHref(basePath, href) : undefined;
  const renderSection = (section) => {
    if (!vertical || !hasDetailPage(siteType, page.slug) || !Array.isArray(section.items) || !section.items.length) return sectionHtml(section, { education, itemHref, resolveHref });
    const chips = medical ? categoryChips(section, { basePath, pageSlug: page.slug, active: activeCategory }) : "";
    const shown = activeCategory ? { ...section, items: section.items.filter((item) => String(item?.meta || "").trim() === activeCategory) } : section;
    const html = sectionHtml(shown, { education, itemHref, resolveHref });
    return chips ? html.replace('<div class="grid"', `${chips}<div class="grid"`) : html;
  };
  const heroHtml = (hero.enabled === false || !page.isHome || detail) ? "" : `<section class="hero"><div class="wrap hero-inner"><div>${
    hero.eyebrow ? `<span class="eyebrow" style="color:inherit;opacity:.75">${escape(hero.eyebrow)}</span>` : ""
  }<h1>${escape(hero.title || siteName)}</h1>${hero.subtitle ? `<p>${escape(hero.subtitle)}</p>` : ""}${
    hero.ctaLabel ? link(vertical ? bookingHref(basePath) : (hero.ctaHref || "#"), hero.ctaLabel, "hero-cta") : ""
  }</div>${url(hero.imageUrl) ? `<div class="hero-media"><img src="${escape(url(hero.imageUrl))}" alt="${escape(hero.title || siteName)}"></div>` : ""}</div></section>`;

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escape(title)}</title>${description ? `<meta name="description" content="${escape(description)}">` : ""}`
    + `<meta name="generator" content="Loadder Site Builder"><style>${css}</style></head><body data-site-kind="BUSINESS" data-published-version="${escape(version?.version ?? "draft")}" data-page-slug="${escape(page.slug)}" data-page-id="${escape(page.id)}">`
    + `<header class="site"${education ? ' data-education-public="true"' : ""}${medical ? ' data-medical-public="true"' : ""}><div class="wrap bar"><span class="brand">${url(header.logoUrl) ? `<img src="${escape(url(header.logoUrl))}" alt="${escape(siteName)}">` : ""}${escape(siteName)}</span>`
    + `${navItems.length ? `<nav class="menu">${navItems.map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join("")}</nav>` : ""}`
    + `${nav.enabled === false ? "" : link(resolveHref ? resolveHref(nav.ctaHref || "#") : (nav.ctaHref || "#"), nav.ctaLabel || "تماس با ما", "nav-cta")}`
    + `</div></header>${heroHtml}<main>${detail ? detailArticleHtml(detail, { page, basePath, vertical, siteType, catalog: bookingCatalog, pages }) : sections.map((section) => renderSection(section)).join("")}</main>`
    + `${footer.enabled === false ? "" : `<footer class="site"><div class="wrap foot"><b>${escape(siteName)}</b><span>${escape(footer.text || "")}</span></div></footer>`}`
    + `</body></html>`;
}
