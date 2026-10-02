import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import http from "node:http";
import { once } from "node:events";
import express from "express";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createBookingRepository } from "../app/repositories/booking-repository.mjs";
import { bookingScopeForSite } from "../app/services/booking-scope.mjs";
import { DETAIL_REGISTRY, detailPagesFor, hasDetailPage, isVerticalSite } from "../app/services/public-detail-registry.mjs";
import { findDetail, isCorporateV16, renderCorporateSite } from "../app/services/corporate-site-html.mjs";
import { environment } from "../app/config/environment.mjs";
import { createPublicSitesRouter } from "../app/routes/public-sites.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";

const read = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
const medical = { id: "med-1", workspaceId: "ws-1", siteType: "MEDICAL", name: "نوا", content: {} };
const BASE = "/sites/med-1";

const page = (id, title, slug, sections) => ({ id, title, slug, isHome: slug === "", showInNav: true, navLabel: title, seo: {}, sections });
const sec = (id, type, title, items = [], extra = {}) => ({ id, type, enabled: true, title, subtitle: "", items, ...extra });
const doc = () => ({
  storeBuilderV16: {
    header: { storeName: "نوا" }, hero: { enabled: true, title: "سلامت", ctaLabel: "رزرو", ctaHref: "/anything" }, nav: { enabled: true, ctaLabel: "رزرو نوبت", ctaHref: "/booking" },
    pages: [
      page("home", "خانه", "", [sec("h", "about", "درباره"), sec("c", "cta", "مجله", [], { ctaLabel: "ورود", ctaHref: "/magazine" })]),
      page("services", "خدمات", "services", [sec("s", "services", "خدمات", [
        { id: "s1", title: "ویزیت تخصصی", subtitle: "نمونه", body: "متن", meta: "عمومی", bookingServiceId: "svc-1" },
        { id: "s2", title: "تصویربرداری", subtitle: "نمونه", body: "متن", meta: "تشخیصی" },
      ])]),
      page("doctors", "پزشکان", "doctors", [sec("d", "team", "پزشکان", [{ id: "d1", title: "پزشک نمونه", subtitle: "تخصص", body: "معرفی", meta: "تخصص الف", bookingProviderId: "prov-1" }])]),
      page("clinic", "مرکز", "clinic", [sec("cl", "about", "مرکز", [{ id: "x", title: "امکانات", body: "b" }])]),
      page("magazine", "مجله", "magazine", [sec("m", "services", "مجله", [{ id: "m1", title: "مقاله نمونه", subtitle: "راهنما", body: "متن" }])]),
    ],
    sections: [],
  },
});
const catalog = [
  { id: "svc-1", name: "ویزیت تخصصی", durationMinutes: 45, modalities: ["IN_PERSON", "VIDEO"], price: { amount: 1200000, currency: "IRT" }, providers: [{ id: "prov-1", name: "دکتر نمونه" }] },
  { id: "svc-2", name: "خدمت دیگر", durationMinutes: 20, modalities: ["TEXT"], price: null, providers: [{ id: "prov-9", name: "دیگری" }] },
];
const render = (options = {}, project = medical) => renderCorporateSite(project, { version: 1, content: doc() }, doc(), { basePath: BASE, ...options });

test("vertical detail pages come from one registry, mirrored on the client", () => {
  assert.deepEqual(detailPagesFor("MEDICAL"), ["services", "doctors", "magazine"]);
  assert.deepEqual(detailPagesFor("education"), ["courses", "teachers", "magazine", "performances"]);
  assert.equal(isVerticalSite("BUSINESS"), false);
  assert.equal(hasDetailPage("MEDICAL", "clinic"), false);
  const client = read("src/components/store-studio-v16/detailRegistry.ts");
  for (const [type, pages] of Object.entries(DETAIL_REGISTRY)) assert.ok(client.includes(`${type}: [${pages.map((p) => `"${p}"`).join(", ")}]`), `${type} matches the client registry`);
});

test("Medical is a V16 vertical: details only on registry pages, cards link to them", () => {
  assert.equal(isCorporateV16(medical, doc()), true);
  const content = doc().storeBuilderV16, pages = content.pages;
  assert.equal(findDetail("MEDICAL", pages[1], "ویزیت-تخصصی").item.id, "s1");
  assert.equal(findDetail("MEDICAL", pages[3], "امکانات"), null, "the clinic page has no detail routes");
  assert.equal(findDetail("MEDICAL", pages[2], "ویزیت-تخصصی"), null, "a detail never crosses its page");
  const list = render({ slug: "services" });
  assert.ok(list.includes(`${BASE}/services/${encodeURIComponent("ویزیت-تخصصی")}`));
  assert.equal(render({ slug: "clinic", detailSlug: "امکانات" }), null);
  assert.match(render({ slug: "services" }), /data-medical-public="true"/);
});

test("Medical CTAs reach canonical booking and internal links resolve against the page base", () => {
  const home = render({ slug: "" });
  assert.match(home, /class="hero-cta" href="\/sites\/med-1\/booking"/, "the hero always enters Booking");
  assert.match(home, /class="nav-cta" href="\/sites\/med-1\/booking"/);
  assert.match(home, /class="cta-btn" href="\/sites\/med-1\/magazine"/);
  const onDomain = render({ slug: "", basePath: "" });
  assert.match(onDomain, /class="nav-cta" href="\/booking"/, "a custom domain keeps root-relative links");
  assert.match(onDomain, /class="cta-btn" href="\/magazine"/);
});

test("category chips are plain links and filter server-side", () => {
  const all = render({ slug: "services" });
  assert.match(all, /<nav class="chips"/);
  assert.match(all, /href="\/sites\/med-1\/services\?category=%D8%B9%D9%85%D9%88%D9%85%DB%8C"/);
  assert.ok(all.includes("ویزیت تخصصی") && all.includes("تصویربرداری"));
  const filtered = render({ slug: "services", category: "تشخیصی" });
  assert.ok(filtered.includes("تصویربرداری"));
  assert.equal(filtered.includes("ویزیت تخصصی</b>"), false);
  assert.match(filtered, /class="chip chip-on"/);
  assert.doesNotMatch(render({ slug: "magazine" }), /class="chips"/, "no chips when there are not two categories");
});

test("service and doctor details show canonical Booking facts and deep-link with context", () => {
  const service = render({ slug: "services", detailSlug: "ویزیت-تخصصی", bookingCatalog: catalog });
  assert.match(service, /<dt>مدت<\/dt><dd>۴۵ دقیقه<\/dd>/);
  assert.match(service, /حضوری، ویدئویی/);
  assert.match(service, /<dt>هزینه<\/dt><dd>۱٬۲۰۰٬۰۰۰ IRT<\/dd>/);
  assert.match(service, /پزشکان این خدمت/);
  assert.ok(service.includes(`href="${BASE}/doctors/${encodeURIComponent("پزشک-نمونه")}"`), "the doctor links to their own profile card");
  assert.match(service, /href="\/sites\/med-1\/booking\?service=svc-1"/);
  const doctor = render({ slug: "doctors", detailSlug: "پزشک-نمونه", bookingCatalog: catalog });
  assert.match(doctor, /خدمات این پزشک/);
  assert.ok(doctor.includes(`href="${BASE}/services/${encodeURIComponent("ویزیت-تخصصی")}"`));
  assert.match(doctor, /href="\/sites\/med-1\/booking\?provider=prov-1"/);
  assert.doesNotMatch(doctor, /خدمت دیگر/, "only services this doctor actually delivers");
});

test("details never invent facts: no catalog or unlinked card means no facts, and prices only when canonical", () => {
  const unlinked = render({ slug: "services", detailSlug: "تصویربرداری", bookingCatalog: catalog });
  assert.doesNotMatch(unlinked, /class="facts"|مدت|هزینه/);
  assert.match(unlinked, /class="hero-cta" href="\/sites\/med-1\/booking"/, "still a plain booking CTA, without a preselected context");
  assert.doesNotMatch(render({ slug: "services", detailSlug: "ویزیت-تخصصی" }), /class="facts"/, "no catalog, no facts");
  const noPrice = render({ slug: "services", detailSlug: "ویزیت-تخصصی", bookingCatalog: [{ ...catalog[0], price: null }] });
  assert.doesNotMatch(noPrice, /هزینه/);
  assert.doesNotMatch(render({ slug: "services", detailSlug: "ویزیت-تخصصی", bookingCatalog: [{ ...catalog[0], id: "other" }] }), /class="facts"/, "a catalog without the linked service shows nothing");
});

test("Education output is unchanged by the vertical generalization", () => {
  const education = { id: "e1", siteType: "EDUCATION", name: "آموزشگاه" };
  const content = { storeBuilderV16: { header: { storeName: "x" }, pages: [page("home", "خانه", "", []), page("courses", "دوره‌ها", "courses", [sec("c", "services", "دوره‌ها", [{ id: "c1", title: "پیانو", meta: "الف" }, { id: "c2", title: "گیتار", meta: "ب" }])])], sections: [] } };
  const html = renderCorporateSite(education, { version: 1, content }, content, { slug: "courses", basePath: "/sites/e1", bookingCatalog: catalog });
  assert.doesNotMatch(html, /class="chips"|class="facts"/);
  assert.match(html, /data-education-public="true"/);
  assert.doesNotMatch(html, /data-medical-public/);
});

function fixtureDb() {
  const db = createSiteTestDb();
  const booking = createBookingRepository(db);
  const weekday = new Date(Date.now() + 14 * 86400000).getUTCDay();
  const site = runWithWorkspace("ws-1", () => createSiteProjectService({ repository: createSiteProjectRepository(db) }).create({ name: "نوا", siteType: "MEDICAL", content: {} }));
  const ids = runWithWorkspace("ws-1", () => {
    const scope = bookingScopeForSite(site);
    const s = booking.createService({ name: "ویزیت", durationMinutes: 30, modalities: ["IN_PERSON"], scope });
    const p = booking.createProvider({ name: "دکتر", scope });
    booking.associate(p.id, s.id, scope);
    booking.createService({ name: "خدمت قدیمی", durationMinutes: 10, modalities: [] });
    return { serviceId: s.id, providerId: p.id };
  });
  return { db, booking, ids, weekday, site };
}

test("public router: Medical loads the scoped catalog, others never do; booking entry redirects to the app", async () => {
  const { db, booking, ids, site } = fixtureDb();
  const published = { project: { ...medical, id: site.id }, version: { id: "v1", version: 1, content: doc() }, assets: [] };
  const other = { project: { ...medical, id: "edu", siteType: "EDUCATION" }, version: { id: "v2", version: 1, content: doc() }, assets: [] };
  const content = doc(); content.storeBuilderV16.pages[1].sections[0].items[0].bookingServiceId = ids.serviceId; content.storeBuilderV16.pages[2].sections[0].items[0].bookingProviderId = ids.providerId;
  published.version.content = content;
  const repository = { getPublishedPublic: (id) => (id === "med-1" ? published : id === "edu" ? other : null), getPublishedPublicByDomain: (host) => (host === "clinic.example" ? published : null) };
  const prev = process.env.CLIENT_ORIGINS;
  const app = express();
  app.use(createPublicSitesRouter({ repository, bookingRepository: booking }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const detail = await fetch(`${base}/sites/med-1/services/${encodeURIComponent("ویزیت-تخصصی")}`);
    assert.equal(detail.status, 200);
    const html = await detail.text();
    assert.match(html, /<dt>مدت<\/dt><dd>۳۰ دقیقه<\/dd>/, "facts come from the site-scoped Booking service");
    assert.doesNotMatch(html, /خدمت قدیمی/, "legacy rows never reach a Medical page");
    assert.equal(detail.headers.get("cache-control"), "no-cache", "catalog-backed pages always revalidate");
    assert.match(detail.headers.get("content-security-policy"), /media-src 'self' https:/);
    const etagA = detail.headers.get("etag");
    const filtered = await fetch(`${base}/sites/med-1/services?category=${encodeURIComponent("تشخیصی")}`);
    assert.notEqual(filtered.headers.get("etag"), (await fetch(`${base}/sites/med-1/services`)).headers.get("etag"), "the category participates in the validator");
    assert.ok(etagA);
    const eduHtml = await (await fetch(`${base}/sites/edu/services/${encodeURIComponent("ویزیت-تخصصی")}`)).text();
    assert.doesNotMatch(eduHtml, /class="facts"/);
    // Booking entry: redirects to the app origin, passing only the known context.
    const origin = environment.clientOrigins?.[0];
    assert.ok(origin, "the default configuration names an app origin");
    const redirect = await fetch(`${base}/sites/med-1/booking?service=svc-1&provider=prov-1&evil=x`, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), `${origin.replace(/\/+$/, "")}/site/med-1/booking?service=svc-1&provider=prov-1`);
    const onDomain = await new Promise((resolve, reject) => http.get({ host: "127.0.0.1", port: server.address().port, path: "/booking", headers: { host: "clinic.example" } }, (res) => { res.resume(); resolve({ status: res.statusCode, location: res.headers.location }); }).on("error", reject));
    assert.equal(onDomain.status, 302);
    assert.match(onDomain.location, new RegExp(`/site/${site.id}/booking$`));
  } finally { await new Promise((resolve) => server.close(resolve)); db.close(); if (prev === undefined) delete process.env.CLIENT_ORIGINS; }
});
