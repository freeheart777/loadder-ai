import AxeBuilder from "@axe-core/playwright";
import { expect, request, test, type APIRequestContext } from "@playwright/test";

// Batch B: the server-rendered published Store page (what a custom domain or /sites/:id serves) is static HTML.
// It must hand the visitor to the interactive storefront (real cart and checkout) instead of showing a button
// that cannot work, stay RTL and usable on a phone, and degrade to a clear empty state with no products.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the published-store journey.");

const productsSection = { id: "products-main", type: "products", enabled: true, title: "محصولات منتخب", subtitle: "جدیدترین کالاها", productSettings: { source: "all", showCartButton: true, showPrice: true }, visibleProductCount: 8 };
const document = { version: 16, header: { storeName: "فروشگاه آزمون" }, hero: { enabled: true, title: "فروشگاه آزمون", subtitle: "خرید مطمئن", ctaLabel: "مشاهده محصولات", ctaHref: "#products-main" }, sections: [productsSection] };

let api: APIRequestContext;
let populatedId = "";
let emptyId = "";
let product: { id: string; slug: string; name: string };

test.beforeAll(async ({}, testInfo) => {
  api = await request.newContext({ baseURL: apiBaseURL });
  const identity = `${testInfo.workerIndex}-${Date.now()}`;
  const otp = await (await api.post("/api/auth/send-otp", { data: { mobile: `090${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`, name: "Published Store E2E" } })).json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile: `090${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`, code: otp.developmentOtp } })).ok()).toBeTruthy();
  const make = async (name: string) => (await (await api.post("/api/site-projects", { data: { name, siteType: "STORE", content: { storeBuilderV16: document } } })).json()).project.id as string;
  populatedId = await make("فروشگاه آزمون پر");
  emptyId = await make("فروشگاه آزمون خالی");
  const created = await api.post(`/api/stores/${populatedId}/products`, { data: { name: "زعفران ممتاز", description: "نمونه", currency: "IRT", basePriceMinor: 45_000_000, inventoryQuantity: 5, status: "ACTIVE", featured: true, sku: `PUB-${identity}` } });
  expect(created.ok(), await created.text()).toBeTruthy();
  product = (await created.json()).product;
  for (const id of [populatedId, emptyId]) expect((await api.post(`/api/site-projects/${id}/publish`, { data: {} })).status()).toBe(200);
});
test.afterAll(async () => api?.dispose());

const publishedUrl = (id: string) => `${apiBaseURL}/api/auth/sites/${id}`;

test("published store page is RTL, links products to the interactive storefront and shows no dead cart button", async ({ page }) => {
  await page.goto(publishedUrl(populatedId));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  const card = page.locator("a.product-link", { hasText: "زعفران ممتاز" });
  await expect(card).toHaveAttribute("href", new RegExp(`/store/${populatedId}/product/${encodeURIComponent(product.slug)}$`));
  await expect(page.getByText("افزودن به سبد خرید")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "سبد خرید" })).toHaveAttribute("href", new RegExp(`/store/${populatedId}/cart$`));
  expect(await page.locator("body").innerText()).not.toMatch(/برند یک|برند دو|برند سه/);

  // Keyboard: the product card is reachable and activatable without a mouse.
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/store/${populatedId}/product/`));
  await expect(page.getByText("زعفران ممتاز").first()).toBeVisible();
});

test("published store page has no serious accessibility violations and no horizontal overflow on desktop and mobile", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(publishedUrl(populatedId));
    await expect(page.locator("a.product-link", { hasText: "زعفران ممتاز" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `overflow at ${viewport.width}`).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    test.info().annotations.push({ type: `axe-${viewport.width}`, description: JSON.stringify(results.violations.map((v) => `${v.impact}:${v.id}×${v.nodes.length}`)) });
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), `axe at ${viewport.width}`).toEqual([]);
  }
});

test("published store with no products shows a clear empty state and no product links", async ({ page }) => {
  await page.goto(publishedUrl(emptyId));
  await expect(page.getByText("هنوز محصولی در این بخش نیست.")).toBeVisible();
  await expect(page.locator("a.product-link")).toHaveCount(0);
  await expect(page.getByText("افزودن به سبد خرید")).toHaveCount(0);
});
