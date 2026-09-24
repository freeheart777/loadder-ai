import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { renderPublishedSite } from "../app/routes/public-sites.mjs";

// Edge-case baselines for the PR4B dispatch refactor (docs/decisions/PR4B-render-boundary.md).
// Captured from the renderers BEFORE the refactor; they cover what the original
// baselines do not: unknown types, prototype-named types, non-object entries,
// renderer limits, leftover top-level sections, mixed-case slugs, empty pages.
// Regenerate only on an intended change: UPDATE_SNAPSHOTS=1.
const SNAPSHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "__snapshots__", "site-render-baseline-edge");
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

function matchSnapshot(name, html) {
  assert.equal(typeof html, "string", `${name} rendered no HTML`);
  const file = path.join(SNAPSHOT_DIR, `${name}.html`);
  if (UPDATE) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(file, html);
    return;
  }
  assert.ok(fs.existsSync(file), `missing baseline ${name}.html — run with UPDATE_SNAPSHOTS=1`);
  assert.equal(html, fs.readFileSync(file, "utf8"), `${name} HTML differs from baseline`);
}

const style = { backgroundColor: "#ffffff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32 };
const s = (id, type, extra = {}) => ({ id, type, enabled: true, title: `عنوان ${id}`, subtitle: `زیرعنوان ${id}`, body: `متن ${id}`, ...style, ...extra });
const STORE = { id: "edge-store", name: "فروشگاه لبه", siteType: "STORE" };
const BUSINESS = { id: "edge-corp", name: "شرکت لبه", siteType: "BUSINESS" };
const version = (content) => ({ id: "edge-ver", version: 7, content });
const render = (project, content, slug = "") => renderPublishedSite(project, version(content), [], { slug, basePath: `/sites/${project.id}` }, []);

// Types that exist on Object.prototype must stay "unknown" after any table-based dispatch.
const PROTOTYPE_TYPES = ["toString", "constructor", "__proto__", "hasOwnProperty"];

const storeUnknown = () => ({ storeBuilderV16: {
  header: { storeName: "فروشگاه لبه" },
  sections: [
    s("u1", "hologram"), null, "text", { id: "n", type: 7, title: "عدد" },
    ...PROTOTYPE_TYPES.map((type, i) => s(`p${i}`, type)),
    s("d", "trust", { enabled: false }), s("e", "trust", { enabled: "false" }),
    s("pr", "products", { productSettings: { source: "featured" }, visibleProductCount: 0 }),
    s("cg", "category-grid", { items: [] }), s("br", "brand", { subtitle: "" }),
    s("bn", "banner", { imageUrl: "javascript:alert(1)" }), s("sp", "spacer", { spacingTop: 5, spacingBottom: 7 }),
    s("tx", "text", { subtitle: "" }),
  ],
  pages: [{ sections: [s("ignored", "about")] }],
} });

const storeLimit = () => ({ storeBuilderV16: { sections: Array.from({ length: 105 }, (_, i) => s(`l${i}`, i % 2 ? "trust" : "banner")) } });

const corporateUnknown = () => ({ storeBuilderV16: {
  header: { storeName: "شرکت لبه" },
  hero: { enabled: true, title: "قهرمان", subtitle: "" },
  sections: [
    s("about", "about", { mediaPosition: "start", imageUrl: "https://example.com/a.jpg" }),
    s("mystery", "mystery"), null, s("text", "text"),
    ...PROTOTYPE_TYPES.map((type, i) => s(`p${i}`, type)),
    s("svc", "services", { columns: 9, items: [{ id: "i1", title: "آیتم", imageUrl: "https://example.com/i.jpg" }] }),
    s("pf", "portfolio", { columns: 0, items: [] }),
    s("cta", "cta", { ctaLabel: "", ctaHref: "" }),
    s("contact", "contact", { contact: {} }),
    s("sp", "spacer"),
  ],
} });

const corporateMultiPage = () => ({ storeBuilderV16: {
  header: { storeName: "شرکت چندصفحه" },
  sections: [s("leftover", "portfolio")],
  pages: [
    { id: "home", title: "خانه", slug: "ignored-home-slug", sections: [s("a", "about"), s("m", "mystery")] },
    { id: "team", title: "تیم", slug: "Team", showInNav: false, sections: [s("t", "team", { items: [{ id: "x", title: "عضو" }] }), s("c", "cta", { enabled: false }), s("k", "contact", { contact: { phone: "021" } })] },
    { id: "empty", title: "خالی", slug: "empty", sections: [] },
  ],
} });

const cases = [
  ["store-unknown-null-prototype", () => render(STORE, storeUnknown())],
  ["store-section-limit", () => render(STORE, storeLimit())],
  ["corporate-unknown-null-prototype", () => render(BUSINESS, corporateUnknown())],
  ["corporate-multipage-home", () => render(BUSINESS, corporateMultiPage(), "")],
  ["corporate-multipage-team", () => render(BUSINESS, corporateMultiPage(), "team")],
  ["corporate-multipage-empty", () => render(BUSINESS, corporateMultiPage(), "empty")],
];

for (const [name, run] of cases) {
  test(`edge baseline: ${name}`, () => matchSnapshot(name, run()));
}

test("edge baseline: the store section limit keeps exactly 100 sections", () => {
  const html = render(STORE, storeLimit());
  assert.equal([...html.matchAll(/data-section-type="/g)].length, 100);
});

test("edge baseline: prototype-named types render through the unknown fallback", () => {
  for (const html of [render(STORE, storeUnknown()), render(BUSINESS, corporateUnknown())]) {
    for (const type of PROTOTYPE_TYPES) assert.match(html, new RegExp(`data-section-type="${type}"`), type);
  }
});
