import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteLeadService } from "../app/services/site-lead-service.mjs";
import { projectPublicStorePresentation } from "../app/services/store-public-presentation.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

const source = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

function fixture() {
  const db = createSiteTestDb();
  // `leads` predates the migration chain (it lives in database.mjs's raw
  // bootstrap), so the test DB declares it exactly as production shapes it.
  db.exec(`CREATE TABLE IF NOT EXISTS leads(
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT,
    company TEXT, source TEXT, score REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new',
    opportunity_value INTEGER NOT NULL DEFAULT 0, customer_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);
  const repository = createSiteProjectRepository(db);
  const service = createSiteProjectService({
    repository,
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
  });
  return { db, repository, service };
}

const corporateContent = (overrides = {}) => ({
  storeBuilderV16: {
    version: 16,
    seo: { title: "شرکت نمونه", description: "خدمات حرفه‌ای" },
    nav: { enabled: true, ctaLabel: "تماس با ما", ctaHref: "#contact-main" },
    footer: { enabled: true, text: "© همه حقوق محفوظ است.", backgroundColor: "#0f172a", textColor: "#e2e8f0" },
    hero: { enabled: true, title: "عنوان اصلی", subtitle: "زیرعنوان" },
    sections: [
      { id: "about-main", type: "about", enabled: true, showInNav: true, navLabel: "درباره ما", title: "درباره ما", subtitle: "ما که هستیم", body: "متن معرفی" },
      { id: "services-main", type: "services", enabled: true, showInNav: true, navLabel: "خدمات", title: "خدمات", subtitle: "", columns: 3, items: [{ id: "s1", title: "مشاوره", subtitle: "کوتاه" }] },
      { id: "team-main", type: "team", enabled: true, showInNav: true, navLabel: "تیم", title: "تیم", subtitle: "", items: [{ id: "m1", title: "عضو", subtitle: "سمت" }] },
      { id: "portfolio-main", type: "portfolio", enabled: true, showInNav: true, navLabel: "نمونه‌کار", title: "نمونه‌کارها", subtitle: "", items: [{ id: "p1", title: "پروژه", subtitle: "صنعت" }] },
      { id: "cta-main", type: "cta", enabled: true, showInNav: false, title: "شروع کنیم", subtitle: "", ctaLabel: "تماس", ctaHref: "#contact-main" },
      { id: "contact-main", type: "contact", enabled: true, showInNav: true, navLabel: "تماس", title: "تماس با ما", subtitle: "", contact: { formEnabled: true, submitLabel: "ارسال", successMessage: "ثبت شد.", phone: "021" } },
    ],
    ...overrides,
  },
});

test("one V16 core serves both site types: the registry decides capabilities and sections, not a second builder", () => {
  const registry = source("src/components/store-studio-v16/site-types.ts");
  const canvas = source("src/components/store-studio-v16/StudioCanvas.tsx");

  assert.match(registry, /STORE:\s*\{[\s\S]*?capabilities:\s*\["commerce",\s*"catalog"\]/, "STORE keeps the commerce capability");
  assert.doesNotMatch(registry, /BUSINESS:[\s\S]*?capabilities:[^\]]*"commerce"/, "a corporate site must not load Commerce concepts");
  for (const type of ["about", "services", "portfolio", "team", "cta", "contact"]) {
    assert.ok(registry.includes(`"${type}"`), `corporate section type ${type} is registered`);
  }
  // One renderer, one canvas: the corporate composition is a branch inside
  // StudioCanvas, never a parallel renderer or a duplicated publish flow.
  assert.match(canvas, /data-storefront-renderer="store-studio-v16"/);
  assert.equal((canvas.match(/export default function StudioCanvas/g) || []).length, 1, "there is exactly one canvas entry point");
  assert.match(canvas, /!isCommerceSite\(props\.config\.siteKind\)\?<CorporateCanvas/, "site kind selects the composition inside the one canvas");
});

test("corporate project publishes, serves live from the published version, and rolls back", () => {
  const { db, repository, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت نمونه", siteType: "BUSINESS", content: corporateContent() });
    assert.equal(project.siteType, "BUSINESS");

    // Draft only: nothing is live yet.
    assert.equal(repository.getPublishedPublic(project.id), null, "an unpublished corporate site is not live");

    service.publish(project.id);
    const liveV1 = repository.getPublishedPublic(project.id);
    assert.equal(liveV1.version.version, 1);
    assert.equal(liveV1.version.content.storeBuilderV16.hero.title, "عنوان اصلی");

    // Draft edit must not alter the live version.
    const edited = corporateContent();
    edited.storeBuilderV16.hero.title = "عنوان ویرایش‌شده";
    service.update(project.id, { content: edited });
    assert.equal(
      repository.getPublishedPublic(project.id).version.content.storeBuilderV16.hero.title,
      "عنوان اصلی",
      "editing the draft must never change what is live"
    );

    // Publishing promotes the draft; rollback restores the previous version.
    service.publish(project.id);
    assert.equal(repository.getPublishedPublic(project.id).version.content.storeBuilderV16.hero.title, "عنوان ویرایش‌شده");
    service.rollbackPublishVersion(project.id, liveV1.version.id);
    assert.equal(
      repository.getPublishedPublic(project.id).version.content.storeBuilderV16.hero.title,
      "عنوان اصلی",
      "rollback restores the earlier published version"
    );
  });
  db.close();
});

test("the public projection carries corporate structure and keeps section ids stable for navigation", () => {
  const presentation = projectPublicStorePresentation(corporateContent(), { preserveSectionIds: true }).storeBuilderV16;

  assert.equal(presentation.seo.title, "شرکت نمونه");
  assert.equal(presentation.seo.description, "خدمات حرفه‌ای");
  assert.equal(presentation.nav.ctaHref, "#contact-main");
  assert.equal(presentation.footer.text, "© همه حقوق محفوظ است.");

  const ids = presentation.sections.map((section) => section.id);
  assert.deepEqual(ids, ["about-main", "services-main", "team-main", "portfolio-main", "cta-main", "contact-main"]);

  const nav = presentation.sections.filter((section) => section.showInNav !== false && section.enabled);
  assert.deepEqual(nav.map((section) => section.navLabel), ["درباره ما", "خدمات", "تیم", "نمونه‌کار", "تماس"], "navigation is derived from the sections");

  // The CTA target must still resolve against a real section id after projection.
  assert.ok(ids.includes(presentation.sections.find((s) => s.type === "cta").ctaHref.slice(1)), "CTA anchor survives publication");

  const services = presentation.sections.find((section) => section.type === "services");
  assert.equal(services.items[0].title, "مشاوره");
  assert.equal(services.columns, 3);
  assert.equal(presentation.sections.find((section) => section.type === "contact").contact.phone, "021");
});

test("STORE public projection still anonymises section ids and is unaffected by the corporate path", () => {
  const storeContent = { storeBuilderV16: { version: 16, sections: [{ id: "products-main", type: "products", enabled: true, title: "محصولات" }] } };
  const presentation = projectPublicStorePresentation(storeContent).storeBuilderV16;
  assert.deepEqual(presentation.sections.map((section) => section.id), ["public-section-1"], "store section ids stay anonymised");
});

test("a contact submission becomes a canonical CRM lead attributed to the site project", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت نمونه", siteType: "BUSINESS", content: corporateContent() });
    const leads = createSiteLeadService({ db, clock: () => "2026-09-16T12:00:00.000Z" });

    const lead = leads.submit(project.id, { name: "سارا رضایی", phone: "09120000000", email: "s@example.com", company: "نمونه", message: "درخواست مشاوره" });

    const row = db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id);
    assert.equal(row.workspace_id, "ws-1", "the lead is written into the submitting workspace");
    assert.equal(row.name, "سارا رضایی");
    assert.equal(row.status, "new");
    assert.equal(row.source, `website:${project.id}`, "provenance is the site project, not client-supplied text");

    // Contact identity is required; the form cannot create an empty lead.
    assert.throws(() => leads.submit(project.id, { name: "", phone: "" }), (error) => error.code === "SITE_LEAD_CONTACT_REQUIRED");
  });
  db.close();
});

test("leads are tenant isolated", () => {
  const { db, service } = fixture();
  const leads = createSiteLeadService({ db });
  const own = runWithWorkspace("ws-1", () => service.create({ name: "شرکت الف", siteType: "BUSINESS", content: corporateContent() }));
  runWithWorkspace("ws-1", () => leads.submit(own.id, { name: "الف", phone: "0912" }));

  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads WHERE workspace_id='ws-2'").get().n, 0, "another tenant sees none of these leads");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads WHERE workspace_id='ws-1'").get().n, 1);
  db.close();
});

test("corporate live entry, RTL and the 390px mobile contract are wired", () => {
  const canvas = source("src/components/store-studio-v16/StudioCanvas.tsx");
  const runtime = source("src/components/store-studio-v16/PublicSiteRuntime.tsx");
  const app = source("src/App.tsx");

  assert.match(canvas, /dir="rtl"/, "the one canvas renders RTL for every site type");
  assert.match(canvas, /props\.device==="tablet"\?"768px":"390px"/, "mobile preview is the 390px contract");
  // The live corporate page reuses the same canvas rather than a second renderer.
  assert.match(runtime, /import StudioCanvas from "\.\/StudioCanvas"/);
  assert.doesNotMatch(runtime, /\/api\/stores\//, "a corporate site must not fetch the product catalog");
  assert.match(runtime, /restoreConfig\(meta\?\.presentation \|\| \{\}, "BUSINESS"\)/, "live reads the published presentation");
  assert.match(app, /path="\/site\/:siteProjectId"/, "the corporate site has a public live route");
  assert.match(app, /path="\/dashboard\/websites\/corporate"/, "direct entry to the corporate builder exists");
});

test("direct entry needs no Growth, Goal, Plan or Brain prerequisite", () => {
  const entry = source("src/pages/CorporateWebsiteStudioPage.tsx");
  const bootstrap = source("src/lib/activeSiteProject.ts");
  const imports = (file) => [...file.matchAll(/^import\s.*?from\s+"([^"]+)";/gm)].map((match) => match[1]);
  for (const specifier of [...imports(entry), ...imports(bootstrap)]) {
    for (const forbidden of ["growth", "goal", "plan", "brain", "mission"]) {
      assert.ok(!specifier.toLowerCase().includes(forbidden), `corporate entry must not import ${specifier}`);
    }
  }
  assert.match(bootstrap, /siteType/, "the bootstrap creates the project by site type");
  // Corporate bootstrap must not touch Commerce's canonical active-store truth.
  assert.doesNotMatch(bootstrap, /setCanonicalStoreProject/, "corporate entry must not mutate the canonical store project");
});
