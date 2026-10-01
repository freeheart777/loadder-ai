import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Database from "better-sqlite3";
import { safePublicHref, safePublicImageUrl } from "../app/services/public-link-policy.mjs";
import { PUBLIC_SITE_CSP, previewSiteHeaders, publishedSiteHeaders } from "../app/services/public-site-headers.mjs";
import { sendPublishedSite } from "../app/services/site-public-runtime.mjs";
import { renderCorporateSite } from "../app/services/corporate-site-html.mjs";
import { createSiteLeadService } from "../app/services/site-lead-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

const read = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

test("link policy rejects every script-capable or off-site form and keeps legitimate links byte-for-byte", () => {
  for (const hostile of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "%6aavascript:alert(1)", "%256aavascript:alert(1)", " \u0001javascript:x", "vbscript:x", "data:text/html,<script>1</script>", "file:///etc/passwd", "about:blank", "//evil.example/x", "/x\"onmouseover=alert(1)", "/x'y", "/x<y", "https://", "../escape", "ftp://a.example/f"]) {
    assert.equal(safePublicHref(hostile), null, JSON.stringify(hostile));
  }
  for (const fine of ["https://example.com/a?b=c", "mailto:clinic@example.com", "tel:+989120000000", "#contact-main", "/sites/abc/services", "/search?q=a%26b", "/a%2Fb", "/sites/x/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA", "contact"]) {
    assert.ok(safePublicHref(fine), fine);
  }
  assert.equal(safePublicHref("/search?q=a%26b"), "/search?q=a%26b", "an encoded %26 keeps its meaning");
  assert.equal(safePublicHref("/a%2Fb"), "/a%2Fb");
});

test("image policy accepts https and raster data URLs but never SVG or scripts", () => {
  assert.ok(safePublicImageUrl("https://cdn.example/p.png"));
  assert.ok(safePublicImageUrl("data:image/png;base64,iVBORw0KGgo="));
  for (const bad of ["data:image/svg+xml;base64,PHN2Zz4=", "javascript:x", "http://insecure.example/p.png", "data:text/html;base64,AAAA"]) assert.equal(safePublicImageUrl(bad), null, bad);
});

const project = { id: "p1", siteType: "BUSINESS", name: "Clinic" };
const renderWith = (hero, nav, ctaHref, siteType = "BUSINESS", basePath = "/sites/p1") => {
  const pages = [{ id: "home", title: "خانه", slug: "", isHome: true, showInNav: true, sections: [{ id: "c", type: "cta", enabled: true, title: "T", ctaLabel: "برو", ctaHref }, { id: "a", type: "about", enabled: true, title: "A", body: "b" }] }];
  const content = { storeBuilderV16: { header: { storeName: "x" }, hero: { enabled: true, title: "H", ...hero }, nav: { enabled: true, ...nav }, pages, sections: pages[0].sections } };
  return renderCorporateSite({ ...project, siteType }, { version: 1, content }, content, { slug: "", basePath });
};

test("renderer publishes rejected author links as inert text and safe ones as links", () => {
  const html = renderWith({ ctaLabel: "هیرو", ctaHref: "javascript:alert(1)" }, { ctaLabel: "ناو", ctaHref: "data:text/html,x" }, "//evil.example");
  assert.doesNotMatch(html, /javascript:|data:text|evil\.example/);
  assert.equal((html.match(/data-link-rejected="true"/g) || []).length, 3, "hero, nav and section CTA all degrade to text");
  const safe = renderWith({ ctaLabel: "هیرو", ctaHref: "https://example.com/book" }, { ctaLabel: "ناو", ctaHref: "tel:+98912" }, "#contact-main");
  assert.match(safe, /class="hero-cta" href="https:\/\/example\.com\/book"/);
  assert.match(safe, /class="nav-cta" href="tel:\+98912"/);
  assert.doesNotMatch(safe, /data-link-rejected/);
});

test("Education hero CTA still deep-links to the canonical booking journey", () => {
  const html = renderWith({ ctaLabel: "رزرو", ctaHref: "javascript:alert(1)" }, { ctaLabel: "ناو", ctaHref: "#c" }, "#c", "EDUCATION", "/sites/p1");
  assert.match(html, /class="hero-cta" href="\/sites\/p1\/booking"/);
});

test("one header policy: closed scripts/forms, https video allowed, identical on every public surface", () => {
  for (const directive of ["default-src 'self'", "script-src 'none'", "object-src 'none'", "form-action 'none'", "frame-ancestors 'none'", "base-uri 'none'", "media-src 'self' https:"]) assert.ok(PUBLIC_SITE_CSP.includes(directive), directive);
  const published = publishedSiteHeaders(), preview = previewSiteHeaders({ ETag: "x" });
  assert.equal(published["Content-Security-Policy"], preview["Content-Security-Policy"]);
  assert.equal(published["X-Content-Type-Options"], "nosniff");
  assert.equal(preview["Cache-Control"], "private, no-store");
  assert.match(preview["X-Robots-Tag"], /noindex/);
  const headers = {}; const res = { req: { headers: {} }, status() { return this; }, set(value) { Object.assign(headers, value); return this; }, send() { return this; }, json() { return this; } };
  sendPublishedSite(res, { project: { name: "x", siteType: "BUSINESS", content: {} }, version: { id: "v", version: 1, content: {} }, assets: [] });
  if (headers["Content-Security-Policy"]) assert.equal(headers["Content-Security-Policy"], PUBLIC_SITE_CSP);
});

test("no public surface declares its own CSP string outside the shared module", () => {
  const offenders = ["server/app/routes/public-sites.mjs", "server/app/routes/auth.mjs", "server/app/services/site-public-runtime.mjs"].filter((file) => /Content-Security-Policy/.test(read(file)));
  assert.deepEqual(offenders, []);
  assert.ok(readdirSync(fileURLToPath(new URL("../app/services", import.meta.url))).includes("public-site-headers.mjs"));
});

function leadDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE leads(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT, company TEXT, source TEXT, message TEXT, score REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new', opportunity_value REAL NOT NULL DEFAULT 0, customer_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  return db;
}

test("lead honeypot discards silently and duplicate enquiries are bounded per workspace and site", () => {
  const db = leadDb(); let now = Date.parse("2026-10-02T10:00:00.000Z");
  const leads = createSiteLeadService({ db, clock: () => new Date(now).toISOString(), duplicateWindowMs: 600_000 });
  const count = () => db.prepare("SELECT count(*) AS n FROM leads").get().n;
  runWithWorkspace("ws-1", () => {
    const bot = leads.submit("site-a", { name: "Bot", phone: "0912", message: "spam", website: "http://spam.example" });
    assert.equal(bot.discarded, "HONEYPOT"); assert.equal(count(), 0); assert.ok(bot.id, "a bot gets an opaque id, not a null that reveals the discard");
    const first = leads.submit("site-a", { name: "سارا", phone: "0912", message: "نوبت" });
    assert.equal(first.discarded, null); assert.equal(count(), 1);
    const again = leads.submit("site-a", { name: "سارا", phone: "0912", message: "نوبت" });
    assert.equal(again.discarded, "DUPLICATE"); assert.equal(count(), 1); assert.notEqual(again.id, first.id, "the stored lead id is not echoed back");
    leads.submit("site-a", { name: "سارا", phone: "0912", message: "پیام دیگر" }); assert.equal(count(), 2, "a different message is a different enquiry");
    leads.submit("site-b", { name: "سارا", phone: "0912", message: "نوبت" }); assert.equal(count(), 3, "another site is never suppressed");
    now += 601_000;
    leads.submit("site-a", { name: "سارا", phone: "0912", message: "نوبت" }); assert.equal(count(), 4, "the window expires");
  });
  runWithWorkspace("ws-2", () => { leads.submit("site-a", { name: "سارا", phone: "0912", message: "نوبت" }); });
  assert.equal(count(), 5, "another workspace is never suppressed");
  db.close();
});
