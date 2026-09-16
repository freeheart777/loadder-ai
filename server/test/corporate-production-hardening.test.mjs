import assert from "node:assert/strict";
import test from "node:test";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteLeadService } from "../app/services/site-lead-service.mjs";
import { renderPublishedSite } from "../app/routes/public-sites.mjs";
import { renderCorporateSite } from "../app/services/corporate-site-html.mjs";
import { safePublicHref, safePublicImageUrl } from "../app/services/public-link-policy.mjs";
import { PUBLIC_SITE_CSP, previewSiteHeaders, publishedSiteHeaders } from "../app/services/public-site-headers.mjs";
import { indexablePages, isDiscoverableSite, renderRobots, renderSitemap } from "../app/services/public-site-discovery.mjs";
import { projectPublicStorePresentation } from "../app/services/store-public-presentation.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { migration089LeadEnquiryMessage } from "../db/migrations/089_lead_enquiry_message.mjs";

const LEGACY_LEADS_DDL = `CREATE TABLE IF NOT EXISTS leads(
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT,
  company TEXT, source TEXT, score REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new',
  opportunity_value INTEGER NOT NULL DEFAULT 0, customer_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);`;

function fixture() {
  const db = createSiteTestDb();
  db.exec(LEGACY_LEADS_DDL);
  migration089LeadEnquiryMessage.up(db);
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({
    repository,
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  return { db, repository, service };
}

const section = (id, type, extra = {}) => ({ id, type, enabled: true, title: `عنوان ${id}`, subtitle: "", backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra });

const corporateDoc = (over = {}) => ({
  storeBuilderV16: {
    version: 16,
    header: { storeName: "شرکت" },
    hero: { enabled: true, title: "عنوان خانه", subtitle: "زیرعنوان", ctaLabel: "CTA", ctaHref: "/contact" },
    nav: { enabled: true, ctaLabel: "تماس", ctaHref: "/contact" },
    footer: { enabled: true, text: "©" },
    seo: { title: "سایت", description: "توضیح سایت" },
    pages: [
      { id: "h", title: "خانه", slug: "", showInNav: true, seo: { title: "خانه | شرکت", description: "توضیح خانه" }, sections: [section("a", "about")] },
      { id: "t", title: "تیم", slug: "team", showInNav: true, seo: { title: "تیم | شرکت", description: "توضیح تیم" }, sections: [section("b", "team")] },
      { id: "x", title: "پنهان", slug: "hidden", showInNav: false, seo: { title: "پنهان", description: "" }, sections: [section("c", "team")] },
    ],
    ...over,
  },
});

const render = (content, opts = {}) => renderPublishedSite({ siteType: "BUSINESS", name: "شرکت" }, { version: 3, publishedAt: "2026-09-16T10:00:00.000Z", content }, [], { slug: "", basePath: "", ...opts });
const hrefsIn = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

// ------------------------------------------------------------- 1. safe links

test("author links: every dangerous scheme and bypass variant is rejected", () => {
  const TAB = String.fromCharCode(9), NUL = String.fromCharCode(0), ZWSP = String.fromCharCode(0x200b);
  const unsafe = [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", `java${TAB}script:alert(1)`, " javascript:alert(1) ",
    `jav${NUL}ascript:alert(1)`, `${ZWSP}javascript:alert(1)`, "%6aavascript:alert(1)",
    "%6A%61%76%61%73%63%72%69%70%74%3Aalert(1)", "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)", "file:///etc/passwd", "about:blank", "//evil.test", "http://insecure.test",
  ];
  for (const value of unsafe) assert.equal(safePublicHref(value), null, `${JSON.stringify(value)} must be rejected`);

  for (const [value, expected] of [
    ["#contact-main", "#contact-main"], ["/contact", "/contact"], ["/site/x/team", "/site/x/team"],
    ["contact", "contact"], ["mailto:a@b.test", "mailto:a@b.test"], ["tel:+982100000000", "tel:+982100000000"],
    ["https://example.test/a?b=1", "https://example.test/a?b=1"],
  ]) assert.equal(safePublicHref(value), expected, `${value} must be allowed`);

  // Media has its own, narrower rule.
  assert.equal(safePublicImageUrl("https://x.test/a.png"), "https://x.test/a.png");
  assert.ok(safePublicImageUrl("data:image/png;base64,iVBORw0KGgo="));
  for (const bad of ["data:text/html,<script>", "javascript:alert(1)", "http://x.test/a.png"]) {
    assert.equal(safePublicImageUrl(bad), null, `${bad} must not be published as an image`);
  }
});

test("a rejected link is published as text, never rewritten into a working target", () => {
  const doc = corporateDoc({
    nav: { enabled: true, ctaLabel: "NavCTA", ctaHref: "javascript:alert(1)" },
    hero: { enabled: true, title: "H", ctaLabel: "HeroCTA", ctaHref: "data:text/html,x" },
  });
  doc.storeBuilderV16.pages[0].sections = [section("c", "cta", { ctaLabel: "SecCTA", ctaHref: "vbscript:x" })];
  const html = render(doc);

  assert.ok(!/href="(javascript|data|vbscript|file|about):/i.test(html), "no dangerous scheme reaches the page");
  assert.equal((html.match(/data-link-rejected="true"/g) || []).length, 3, "all three rejected links render as text");
  // The label survives; only the link is withheld.
  for (const label of ["NavCTA", "HeroCTA", "SecCTA"]) assert.ok(html.includes(label), `${label} is still shown`);
  assert.ok(!hrefsIn(html).includes("#"), "a rejected link is not silently turned into #");
});

test("valid internal and external links still publish", () => {
  const doc = corporateDoc({ nav: { enabled: true, ctaLabel: "تماس", ctaHref: "/contact" } });
  doc.storeBuilderV16.pages[0].sections = [section("c", "cta", { ctaLabel: "بیرونی", ctaHref: "https://partner.test/x" })];
  const html = render(doc);
  const hrefs = hrefsIn(html);
  assert.ok(hrefs.includes("/contact"), "an internal path publishes");
  assert.ok(hrefs.includes("https://partner.test/x"), "an https target publishes");
  assert.equal((html.match(/data-link-rejected/g) || []).length, 0);
});

// -------------------------------------------------------------------- 2. CSP

test("every public HTML surface carries a CSP that closes scripts without breaking assets", () => {
  for (const headers of [publishedSiteHeaders(), previewSiteHeaders()]) {
    const csp = headers["Content-Security-Policy"];
    assert.ok(csp, "a CSP is always set");
    assert.match(csp, /script-src 'none'/, "the server-rendered page runs no scripts");
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    // Required assets stay allowed.
    assert.match(csp, /img-src 'self' https: data:/, "images must keep working");
    assert.match(csp, /style-src 'self' 'unsafe-inline'/, "the renderer emits inline <style>");
    assert.match(csp, /font-src 'self' data:/);
    assert.ok(!/script-src[^;]*unsafe/.test(csp), "no unsafe script broadening");
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
  }
  assert.equal(previewSiteHeaders()["X-Robots-Tag"], "noindex, nofollow, noarchive", "a draft preview is never indexed");
  assert.equal(publishedSiteHeaders()["Cache-Control"], "public, max-age=60, stale-while-revalidate=300");
  assert.equal(PUBLIC_SITE_CSP, publishedSiteHeaders()["Content-Security-Policy"], "one policy, one definition");
});

// --------------------------------------------------- 3 & 4. canonical, SEO

test("initial HTML carries the published page's own title, description and canonical", () => {
  const doc = corporateDoc();
  const home = render(doc, { canonicalDomain: "acme.test" });
  assert.match(home, /<title>خانه \| شرکت<\/title>/);
  assert.match(home, /<meta name="description" content="توضیح خانه">/);
  assert.match(home, /<link rel="canonical" href="https:\/\/acme\.test\/">/);

  const team = render(doc, { slug: "team", canonicalDomain: "acme.test" });
  assert.match(team, /<title>تیم \| شرکت<\/title>/);
  assert.match(team, /<meta name="description" content="توضیح تیم">/);
  assert.match(team, /<link rel="canonical" href="https:\/\/acme\.test\/team">/, "canonical points at the customer domain page");
});

test("no canonical is invented when the site has no customer domain, and internal addresses are noindex", () => {
  const doc = corporateDoc();
  const withoutDomain = render(doc);
  assert.ok(!withoutDomain.includes('rel="canonical"'), "a site with no domain gets no canonical");
  assert.ok(!withoutDomain.includes('name="robots"'), "the customer surface is not marked noindex");

  const internal = render(doc, { noindex: true });
  assert.match(internal, /<meta name="robots" content="noindex, follow">/, "an internal address is noindex");

  const internalWithDomain = render(doc, { slug: "team", noindex: true, canonicalDomain: "acme.test" });
  assert.match(internalWithDomain, /<meta name="robots" content="noindex, follow">/);
  assert.match(internalWithDomain, /<link rel="canonical" href="https:\/\/acme\.test\/team">/, "an internal address points at the customer domain");
});

test("the canonical domain is read from an ACTIVE domain of that project only", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const own = service.create({ name: "شرکت الف", siteType: "BUSINESS", content: corporateDoc() });
    const other = service.create({ name: "شرکت ب", siteType: "BUSINESS", content: corporateDoc() });
    const now = "2026-09-16T10:00:00.000Z";
    db.prepare("INSERT INTO site_domains(id,workspace_id,site_project_id,domain,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .run("d1", "ws-1", own.id, "acme.test", "ACTIVE", now, now);
    db.prepare("INSERT INTO site_domains(id,workspace_id,site_project_id,domain,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .run("d2", "ws-1", other.id, "pending.test", "PENDING", now, now);

    assert.equal(repository.getActiveDomainForProject(own.id), "acme.test");
    assert.equal(repository.getActiveDomainForProject(other.id), null, "a domain that is not ACTIVE is not canonical");
    assert.equal(repository.getActiveDomainForProject("missing"), null);
  });
  db.close();
});

// ------------------------------------------------------- 5. sitemap & robots

test("the sitemap lists published navigable pages only, from the canonical page collection", () => {
  const published = { project: { siteType: "BUSINESS", name: "شرکت" }, version: { version: 3, publishedAt: "2026-09-16T10:00:00.000Z", content: corporateDoc() } };
  assert.equal(isDiscoverableSite(published), true);

  assert.deepEqual(indexablePages(published).map((p) => p.slug), ["", "team"], "a page hidden from navigation is not advertised");
  const xml = renderSitemap(published, "https://acme.test");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/acme\.test\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/acme\.test\/team<\/loc>/);
  assert.ok(!xml.includes("/hidden"), "a nav-hidden page stays out of the sitemap");
  assert.match(xml, /<lastmod>2026-09-16<\/lastmod>/);

  // A store, and anything unpublished, is not a discoverable corporate site.
  assert.equal(isDiscoverableSite({ project: { siteType: "STORE" }, version: { content: corporateDoc() } }), false);
  assert.equal(isDiscoverableSite(null), false);
  assert.equal(isDiscoverableSite({ project: { siteType: "BUSINESS" }, version: { content: {} } }), false);
});

test("robots references the sitemap only when a canonical origin exists", () => {
  const withDomain = renderRobots("https://acme.test");
  assert.match(withDomain, /^User-agent: \*/m);
  assert.match(withDomain, /Sitemap: https:\/\/acme\.test\/sitemap\.xml/);
  assert.ok(!renderRobots(null).includes("Sitemap:"), "no sitemap is advertised without a canonical origin");
});

test("discovery never crosses tenants: it is built from the requested site's own published snapshot", () => {
  const mine = { project: { siteType: "BUSINESS", name: "الف" }, version: { version: 1, content: corporateDoc() } };
  const theirs = corporateDoc();
  theirs.storeBuilderV16.pages = [{ id: "h", title: "خانه", slug: "", showInNav: true, seo: {}, sections: [section("z", "about")] }, { id: "s", title: "مخفی", slug: "secret-tenant-page", showInNav: true, seo: {}, sections: [section("y", "team")] }];
  const xml = renderSitemap(mine, "https://acme.test");
  assert.ok(!xml.includes("secret-tenant-page"), "another tenant's pages never appear");
  assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), ["https://acme.test/", "https://acme.test/team"]);
});

// ------------------------------------------------------------------ 6. 404

test("an unknown slug yields no HTML at all, so the route answers a real 404", () => {
  const doc = corporateDoc();
  for (const missing of ["nope", "admin", "../etc", "a/b"]) {
    assert.equal(render(doc, { slug: missing }), null, `/${missing} must not render`);
  }
  // Home is never substituted for a missing page.
  const home = render(doc);
  assert.ok(home && home.includes("عنوان خانه"));
  assert.notEqual(render(doc, { slug: "nope" }), home);
});

// --------------------------------------------------------- 7. spam hardening

test("a filled honeypot is accepted but never stored", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc() });
    const leads = createSiteLeadService({ db, clock: () => "2026-09-16T12:00:00.000Z" });
    const result = leads.submit(project.id, { name: "بات", phone: "09120000000", message: "spam", website: "http://spam.test" });
    assert.equal(result.discarded, "HONEYPOT");
    assert.equal(result.id, null);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads").get().n, 0, "nothing is written");
  });
  db.close();
});

test("a repeated identical enquiry is suppressed inside the window and allowed after it", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc() });
    let now = "2026-09-16T12:00:00.000Z";
    const leads = createSiteLeadService({ db, clock: () => now, duplicateWindowMs: 10 * 60 * 1000 });
    const payload = { name: "سارا", phone: "09120000000", message: "درخواست مشاوره" };

    const first = leads.submit(project.id, payload);
    assert.equal(first.discarded, null);

    now = "2026-09-16T12:05:00.000Z";
    const repeat = leads.submit(project.id, payload);
    assert.equal(repeat.discarded, "DUPLICATE");
    assert.equal(repeat.id, first.id, "the caller is pointed at the existing lead");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads").get().n, 1, "no second row");

    // A different enquiry from the same person is not a duplicate.
    now = "2026-09-16T12:06:00.000Z";
    assert.equal(leads.submit(project.id, { ...payload, message: "سوال دیگر" }).discarded, null);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads").get().n, 2);

    // Past the window the same enquiry is accepted again.
    now = "2026-09-16T12:30:00.000Z";
    assert.equal(leads.submit(project.id, payload).discarded, null);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads").get().n, 3);
  });
  db.close();
});

test("a legitimate submission still persists its message, and stays tenant isolated", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc() });
    const lead = createSiteLeadService({ db }).submit(project.id, { name: "سارا", phone: "09121111111", email: "s@x.test", message: "متن واقعی درخواست" });
    const row = db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id);
    assert.equal(row.message, "متن واقعی درخواست");
    assert.equal(row.workspace_id, "ws-1");
    assert.equal(row.source, `website:${project.id}`);
    assert.equal(row.status, "new");
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads WHERE workspace_id='ws-2'").get().n, 0, "no foreign workspace receives it");

  // Duplicate suppression is scoped per workspace, not global.
  const other = runWithWorkspace("ws-2", () => {
    const project = createSiteProjectService({
      repository: createSiteProjectRepository(db),
      businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
    }).create({ name: "شرکت ب", siteType: "BUSINESS", content: corporateDoc() });
    return createSiteLeadService({ db }).submit(project.id, { name: "سارا", phone: "09121111111", message: "متن واقعی درخواست" });
  });
  assert.equal(other.discarded, null, "an identical enquiry to another tenant's site is its own lead");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads WHERE workspace_id='ws-2'").get().n, 1);
  db.close();
});

// -------------------------------------------------------------- 8. no regress

test("STORE is untouched by the hardening", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const store = { storeBuilderV16: { version: 16, sections: [section("p", "products")] } };
    const project = service.create({ name: "فروشگاه", siteType: "STORE", content: store });
    service.publish(project.id);
    const live = repository.getPublishedPublic(project.id);
    const v16 = projectPublicStorePresentation(live.version.content).storeBuilderV16;
    assert.equal(v16.pages, undefined, "a store publishes no page collection");
    assert.deepEqual(v16.sections.map((s) => s.type), ["products"]);

    // The store still renders through its own path, not the corporate one.
    const html = renderPublishedSite({ siteType: "STORE", name: "فروشگاه" }, { version: 1, content: store }, [], {});
    assert.ok(html && !html.includes('data-site-kind="BUSINESS"'));

    const emptied = service.update(project.id, { content: { storeBuilderV16: { version: 16, sections: [] } } });
    assert.deepEqual(emptied.content.storeBuilderV16.sections, []);
  });
  db.close();
});

test("a legacy corporate site with no pages[] still renders, with the same hardening applied", () => {
  const legacy = { storeBuilderV16: { version: 16, header: { storeName: "قدیمی" }, hero: { enabled: true, title: "H", ctaLabel: "CTA", ctaHref: "javascript:alert(1)" }, sections: [section("a", "about")] } };
  const before = JSON.stringify(legacy);
  const html = renderCorporateSite({ siteType: "BUSINESS", name: "قدیمی" }, { version: 1 }, legacy, { slug: "", basePath: "" });
  assert.ok(html.includes("<h1>H</h1>"));
  assert.ok(!/href="javascript:/i.test(html), "the link policy applies to legacy documents too");
  assert.equal(JSON.stringify(legacy), before, "rendering does not rewrite the stored document");
  assert.equal(renderCorporateSite({ siteType: "BUSINESS", name: "قدیمی" }, { version: 1 }, legacy, { slug: "team", basePath: "" }), null);
});
