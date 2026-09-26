import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";

import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteProjectsRouter } from "../app/routes/site-projects.mjs";
import { renderPublishedSite } from "../app/routes/public-sites.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
// The real template and schema modules (TypeScript with type-only imports; Node strips the types).
import { legalFirmStarterV1 as template } from "../../src/components/store-studio-v16/templates/business-legal-firm-v1.ts";
import { siteTypeDefinition } from "../../src/components/store-studio-v16/site-types.ts";
import { SECTION_ITEM_ICONS } from "../../src/components/store-studio-v16/item-icons.ts";

// Same document shape createConfigFromTemplate() feeds the Studio.
const templateDocument = () => structuredClone({ storeBuilderV16: { version: 16, design: template.design, header: template.header, hero: template.hero, sections: template.sections } });
const ICON_NAMES = new Set(SECTION_ITEM_ICONS.map(([name]) => name));
const SPEC_SECTIONS = ["metrics-main", "practice-main", "attorneys-main", "features-main", "cases-main", "testimonials-main", "articles-main", "contact-main"];

test("the Legal Firm Starter template loads in the V16 BUSINESS schema", () => {
  assert.equal(template.id, "business.legal.firm.v1");
  assert.equal(template.siteKind, "BUSINESS");
  assert.ok(template.hero?.title && template.hero?.ctaLabel, "HeroSection → hero with title and CTA");
  assert.deepEqual(template.sections.map((section) => section.id), SPEC_SECTIONS, "spec section hierarchy, in order");
  const allowed = siteTypeDefinition("BUSINESS").sectionTypes;
  for (const section of template.sections) {
    assert.ok(allowed.includes(section.type), `${section.id}: ${section.type} is an existing BUSINESS section type`);
    assert.ok(section.enabled && section.title, `${section.id} is enabled and titled`);
  }
  const itemIds = template.sections.flatMap((section) => (section.items || []).map((item) => item.id));
  assert.equal(new Set(itemIds).size, itemIds.length, "repeater item ids are unique");
  for (const section of template.sections.filter((s) => s.type === "services")) {
    for (const item of section.items) assert.ok(ICON_NAMES.has(item.icon), `${item.id} has a known icon (${item.icon})`);
  }
  assert.equal(template.sections.at(-1).contact?.formEnabled, true, "ContactFormSection → contact form");
});

const isSvgDataImage = (value) => typeof value === "string" && value.startsWith("data:image/svg+xml") && decodeURIComponent(value.slice(value.indexOf(",") + 1)).startsWith("<svg ");
const byId = (id) => template.sections.find((section) => section.id === id);

test("the starter is a complete website: metadata, hero, 6 services, lawyer placeholders, cases, articles, consultation form", () => {
  assert.deepEqual(template.metadata, { industry: "LEGAL", targetAudience: ["law firms", "legal offices", "consultants"] });
  const { hero } = template;
  for (const field of ["eyebrow", "title", "subtitle", "ctaLabel", "ctaHref"]) assert.ok(hero[field], `hero.${field} (trust badge = eyebrow)`);
  assert.ok(isSvgDataImage(hero.imageUrl), "heroImage placeholder");
  assert.ok(template.seo?.title && template.seo?.description, "SEO defaults");

  const services = byId("practice-main").items;
  assert.equal(services.length, 6, "6 legal services");
  for (const item of services) {
    assert.ok(item.title && item.subtitle && item.body && item.icon, `${item.id} is complete`);
    // The services card renders no media and its server output is pinned byte-for-byte
    // (docs/decisions/PR4B-render-boundary.md), so a service image would be invisible.
    assert.equal(item.imageUrl, "", `${item.id} ships no invisible image`);
  }
  for (const item of byId("attorneys-main").items) {
    assert.equal(item.title, "وکیل پایه یک دادگستری", "generic lawyer identity, never a real person");
    assert.ok(item.subtitle && item.body && isSvgDataImage(item.imageUrl), `${item.id} teamImage placeholder`);
  }
  for (const item of byId("cases-main").items) assert.ok(item.body && isSvgDataImage(item.imageUrl), `${item.id} anonymous case with image`);
  for (const item of byId("articles-main").items) {
    assert.ok(item.title.length >= 30 && item.body && /مطالعه/.test(item.subtitle), `${item.id} SEO-style title, excerpt and reading time`);
    assert.ok(item.href && isSvgDataImage(item.imageUrl), `${item.id} link and articleImage placeholder`);
  }
  const contact = byId("contact-main");
  assert.ok(contact.contact.formEnabled && contact.contact.submitLabel && contact.contact.successMessage && contact.subtitle, "consultation form defaults");
});

test("no empty sections: every card section ships at least three complete cards", () => {
  for (const section of template.sections.filter((s) => s.type !== "contact")) {
    assert.ok(section.items.length >= 3, `${section.id} has cards`);
    for (const item of section.items) assert.ok(item.title && (item.subtitle || item.body), `${item.id} has text`);
  }
});

test("every template section and repeater item renders on the published site", () => {
  const repository = createSiteProjectRepository(createSiteTestDb());
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({}) } });
  const project = runWithWorkspace("ws-1", () => service.create({ name: template.label, siteType: "BUSINESS", content: templateDocument() }));
  runWithWorkspace("ws-1", () => service.publish(project.id));
  const published = repository.getPublishedPublic(project.id);
  const html = renderPublishedSite(published.project, published.version, published.assets, { slug: "", basePath: `/sites/${project.id}` }, []);
  assert.match(html, new RegExp(template.hero.title));
  const imageCount = [template.hero.imageUrl, ...template.sections.flatMap((section) => (section.items || []).map((item) => item.imageUrl))].filter(Boolean).length;
  assert.equal((html.match(/<img src="data:image\/svg\+xml/g) || []).length, imageCount, "every default image renders on the published site");
  for (const section of template.sections) {
    assert.ok(html.includes(section.title), `section "${section.title}" renders`);
    for (const item of section.items || []) assert.ok(html.includes(item.title), `item "${item.title}" renders`);
  }
});

test("edited text, image, icon, repeater and section order persist after save (Studio PATCH contract)", async () => {
  const repository = createSiteProjectRepository(createSiteTestDb());
  const service = createSiteProjectService({ repository, businessContextService: { getCurrent: () => ({}) } });
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => runWithWorkspace("ws-1", next));
  app.use("/api", createSiteProjectsRouter({ service }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/site-projects`;
  const json = async (url, init) => { const res = await fetch(url, init); return { status: res.status, body: await res.json() }; };
  try {
    const created = await json(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: template.label, siteType: "BUSINESS", content: templateDocument() }) });
    assert.equal(created.status, 201);
    const { id } = created.body.project;

    // Edit like the Inspector does: text, image, icon, a new repeater item, and move a section.
    const doc = structuredClone(created.body.project.content);
    const sections = doc.storeBuilderV16.sections;
    const practice = sections.find((section) => section.id === "practice-main");
    practice.title = "حوزه‌های تخصصی ما";
    practice.items[0] = { ...practice.items[0], title: "حقوق خانواده و ارث", icon: "scales" };
    practice.items.push({ id: "practice-main-new", title: "حقوق کار", subtitle: "دعاوی کارگر و کارفرما", body: "", imageUrl: "", meta: "", icon: "users" });
    const attorneys = sections.find((section) => section.id === "attorneys-main");
    attorneys.items[0] = { ...attorneys.items[0], title: "دکتر سارا احمدی", imageUrl: "https://cdn.example.test/attorney.jpg" };
    const [cases] = sections.splice(sections.findIndex((section) => section.id === "cases-main"), 1);
    sections.splice(1, 0, cases);

    const saved = await json(`${base}/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: doc, idempotencyKey: "legal-edit-1" }) });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));

    const reloaded = (await json(`${base}/${id}`)).body.project.content.storeBuilderV16.sections;
    assert.deepEqual(reloaded.map((section) => section.id), ["metrics-main", "cases-main", "practice-main", "attorneys-main", "features-main", "testimonials-main", "articles-main", "contact-main"], "section order persists");
    const reloadedPractice = reloaded.find((section) => section.id === "practice-main");
    assert.equal(reloadedPractice.title, "حوزه‌های تخصصی ما");
    assert.equal(reloadedPractice.items[0].title, "حقوق خانواده و ارث");
    assert.equal(reloadedPractice.items[0].icon, "scales", "icon field persists");
    assert.equal(reloadedPractice.items.at(-1).id, "practice-main-new", "added repeater item persists");
    assert.equal(reloaded.find((section) => section.id === "attorneys-main").items[0].imageUrl, "https://cdn.example.test/attorney.jpg", "image field persists");
  } finally {
    server.close();
  }
});
