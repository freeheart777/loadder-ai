import test from "node:test";
import assert from "node:assert/strict";
import { renderPublishedSite } from "../app/routes/public-sites.mjs";

test("public renderer produces a safe published site with hero and products", () => {
  const html = renderPublishedSite({ name: "فروشگاه نمونه <script>", siteType: "STORE", content: { headline: "محصولات برتر", positioning: "خرید مطمئن و سریع", description: "توضیحات فروشگاه", sections: ["Hero", "محصولات", "درباره ما"], offerings: ["محصول A", { name: "محصول B" }] } }, [
    { kind: "hero", url: "https://cdn.example/hero.webp", name: "hero", altText: "Hero" },
    { kind: "product", url: "https://cdn.example/p.webp", name: "محصول A", altText: "A" },
  ]);
  assert.match(html, /محصولات برتر/);
  assert.match(html, /خرید مطمئن و سریع/);
  assert.match(html, /https:\/\/cdn\.example\/p\.webp/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Loadder Site Builder/);
  assert.doesNotMatch(html, /<script>/);
});
