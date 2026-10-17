import AxeBuilder from "@axe-core/playwright";
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

// Batch B part 2: the interactive /store/:id application (storefront, product, cart, checkout) in a real browser.
// Fixtures are created through the public/admin APIs of a throw-away database; nothing here touches payment code.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the interactive store journey.");

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const doc = {
  version: 16,
  header: { storeName: "فروشگاه آزمون" },
  hero: { enabled: true, title: "فروشگاه آزمون", subtitle: "خرید مطمئن", ctaLabel: "مشاهده محصولات", ctaHref: "#products-main" },
  sections: [
    { id: "products-main", type: "products", enabled: true, title: "محصولات منتخب", subtitle: "جدیدترین کالاها", visibleProductCount: 8, productSettings: { source: "all", showCartButton: true, showPrice: true } },
    { id: "more-products", type: "products", enabled: true, title: "همه محصولات", subtitle: "", visibleProductCount: 8, productSettings: { source: "all", showCartButton: true, showPrice: true } },
  ],
};

let api: APIRequestContext;
let storeId = "";
let emptyStoreId = "";
let inStock: { id: string; slug: string; name: string };

test.beforeAll(async ({}, testInfo) => {
  api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `090${`${testInfo.workerIndex}${Date.now()}`.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
  const otp = await (await api.post("/api/auth/send-otp", { data: { mobile, name: "Interactive Store E2E" } })).json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  const make = async (name: string) => (await (await api.post("/api/site-projects", { data: { name, siteType: "STORE", content: { storeBuilderV16: doc } } })).json()).project.id as string;
  storeId = await make("فروشگاه تعاملی");
  emptyStoreId = await make("فروشگاه تعاملی خالی");
  const add = async (data: object) => { const r = await api.post(`/api/stores/${storeId}/products`, { data: { currency: "IRT", status: "ACTIVE", featured: true, ...data } }); expect(r.ok(), await r.text()).toBeTruthy(); return (await r.json()).product; };
  inStock = await add({ name: "زعفران ممتاز", description: "نمونه", basePriceMinor: 45_000_000, inventoryQuantity: 5, sku: `I-${Date.now()}` });
  await add({ name: "چای تمام‌شده", description: "نمونه", basePriceMinor: 30_000_000, inventoryQuantity: 0, inventoryPolicy: "DENY", sku: `O-${Date.now()}` });
  for (const id of [storeId, emptyStoreId]) expect((await api.post(`/api/site-projects/${id}/publish`, { data: {} })).status()).toBe(200);
});
test.afterAll(async () => api?.dispose());

async function ready(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(300);
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  test.info().annotations.push({ type: `axe ${label}`, description: results.violations.map((v) => `${v.impact}:${v.id}×${v.nodes.length}`).join("; ") || "none" });
  // Serious and critical findings fail; automated checks cannot prove WCAG conformance, so lesser findings are only listed.
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const duplicateIds = (page: Page) => page.evaluate(() => { const c: Record<string, number> = {}; document.querySelectorAll("[id]").forEach((e) => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.entries(c).filter(([, n]) => n > 1).map(([id]) => id); });

test("hero button scrolls to the products on the storefront (its #products-main target exists)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 }); // short enough that the products start below the fold
  await page.goto(`/store/${storeId}`);
  const hero = page.getByRole("button", { name: "مشاهده محصولات" });
  await expect(hero).toBeVisible();
  const products = page.getByRole("heading", { name: "محصولات منتخب" });
  await expect(products).not.toBeInViewport();
  await hero.click();
  await expect(products).toBeInViewport();
  // The same "#products-main" target also answers in-page links (category and brand tiles) on the storefront.
  await expect(page.locator("#products-main")).toHaveCount(1);
  expect(await duplicateIds(page)).toEqual([]);
});

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`${name}: storefront, product, cart, checkout and empty states are accessible, RTL and do not overflow`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const screens: [string, string][] = [];
    const check = async (label: string) => {
      await ready(page);
      expect(await overflow(page), `${label} overflow`).toBeLessThanOrEqual(0);
      expect(await duplicateIds(page), `${label} duplicate ids`).toEqual([]);
      expect(await audit(page, `${name} ${label}`), `${label} serious/critical axe`).toEqual([]);
      screens.push([label, page.url()]);
    };

    await page.goto(`/store/${storeId}`);
    await expect(page.getByText("زعفران ممتاز").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await check("storefront");
    // The sold-out product is shown as such and cannot be added.
    await expect(page.getByText("ناموجود").first()).toBeVisible();

    // Keyboard: the first add-to-cart control is reachable and shows a visible focus indicator.
    const add = page.getByRole("button", { name: "افزودن به سبد خرید", exact: true }).first();
    await add.focus();
    await expect(add).toBeFocused();
    expect(await add.evaluate((el) => { const s = getComputedStyle(el); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== "none"; }), "visible focus").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByText("به سبد خرید اضافه شد.")).toBeVisible();

    await page.goto(`/store/${storeId}/product/${encodeURIComponent(inStock.slug)}`);
    await expect(page.getByText("زعفران ممتاز").first()).toBeVisible();
    await check("product");

    await page.goto(`/store/${storeId}/cart`);
    // Quantity controls have names that say what they do and for which product.
    const plus = page.getByRole("button", { name: /افزایش تعداد زعفران ممتاز/ });
    await expect(plus).toBeVisible();
    await plus.click();
    await expect(page.locator("article").filter({ hasText: "زعفران ممتاز" })).toContainText("۲");
    await expect(page.getByRole("button", { name: /کاهش تعداد زعفران ممتاز/ })).toBeVisible();
    await check("cart");

    await page.goto(`/store/${storeId}/checkout`);
    await expect(page.getByRole("button", { name: "ثبت سفارش", exact: true })).toBeVisible();
    for (const label of ["نام و نام خانوادگی", "شماره موبایل", "آدرس کامل"]) await expect(page.getByLabel(label)).toBeVisible();
    await check("checkout");

    await page.goto(`/store/${emptyStoreId}`);
    await expect(page.getByText(/محصول فعالی یافت نشد/).first()).toBeVisible();
    await check("empty store");
    await page.goto(`/store/${emptyStoreId}/cart`);
    await expect(page.getByRole("link", { name: "بازگشت به فروشگاه" }).first()).toBeVisible();
    await check("empty cart");
  });
}

// Visual baselines (macOS-generated, reviewed by eye; Playwright suffixes them per platform, so another OS needs its own).
// Regenerate with --update-snapshots ONLY after reviewing the new pages.
for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`${name}: visual baseline of storefront, product and checkout`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    const shots: [string, string][] = [["storefront", `/store/${storeId}`], ["product", `/store/${storeId}/product/${encodeURIComponent(inStock.slug)}`], ["checkout", `/store/${storeId}/checkout`]];
    for (const [label, path] of shots) {
      await page.goto(path);
      if (label === "checkout") {
        // A real cart first, so the baseline is the checkout form and not the empty-cart state.
        await page.goto(`/store/${storeId}/product/${encodeURIComponent(inStock.slug)}`);
        await page.getByRole("button", { name: "افزودن به سبد خرید", exact: true }).first().click();
        await expect(page.getByText("به سبد خرید اضافه شد.")).toBeVisible();
        await page.goto(path);
        await expect(page.getByRole("button", { name: "ثبت سفارش", exact: true })).toBeVisible();
      }
      await expect(page.locator("main, header").first()).toBeVisible();
      await ready(page);
      await expect(page).toHaveScreenshot(`store-${label}-${name}.png`, { fullPage: true, maxDiffPixelRatio: 0.005, animations: "disabled" });
    }
  });
}
