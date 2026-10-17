import AxeBuilder from "@axe-core/playwright";
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

// Batch B part 3: a customer who picks a variant gets exactly that variant, at that variant's price, in the cart and the order.
// Fixtures are isolated API-created data; checkout is the existing manual checkout (no payment gateway is involved).
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the variant journey.");

const doc = { version: 16, header: { storeName: "فروشگاه گزینه‌ها" }, hero: { enabled: false }, sections: [{ id: "products-main", type: "products", enabled: true, title: "محصولات", subtitle: "", visibleProductCount: 8, productSettings: { source: "all", showCartButton: true, showPrice: true } }] };

let api: APIRequestContext;
let storeId = "";
let single: { id: string; slug: string; name: string; variants: { id: string }[] };
let multi: { id: string; slug: string; name: string };
const variants: Record<string, { id: string }> = {};

test.beforeAll(async ({}, testInfo) => {
  api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `090${`${testInfo.workerIndex}${Date.now()}`.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
  const otp = await (await api.post("/api/auth/send-otp", { data: { mobile, name: "Variants E2E" } })).json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  storeId = (await (await api.post("/api/site-projects", { data: { name: "فروشگاه گزینه‌ها", siteType: "STORE", content: { storeBuilderV16: doc } } })).json()).project.id;
  const stamp = Date.now();
  const make = async (data: object) => { const r = await api.post(`/api/stores/${storeId}/products`, { data: { currency: "IRT", status: "ACTIVE", featured: true, ...data } }); expect(r.ok(), await r.text()).toBeTruthy(); return (await r.json()).product; };
  single = await make({ name: "چای تک‌مدل", description: "یک مدل", basePriceMinor: 30_000_000, inventoryQuantity: 4, sku: `S-${stamp}` });
  const shirt = await make({ name: "تی‌شرت چندمدلی", description: "سه مدل", basePriceMinor: 10_000_000, inventoryQuantity: 5, variantTitle: "S", sku: `T-S-${stamp}` });
  multi = shirt;
  variants.S = shirt.variants[0];
  const add = async (title: string, data: object) => { const r = await api.post(`/api/commerce/products/${shirt.id}/variants`, { data: { title, sku: `T-${title}-${stamp}`, ...data } }); expect(r.ok(), await r.text()).toBeTruthy(); variants[title] = (await r.json()).variant; };
  await add("M", { priceMinor: 12_000_000, inventoryQuantity: 5 });
  await add("L", { inventoryQuantity: 0, inventoryPolicy: "DENY" });
  expect((await api.post(`/api/site-projects/${storeId}/publish`, { data: {} })).status()).toBe(200);
});
test.afterAll(async () => api?.dispose());

const productUrl = (p: { slug: string }) => `/store/${storeId}/product/${encodeURIComponent(p.slug)}`;
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("single-variant product: no variant picker, no internal 'Default' label anywhere, and it still adds to the cart", async ({ page }) => {
  await page.goto(productUrl(single));
  await expect(page.getByRole("heading", { name: single.name })).toBeVisible();
  await expect(page.getByText("انتخاب مدل / تنوع")).toHaveCount(0);
  await page.getByRole("button", { name: "افزودن به سبد خرید", exact: true }).first().click();
  await expect(page.getByText("به سبد خرید اضافه شد.")).toBeVisible();
  await page.goto(`/store/${storeId}/cart`);
  await expect(page.locator("article").filter({ hasText: single.name })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("Default");
});

test("multi-variant product: the listing asks for a choice, the picker works by keyboard, and the chosen variant (not the first) reaches the cart and the order at its own price", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/store/${storeId}`);
  const card = page.locator("article, div").filter({ hasText: multi.name }).filter({ has: page.getByRole("button", { name: "انتخاب گزینه‌ها" }) }).last();
  await expect(card.getByRole("button", { name: "انتخاب گزینه‌ها" })).toBeVisible();
  await expect(card).toContainText("از");
  await expect(page.getByRole("button", { name: "افزودن به سبد خرید", exact: true })).toHaveCount(1); // only the single-variant product adds straight from the list
  await card.getByRole("button", { name: "انتخاب گزینه‌ها" }).click();
  await expect(page).toHaveURL(new RegExp(`/product/`));

  const group = page.getByRole("group", { name: "انتخاب مدل / تنوع" });
  const s = group.getByRole("button", { name: "S", exact: true });
  const m = group.getByRole("button", { name: "M", exact: true });
  const l = group.getByRole("button", { name: /^L/ });
  await expect(s).toHaveAttribute("aria-pressed", "true");
  await expect(l).toBeDisabled();
  await expect(l).toContainText("ناموجود");
  await expect(page.getByText("۱۰۰٬۰۰۰ تومان").first()).toBeVisible();

  await m.focus();
  await page.keyboard.press("Enter");
  await expect(m).toHaveAttribute("aria-pressed", "true");
  await expect(s).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("۱۲۰٬۰۰۰ تومان").first()).toBeVisible();

  const itemRequest = page.waitForRequest((r) => r.method() === "POST" && /\/carts\/[^/]+\/items$/.test(new URL(r.url()).pathname));
  await page.getByRole("button", { name: "افزودن به سبد خرید", exact: true }).first().click();
  expect((await itemRequest).postDataJSON()).toMatchObject({ variantId: variants.M.id, quantity: 1 });
  await expect(page.getByText("به سبد خرید اضافه شد.")).toBeVisible();

  // The server refuses the unavailable variant even when the UI is bypassed.
  const cartRef = JSON.parse((await page.evaluate((id) => localStorage.getItem(`loadder-public-cart:${id}`), storeId)) || "null") as { id: string; capability: string };
  const refused = await page.request.post(`/api/auth/storefront/carts/${cartRef.id}/items`, { headers: { "X-Loadder-Cart-Capability": cartRef.capability }, data: { variantId: variants.L.id, quantity: 1 } });
  expect(refused.status()).toBe(409);

  await page.goto(`/store/${storeId}/cart`);
  const line = page.locator("article").filter({ hasText: multi.name });
  await expect(line).toContainText("M");
  await expect(line).toContainText("۱۲۰٬۰۰۰ تومان");

  await page.getByRole("link", { name: /^ادامه/ }).first().click();
  await expect(page).toHaveURL(`/store/${storeId}/checkout`);
  await expect(page.getByLabel("کد تخفیف (اختیاری)")).toBeVisible();
  await page.getByLabel("نام و نام خانوادگی").fill("نگار رضایی");
  await page.getByLabel("شماره موبایل").fill("۰۹۱۲۱۲۳۴۵۶۷");
  await page.getByLabel("استان").fill("تهران");
  await page.getByLabel("شهر").fill("تهران");
  await page.getByLabel("کد پستی").fill("۱۴۱۶۷۵۳۹۱۱");
  await page.getByLabel("آدرس کامل").fill("خیابان ولیعصر، پلاک ۱۲، واحد ۳");
  const placed = page.waitForResponse((r) => r.request().method() === "POST" && /\/carts\/[^/]+\/checkout$/.test(new URL(r.url()).pathname) && r.status() === 201);
  await page.getByRole("button", { name: "ثبت سفارش", exact: true }).click();
  const order = (await (await placed).json()).order;
  expect(order.items).toHaveLength(1);
  expect(order.items[0]).toMatchObject({ variantId: variants.M.id, variantTitle: "M", quantity: 1, unitPriceMinor: 12_000_000, lineTotalMinor: 12_000_000 });
  expect(order.totalMinor).toBe(12_000_000);
  await expect(page.getByText(`${multi.name} (M) × ۱`, { exact: true })).toBeVisible();
});

test("mobile 390px: the variant picker is usable, RTL, without overflow or serious accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(productUrl(multi));
  const group = page.getByRole("group", { name: "انتخاب مدل / تنوع" });
  await expect(group).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const name of ["S", "M"]) expect((await group.getByRole("button", { name, exact: true }).boundingBox())!.height, `${name} touch target`).toBeGreaterThanOrEqual(40);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  test.info().annotations.push({ type: "axe mobile variants", description: results.violations.map((v) => `${v.impact}:${v.id}×${v.nodes.length}`).join("; ") || "none" });
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});
