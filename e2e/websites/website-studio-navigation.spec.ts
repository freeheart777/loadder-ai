import { expect, request, test, type Browser, type Page } from "@playwright/test";

// V17 phase 6: the left workspace is organised as Pages / Sections / Design, with Persian terminology only.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Navigation E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Navigation E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}
async function createFrom(page: Page, route: string, label: RegExp) {
  await page.goto(`${route}?new=1`);
  await page.getByRole("button", { name: label }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project as { id: string };
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project;
}
const canvas = (page: Page) => page.locator('[data-canvas-interactive="true"]');
const inspector = (page: Page) => page.locator("[data-studio-inspector]");
const openInspector = async (page: Page) => { const t = page.getByRole("button", { name: /پنل ویرایش/ }); if ((await t.getAttribute("aria-label")) === "باز کردن پنل ویرایش") await t.click(); };
const tab = async (page: Page, name: string) => { await openInspector(page); await inspector(page).getByRole("button", { name, exact: true }).click(); };
const save = async (page: Page, id: string) => {
  const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${id}` && r.request().method() === "PATCH" && r.status() === 200);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await saved;
};
// Every small heading line in the panel (the "eyebrow") is Persian: no internal English keys such as TEAM or SECTION TREE.
const eyebrows = (page: Page) => inspector(page).locator('p[class*="tracking"]').allTextContents();
const noInternalKeys = async (page: Page, where: string) => {
  for (const text of await eyebrows(page)) expect(text, `${where}: "${text}" must be Persian`).toMatch(/[؀-ۿ]/);
};

test("Medical: Pages, Sections and Design cover everything the customer needs, in Persian, without losing work between pages", async ({ browser }) => {
  test.setTimeout(300_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", /کلینیک و پزشک/);
    await openInspector(page);
    for (const name of ["ویرایش", "بخش‌ها", "صفحه‌ها", "طراحی"]) await expect(inspector(page).getByRole("button", { name, exact: true })).toBeVisible();
    await noInternalKeys(page, "edit tab");

    // ----- Pages: add, rename, address, menu, SEO, reorder, Home protected.
    await tab(page, "صفحه‌ها");
    await noInternalKeys(page, "pages tab");
    const add = inspector(page).getByRole("button", { name: "افزودن صفحه" });
    await add.click();
    await inspector(page).getByLabel("عنوان صفحه", { exact: true }).last().fill("درباره ما");
    await inspector(page).getByLabel("آدرس صفحه", { exact: true }).last().fill("about");
    await inspector(page).getByLabel("عنوان SEO", { exact: true }).last().fill("دربارهٔ کلینیک");
    await inspector(page).getByLabel("توضیح SEO", { exact: true }).last().fill("معرفی تیم و خدمات کلینیک");
    await add.click();
    await inspector(page).getByLabel("عنوان صفحه", { exact: true }).last().fill("تماس");
    await inspector(page).getByLabel("آدرس صفحه", { exact: true }).last().fill("contact-us");
    await inspector(page).getByLabel("نمایش در منو", { exact: true }).last().uncheck();
    // Home has no delete or address field; others do.
    await inspector(page).locator("[data-page-row]").first().getByRole("button").first().click();
    await expect(inspector(page).getByRole("button", { name: "حذف صفحه" })).toHaveCount(0);
    await expect(inspector(page).getByText("صفحه خانه آدرس اصلی سایت است و حذف نمی‌شود.")).toBeVisible();
    // Reorder: move "تماس" above "درباره ما".
    await inspector(page).locator("[data-page-row]").last().getByRole("button").first().click();
    await inspector(page).getByRole("button", { name: "بالا", exact: true }).click();
    await expect(inspector(page).locator("[data-page-row]").nth(1)).toContainText("تماس");

    // ----- Work in progress survives page switching: an unsaved inline edit on Home, an edit on another page, back again.
    const select = page.locator("[data-page-select]");
    const homeId = (await select.locator("option").first().getAttribute("value"))!;
    await select.selectOption(homeId);
    const heroTitle = canvas(page).locator('[data-editable-scope="hero"][data-editable-field="title"]');
    await heroTitle.dblclick();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("عنوان در حال کار");
    await page.keyboard.press("Enter");
    await select.selectOption({ label: "درباره ما" });
    await expect(canvas(page).locator("[data-empty-page]")).toBeVisible();

    // ----- Sections: Persian names, add, hide badge, duplicate, delete.
    await tab(page, "بخش‌ها");
    await noInternalKeys(page, "sections tab");
    await inspector(page).locator("label", { hasText: "افزودن بخش" }).locator("select").selectOption("about");
    await tab(page, "بخش‌ها");   // adding a section selects it and opens its editor; the list is one tab away
    const row = inspector(page).locator("[data-section-row]").first();
    await expect(row).toContainText("درباره ما");
    await row.locator('input[type="checkbox"]').uncheck();
    await expect(row.locator("[data-section-hidden]")).toHaveText("پنهان");
    await row.locator('input[type="checkbox"]').check();
    await expect(row.locator("[data-section-hidden]")).toHaveCount(0);
    await row.getByRole("button", { name: "تکثیر" }).click();
    await expect(inspector(page).locator("[data-section-row]")).toHaveCount(2);
    await inspector(page).locator("[data-section-row]").last().getByRole("button", { name: "حذف" }).click();
    await expect(inspector(page).locator("[data-section-row]")).toHaveCount(1);

    await select.selectOption(homeId);
    await expect(heroTitle).toHaveText("عنوان در حال کار");
    await expect(page.getByText("تغییرات ذخیره نشده").first()).toBeVisible();

    // ----- Design: colour, font, spacing, header brand, footer.
    await tab(page, "طراحی");
    await noInternalKeys(page, "design tab");
    await inspector(page).getByLabel("اصلی", { exact: true }).first().fill("#7c3aed");
    await inspector(page).getByLabel("فونت", { exact: true }).selectOption({ index: 2 });
    await inspector(page).getByLabel("فاصله بخش‌ها", { exact: true }).fill("48");
    await expect(inspector(page).getByText("نمایش فوتر")).toBeVisible();
    await expect(inspector(page).getByText("متن فوتر")).toBeVisible();

    // ----- Save, reload, persisted; publish and the public site has the pages in its menu (not the hidden one).
    await save(page, project.id);
    const stored = (await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content.storeBuilderV16;
    expect(stored.pages.map((p: { title: string }) => p.title)).toEqual(["خانه", "تماس", "درباره ما"]);
    expect(stored.pages.find((p: { title: string }) => p.title === "درباره ما").seo).toMatchObject({ title: "دربارهٔ کلینیک", description: "معرفی تیم و خدمات کلینیک" });
    expect(stored.pages.find((p: { title: string }) => p.title === "تماس").showInNav).toBe(false);
    expect(stored.design.primaryColor.toLowerCase()).toBe("#7c3aed");
    expect(stored.pages[0].sections.length).toBeGreaterThan(0);
    await page.reload();
    await expect(canvas(page).locator('[data-editable-scope="hero"][data-editable-field="title"]')).toHaveText("عنوان در حال کار");
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/site/${project.id}`);
    await expect(visitor.getByRole("link", { name: "درباره ما", exact: true }).first()).toBeVisible();
    await expect(visitor.getByRole("link", { name: "تماس", exact: true }), "the page hidden from the menu is not linked").toHaveCount(0);
    await visitor.goto(`/site/${project.id}/about`);
    await expect(visitor.getByText("درباره ما").first()).toBeVisible();
    await visitor.context().close();
  } finally { await context.close(); await api.dispose(); }
});

test("Store: Sections and Design are present, Pages is not offered, and the panel is Persian", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    await createFrom(page, "/dashboard/websites/store", /Loadder Commerce Modern V1/);
    await openInspector(page);
    await expect(inspector(page).getByRole("button", { name: "صفحه‌ها", exact: true })).toHaveCount(0);
    for (const name of ["بخش‌ها", "طراحی"]) {
      await inspector(page).getByRole("button", { name, exact: true }).click();
      await noInternalKeys(page, `store ${name}`);
    }
    await inspector(page).getByRole("button", { name: "بخش‌ها", exact: true }).click();
    const labels = await inspector(page).locator("label", { hasText: "افزودن بخش" }).locator("select option").allTextContents();
    expect(labels.filter((t) => /^[a-z-]+$/i.test(t.trim()))).toEqual([]);
  } finally { await context.close(); await api.dispose(); }
});
