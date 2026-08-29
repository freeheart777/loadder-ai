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
