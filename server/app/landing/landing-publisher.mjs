import crypto from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "../persistence/atomic-file-write.mjs";
const esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  safePath = (v) => v.replace(/[^a-z0-9/_-]/g, "-");
function render({
  blueprint,
  trackingEndpoint,
  navigation = [],
  visualPublication = [],
}) {
  const b = blueprint.blueprint,
    t = b.designTokens,
    radius =
      t.radius === "pill"
        ? "999px"
        : t.radius === "lg"
          ? "24px"
          : t.radius === "sm"
            ? "8px"
            : "16px",
    space =
      t.spacingDensity === "compact"
        ? "2rem"
        : t.spacingDensity === "spacious"
          ? "5rem"
          : "3rem",
    cta = (x) =>
      x && typeof x === "object" && x.label && x.target
        ? `<a data-landing-action="CTA_CLICK" href="${esc(x.target)}" class="cta">${esc(x.label)}</a>`
        : "",
    navigationHtml = navigation.length
      ? `<nav aria-label="Site navigation">${navigation.map((x) => `<a href="${esc(x.href)}">${esc(x.label)}</a>`).join("")}</nav>`
      : "",
    sections = b.sections
      .map((s, i) => {
        const p = s.props,
          heading = esc(p.heading || p.headline || s.componentId),
          items = Array.isArray(p.items)
            ? `<ul>${p.items.map((x) => `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("")}</ul>`
            : "",
          visuals = visualPublication
            .filter((visual) => visual.sectionId === s.id)
            .map((visual) => visual.markup)
            .join("");
        return `<section data-component="${esc(s.componentId)}" data-variant="${esc(s.variant)}">${visuals}${i ? `<h2>${heading}</h2>` : `<h1>${heading}</h1>`}${p.body ? `<p>${esc(p.body)}</p>` : ""}${items}${cta(p.primaryCta)}</section>`;
      })
      .join("");
  const client = `(()=>{try{const q=new URLSearchParams(location.search),token=q.get('lt');if(!token)return;const key='ld_landing_anon',anon=localStorage.getItem(key)||crypto.randomUUID().replaceAll('-','');localStorage.setItem(key,anon);const send=type=>{const body=JSON.stringify({token,eventId:crypto.randomUUID().replaceAll('-',''),eventType:type,occurredAt:new Date().toISOString(),anonymousId:anon});fetch(${JSON.stringify(trackingEndpoint)},{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{})};send('LANDING_VISIT');addEventListener('click',e=>{if(e.target.closest('[data-landing-action="CTA_CLICK"]'))send('CTA_CLICK')},{capture:true})}catch{}})();`,
    scriptHash = crypto.createHash("sha256").update(client).digest("base64"),
    style = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:${t.backgroundColor};color:${t.foregroundColor};font-family:system-ui,sans-serif}nav{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;min-height:64px;padding:0 1.25rem;background:${t.secondaryColor}}nav a{color:${t.foregroundColor};text-decoration:none;min-height:44px;display:inline-flex;align-items:center}main{overflow:hidden}section{max-width:${t.containerWidth === "wide" ? "78rem" : t.containerWidth === "narrow" ? "48rem" : "64rem"};margin:auto;padding:${space} 1.25rem}h1{font-size:clamp(2.2rem,7vw,4.8rem);line-height:1.15}h2{font-size:clamp(1.5rem,4vw,2.6rem)}p,li{line-height:1.9;color:${t.mutedColor}}ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:1rem;padding:0;list-style:none}li{padding:1rem;border-radius:${radius};background:${t.secondaryColor}}.cta{display:inline-flex;align-items:center;min-height:44px;margin-top:1rem;padding:.75rem 1.25rem;border-radius:${radius};background:${t.buttonStyle === "outline" ? "transparent" : t.primaryColor};border:2px solid ${t.primaryColor};color:${t.buttonStyle === "outline" ? t.primaryColor : "#fff"};text-decoration:none}.cta:focus-visible{outline:3px solid #fff;outline-offset:3px}${visualPublication.length ? "section{position:relative}section>*:not(.ld-visual-host){position:relative}.ld-visual-host{z-index:0}" : ""}${visualPublication.map((visual) => visual.css).join("\n")}`;
  const html = `<!doctype html><html lang="${esc(blueprint.locale)}" dir="${esc(blueprint.direction)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.seo.title)}</title><meta name="description" content="${esc(b.seo.description)}"><meta property="og:title" content="${esc(b.socialPreview.title)}"><meta property="og:description" content="${esc(b.socialPreview.description)}"><style>${style}</style></head><body>${navigationHtml}<main aria-label="${esc(b.accessibility.mainLabel)}">${sections}</main><script>${client}</script></body></html>`,
    checksum = crypto.createHash("sha256").update(html).digest("hex"),
    origin = new URL(trackingEndpoint, "http://local").origin,
    csp = `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'self' ${origin}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  return { html, checksum, csp };
}
export function createLandingPublisher({
  nodeEnv = "development",
  staticDirectory = "",
  publicBaseUrl = "",
  publicApiBaseUrl = "",
} = {}) {
  const production = nodeEnv === "production",
    base = String(publicBaseUrl || "").replace(/\/$/, ""),
    api = String(publicApiBaseUrl || base || "").replace(/\/$/, ""),
    configured =
      !production ||
      Boolean(
        staticDirectory && /^https:\/\//.test(base) && /^https:\/\//.test(api),
      ),
    memory = new Map(),
    endpoint = `${api}/api/public/landing/events`;
  const persist = (path, html) => {
    if (staticDirectory) {
      const target = join(staticDirectory, path);
      atomicWriteFile(target, html);
    }
    memory.set(path, html);
  };
  return Object.freeze({
    configured,
    publishRegisteredBlueprint({
      project,
      blueprint,
      navigation = [],
      visualPublication = [],
    }) {
      if (!configured)
        return Object.freeze({
          available: false,
          failureCode: "LANDING_PUBLISHER_NOT_CONFIGURED",
        });
      const path = safePath(
          `landings/${project.slug}/v${blueprint.version}-${blueprint.contentHash.slice(0, 12)}.html`,
        ),
        artifact = render({
          blueprint,
          trackingEndpoint: endpoint || "/api/public/landing/events",
          navigation,
          visualPublication,
        });
      persist(path, artifact.html);
      return Object.freeze({
        available: true,
        host: base || "local",
        path,
        artifactChecksum: artifact.checksum,
      });
    },
    resolvePublication({ publication, blueprint, visualPublication = [] }) {
      let html = memory.get(publication.path);
      if (!html && staticDirectory) {
        try {
          html = readFileSync(join(staticDirectory, publication.path), "utf8");
        } catch {}
      }
      const artifact = render({
        blueprint,
        trackingEndpoint: endpoint || "/api/public/landing/events",
        visualPublication,
      });
      if (!html) html = artifact.html;
      return artifact.checksum === publication.artifactChecksum
        ? { html, csp: artifact.csp }
        : null;
    },
    publicUrl(publication) {
      return base
        ? `${base}/${publication.path}`
        : `/public/landings/${publication.id}`;
    },
    removePublication(publication) {
      memory.delete(publication.path);
      if (staticDirectory)
        try {
          unlinkSync(join(staticDirectory, publication.path));
        } catch {}
    },
    supersedePublication() {
      return Object.freeze({ supported: true });
    },
  });
}
