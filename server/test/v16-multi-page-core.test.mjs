import assert from "node:assert/strict";
import test from "node:test";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { projectPublicStorePresentation } from "../app/services/store-public-presentation.mjs";
import { renderPublishedSite } from "../app/routes/public-sites.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import {
  findPageBySlug, hasPages, navigationPages, normalizeSlug, readPages, validatePages, validateSiteDocument,
} from "../app/services/site-page-model.mjs";

function fixture() {
  const db = createSiteTestDb();
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({
    repository,
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  return { db, repository, service };
}

const section = (id, type, title) => ({ id, type, enabled: true, title, subtitle: "", backgroundColor: "#fff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32 });

const page = (id, title, slug, type, showInNav = true) => ({
  id, title, slug, showInNav, navLabel: title,
  seo: { title: `${title} | شرکت`, description: `توضیح ${title}` },
  sections: [section(`${id}-s`, type, title)],
});

/** The corporate proof set: /, /about, /services, /team, /portfolio, /contact. */
const corporateDoc = (homeTitle = "خانه") => ({
  storeBuilderV16: {
    version: 16,
    header: { storeName: "شرکت چندصفحه‌ای" },
    hero: { enabled: true, title: homeTitle, subtitle: "زیرعنوان" },
    nav: { enabled: true, ctaLabel: "تماس", ctaHref: "/contact" },
    footer: { enabled: true, text: "©" },
    seo: { title: "سایت شرکتی", description: "توضیح سایت" },
    pages: [
      { ...page("page-home", "خانه", "", "about"), seo: { title: "خانه | شرکت", description: "توضیح خانه" } },
      page("page-about", "درباره ما", "about", "about"),
      page("page-services", "خدمات", "services", "services"),
      page("page-team", "تیم", "team", "team"),
      page("page-portfolio", "نمونه‌کارها", "portfolio", "portfolio"),
      page("page-contact", "تماس", "contact", "contact"),
    ],
  },
});

const html = (project, version, content, opts) => renderPublishedSite({ siteType: "BUSINESS", ...project }, { ...version, content }, [], opts);

// ---------------------------------------------------------------- slug rules

test("slugs normalise consistently and reject anything that could escape site scope", () => {
  assert.equal(normalizeSlug("  /About/ "), "about");
  assert.equal(normalizeSlug("Our Services"), "our-services");
  assert.equal(normalizeSlug("درباره ما"), "درباره-ما");
  assert.equal(normalizeSlug(""), "");
  for (const unsafe of ["../etc", "a/b", "a\\b", "..", "%2e%2e%2fadmin", ".hidden", "%2fadmin"]) {
    assert.equal(normalizeSlug(unsafe), null, `${unsafe} must not normalise to a slug`);
  }
  // Only-slashes means the root; the write path then rejects it for any page
  // that is not Home.
  assert.equal(normalizeSlug("///"), "");
  assert.throws(() => validatePages([page("h", "خانه", ""), page("a", "A", "///")]), (error) => error.code === "SITE_PAGE_SLUG_REQUIRED");
  assert.equal(normalizeSlug("x".repeat(61)), null, "an over-long slug is rejected");
});

test("page writes reject duplicates, reserved paths, unsafe slugs and a home that leaves the root", () => {
  const ok = validatePages([page("h", "خانه", ""), page("a", "درباره", "about")]);
  assert.deepEqual(ok.map((p) => p.slug), ["", "about"]);

  const fails = (pages, code) => assert.throws(() => validatePages(pages), (error) => error.code === code, code);
  fails([page("h", "خانه", ""), page("a", "A", "about"), page("b", "B", "about")], "SITE_PAGE_SLUG_DUPLICATE");
  fails([page("h", "خانه", ""), page("a", "A", "api")], "SITE_PAGE_SLUG_RESERVED");
  fails([page("h", "خانه", ""), page("a", "A", "../admin")], "SITE_PAGE_SLUG_INVALID");
  fails([page("h", "خانه", ""), page("a", "A", "")], "SITE_PAGE_SLUG_REQUIRED");
  fails([{ ...page("h", "خانه", "home") }], "SITE_PAGE_HOME_SLUG");
  fails([page("h", "خانه", ""), { ...page("h", "دو", "two") }], "SITE_PAGE_ID_DUPLICATE");
  fails([], "SITE_PAGES_EMPTY");
});

test("an invalid page collection never reaches storage", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const bad = corporateDoc();
    bad.storeBuilderV16.pages[2].slug = "api";
    assert.throws(() => service.create({ name: "بد", siteType: "BUSINESS", content: bad }), (error) => error.code === "SITE_PAGE_SLUG_RESERVED");

    const project = service.create({ name: "خوب", siteType: "BUSINESS", content: corporateDoc() });
    const clash = corporateDoc();
    clash.storeBuilderV16.pages[3].slug = "about";
    assert.throws(() => service.update(project.id, { content: clash }), (error) => error.code === "SITE_PAGE_SLUG_DUPLICATE");
  });
  db.close();
});

// ------------------------------------------------------- legacy compatibility

test("a legacy single-page document reads as one Home page and is not rewritten", () => {
  const legacy = { version: 16, sections: [section("a", "about", "درباره")], seo: { title: "قدیمی", description: "توضیح" } };
  assert.equal(hasPages(legacy), false);

  const pages = readPages(legacy);
  assert.equal(pages.length, 1);
  assert.deepEqual([pages[0].slug, pages[0].isHome], ["", true]);
  assert.deepEqual(pages[0].sections, legacy.sections, "Home reuses the existing sections");
  assert.deepEqual(pages[0].seo, { title: "قدیمی", description: "توضیح" });

  // Reading must not add a page collection to what is stored.
  assert.equal(hasPages(legacy), false, "the source document is untouched by reading it");
  assert.deepEqual(validateSiteDocument({ storeBuilderV16: legacy }).storeBuilderV16, legacy, "a document without pages passes through unchanged");
});

test("a corporate single-page site from the previous release still renders", () => {
  const legacy = { storeBuilderV16: { version: 16, header: { storeName: "قدیمی" }, hero: { enabled: true, title: "H" }, sections: [section("a", "about", "درباره ما")] } };
  const out = html({ name: "قدیمی" }, { version: 1 }, legacy, { slug: "", basePath: "" });
  assert.ok(out && out.includes("درباره ما"), "the legacy page still renders");
  assert.match(out, /<h1>H<\/h1>/);
  assert.equal(html({ name: "قدیمی" }, { version: 1 }, legacy, { slug: "about", basePath: "" }), null, "a legacy site has no second page");
});

// ------------------------------------------------------------------- routing

test("public routing resolves every page from pages[], and an unknown slug is a 404", () => {
  const content = corporateDoc();
  for (const slug of ["", "about", "services", "team", "portfolio", "contact"]) {
    const out = html({ name: "شرکت" }, { version: 2 }, content, { slug, basePath: "" });
    assert.ok(out, `/${slug} resolves`);
    assert.match(out, new RegExp(`data-page-slug="${slug}"`), `/${slug} renders its own page`);
  }
  for (const missing of ["nope", "admin", "../etc", "a/b"]) {
    assert.equal(html({ name: "شرکت" }, { version: 2 }, content, { slug: missing, basePath: "" }), null, `/${missing} is a 404`);
  }
});

test("navigation references page identity and is shared across every page", () => {
  const content = corporateDoc();
  const pages = readPages(projectPublicStorePresentation(content, { preserveSectionIds: true, includeCommerce: false }).storeBuilderV16);
  assert.deepEqual(navigationPages(pages).map((p) => p.slug), ["", "about", "services", "team", "portfolio", "contact"]);

  const home = html({ name: "شرکت" }, { version: 2 }, content, { slug: "", basePath: "/sites/x" });
  const team = html({ name: "شرکت" }, { version: 2 }, content, { slug: "team", basePath: "/sites/x" });
  const links = (out) => [...out.matchAll(/<nav class="menu">(.*?)<\/nav>/gs)].flatMap((m) => [...m[1].matchAll(/href="([^"]*)"/g)].map((l) => l[1]));
  assert.deepEqual(links(home), ["/sites/x", "/sites/x/about", "/sites/x/services", "/sites/x/team", "/sites/x/portfolio", "/sites/x/contact"]);
  assert.deepEqual(links(team), links(home), "navigation is identical on every page");

  // Hiding a page removes it from navigation without deleting the page.
  const hidden = corporateDoc();
  hidden.storeBuilderV16.pages[4].showInNav = false;
  const out = html({ name: "شرکت" }, { version: 2 }, hidden, { slug: "", basePath: "" });
  assert.ok(!links(out).includes("/portfolio"), "a hidden page leaves navigation");
  assert.ok(html({ name: "شرکت" }, { version: 2 }, hidden, { slug: "portfolio", basePath: "" }), "but it is still reachable by address");
});

test("each page renders only its own sections and its own SEO", () => {
  const content = corporateDoc();
  const services = html({ name: "شرکت" }, { version: 2 }, content, { slug: "services", basePath: "" });
  assert.match(services, /<title>خدمات \| شرکت<\/title>/);
  assert.match(services, /<meta name="description" content="توضیح خدمات">/);
  assert.deepEqual([...services.matchAll(/data-section-type="([a-z-]+)"/g)].map((m) => m[1]), ["services"]);
  assert.ok(!services.includes("data-section-type=\"team\""), "another page's sections never leak in");

  // The hero belongs to Home only.
  assert.match(html({ name: "شرکت" }, { version: 2 }, content, { slug: "", basePath: "" }), /<h1>خانه<\/h1>/);
  assert.ok(!services.includes("class=\"hero\""), "an inner page has no home hero");

  // Absent per-page SEO falls back to values the site already has; nothing invented.
  const bare = corporateDoc();
  bare.storeBuilderV16.pages[1].seo = { title: "", description: "" };
  const about = html({ name: "شرکت" }, { version: 2 }, bare, { slug: "about", basePath: "" });
  assert.match(about, /<title>درباره ما<\/title>/, "falls back to the page title");
  assert.match(about, /content="توضیح سایت"/, "falls back to the site description");
});

// ------------------------------------------------ publish, rollback, isolation

test("publish snapshots the whole page collection; draft edits never alter live; rollback restores it", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc("نسخه یک") });
    assert.equal(repository.getPublishedPublic(project.id), null, "a draft site is on no public surface");

    service.publish(project.id);
    const liveA = repository.getPublishedPublic(project.id);
    assert.equal(liveA.version.content.storeBuilderV16.pages.length, 6, "the snapshot carries every page");

    // Draft: retitle Home and delete two pages.
    const draft = corporateDoc("نسخه دو");
    draft.storeBuilderV16.pages = draft.storeBuilderV16.pages.slice(0, 4);
    service.update(project.id, { content: draft });
    const stillA = repository.getPublishedPublic(project.id);
    assert.equal(stillA.version.content.storeBuilderV16.pages.length, 6, "live still has every published page");
    assert.match(html({ name: "ش" }, stillA.version, stillA.version.content, { slug: "", basePath: "" }), /<h1>نسخه یک<\/h1>/);
    assert.ok(html({ name: "ش" }, stillA.version, stillA.version.content, { slug: "contact", basePath: "" }), "a page deleted only in draft is still live");

    service.publish(project.id);
    const liveB = repository.getPublishedPublic(project.id);
    assert.equal(liveB.version.content.storeBuilderV16.pages.length, 4);
    assert.equal(html({ name: "ش" }, liveB.version, liveB.version.content, { slug: "contact", basePath: "" }), null, "the removed page is now a 404");

    service.rollbackPublishVersion(project.id, liveA.version.id);
    const rolled = repository.getPublishedPublic(project.id);
    assert.equal(rolled.version.content.storeBuilderV16.pages.length, 6, "rollback restores the complete historical collection");
    assert.ok(html({ name: "ش" }, rolled.version, rolled.version.content, { slug: "contact", basePath: "" }), "the rolled-back page is live again");
    assert.match(html({ name: "ش" }, rolled.version, rolled.version.content, { slug: "", basePath: "" }), /<h1>نسخه یک<\/h1>/);
  });
  db.close();
});

test("changing a slug does not expose draft content at the old or new address", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت", siteType: "BUSINESS", content: corporateDoc() });
    service.publish(project.id);

    const renamed = corporateDoc();
    renamed.storeBuilderV16.pages[1].slug = "about-us";
    renamed.storeBuilderV16.pages[1].sections = [section("secret", "about", "محتوای پیش‌نویس")];
    service.update(project.id, { content: renamed });

    const live = repository.getPublishedPublic(project.id).version;
    assert.ok(html({ name: "ش" }, live, live.content, { slug: "about", basePath: "" }), "the published address still serves the published page");
    assert.equal(html({ name: "ش" }, live, live.content, { slug: "about-us", basePath: "" }), null, "the draft address is not live");
    assert.ok(!html({ name: "ش" }, live, live.content, { slug: "about", basePath: "" }).includes("محتوای پیش‌نویس"), "draft content never appears");
  });
  db.close();
});

test("the public projection carries pages without internal ids or editor state", () => {
  const doc = corporateDoc();
  doc.storeBuilderV16.activePageId = "page-team";
  doc.storeBuilderV16.selectedElement = { type: "section", id: "page-team-s" };
  const v16 = projectPublicStorePresentation(doc, { preserveSectionIds: true, includeCommerce: false }).storeBuilderV16;

  assert.equal(v16.pages.length, 6);
  assert.deepEqual(v16.pages.map((p) => p.slug), ["", "about", "services", "team", "portfolio", "contact"]);
  const serialized = JSON.stringify(v16);
  assert.ok(!serialized.includes("activePageId"), "editor state is not published");
  assert.ok(!serialized.includes("selectedElement"), "editor selection is not published");
  assert.ok(!v16.pages.some((p) => "id" in p), "internal page ids are not published");
  assert.deepEqual(Object.keys(v16.pages[3]).sort(), ["navLabel", "sections", "seo", "showInNav", "slug", "title"], "a published page exposes only its public contract");
});

// ------------------------------------------------------- tenancy and the store

test("a foreign workspace cannot read or mutate another tenant's pages", () => {
  const { db, repository, service } = fixture();
  const project = runWithWorkspace("ws-1", () => {
    const created = service.create({ name: "شرکت الف", siteType: "BUSINESS", content: corporateDoc() });
    service.publish(created.id);
    return created;
  });

  runWithWorkspace("ws-2", () => {
    assert.throws(() => service.get(project.id), (error) => error.status === 404, "a foreign workspace cannot read the project");
    assert.throws(() => service.update(project.id, { content: corporateDoc("ربوده‌شده") }), (error) => error.status === 404, "nor mutate its pages");
    assert.equal(repository.listPublishVersions(project.id).length, 0, "nor enumerate its publish history");
  });

  runWithWorkspace("ws-1", () => {
    assert.match(repository.getPublishedPublic(project.id).version.content.storeBuilderV16.pages[0].sections[0].title, /خانه/, "the owner's pages are unchanged");
  });
  db.close();
});

test("STORE is unaffected: no page collection is required, added or rendered", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const store = { storeBuilderV16: { version: 16, sections: [section("p", "products", "محصولات")] } };
    const project = service.create({ name: "فروشگاه", siteType: "STORE", content: store });
    assert.equal(hasPages(repository.get(project.id).content.storeBuilderV16), false, "creating a store adds no pages");

    service.publish(project.id);
    const live = repository.getPublishedPublic(project.id);
    const v16 = projectPublicStorePresentation(live.version.content).storeBuilderV16;
    assert.equal(v16.pages, undefined, "a store publishes no page collection");
    assert.deepEqual(v16.sections.map((s) => s.type), ["products"]);

    // An intentionally empty store still keeps zero sections.
    const emptied = service.update(project.id, { content: { storeBuilderV16: { version: 16, sections: [] } } });
    assert.deepEqual(emptied.content.storeBuilderV16.sections, []);
  });
  db.close();
});

test("findPageBySlug is the single resolution rule and never falls through to Home", () => {
  const pages = readPages(corporateDoc().storeBuilderV16);
  assert.equal(findPageBySlug(pages, "about").slug, "about");
  assert.equal(findPageBySlug(pages, "/About/").slug, "about", "resolution normalises the request");
  assert.equal(findPageBySlug(pages, "").slug, "");
  assert.equal(findPageBySlug(pages, "missing"), null);
  assert.equal(findPageBySlug(pages, "../admin"), null);
});
