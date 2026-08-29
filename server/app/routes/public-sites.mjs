import crypto from "node:crypto";
import express from "express";

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const normalizeHost = (value) => String(value ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
const hashPreviewToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const storefront = (project, version, assets, content) => {
  const hero = assets.find((asset) => asset.kind === "hero") || assets.find((asset) => asset.kind === "banner");
  const banner = assets.find((asset) => asset.kind === "banner");
  const logo = assets.find((asset) => asset.kind === "logo");
  const products = assets.filter((asset) => asset.kind === "product").slice(0, 24);
  const title = typeof content.headline === "string" && content.headline.trim() ? content.headline.trim() : project.name;
  const description = typeof content.description === "string" && content.description.trim() ? content.description.trim() : "فروشگاهی ساخته‌شده با Loadder";
  const positioning = typeof content.positioning === "string" && content.positioning.trim() ? content.positioning.trim() : description;
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="generator" content="Loadder Site Builder"><style>*{box-sizing:border-box}body{margin:0;background:#f7f8fb;color:#111827;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.8}.wrap{width:min(1180px,calc(100% - 32px));margin:auto}.nav{height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:#fff}.nav-shell{background:#fff;border-bottom:1px solid #eef0f4;position:sticky;top:0;z-index:20}.logo{max-width:160px;max-height:48px}.menu{display:flex;gap:24px;font-size:14px;color:#5b6473}.pill{border:1px solid #e6e8ee;border-radius:999px;padding:7px 13px;color:#667085;font-size:12px}.hero{min-height:560px;display:grid;align-items:center;background:#eef2ff;background-size:cover;background-position:center;border-radius:32px;overflow:hidden;margin-top:28px}.hero-overlay{min-height:560px;display:grid;align-items:center;padding:68px;background:linear-gradient(90deg,rgba(12,18,35,.84),rgba(12,18,35,.38))}.hero-copy{max-width:650px;color:#fff}.hero h1{font-size:clamp(42px,7vw,74px);line-height:1.08;margin:12px 0}.hero p{font-size:19px;color:rgba(255,255,255,.75);max-width:620px}.cta{display:inline-flex;margin-top:24px;background:#6d5dfc;color:#fff;text-decoration:none;border-radius:14px;padding:13px 22px;font-weight:800}.section{padding:70px 0}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:28px}.section h2{font-size:32px;margin:0}.muted{color:#737b8c}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}.card{background:#fff;border:1px solid #eceef3;border-radius:22px;padding:14px;box-shadow:0 12px 30px rgba(20,29,50,.05)}.product{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;background:#f1f3f7}.product-name{font-weight:800;margin-top:12px}.product-meta{font-size:13px;color:#8a92a3}.empty-products{border:1px dashed #d9dde6;border-radius:22px;padding:34px;text-align:center;color:#8a92a3;background:#fff}.banner{margin:6px 0 30px;border-radius:28px;overflow:hidden;background:#111827}.banner img{display:block;width:100%;max-height:420px;object-fit:cover}.about{background:#fff;border:1px solid #eceef3;border-radius:28px;padding:34px}.footer{margin-top:30px;background:#111827;color:#aab2c0;padding:48px 0}.footer strong{color:#fff}@media(max-width:720px){.wrap{width:calc(100% - 22px)}.menu{display:none}.hero,.hero-overlay{min-height:470px}.hero-overlay{padding:38px 24px}.hero h1{font-size:44px}.section{padding:48px 0}.section-head{align-items:start;flex-direction:column}}</style></head><body><div class="nav-shell"><div class="wrap"><nav class="nav">${logo ? `<img class="logo" src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.altText || project.name)}">` : `<strong>${escapeHtml(project.name)}</strong>`}<div class="menu"><span>خانه</span><span>محصولات</span><span>درباره ما</span><span>تماس</span></div><span class="pill">فروشگاه آنلاین</span></nav></div></div><main class="wrap"><section class="hero" ${hero ? `style="background-image:url('${escapeHtml(hero.url)}')"` : ""}><div class="hero-overlay"><div class="hero-copy"><div>فروشگاه ${escapeHtml(project.name)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(positioning)}</p><a class="cta" href="#products">مشاهده محصولات</a></div></div></section>${banner && (!hero || banner.id !== hero.id) ? `<section class="banner"><img src="${escapeHtml(banner.url)}" alt="${escapeHtml(banner.altText || banner.name)}"></section>` : ""}<section id="products" class="section"><div class="section-head"><div><div class="muted">انتخاب‌های فروشگاه</div><h2>محصولات</h2></div><span class="muted">${products.length ? `${products.length} محصول` : "هنوز محصولی اضافه نشده"}</span></div>${products.length ? `<div class="grid">${products.map((asset) => `<article class="card"><img class="product" src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || asset.name)}"><div class="product-name">${escapeHtml(asset.name.replace(/\.[^.]+$/, ""))}</div><div class="product-meta">برای قیمت و جزئیات محصول تنظیمات فروشگاه را تکمیل کن</div></article>`).join("")}</div>` : `<div class="empty-products">تصاویر محصول را از Media Library یا بخش دارایی‌های پروژه اضافه کن.</div>`}</section><section class="section"><div class="about"><h2>درباره ${escapeHtml(project.name)}</h2><p class="muted">${escapeHtml(description)}</p></div></section></main><footer class="footer"><div class="wrap"><strong>${escapeHtml(project.name)}</strong><div>نسخه ${escapeHtml(version?.version ?? "draft")} · منتشرشده با Loadder</div></div></footer></body></html>`;
};

const genericSite = (project, version, assets, content) => {
  const hero = assets.find((asset) => asset.kind === "hero") || assets.find((asset) => asset.kind === "banner");
  const logo = assets.find((asset) => asset.kind === "logo");
  const title = typeof content.headline === "string" && content.headline.trim() ? content.headline.trim() : project.name;
  const description = typeof content.description === "string" && content.description.trim() ? content.description.trim() : "ساخته‌شده با Loadder Site Builder.";
  const positioning = typeof content.positioning === "string" && content.positioning.trim() ? content.positioning.trim() : description;
  const sections = Array.isArray(content.sections) && content.sections.length ? content.sections.filter((x) => typeof x === "string").slice(0, 10) : ["Hero", "خدمات", "درباره ما", "تماس"];
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><style>body{margin:0;background:#f8f9fc;color:#151821;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.8}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}.nav{display:flex;justify-content:space-between;align-items:center;padding:22px 0}.logo{max-width:160px;max-height:48px}.hero{min-height:58vh;display:grid;align-items:center;background:#eef2ff;background-size:cover;background-position:center;border-radius:28px;overflow:hidden}.hero-content{padding:70px 46px;background:linear-gradient(90deg,#fffefa,#ffffffb8);max-width:720px}.hero h1{font-size:clamp(42px,7vw,72px);line-height:1.1;margin:14px 0}.hero p,.muted{color:#667085}.section{padding:64px 0;border-bottom:1px solid #e9ebf0}.footer{padding:42px 0 70px;color:#71717a}@media(max-width:640px){.wrap{width:calc(100% - 22px)}.hero-content{padding:40px 24px}}</style></head><body><div class="wrap"><nav class="nav">${logo ? `<img class="logo" src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.altText || project.name)}">` : `<strong>${escapeHtml(project.name)}</strong>`}<span>Loadder</span></nav><section class="hero" ${hero ? `style="background-image:url('${escapeHtml(hero.url)}')"` : ""}><div class="hero-content"><div class="muted">${escapeHtml(project.siteType)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(positioning)}</p></div></section>${sections.slice(1).map((section, i) => `<section class="section"><h2>${escapeHtml(section)}</h2><p class="muted">${escapeHtml(i === 0 ? description : positioning)}</p></section>`).join("")}<footer class="footer">${escapeHtml(project.name)} · نسخه ${escapeHtml(version?.version ?? "draft")} · Loadder</footer></div></body></html>`;
};

export const renderPublishedSite = (project, version, assets = []) => {
  if (Array.isArray(version) && assets.length === 0) {
    assets = version;
    version = { version: "draft", content: project?.content || {} };
  }
  const content = version?.content && typeof version.content === "object" ? version.content : {};
  return project?.siteType === "STORE" ? storefront(project, version, assets, content) : genericSite(project, version, assets, content);
};

export function createPublicSitesRouter({ repository }) {
  const router = express.Router();
  const sendPublished = (req, res, published) => {
    if (!published) return res.status(404).send("Site not found");
    const etag = `W/\"site-${published.version.id}\"`;
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    return res.set({ "Cache-Control": "public, max-age=60, stale-while-revalidate=300", ETag: etag, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'" }).type("html").send(renderPublishedSite(published.project, published.version, published.assets));
  };
  const sendPreview = (req, res, preview) => {
    if (!preview) return res.status(404).send("Preview not found");
    const etag = `W/\"preview-${preview.project.id}-${preview.project.updatedAt}\"`;
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    const draftVersion = { version: "draft", content: preview.project.content };
    return res.set({ "Cache-Control": "private, no-store", ETag: etag, "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'" }).type("html").send(renderPublishedSite(preview.project, draftVersion, preview.assets));
  };
  router.get("/preview/sites/:id", (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (token.length < 32 || token.length > 128) return res.status(401).send("Preview token required");
    try { return sendPreview(req, res, repository.getPreviewByToken(hashPreviewToken(token), req.params.id)); }
    catch (error) { console.error("Preview site error:", error); return res.status(500).send("Unable to render preview"); }
  });
  router.get("/sites/:id", (req, res) => {
    try { return sendPublished(req, res, repository.getPublishedPublic(req.params.id)); }
    catch (error) { console.error("Public site error:", error); return res.status(500).send("Unable to render site"); }
  });
  router.get("/", (req, res, next) => {
    const host = normalizeHost(req.headers.host);
    if (!host || host === "localhost" || host === "127.0.0.1") return next();
    try { return sendPublished(req, res, repository.getPublishedPublicByDomain(host)); }
    catch (error) { console.error("Domain site error:", error); return res.status(500).send("Unable to render site"); }
  });
  return router;
}
