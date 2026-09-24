import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { renderPublishedSite } from "../app/routes/public-sites.mjs";

// Regression safety net for ADR-004: the capability/section registry must not
// change a single byte of published HTML. Baselines are the output of the
// current renderPublishedSite flow. Regenerate only on an intended change:
//   UPDATE_SNAPSHOTS=1 npm test -- test/site-render-baseline.test.mjs
const SNAPSHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "__snapshots__", "site-render-baseline");
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

const storeContent = () => ({
  storeBuilderV16: {
    version: 16,
    header: { storeName: "فروشگاه پایه" },
    hero: { enabled: true, title: "حراج فصل", subtitle: "بهترین قیمت‌ها", ctaLabel: "خرید", ctaHref: "#products-main" },
    nav: { enabled: true },
    footer: { enabled: true, text: "© فروشگاه پایه" },
    seo: { title: "فروشگاه پایه", description: "توضیح فروشگاه" },
    commerce: { productOverrides: { "prod-1": { promotionBadge: true, promotionBadgeText: "ویژه" } } },
    sections: [
      // saleEndsAt is in the past so the rendered sale state never depends on the clock.
      { id: "products-main", type: "products", enabled: true, title: "محصولات", subtitle: "انتخاب ما", visibleProductCount: 8, productSettings: { source: "all" }, saleLabel: "تخفیف", saleEndsAt: "2020-01-01T00:00:00.000Z", ...style },
      { id: "banner-main", type: "banner", enabled: true, title: "بنر", subtitle: "زیر بنر", imageUrl: "https://example.com/banner.jpg", ctaLabel: "ببین", ctaHref: "#products-main", ...style },
      { id: "trust-main", type: "trust", enabled: true, title: "ضمانت", subtitle: "ارسال سریع", ...style },
      { id: "cat-main", type: "category-grid", enabled: true, title: "دسته‌ها", subtitle: "", items: [{ id: "c1", title: "آشپزخانه", imageUrl: "https://example.com/c1.jpg", href: "#products-main" }], ...style },
      { id: "brand-main", type: "brand", enabled: true, title: "برندها", subtitle: "همکاران", items: [{ id: "b1", title: "برند", imageUrl: "https://example.com/b1.jpg" }], ...style },
      { id: "text-main", type: "text", enabled: true, title: "درباره ما", subtitle: "متن کوتاه", ...style },
      { id: "spacer-main", type: "spacer", enabled: true, title: "", subtitle: "", ...style, spacingTop: 10, spacingBottom: 20 },
      { id: "hidden-main", type: "text", enabled: false, title: "پنهان", subtitle: "", ...style },
    ],
  },
});

const storeProducts = () => [
  { id: "prod-1", name: "قابلمه", basePriceMinor: 1200000, compareAtPriceMinor: 1500000, featured: true, createdAt: "2024-01-02T00:00:00.000Z", variants: [{ id: "v1", active: true, inventoryPolicy: "DENY", inventoryQuantity: 3, imageUrl: "https://example.com/p1.jpg" }] },
  { id: "prod-2", name: "ماهیتابه", basePriceMinor: 800000, compareAtPriceMinor: null, featured: false, createdAt: "2024-01-01T00:00:00.000Z", variants: [{ id: "v2", active: true, inventoryPolicy: "DENY", inventoryQuantity: 0 }] },
];

const corporateSection = (id, type, title, extra = {}) => ({ id, type, enabled: true, title, subtitle: "", ...style, ...extra });

const corporateSinglePage = () => ({
  storeBuilderV16: {
    version: 16,
    seo: { title: "شرکت نمونه", description: "خدمات حرفه‌ای" },
    nav: { enabled: true, ctaLabel: "تماس با ما", ctaHref: "#contact-main" },
    footer: { enabled: true, text: "© همه حقوق محفوظ است.", backgroundColor: "#0f172a", textColor: "#e2e8f0" },
    hero: { enabled: true, title: "عنوان اصلی", subtitle: "زیرعنوان" },
    sections: [
      corporateSection("about-main", "about", "درباره ما", { showInNav: true, navLabel: "درباره ما", body: "متن معرفی", imageUrl: "https://example.com/about.jpg" }),
      corporateSection("services-main", "services", "خدمات", { showInNav: true, navLabel: "خدمات", columns: 3, items: [{ id: "s1", title: "مشاوره", subtitle: "کوتاه", body: "شرح" }] }),
      corporateSection("team-main", "team", "تیم", { showInNav: true, navLabel: "تیم", items: [{ id: "m1", title: "عضو", subtitle: "سمت", imageUrl: "https://example.com/m1.jpg" }] }),
      corporateSection("portfolio-main", "portfolio", "نمونه‌کارها", { items: [{ id: "p1", title: "پروژه", subtitle: "صنعت" }] }),
      corporateSection("text-image-main", "text-image", "متن و تصویر", { body: "توضیح", imageUrl: "https://example.com/ti.jpg", mediaPosition: "end" }),
      corporateSection("cta-main", "cta", "شروع کنیم", { ctaLabel: "تماس", ctaHref: "#contact-main" }),
      corporateSection("contact-main", "contact", "تماس با ما", { showInNav: true, navLabel: "تماس", contact: { formEnabled: true, submitLabel: "ارسال", successMessage: "ثبت شد.", phone: "021", email: "info@example.com", address: "تهران" } }),
      corporateSection("spacer-main", "spacer", "", { spacingTop: 8, spacingBottom: 8 }),
    ],
  },
});

const corporatePage = (id, title, slug, type) => ({
  id, title, slug, showInNav: true, navLabel: title,
  seo: { title: `${title} | شرکت`, description: `توضیح ${title}` },
  sections: [corporateSection(`${id}-s`, type, title)],
});

const corporateMultiPage = () => ({
  storeBuilderV16: {
    version: 16,
    header: { storeName: "شرکت چندصفحه‌ای" },
    hero: { enabled: true, title: "خانه", subtitle: "زیرعنوان" },
    nav: { enabled: true, ctaLabel: "تماس", ctaHref: "/contact" },
    footer: { enabled: true, text: "©" },
    seo: { title: "سایت شرکتی", description: "توضیح سایت" },
    pages: [
      corporatePage("page-home", "خانه", "", "about"),
      corporatePage("page-services", "خدمات", "services", "services"),
      corporatePage("page-contact", "تماس", "contact", "contact"),
    ],
  },
});

const legacyAssets = () => [
  { id: "logo1", kind: "logo", name: "logo.png", url: "https://example.com/logo.png", altText: "لوگو" },
  { id: "hero1", kind: "hero", name: "hero.jpg", url: "https://example.com/hero.jpg" },
  { id: "banner1", kind: "banner", name: "banner.jpg", url: "https://example.com/banner.jpg", altText: "بنر" },
  { id: "prod1", kind: "product", name: "drill.jpg", url: "https://example.com/drill.jpg" },
];

const cases = [
  {
    name: "v16-store-home",
    render: () => renderPublishedSite({ id: "store-1", name: "فروشگاه پایه", siteType: "STORE" }, { id: "ver-1", version: 3, content: storeContent() }, [], { slug: "", basePath: "/sites/store-1" }, storeProducts()),
  },
  {
    name: "v16-corporate-single-page",
    render: () => renderPublishedSite({ id: "corp-1", name: "شرکت نمونه", siteType: "BUSINESS" }, { id: "ver-2", version: 2, content: corporateSinglePage() }, [], { slug: "", basePath: "/sites/corp-1" }),
  },
  {
    name: "v16-corporate-multi-page-home",
    render: () => renderPublishedSite({ id: "corp-2", name: "شرکت چندصفحه‌ای", siteType: "BUSINESS" }, { id: "ver-3", version: 1, content: corporateMultiPage() }, [], { slug: "", basePath: "/sites/corp-2" }),
  },
  {
    name: "v16-corporate-multi-page-services",
    render: () => renderPublishedSite({ id: "corp-2", name: "شرکت چندصفحه‌ای", siteType: "BUSINESS" }, { id: "ver-3", version: 1, content: corporateMultiPage() }, [], { slug: "services", basePath: "/sites/corp-2" }),
  },
  {
    name: "legacy-store",
    render: () => renderPublishedSite({ id: "legacy-store", name: "ایران افزار", siteType: "STORE" }, { id: "ver-4", version: 5, content: { headline: "ابزار حرفه‌ای", positioning: "خرید مطمئن", description: "فروشگاه ابزار" } }, legacyAssets()),
  },
  {
    name: "legacy-generic-business",
    render: () => renderPublishedSite({ id: "legacy-biz", name: "دفتر نمونه", siteType: "BUSINESS" }, { id: "ver-5", version: 1, content: { headline: "خدمات ما", description: "توضیح دفتر", sections: ["Hero", "خدمات", "درباره ما", "تماس"] } }, legacyAssets()),
  },
  {
    // Server archetypes include MEDICAL; with no V16 renderer it falls through to genericSite.
    name: "legacy-generic-medical",
    render: () => renderPublishedSite({ id: "legacy-med", name: "مطب نمونه", siteType: "MEDICAL" }, { id: "ver-6", version: 1, content: { headline: "نوبت‌دهی", description: "مطب" } }, []),
  },
];

for (const { name, render } of cases) {
  test(`baseline: ${name}`, () => matchSnapshot(name, render()));
}

// Dispatch edges that must survive the registry refactor unchanged.
test("baseline: V16 store has a single page; a non-root slug renders nothing", () => {
  assert.equal(renderPublishedSite({ id: "store-1", name: "فروشگاه", siteType: "STORE" }, { id: "v", version: 1, content: storeContent() }, [], { slug: "about", basePath: "" }, storeProducts()), null);
});

test("baseline: V16 corporate unknown slug renders nothing", () => {
  assert.equal(renderPublishedSite({ id: "corp-2", name: "شرکت", siteType: "BUSINESS" }, { id: "v", version: 1, content: corporateMultiPage() }, [], { slug: "missing", basePath: "" }), null);
});

test("baseline: BUSINESS with a V16 document but no corporate section types falls back to genericSite", () => {
  const content = { storeBuilderV16: { version: 16, sections: [corporateSection("t", "text", "متن")] } };
  const html = renderPublishedSite({ id: "b", name: "شرکت", siteType: "BUSINESS" }, { id: "v", version: 1, content }, []);
  assert.doesNotMatch(html, /data-section-type/);
  assert.match(html, /Loadder Site Builder\./);
});

test("baseline: STORE with an empty V16 section list falls back to the legacy storefront", () => {
  const html = renderPublishedSite({ id: "s", name: "فروشگاه", siteType: "STORE" }, { id: "v", version: 1, content: { storeBuilderV16: { version: 16, sections: [] } } }, []);
  assert.match(html, /background:#f7f8fb/);
});
