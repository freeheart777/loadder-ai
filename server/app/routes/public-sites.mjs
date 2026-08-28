import express from "express";

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export const renderPublishedSite = (project, assets = []) => {
  const content = project.content && typeof project.content === "object" ? project.content : {};
  const hero = assets.find((asset) => asset.kind === "hero") || assets.find((asset) => asset.kind === "banner");
  const logo = assets.find((asset) => asset.kind === "logo");
  const products = assets.filter((asset) => asset.kind === "product").slice(0, 12);
  const title = typeof content.headline === "string" && content.headline.trim() ? content.headline.trim() : project.name;
  const description = typeof content.description === "string" && content.description.trim() ? content.description.trim() : "ساخته‌شده با Loadder Site Builder.";
  const positioning = typeof content.positioning === "string" && content.positioning.trim() ? content.positioning.trim() : description;
  const sections = Array.isArray(content.sections) && content.sections.length ? content.sections.filter((x) => typeof x === "string").slice(0, 10) : ["Hero", "خدمات", "درباره ما", "تماس"];
  const offerings = Array.isArray(content.offerings) ? content.offerings.map((x) => typeof x === "string" ? x : x?.name).filter(Boolean).slice(0, 12) : [];
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.name)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="generator" content="Loadder Site Builder"><style>body{margin:0;background:#08080b;color:#f7f7f8;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.8}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}.nav{display:flex;justify-content:space-between;align-items:center;padding:22px 0}.logo{max-width:160px;max-height:48px}.badge{border:1px solid #27272a;border-radius:999px;padding:5px 11px;color:#a1a1aa;font-size:12px}.hero{min-height:58vh;display:grid;align-items:center;background-size:cover;background-position:center}.hero-content{max-width:780px;padding:56px 0}.hero h1{font-size:clamp(42px,7vw,76px);line-height:1.1;margin:14px 0}.hero p{font-size:20px;color:#a1a1aa}.section{padding:64px 0;border-top:1px solid #18181b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.card{background:#111116;border:1px solid #27272a;border-radius:22px;padding:22px}.product{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px}.muted{color:#a1a1aa}.footer{padding:42px 0 70px;color:#71717a}@media(max-width:640px){.wrap{width:calc(100% - 22px)}.hero-content{padding:40px 0}.hero p{font-size:17px}}</style></head><body><div class="wrap"><nav class="nav">${logo ? `<img class="logo" src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.altText || project.name)}">` : `<strong>${escapeHtml(project.name)}</strong>`}<span class="badge">Loadder</span></nav><section class="hero" ${hero ? `style="background-image:linear-gradient(#0008,#0008),url('${escapeHtml(hero.url)}')"` : ""}><div class="hero-content"><div class="muted">${escapeHtml(project.siteType)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(positioning)}</p></div></section>${sections.slice(1).map((section, i) => `<section class="section"><h2>${escapeHtml(section)}</h2><p class="muted">${escapeHtml(i === 0 ? description : positioning)}</p>${i === 0 && offerings.length ? `<div class="grid">${offerings.map((item) => `<article class="card"><strong>${escapeHtml(item)}</strong></article>`).join("")}</div>` : ""}</section>`).join("")}${products.length ? `<section class="section"><h2>محصولات</h2><div class="grid">${products.map((asset) => `<article class="card"><img class="product" src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || asset.name)}"><div style="margin-top:10px">${escapeHtml(asset.name)}</div></article>`).join("")}</div></section>` : ""}<footer class="footer">${escapeHtml(project.name)} · منتشرشده با Loadder</footer></div></body></html>`;
};

export function createPublicSitesRouter({ repository }) {
  const router = express.Router();
  router.get("/sites/:id", (req, res) => {
    const published = repository.getPublished(req.params.id);
    if (!published) return res.status(404).send("Site not found");
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.type("html").send(renderPublishedSite(published.project, published.assets));
  });
  return router;
}
