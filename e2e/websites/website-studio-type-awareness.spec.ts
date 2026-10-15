import { expect, request, test, type Browser, type Page } from "@playwright/test";

// The Studio must only offer what the site type can actually do: a clinic or company site edits its OWN pages
// and never sees storefront pages or discount actions; a store keeps its storefront pages and quick-adds.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

const STORE_ONLY_PAGES = ["خانه فروشگاه", "سبد خرید", "تسویه حساب", "صفحه محصول", "سفارش موفق", "دسته‌بندی / کالکشن"];

async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `095${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Type Awareness E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Type Awareness E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}

async function createFrom(page: Page, route: string, label: RegExp) {
  await page.goto(`${route}?new=1`);
  await page.getByRole("button", { name: label }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project;
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project as { id: string; siteType: string };
}

async function expectBusinessStudio(page: Page, siteType: string, project: { id: string; siteType: string }) {
  expect(project.siteType).toBe(siteType);
  const select = page.locator("[data-page-select]");
  await expect(select).toHaveAttribute("data-page-select", "site");
  const options = await select.locator("option").allTextContents();
  expect(options.length, "the site's own pages").toBeGreaterThanOrEqual(1);
  for (const storeOnly of STORE_ONLY_PAGES) expect(options, `no storefront page "${storeOnly}"`).not.toContain(storeOnly);
  await expect(page.getByRole("button", { name: "تخفیف‌ها" }), "no discount quick-add").toHaveCount(0);
  await expect(page.locator('[data-quick-add="discounts"]')).toHaveCount(0);
  await expect(page.getByText("صفحه فروشگاه", { exact: true })).toHaveCount(0);

  // A new page appears in the selector, switching shows it, and save + preview + publish still work.
  const toggle = page.getByRole("button", { name: /پنل ویرایش/ });
  if ((await toggle.getAttribute("aria-label")) === "باز کردن پنل ویرایش") await toggle.click();
  const inspector = page.locator("[data-studio-inspector]");
  await inspector.getByRole("button", { name: "صفحه‌ها", exact: true }).click();
  await inspector.getByRole("button", { name: "افزودن صفحه" }).click();
  await inspector.getByLabel("عنوان صفحه", { exact: true }).last().fill("صفحهٔ آزمون");
  await inspector.getByLabel("آدرس صفحه", { exact: true }).last().fill("probe");
  await expect(select.locator("option", { hasText: "صفحهٔ آزمون" })).toHaveCount(1);
  const home = (await select.locator("option").first().getAttribute("value"))!;
  await select.selectOption({ label: "صفحهٔ آزمون" });
  await expect(select).toHaveValue(await select.locator("option", { hasText: "صفحهٔ آزمون" }).getAttribute("value") as string);
  await select.selectOption(home);

  const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${project.id}` && r.request().method() === "PATCH" && r.status() === 200);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await saved;
  await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await expect(page.locator('[data-canvas-interactive="false"]').first()).toBeVisible();
  await page.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();
  const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  await published;
  await page.reload();
  await expect(page.locator("[data-page-select]")).toHaveAttribute("data-page-select", "site");
  await expect(page.locator("[data-page-select] option", { hasText: "صفحهٔ آزمون" })).toHaveCount(1);
}

for (const [label, route, name, siteType] of [
  ["Medical", "/dashboard/websites/corporate", /کلینیک و پزشک/, "MEDICAL"],
  ["Corporate", "/dashboard/websites/corporate", /شرکت حرفه‌ای/, "CORPORATE"],
  ["Legal", "/dashboard/websites/corporate", /موسسه حقوقی/, "LEGAL"],
] as const) {
  test(`${label} Studio offers its own pages and no store actions`, async ({ browser }) => {
    test.setTimeout(150_000);
    const { api, context } = await signIn(browser);
    const page = await context.newPage();
    try { await expectBusinessStudio(page, siteType, await createFrom(page, route, name)); }
    finally { await context.close(); await api.dispose(); }
  });
}

test("Store Studio keeps its storefront pages and quick-add actions", async ({ browser }) => {
  test.setTimeout(120_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/store", /Loadder Commerce Modern V1/);
    expect(project.siteType).toBe("STORE");
    const select = page.locator("[data-page-select]");
    await expect(select).toHaveAttribute("data-page-select", "store");
    const options = await select.locator("option").allTextContents();
    for (const storePage of ["خانه فروشگاه", "سبد خرید", "تسویه حساب"]) expect(options).toContain(storePage);
    await expect(page.getByRole("button", { name: "تخفیف‌ها" })).toBeVisible();
    await select.selectOption({ label: "سبد خرید" });
    await expect(select).toHaveValue("cart");
    await select.selectOption({ label: "خانه فروشگاه" });
    const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${project.id}` && r.request().method() === "PATCH" && r.status() === 200);
    await page.getByRole("button", { name: "ذخیره", exact: true }).click();
    await saved;
  } finally { await context.close(); await api.dispose(); }
});
