import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MAX_PAGES, MAX_SECTIONS_PER_PAGE, normalizeSiteSections, renderedSections, sectionWalkMode } from "../app/site-platform/section-runtime.mjs";
import { renderPublishedSite } from "../app/routes/public-sites.mjs";
import { isCorporateV16 } from "../app/services/corporate-site-html.mjs";
import { isStoreV16 } from "../app/services/store-site-html.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SNAPSHOTS = path.join(HERE, "__snapshots__", "site-render-baseline");

const section = (id, type, extra = {}) => ({ id, type, enabled: true, title: `t-${id}`, subtitle: "", ...extra });
const STORE = { siteType: "STORE", name: "store" };
const BUSINESS = { siteType: "BUSINESS", name: "business" };

/** data-section-type sequence of rendered HTML (spacers carry no attribute). */
const renderedTypes = (html) => [...html.matchAll(/data-section-type="([^"]*)"/g)].map((match) => match[1]);
/** The same sequence from the runtime model. */
const modelTypes = (page) => renderedSections(page).filter((s) => s.legacyType !== "spacer").map((s) => (s.legacyType == null ? "" : String(s.legacyType)));
const render = (project, content, slug = "") => renderPublishedSite(project, { id: "v", version: 1, content }, [], { slug, basePath: "" });
const pageBySlug = (model, slug) => model.pages.find((page) => page.slug === slug);

// --- walk rules ----------------------------------------------------------------

test("store: top-level sections only; pages are ignored", () => {
  const content = { storeBuilderV16: { sections: [section("p", "products"), section("t", "trust")], pages: [{ sections: [section("x", "about")] }] } };
  const model = normalizeSiteSections(STORE, content);
  assert.equal(model.mode, "store");
  assert.equal(model.pages.length, 1);
  assert.deepEqual(model.pages[0].sections.map((s) => s.legacyType), ["products", "trust"]);
  assert.deepEqual(model.sectionTypes, ["commerce.productShelf", "core.trust"]);
});

test("corporate: pages semantics — pages win, leftover top-level sections are ignored", () => {
  const content = { storeBuilderV16: {
    sections: [section("old", "portfolio")],
    pages: [
      { id: "stored-home", title: "خانه", slug: "ignored", sections: [section("a", "about")] },
      { id: "stored-team", title: "تیم", slug: "Team", sections: [section("m", "team"), section("c", "contact")] },
    ],
  } };
  const model = normalizeSiteSections(BUSINESS, content);
  assert.equal(model.mode, "corporate");
  assert.deepEqual(model.pages.map((p) => [p.id, p.slug, p.isHome]), [["page-1", "", true], ["page-2", "team", false]], "ids and slugs as the renderer's readPages yields them");
  assert.deepEqual(model.sectionTypes, ["core.about", "core.contact", "people.profileGrid"]);
  assert.ok(!model.sectionTypes.includes("core.portfolio"), "top-level leftovers never render");
  assert.equal(model.pages[1].sections[0].pageSlug, "team");
});

test("corporate: a document without pages reads as a single Home page", () => {
  const model = normalizeSiteSections(BUSINESS, { storeBuilderV16: { sections: [section("a", "about"), section("c", "cta")] } });
  assert.equal(model.pages.length, 1);
  assert.deepEqual([model.pages[0].id, model.pages[0].slug, model.pages[0].isHome], ["page-home", "", true]);
  assert.deepEqual(model.pages[0].sections.map((s) => s.type), ["core.about", "core.cta"]);
});

test("legacy, pre-V16 and non-rendering documents have no sections", () => {
  const cases = [
    [STORE, { headline: "x" }],
    [STORE, { storeBuilderV16: { sections: [] } }],
    [STORE, { storeBuilderV11: { sections: [section("p", "products")] }, storeBuilderV15: { sections: [section("p", "products")] } }],
    [BUSINESS, { storeBuilderV16: { sections: [section("t", "text"), section("s", "spacer")] } }],
    [{ siteType: "MEDICAL" }, { storeBuilderV16: { sections: [section("a", "about")] } }],
    [BUSINESS, null],
    [null, undefined],
    [BUSINESS, { storeBuilderV16: "bad" }],
  ];
  for (const [project, content] of cases) {
    const model = normalizeSiteSections(project, content);
    assert.equal(model.mode, "legacy");
    assert.deepEqual(model.pages, []);
    assert.deepEqual(model.sectionTypes, []);
  }
});

test("walk mode matches the renderer's isCorporateV16 / isStoreV16 decision", () => {
  const docs = [
    { storeBuilderV16: { sections: [section("a", "about")] } },
    { storeBuilderV16: { sections: [section("t", "text")] } },
    { storeBuilderV16: { sections: [] } },
    { storeBuilderV16: { pages: [{ sections: [section("c", "contact")] }] } },
    { storeBuilderV16: { sections: [section("p", "products")] } },
    { storeBuilderV16: null },
    {},
  ];
  for (const siteType of ["STORE", "store", "BUSINESS", "business", "MEDICAL", undefined]) {
    for (const content of docs) {
      const project = { siteType };
      const expected = isCorporateV16(project, content) ? "corporate" : isStoreV16(project, content) ? "store" : "legacy";
      assert.equal(sectionWalkMode(project, content), expected, `${siteType} ${JSON.stringify(content)}`);
    }
  }
});

test("renderer limits: 100 sections per page, 50 pages", () => {
  const many = Array.from({ length: 130 }, (_, i) => section(`s${i}`, "trust"));
  assert.equal(normalizeSiteSections(STORE, { storeBuilderV16: { sections: many } }).pages[0].sections.length, MAX_SECTIONS_PER_PAGE);
  const pages = Array.from({ length: 60 }, (_, i) => ({ slug: `p${i}`, sections: [section(`a${i}`, "about")] }));
  const model = normalizeSiteSections(BUSINESS, { storeBuilderV16: { pages } });
  assert.equal(model.pages.length, MAX_PAGES);
  assert.equal(pageBySlug(model, "p55"), undefined);
  assert.equal(render(BUSINESS, { storeBuilderV16: { pages } }, "p55"), null, "the renderer also serves no page past the limit");
});

// --- resolution ------------------------------------------------------------------

test("legacy aliases resolve to canonical type and capability; legacyType is preserved", () => {
  const legacy = ["products", "banner", "trust", "text", "spacer", "category-grid", "brand", "about", "services", "portfolio", "team", "text-image", "cta", "contact"];
  const model = normalizeSiteSections(STORE, { storeBuilderV16: { sections: legacy.map((type, i) => section(`s${i}`, type)) } });
  const byLegacy = Object.fromEntries(model.pages[0].sections.map((s) => [s.legacyType, s]));
  assert.deepEqual(Object.keys(byLegacy), legacy);
  for (const s of Object.values(byLegacy)) assert.ok(s.known && s.type && s.capability, s.legacyType);
  assert.equal(byLegacy.products.type, "commerce.productShelf");
  assert.equal(byLegacy.products.capability, "commerce");
  assert.equal(byLegacy.team.type, "people.profileGrid");
  assert.equal(byLegacy.team.capability, "people");
  assert.equal(byLegacy["text-image"].type, "core.textImage");
});

test("unknown, missing and non-string types are returned flagged, never dropped", () => {
  const content = { storeBuilderV16: { sections: [section("h", "hologram"), null, "text", { id: "n", type: 7 }, section("a", "about"), section("d", "future", { enabled: false })] } };
  const model = normalizeSiteSections(STORE, content);
  const sections = model.pages[0].sections;
  assert.equal(sections.length, 6, "every entry is kept, in order");
  assert.deepEqual(sections.map((s) => [s.legacyType, s.known, s.type, s.capability]), [
    ["hologram", false, null, null], [null, false, null, null], [null, false, null, null],
    [7, false, null, null], ["about", true, "core.about", "core"], ["future", false, null, null],
  ]);
  assert.deepEqual(model.unknownSectionTypes, ["hologram"], "only enabled string types are reported");
  assert.equal(sections[5].enabled, false, "disabled sections are reported with enabled: false");
  assert.equal(sections[1].id, null);
});

test("enabled follows the renderer: only boolean false disables", () => {
  const model = normalizeSiteSections(STORE, { storeBuilderV16: { sections: [section("a", "trust", { enabled: false }), section("b", "trust", { enabled: "false" }), section("c", "trust", { enabled: undefined })] } });
  assert.deepEqual(model.pages[0].sections.map((s) => s.enabled), [false, true, true]);
});

// --- read-only guarantees ------------------------------------------------------------

test("no mutation of the stored document", () => {
  const content = { storeBuilderV16: { seo: { title: "x" }, sections: [section("old", "about")], pages: [{ id: "h", sections: [section("a", "about")] }, { slug: "Team", sections: [section("m", "team")] }] } };
  const before = structuredClone(content);
  normalizeSiteSections(BUSINESS, content);
  normalizeSiteSections(STORE, content);
  assert.deepEqual(content, before);
});

test("source keeps the stored object by reference; the model itself is frozen", () => {
  const stored = section("p", "products");
  const nullEntry = null;
  const content = { storeBuilderV16: { sections: [stored, nullEntry] } };
  const model = normalizeSiteSections(STORE, content);
  assert.equal(model.pages[0].sections[0].source, stored);
  assert.equal(model.pages[0].sections[1].source, nullEntry);
  assert.ok(Object.isFrozen(model) && Object.isFrozen(model.pages[0]) && Object.isFrozen(model.pages[0].sections[0]));
  assert.ok(!Object.isFrozen(stored), "stored content is not frozen");
});

// --- agreement with renderers and baselines --------------------------------------------

test("baseline section ordering agreement with committed snapshots", () => {
  const store = { storeBuilderV16: { sections: [
    section("products-main", "products"), section("banner-main", "banner"), section("trust-main", "trust"), section("cat-main", "category-grid"),
    section("brand-main", "brand"), section("text-main", "text"), section("spacer-main", "spacer"), section("hidden-main", "text", { enabled: false }),
  ] } };
  const corporateSingle = { storeBuilderV16: { sections: ["about", "services", "team", "portfolio", "text-image", "cta", "contact", "spacer"].map((type) => section(`${type}-main`, type)) } };
  const corporateMulti = { storeBuilderV16: { pages: [
    { id: "page-home", slug: "", sections: [section("h", "about")] },
    { id: "page-services", slug: "services", sections: [section("s", "services")] },
    { id: "page-contact", slug: "contact", sections: [section("c", "contact")] },
  ] } };
  const cases = [
    ["v16-store-home", STORE, store, ""],
    ["v16-corporate-single-page", BUSINESS, corporateSingle, ""],
    ["v16-corporate-multi-page-home", BUSINESS, corporateMulti, ""],
    ["v16-corporate-multi-page-services", BUSINESS, corporateMulti, "services"],
  ];
  for (const [name, project, content, slug] of cases) {
    const committed = renderedTypes(fs.readFileSync(path.join(SNAPSHOTS, `${name}.html`), "utf8"));
    assert.ok(committed.length > 0, `${name} baseline has sections`);
    assert.deepEqual(modelTypes(pageBySlug(normalizeSiteSections(project, content), slug)), committed, name);
  }
  for (const name of ["legacy-store", "legacy-generic-business", "legacy-generic-medical"]) {
    assert.deepEqual(renderedTypes(fs.readFileSync(path.join(SNAPSHOTS, `${name}.html`), "utf8")), [], `${name} renders no V16 sections`);
  }
});

test("edge-case ordering agreement with the live renderers", () => {
  const cases = [
    [STORE, { storeBuilderV16: { sections: [section("h", "hologram"), null, section("x", "trust", { enabled: false }), section("p", "products"), section("s", "spacer")], pages: [{ sections: [section("a", "about")] }] } }, [""]],
    [STORE, { storeBuilderV16: { sections: Array.from({ length: 120 }, (_, i) => section(`s${i}`, i % 2 ? "trust" : "banner")) } }, [""]],
    [BUSINESS, { storeBuilderV16: { sections: [section("old", "portfolio")], pages: [
      { sections: [section("a", "about"), section("u", "mystery")] },
      { slug: "Team", sections: [section("m", "team"), section("d", "cta", { enabled: false }), section("c", "contact")] },
      { slug: "empty", sections: [] },
    ] } }, ["", "team", "empty"]],
    [BUSINESS, { storeBuilderV16: { sections: [section("a", "about"), section("u", "mystery"), section("t", "text")] } }, [""]],
  ];
  for (const [project, content, slugs] of cases) {
    const model = normalizeSiteSections(project, content);
    for (const slug of slugs) {
      const html = render(project, content, slug);
      assert.equal(typeof html, "string", `renders ${slug}`);
      assert.deepEqual(modelTypes(pageBySlug(model, slug)), renderedTypes(html), `${project.siteType} /${slug}`);
    }
  }
});

test("mirrored CORPORATE_TYPES stay in sync with the corporate renderer", () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const setOf = (file) => read(file).match(/CORPORATE_TYPES = new Set\(\[([^\]]*)\]\)/)[1];
  assert.equal(setOf("server/app/site-platform/section-runtime.mjs"), setOf("server/app/services/corporate-site-html.mjs"));
});
