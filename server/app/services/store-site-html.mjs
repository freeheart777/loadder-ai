import { projectPublicStorePresentation } from "./store-public-presentation.mjs";

// A published STORE site has exactly one truth: the V16 document plus the
// live ecommerce catalog, read through the same projection and the same
// listProducts() the interactive storefront and the admin API already use.
// This module is a serialisation of that truth, not a second source of it —
// mirrors corporate-site-html.mjs's contract for the BUSINESS site kind.

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const url = (value) => (typeof value === "string" && /^(https:\/\/|data:image\/)/i.test(value) ? value : "");
const color = (value, fallback) => (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback);
const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const formatMoney = (minor, currency) => `${new Intl.NumberFormat("fa-IR").format(Math.max(0, Number(minor) || 0) / 100)} ${currency === "IRT" ? "تومان" : escape(currency || "")}`;

/** True when this published project already has a real V16 draft (not just the pre-V16 placeholder). */
export function isStoreV16(project, content) {
  if (String(project?.siteType || "").toUpperCase() !== "STORE") return false;
  const v16 = content?.storeBuilderV16;
  return Boolean(v16 && typeof v16 === "object" && Array.isArray(v16.sections) && v16.sections.length > 0);
}

const isVariantPurchasable = (variant) => Boolean(variant?.active ?? true)
  && (variant?.inventoryPolicy !== "DENY" || Number(variant?.inventoryQuantity || 0) > 0);

/** The same source selection StudioCanvas/config.ts productsForSection() applies on the client. */
function productsForSection(products, settings) {
  if (settings.source === "manual") {
    const ids = Array.isArray(settings.productIds) ? settings.productIds : [];
    const order = new Map(ids.map((id, index) => [id, index]));
    return products.filter((product) => order.has(product.id)).sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
  }
  if (settings.source === "featured") return products.filter((product) => product.featured);
  if (settings.source === "discounted") return products.filter((product) => Number(product.compareAtPriceMinor || 0) > product.basePriceMinor);
  if (settings.source === "latest") return [...products].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return products;
}

function productCardHtml(product, settings, overrides) {
  const override = overrides[product.id] || {};
  const variant = (product.variants || []).find((v) => isVariantPurchasable(v)) || product.variants?.[0];
  const purchasable = (product.variants || []).some((v) => isVariantPurchasable(v));
  const image = url(override.imageUrl) || url(variant?.imageUrl) || url(product.metadata?.gallery?.[0]) || "";
  const compareAt = settings.showCompareAt !== false && product.compareAtPriceMinor && product.compareAtPriceMinor > product.basePriceMinor ? product.compareAtPriceMinor : null;
  const badge = override.promotionBadge && settings.showPromotionBadge !== false ? `<span class="badge">${escape(override.promotionBadgeText || "فروش ویژه")}</span>` : "";
  return `<article class="product-card">${image ? `<div class="product-media"><img src="${escape(image)}" alt="${escape(product.name)}" loading="lazy">${badge}</div>` : `<div class="product-media product-media-empty">${badge}</div>`}<div class="product-body">${settings.showBrand !== false && (product.brand || product.category) ? `<span class="product-eyebrow">${escape(product.brand || product.category)}</span>` : ""}<b class="product-name">${escape(product.name)}</b><div class="product-price">${settings.showPrice !== false ? `<strong>${formatMoney(product.basePriceMinor, product.currency)}</strong>` : ""}${compareAt ? `<del>${formatMoney(compareAt, product.currency)}</del>` : ""}</div>${settings.showCartButton !== false ? `<span class="product-cta">${purchasable ? escape(override.ctaLabel || "افزودن به سبد خرید") : "ناموجود"}</span>` : ""}</div></article>`;
}

/** A snapshot at render time — the SSR page has no client-side clock, so this is the sale state as of publish/request, not a live countdown. saleLabel renders on its own; saleEndsAt only adds the countdown/expiry state next to it. */
function saleLineHtml(section) {
  const label = escape(section.saleLabel || "");
  let stateText = "";
  if (section.saleEndsAt) {
    const endsAt = new Date(section.saleEndsAt);
    if (!Number.isNaN(endsAt.getTime())) {
      const ended = endsAt.getTime() <= Date.now();
      stateText = ended ? "فروش ویژه به پایان رسید" : `تا پایان: ${escape(new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(endsAt))}`;
    }
  }
  if (!label && !stateText) return "";
  return `<div class="sale-line">${label ? `<b class="sale-badge">${label}</b>` : ""}${stateText ? `<span class="sale-state">${stateText}</span>` : ""}</div>`;
}

function itemGridHtml(section) {
  const items = (section.items || []).slice(0, 60);
  if (!items.length) return `<div class="empty-products">هنوز موردی در این بخش نیست.</div>`;
  return `<div class="item-grid">${items.map((item) => `<a class="item-tile" href="${escape(item.href || "#products")}">${url(item.imageUrl) ? `<div class="item-media"><img src="${escape(url(item.imageUrl))}" alt="${escape(item.title || "")}" loading="lazy"></div>` : `<div class="item-media item-media-empty"></div>`}<b class="item-title">${escape(item.title || "")}</b></a>`).join("")}</div>`;
}

function sectionHtml(section, products, commerce) {
  const style = `background:${color(section.backgroundColor, "#ffffff")};color:${color(section.textColor, "#0f172a")};padding-top:${num(section.spacingTop, 28)}px;padding-bottom:${num(section.spacingBottom, 32)}px`;
  const open = `<section data-section-type="${escape(section.type)}" style="${style}"><div class="wrap">`;
  const close = `</div></section>`;

  if (section.type === "spacer") return `<div style="height:${num(section.spacingTop, 0) + num(section.spacingBottom, 0)}px"></div>`;

  if (section.type === "products") {
    const settings = section.productSettings || {};
    const cap = Math.max(1, Math.min(12, num(section.visibleProductCount, 12)));
    const shown = productsForSection(products, settings).slice(0, cap);
    return `${open}${saleLineHtml(section)}<div class="section-head"><span class="eyebrow">${escape(section.subtitle || "")}</span><h2>${escape(section.title || "")}</h2></div>${
      shown.length ? `<div class="product-grid">${shown.map((product) => productCardHtml(product, settings, commerce.productOverrides || {})).join("")}</div>` : `<div class="empty-products">هنوز محصولی در این بخش نیست.</div>`
    }${close}`;
  }

  if (section.type === "banner") {
    return `${open}<div class="banner">${url(section.imageUrl) ? `<img src="${escape(url(section.imageUrl))}" alt="${escape(section.title || "")}" loading="lazy">` : ""}<div class="banner-copy"><h2>${escape(section.title || "")}</h2><p>${escape(section.subtitle || "")}</p></div></div>${close}`;
  }

  if (section.type === "trust") {
    return `${open}<div class="section-head"><h2>${escape(section.title || "")}</h2><p class="muted">${escape(section.subtitle || "")}</p></div>${close}`;
  }

  if (section.type === "category-grid" || section.type === "brand") {
    return `${open}<div class="section-head"><h2>${escape(section.title || "")}</h2>${section.subtitle ? `<p class="muted">${escape(section.subtitle)}</p>` : ""}</div>${itemGridHtml(section)}${close}`;
  }

  return `${open}<h2>${escape(section.title || "")}</h2>${section.subtitle ? `<p class="muted">${escape(section.subtitle)}</p>` : ""}${close}`;
}

/**
 * Render the (single, home) page of a published STORE V16 site.
 * `products` is the live catalog for this store (ecommerceService.listProducts output).
 * Returns null for any non-root slug, since a STORE site has exactly one page.
 */
export function renderStoreSite(project, version, content, products, { slug = "", basePath = "" } = {}) {
  if (slug) return null;

  const presentation = projectPublicStorePresentation(content).storeBuilderV16 || {};
  const design = presentation.design || {};
  const header = presentation.header || {};
  const hero = presentation.hero || {};
  const seo = presentation.seo || {};
  const commerce = presentation.commerce || {};
  const sections = (presentation.sections || []).filter((section) => section.enabled !== false);

  const siteName = header.storeName || project?.name || "";
  const title = seo.title || siteName;
  const description = seo.description || hero.subtitle || "";
  const primary = color(design.primaryColor, "#6d5dfc");
  const width = Math.min(1280, Math.max(880, num(design.containerWidth, 1240)));

  const css = `*{box-sizing:border-box}body{margin:0;background:${color(design.backgroundColor, "#f8fafc")};color:${color(design.textColor, "#0f172a")};font-family:${escape(design.fontFamily || "Vazirmatn")},system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.8}`
    + `.wrap{width:min(${width}px,100%);margin:auto;padding:0 16px}`
    + `header.site{background:${color(header.backgroundColor, "#ffffff")};color:${color(header.textColor, "#0f172a")};position:${header.sticky ? "sticky" : "static"};top:0;z-index:20;border-bottom:1px solid rgba(0,0,0,.06)}`
    + `.bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;min-height:64px}`
    + `.brand{display:flex;align-items:center;gap:10px;font-weight:800}.brand img{width:40px;height:40px;border-radius:12px;object-fit:cover}`
    + `.hero{background:${color(hero.backgroundColor, "#0f172a")};color:${color(hero.textColor, "#ffffff")}}`
    + `.hero-inner{display:grid;gap:24px;align-items:center;padding:48px 0}.hero h1{font-size:clamp(28px,5vw,52px);line-height:1.15;margin:12px 0}`
    + `.hero p{opacity:.78;margin:0}.hero-cta{display:inline-flex;margin-top:22px;background:${primary};color:#fff;border-radius:${num(design.buttonRadius, 12)}px;padding:12px 22px;font-weight:800;text-decoration:none}`
    + `.hero-media img{width:100%;border-radius:${num(design.cardRadius, 18)}px;display:block}`
    + `.section-head{margin-bottom:22px}.section-head h2{font-size:clamp(20px,3vw,28px);margin:6px 0 0}.eyebrow{font-size:12px;font-weight:800;color:${primary}}.muted{opacity:.7}`
    + `.product-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}`
    + `.product-card{border:1px solid rgba(0,0,0,.06);background:#fff;border-radius:${num(design.cardRadius, 18)}px;overflow:hidden}`
    + `.product-media{position:relative;aspect-ratio:1;background:#f1f5f9}.product-media img{width:100%;height:100%;object-fit:contain;display:block}`
    + `.badge{position:absolute;top:10px;right:10px;background:#f43f5e;color:#fff;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800}`
    + `.product-body{padding:16px}.product-eyebrow{display:block;font-size:11px;opacity:.55}.product-name{display:block;margin-top:4px}`
    + `.product-price{margin-top:10px;display:flex;gap:8px;align-items:baseline}.product-price strong{color:${primary}}.product-price del{opacity:.5;font-size:12px}`
    + `.product-cta{display:block;margin-top:12px;background:${primary};color:#fff;text-align:center;border-radius:${num(design.buttonRadius, 12)}px;padding:10px;font-size:13px;font-weight:800}`
    + `.empty-products{border:1px dashed rgba(0,0,0,.15);border-radius:${num(design.cardRadius, 18)}px;padding:32px;text-align:center;opacity:.55}`
    + `.banner{display:grid;border-radius:${num(design.cardRadius, 18)}px;overflow:hidden}.banner img{width:100%;height:100%;object-fit:cover}.banner-copy{padding:24px}`
    + `.sale-line{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}.sale-badge{background:#e11d48;color:#fff;border-radius:999px;padding:4px 12px;font-size:11px}.sale-state{font-size:12px;opacity:.7}`
    + `.item-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}`
    + `.item-tile{display:block;text-align:center;text-decoration:none;color:inherit;border:1px solid rgba(0,0,0,.06);background:#fff;border-radius:${num(design.cardRadius, 18)}px;overflow:hidden}`
    + `.item-media{aspect-ratio:1;background:#f1f5f9}.item-media img{width:100%;height:100%;object-fit:cover;display:block}.item-title{display:block;padding:10px;font-size:13px}`
    + `footer.site{background:${color(header.backgroundColor, "#0f172a")};color:#e2e8f0;margin-top:8px}`
    + `.foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;padding:28px 0;font-size:13px}`
    + `@media(min-width:760px){.hero-inner{grid-template-columns:1.05fr .95fr}.banner{grid-template-columns:1fr 1fr;align-items:center}}`;

  const heroHtml = hero.enabled === false ? "" : `<section class="hero"><div class="wrap hero-inner"><div>${
    hero.eyebrow ? `<span class="eyebrow" style="color:inherit;opacity:.75">${escape(hero.eyebrow)}</span>` : ""
  }<h1>${escape(hero.title || siteName)}</h1>${hero.subtitle ? `<p>${escape(hero.subtitle)}</p>` : ""}${
    hero.ctaLabel ? `<a class="hero-cta" href="${escape(String(hero.ctaHref || "#"))}">${escape(hero.ctaLabel)}</a>` : ""
  }</div>${url(hero.imageUrl) ? `<div class="hero-media"><img src="${escape(url(hero.imageUrl))}" alt="${escape(hero.title || siteName)}"></div>` : ""}</div></section>`;

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${escape(title)}</title>${description ? `<meta name="description" content="${escape(description)}">` : ""}`
    + `<meta name="generator" content="Loadder Site Builder"><style>${css}</style></head><body data-site-kind="STORE" data-published-version="${escape(version?.version ?? "draft")}">`
    + `<header class="site"><div class="wrap bar"><span class="brand">${url(header.logoUrl) ? `<img src="${escape(url(header.logoUrl))}" alt="${escape(siteName)}">` : ""}${escape(siteName)}</span></div></header>${heroHtml}<main>${sections.map((section) => sectionHtml(section, products, commerce)).join("")}</main>`
    + `<footer class="site"><div class="wrap foot"><b>${escape(siteName)}</b><span>نسخه ${escape(version?.version ?? "draft")} · منتشرشده با Loadder</span></div></footer>`
    + `</body></html>`;
}
