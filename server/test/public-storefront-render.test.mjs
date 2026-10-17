import test from "node:test";
import assert from "node:assert/strict";
import { renderPublishedSite } from "../app/routes/public-sites.mjs";

test("STORE renderer includes hero, banner and multiple products", () => {
  const project = { id: "p1", name: "ایران افزار", siteType: "STORE" };
  const version = { version: 3, content: { description: "فروشگاه ابزار و تجهیزات" } };
  const assets = [
    { id: "hero1", kind: "hero", name: "hero.jpg", url: "https://example.com/hero.jpg" },
    { id: "banner1", kind: "banner", name: "banner.jpg", url: "https://example.com/banner.jpg" },
    { id: "p1", kind: "product", name: "drill.jpg", url: "https://example.com/drill.jpg" },
    { id: "p2", kind: "product", name: "saw.jpg", url: "https://example.com/saw.jpg" },
  ];
  const html = renderPublishedSite(project, version, assets);
  assert.match(html, /background:#f7f8fb/);
  assert.match(html, /hero\.jpg/);
  assert.match(html, /banner\.jpg/);
  assert.match(html, /drill\.jpg/);
  assert.match(html, /saw\.jpg/);
  assert.match(html, /2 محصول/);
});

// Batch B: the static published page cannot add to a cart, so it must not pretend to.
{
  const project = { id: "s1", name: "فروشگاه", siteType: "STORE" };
  const content = { storeBuilderV16: { version: 16, sections: [{ id: "p", type: "products", enabled: true, title: "محصولات", productSettings: { source: "all", showCartButton: true } }] } };
  const products = [
    { id: "a1", slug: "tea", name: "چای", basePriceMinor: 100000, currency: "IRT", variants: [{ id: "v1", active: true, inventoryPolicy: "ALLOW" }] },
    { id: "a2", slug: "gone", name: "تمام‌شده", basePriceMinor: 100000, currency: "IRT", variants: [{ id: "v2", active: true, inventoryPolicy: "DENY", inventoryQuantity: 0 }] },
  ];
  const render = (page) => renderPublishedSite(project, { version: 1, content }, [], page, products);

  test("STORE V16 cards link to the interactive product page and the cart when a storefront origin is known", () => {
    const html = render({ storefrontUrl: "https://app.example.com/store/s1/" });
    assert.match(html, /<a class="product-link" href="https:\/\/app\.example\.com\/store\/s1\/product\/tea">/);
    assert.match(html, /href="https:\/\/app\.example\.com\/store\/s1\/cart"/);
  });

  test("STORE V16 without a storefront origin shows no fake add-to-cart button, only the sold-out state", () => {
    const html = render({});
    assert.doesNotMatch(html, /افزودن به سبد خرید|مشاهده و خرید|<a class="product-link"/);
    assert.match(html, /ناموجود/);
  });

  test("STORE V16 refuses a non-http storefront origin", () => {
    assert.doesNotMatch(render({ storefrontUrl: "javascript:alert(1)" }), /javascript:/);
  });
}
