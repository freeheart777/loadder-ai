import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteLeadService } from "../app/services/site-lead-service.mjs";
import { projectPublicStorePresentation } from "../app/services/store-public-presentation.mjs";
import { isCorporateV16, navigationFor, renderCorporateSite } from "../app/services/corporate-site-html.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { migration089LeadEnquiryMessage } from "../db/migrations/089_lead_enquiry_message.mjs";

const source = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

/** The `leads` shape as it exists before migration 089. */
const LEGACY_LEADS_DDL = `CREATE TABLE IF NOT EXISTS leads(
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT,
  company TEXT, source TEXT, score REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new',
  opportunity_value INTEGER NOT NULL DEFAULT 0, customer_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);`;

function fixture() {
  const db = createSiteTestDb();
  // `leads` predates the migration chain (it lives in database.mjs's raw
  // bootstrap), so the test DB declares the pre-089 shape and then upgrades it
  // exactly as a real deployment does.
  db.exec(LEGACY_LEADS_DDL);
  migration089LeadEnquiryMessage.up(db);
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

test("STORE keeps empty-section semantics: deleting every section must stay deleted", () => {
  const config = source("src/components/store-studio-v16/config.ts");
  // A persisted array is honoured as-is for STORE; only a missing array falls
  // back. Guarding on `.length` here would resurrect the defaults on reload.
  assert.match(
    config,
    /const restoredSections = Array\.isArray\(v16\.sections\)\s*\n\s*\?\s*\(corporate \?/,
    "STORE must not treat an empty sections array as 'no sections'"
  );
  assert.doesNotMatch(config, /Array\.isArray\(v16\.sections\) && v16\.sections\.length/, "the empty-array fallback must not return");
});

test("one live truth: the legacy public route and a custom domain render the same published V16 projection", () => {
  const project = { id: "p-1", name: "شرکت نمونه", siteType: "BUSINESS" };
  const content = corporateContent();
  const version = { version: 3, content };

  assert.equal(isCorporateV16(project, content), true, "a V16 corporate document is recognised");
  assert.equal(isCorporateV16({ ...project, siteType: "STORE" }, content), false, "STORE never takes the corporate path");
  assert.equal(isCorporateV16(project, {}), false, "a BUSINESS project with no V16 document keeps legacy rendering");

  const html = renderCorporateSite(project, version, content);
  const payload = projectPublicStorePresentation(content, { preserveSectionIds: true }).storeBuilderV16;

  // Same hero, same SEO, same sections in the same order as /api/auth/site/:id.
  assert.match(html, /<title>شرکت نمونه<\/title>/);
  assert.match(html, /<meta name="description" content="خدمات حرفه‌ای">/);
  assert.match(html, new RegExp(`<h1>${payload.hero.title}</h1>`));
  const rendered = [...html.matchAll(/data-section-type="([a-z-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(rendered, payload.sections.filter((s) => s.enabled !== false).map((s) => s.type), "every projected section is rendered, in order");
  for (const section of payload.sections) assert.ok(html.includes(`id="${section.id}"`), `${section.id} anchor is present`);

  // Navigation is derived from the same rule the canvas uses.
  assert.deepEqual(
    navigationFor(payload.sections).map((item) => item.label),
    ["درباره ما", "خدمات", "تیم", "نمونه‌کار", "تماس"]
  );
  // Real content, not genericSite's invented headings.
  assert.ok(html.includes("مشاوره"), "service items reach the rendered page");
  assert.doesNotMatch(html, /ساخته‌شده با Loadder Site Builder/, "the generic placeholder must not be used");
});

test("the corporate renderer escapes published content and rejects unsafe media URLs", () => {
  const content = corporateContent();
  content.storeBuilderV16.hero.title = '<script>alert(1)</script>';
  content.storeBuilderV16.hero.imageUrl = "javascript:alert(1)";
  const html = renderCorporateSite({ id: "p-1", name: "x", siteType: "BUSINESS" }, { version: 1 }, content);
  assert.doesNotMatch(html, /<script>alert/, "published text is escaped");
  assert.ok(html.includes("&lt;script&gt;"), "the title survives as escaped text");
  assert.doesNotMatch(html, /javascript:/, "only https/data image URLs are emitted");
});

test("a contact submission persists the visitor's enquiry text", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت نمونه", siteType: "BUSINESS", content: corporateContent() });
    const leads = createSiteLeadService({ db });
    const lead = leads.submit(project.id, { name: "سارا", phone: "09120000000", message: "درخواست مشاوره برای پروژه جدید" });
    const row = db.prepare("SELECT message FROM leads WHERE id=?").get(lead.id);
    assert.equal(row.message, "درخواست مشاوره برای پروژه جدید", "the enquiry text the visitor typed is stored");

    // Optional, clamped, and never client-controlled beyond the message itself.
    const blank = leads.submit(project.id, { name: "علی", phone: "09121111111" });
    assert.equal(db.prepare("SELECT message FROM leads WHERE id=?").get(blank.id).message, null);
    const long = leads.submit(project.id, { name: "رضا", phone: "09122222222", message: "x".repeat(5000) });
    assert.equal(db.prepare("SELECT message FROM leads WHERE id=?").get(long.id).message.length, 1000, "message is clamped");
  });
  db.close();
});

test("migration 089 is additive: it upgrades an existing leads table and preserves every row", () => {
  const upgrade = new Database(":memory:");
  upgrade.exec(LEGACY_LEADS_DDL);
  upgrade.prepare("INSERT INTO leads(id,workspace_id,name,phone,source,created_at,updated_at) VALUES('legacy-1','ws-1','مشتری قدیمی','0912','google_ads',?,?)").run("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");

  migration089LeadEnquiryMessage.up(upgrade);

  const columns = upgrade.prepare("PRAGMA table_info(leads)").all().map((row) => row.name);
  assert.ok(columns.includes("message"), "the column is added");
  assert.deepEqual(
    upgrade.prepare("SELECT id,name,source,message FROM leads WHERE id='legacy-1'").get(),
    { id: "legacy-1", name: "مشتری قدیمی", source: "google_ads", message: null },
    "a pre-089 lead is preserved and simply has no enquiry message"
  );

  // Re-running must not fail or duplicate the column.
  migration089LeadEnquiryMessage.up(upgrade);
  assert.equal(upgrade.prepare("PRAGMA table_info(leads)").all().filter((row) => row.name === "message").length, 1);
  assert.equal(upgrade.pragma("integrity_check", { simple: true }), "ok");
  upgrade.close();
});

test("migration 089 is a no-op on a schema that does not carry leads", () => {
  const fresh = new Database(":memory:");
  assert.doesNotThrow(() => migration089LeadEnquiryMessage.up(fresh), "a leads-free schema subset must still migrate");
  assert.equal(fresh.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='leads'").get().n, 0, "no table is invented");
  fresh.close();
});

test("a freshly migrated database accepts and returns the enquiry message", () => {
  const { db, service } = fixture();
  runWithWorkspace("ws-1", () => {
    const project = service.create({ name: "شرکت نو", siteType: "BUSINESS", content: corporateContent() });
    const lead = createSiteLeadService({ db }).submit(project.id, { name: "نازنین", phone: "09123333333", message: "سلام" });
    assert.equal(db.prepare("SELECT message FROM leads WHERE id=?").get(lead.id).message, "سلام");
  });
  db.close();
});

test("the corporate public payload carries no Commerce vocabulary, while STORE keeps it", () => {
  const corporate = projectPublicStorePresentation(corporateContent(), { preserveSectionIds: true, includeCommerce: false }).storeBuilderV16;
  assert.equal("commerce" in corporate, false, "a corporate site must not publish Commerce config");

  const storeContent = { storeBuilderV16: { version: 16, commerce: { cartButtonLabel: "افزودن" }, sections: [] } };
  assert.equal(projectPublicStorePresentation(storeContent).storeBuilderV16.commerce.cartButtonLabel, "افزودن", "STORE still publishes its commerce config");
});
