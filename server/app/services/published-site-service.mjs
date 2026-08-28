const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const list = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).slice(0, 24) : [];

export function createPublishedSiteService({ repository }) {
  const get = (id) => repository.getPublished(id);

  function render(id) {
    const project = get(id);
    if (!project) return null;
    const assets = repository.listPublishedAssets(id);
    const content = project.content || {};
    const title = text(content.title, project.name);
    const headline = text(content.headline, title);
    const description = text(content.description, "");
    const positioning = text(content.positioning, "");
    const hero = assets.find((asset) => asset.kind === "hero") || assets.find((asset) => asset.kind === "banner");
    const logo = assets.find((asset) => asset.kind === "logo");
    const products = assets.filter((asset) => asset.kind === "product" || asset.kind === "gallery");
    const offerings = list(content.offerings);
    const sections = list(content.sections);
    const metaDescription = text(content.metaDescription, description || positioning);

    const cards = products.map((asset) => `<figure><img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || asset.name)}"><figcaption>${escapeHtml(asset.name)}</figcaption></figure>`).join("");
    const offeringHtml = offerings.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const sectionHtml = sections.map((item) => `<span>${escapeHtml(item)}</span>`).join("");

    return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(metaDescription)}"><style>body{margin:0;background:#08080b;color:#f7f7f8;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1100px;margin:auto;padding:28px}header{min-height:360px;display:flex;align-items:end;padding:28px;border-radius:28px;background:linear-gradient(135deg,#17111f,#0b1720);background-size:cover;background-position:center;overflow:hidden}header .shade{width:100%;padding:30px;border-radius:22px;background:linear-gradient(transparent,rgba(0,0,0,.82))}img.logo{width:72px;height:72px;object-fit:contain;border-radius:18px;background:#fff1;margin-bottom:20px}h1{font-size:clamp(36px,7vw,72px);line-height:1.05;margin:0 0 16px}p{color:#b8b8c2;line-height:2;font-size:17px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.chips span{padding:8px 12px;border:1px solid #ffffff1c;border-radius:999px;color:#cfcfd8}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin-top:24px}figure{margin:0;border:1px solid #ffffff14;border-radius:20px;overflow:hidden;background:#ffffff06}figure img{width:100%;aspect-ratio:1;object-fit:cover}figcaption{padding:12px;color:#ddd}ul{line-height:2;color:#ccc;padding-right:22px}.footer{margin-top:50px;padding:20px;border-top:1px solid #ffffff14;color:#777;font-size:12px}</style></head><body><main><header${hero ? ` style="background-image:url('${escapeHtml(hero.url)}')"` : ""}><div class="shade">${logo ? `<img class="logo" src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.altText || logo.name)}">` : ""}<h1>${escapeHtml(headline)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div></header>${sectionHtml ? `<div class="chips">${sectionHtml}</div>` : ""}${positioning ? `<p>${escapeHtml(positioning)}</p>` : ""}${offeringHtml ? `<section><h2>خدمات و محصولات</h2><ul>${offeringHtml}</ul></section>` : ""}${cards ? `<section><h2>تصاویر و محصولات</h2><div class="grid">${cards}</div></section>` : ""}<div class="footer">Published by Loadder · ${escapeHtml(project.slug)}</div></main></body></html>`;
  }

  return Object.freeze({ get, render });
}
