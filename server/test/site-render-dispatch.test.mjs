import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CORPORATE_SECTION_TYPES, isCorporateV16, renderCorporateSite } from "../app/services/corporate-site-html.mjs";
import { STORE_SECTION_TYPES } from "../app/services/store-site-html.mjs";
import { siteRegistry } from "../app/site-platform/capabilities.mjs";
import { normalizeSiteSections } from "../app/site-platform/section-runtime.mjs";

// PR4B agreement (docs/decisions/PR4B-render-boundary.md): section-runtime →
// registry type resolution → renderer dispatch table. The two sides meet only
// through the stored legacy type string; renderers import nothing from site-platform.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const LEGACY_TYPES = ["products", "banner", "trust", "text", "spacer", "category-grid", "brand", "about", "services", "portfolio", "team", "text-image", "cta", "contact"];

test("corporate dispatch table keys are registry aliases", () => {
  assert.deepEqual([...CORPORATE_SECTION_TYPES].sort(), ["about", "contact", "cta", "portfolio", "services", "spacer", "team", "text-image"]);
  for (const type of CORPORATE_SECTION_TYPES) assert.ok(siteRegistry.resolveSectionType(type), `${type} is a registry alias`);
  assert.ok(Object.isFrozen(CORPORATE_SECTION_TYPES));
});

test("corporate: every runtime section resolves to a table renderer or the known fallback set", () => {
  const sections = LEGACY_TYPES.map((type, i) => ({ id: `s${i}`, type, enabled: true, title: type }));
  const model = normalizeSiteSections({ siteType: "BUSINESS" }, { storeBuilderV16: { sections } });
  assert.equal(model.mode, "corporate");
  const viaFallback = model.pages[0].sections.filter((s) => !CORPORATE_SECTION_TYPES.includes(s.legacyType)).map((s) => s.legacyType);
  // Known types the corporate renderer draws with its generic fallback today.
  assert.deepEqual(viaFallback, ["products", "banner", "trust", "text", "category-grid", "brand"]);
  for (const section of model.pages[0].sections) assert.ok(section.known, section.legacyType);
});

test("store dispatch table keys are registry aliases", () => {
  assert.deepEqual([...STORE_SECTION_TYPES].sort(), ["banner", "brand", "category-grid", "products", "spacer", "trust"]);
  for (const type of STORE_SECTION_TYPES) assert.ok(siteRegistry.resolveSectionType(type), `${type} is a registry alias`);
  assert.ok(Object.isFrozen(STORE_SECTION_TYPES));
});

test("store: every runtime section resolves to a table renderer or the known fallback set", () => {
  const sections = LEGACY_TYPES.map((type, i) => ({ id: `s${i}`, type, enabled: true, title: type }));
  const model = normalizeSiteSections({ siteType: "STORE" }, { storeBuilderV16: { sections } });
  assert.equal(model.mode, "store");
  const viaFallback = model.pages[0].sections.filter((s) => !STORE_SECTION_TYPES.includes(s.legacyType)).map((s) => s.legacyType);
  assert.deepEqual(viaFallback, ["text", "about", "services", "portfolio", "team", "text-image", "cta", "contact"]);
});

test("every registry alias has a dedicated renderer in at least one renderer, except text", () => {
  const dedicated = new Set([...STORE_SECTION_TYPES, ...CORPORATE_SECTION_TYPES]);
  assert.deepEqual(LEGACY_TYPES.filter((type) => !dedicated.has(type)), ["text"], "text renders through both unknown fallbacks today");
});

test("renderers stay independent of site-platform", () => {
  for (const file of ["server/app/services/corporate-site-html.mjs", "server/app/services/store-site-html.mjs"]) {
    assert.doesNotMatch(source(file), /site-platform\//, file);
  }
  assert.doesNotMatch(source("server/app/site-platform/capabilities.mjs"), /from\s+"[^"]*site-html/, "capabilities.mjs imports no renderer");
  for (const capability of siteRegistry.capabilities()) {
    for (const section of capability.sections) {
      for (const [key, value] of Object.entries(section)) assert.notEqual(typeof value, "function", `${section.type}.${key} is metadata, not a render function`);
    }
  }
});

test("Education uses the shared V16 public renderer and its CTA enters canonical site booking", () => {
  const project = { id: "education-1", siteType: "EDUCATION", name: "آموزشگاه" };
  const content = { storeBuilderV16: { header: { storeName: "آموزشگاه" }, hero: { title: "موسیقی", ctaLabel: "رزرو کلاس" }, sections: [{ id: "courses", type: "services", enabled: true, title: "دوره‌ها", items: [] }] } };
  assert.equal(isCorporateV16(project, content), true);
  const html = renderCorporateSite(project, { version: 1, content }, content, { basePath: "/sites/education-1" });
  assert.match(html, /data-education-public="true"/);
  assert.match(html, /href="\/sites\/education-1\/booking"/);
});

test("Education public static routes resolve from the persisted V16 pages collection", () => {
  const project = { id: "education-routes", siteType: "EDUCATION", name: "آموزشگاه" };
  const pages = [
    { id: "home", title: "خانه", slug: "", sections: [] },
    { id: "courses", title: "دوره‌ها", slug: "courses", sections: [{ id: "courses-directory", type: "services", enabled: true, title: "دوره‌های آموزشی", items: [] }] },
    { id: "teachers", title: "مدرسان", slug: "teachers", sections: [{ id: "teachers-directory", type: "team", enabled: true, title: "مدرسان", items: [] }] },
    { id: "children", title: "موسیقی کودک", slug: "children", sections: [{ id: "children-music", type: "text", enabled: true, title: "موسیقی کودک" }] },
    { id: "workshops", title: "کارگاه‌ها", slug: "workshops", sections: [{ id: "workshops-directory", type: "services", enabled: true, title: "کارگاه‌ها", items: [] }] },
    { id: "performances", title: "اجراها", slug: "performances", sections: [{ id: "performances-directory", type: "text", enabled: true, title: "اجراها" }] },
    { id: "magazine", title: "مجله", slug: "magazine", sections: [{ id: "magazine-directory", type: "text", enabled: true, title: "مجله" }] },
  ];
  const content = { storeBuilderV16: { header: { storeName: "آموزشگاه" }, pages, sections: pages[0].sections } };
  for (const [index, page] of pages.entries()) {
    const html = renderCorporateSite(project, { version: 1, content }, content, { slug: page.slug, basePath: "/sites/education-routes" });
    // Public projection intentionally does not expose mutable editor IDs.
    assert.match(html, new RegExp(`data-page-id="page-${index + 1}"`));
    assert.match(html, new RegExp(`>${page.title}<`));
  }
  assert.equal(renderCorporateSite(project, { version: 1, content }, content, { slug: "not-a-page" }), null);
});
