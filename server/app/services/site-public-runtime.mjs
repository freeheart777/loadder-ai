const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);

const normalizeContent = (content) => content && typeof content === "object" && !Array.isArray(content) ? content : {};

const renderSection = (section) => {
  const type = escapeHtml(section?.type || "section");
  const title = escapeHtml(section?.title || "");
  const text = escapeHtml(section?.text || section?.description || "");
  const image = typeof section?.image === "string" && /^https?:\/\//i.test(section.image) ? `<img src="${escapeHtml(section.image)}" alt="${escapeHtml(section?.alt || title)}" loading="lazy">` : "";
  return `<section data-section-type="${type}">${title ? `<h2>${title}</h2>` : ""}${text ? `<p>${text}</p>` : ""}${image}</section>`;
};

export function renderPublishedSite({ project, version, assets = [] }) {
  if (!project || project.status !== "PUBLISHED" || !version) return null;
  const content = normalizeContent(version.content);
  const title = escapeHtml(content.title || project.name);
  const description = escapeHtml(content.description || "");
  const sections = Array.isArray(content.sections) ? content.sections.map(renderSection).join("") : "";
  const assetLinks = assets.filter((asset) => typeof asset.url === "string" && /^https?:\/\//i.test(asset.url)).map((asset) => `<link rel="preload" as="image" href="${escapeHtml(asset.url)}">`).join("");
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${description ? `<meta name="description" content="${description}">` : ""}${assetLinks}<style>body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.8;color:#111827;background:#fff}main{max-width:1120px;margin:auto;padding:32px 20px}section{padding:28px 0;border-bottom:1px solid #e5e7eb}img{max-width:100%;height:auto;border-radius:16px}h1{font-size:clamp(2rem,5vw,4rem);line-height:1.15}h2{font-size:1.7rem}</style></head><body><main><header><h1>${title}</h1>${description ? `<p>${description}</p>` : ""}</header>${sections}</main></body></html>`;
}

export function sendPublishedSite(res, payload) {
  const html = renderPublishedSite(payload);
  if (!html) return res.status(404).json({ success: false, message: "Published site not found." });
  const etag = `W/\"${Buffer.from(`${payload.version.id}:${payload.version.version}`).toString("base64url")}\"`;
  if (res.req.headers["if-none-match"] === etag) return res.status(304).end();
  return res.status(200).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60, stale-while-revalidate=300", ETag: etag, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" }).send(html);
}
