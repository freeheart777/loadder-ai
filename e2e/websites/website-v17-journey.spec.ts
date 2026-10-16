import { expect, request, test, type Browser, type Page } from "@playwright/test";

// V17 customer acceptance: "see your website, click anything, and edit it right there".
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
const shots = process.env.V17_SHOTS || "test-results/v17";
test.use({ actionTimeout: 15_000 });

const ZWNJ = "‌";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGP4z8DwHwyBNBgAAIsvCfk0kQ1pAAAAAElFTkSuQmCC", "base64");
async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "V17 Journey" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "V17 Journey" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 900 } }) };
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
const field = (page: Page, scope: string, name: string) => canvas(page).locator(`[data-editable-scope="${scope}"][data-editable-field="${name}"]`);
const inspector = (page: Page) => page.locator("[data-studio-inspector]");
const openInspector = async (page: Page) => { const t = page.getByRole("button", { name: /پنل ویرایش/ }); if ((await t.getAttribute("aria-label")) === "باز کردن پنل ویرایش") await t.click(); };
const save = async (page: Page, id: string) => {
  const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${id}` && r.request().method() === "PATCH" && r.status() === 200);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await saved;
};
const publish = async (page: Page, id: string) => {
  const done = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${id}/publish`) && r.status() === 200);
  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  await done;
};
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png` });
const typeInto = async (page: Page, locator: ReturnType<typeof field>, text: string) => {
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().dblclick();
  await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
  await page.keyboard.press("Enter");
  await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(0);
};

test("Medical: create, click, edit in Persian, replace the image, add a section, navigate, undo/redo, save, reload, preview, publish, verify the public site", async ({ browser }) => {
  test.setTimeout(300_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    // 1-2. Create a Medical website and open the Studio.
    const project = await createFrom(page, "/dashboard/websites/corporate", /کلینیک و پزشک/);
    const initial = JSON.parse(JSON.stringify((await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content.storeBuilderV16));
    const templateSectionTitles: string[] = initial.pages[0].sections.map((s: { title: string }) => s.title);
    await shot(page, "01-medical-studio-opened");

    // 3-4. Click the hero title, then edit it directly in Persian.
    const heroTitle = field(page, "hero", "title").first();
    await heroTitle.click();
    await expect(canvas(page).locator('[data-editor-element="hero"][data-editor-selected="true"]')).toHaveCount(1);
    const newTitle = `کلینیک${ZWNJ} آرامش؛ مراقبت از شما`;
    await typeInto(page, field(page, "hero", "title"), newTitle);
    await expect(field(page, "hero", "title").first()).toHaveText(newTitle);
    await shot(page, "02-hero-title-edited-inline");

    // 5. Replace the hero image directly.
    const before = initial.hero.imageUrl as string;
    await canvas(page).locator('[data-editor-element="hero"] [data-inline-media-control] input[type=file]').first().setInputFiles({ name: "clinic-photo.png", mimeType: "image/png", buffer: PNG });
    await expect.poll(async () => (await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content.storeBuilderV16.hero.imageUrl).not.toBe(before);
    await shot(page, "03-hero-image-replaced");

    // 6-7. Add a services section and edit its title directly.
    await openInspector(page);
    await inspector(page).getByRole("button", { name: "بخش‌ها", exact: true }).click();
    const sectionsBefore = await canvas(page).locator('[data-editor-element="section"], [data-editor-element="banner"], [data-editor-element="trust"]').count();
    await inspector(page).locator("label", { hasText: "افزودن بخش" }).locator("select").selectOption("services");
    await expect(canvas(page).locator('[data-editor-element="section"], [data-editor-element="banner"], [data-editor-element="trust"]')).toHaveCount(sectionsBefore + 1);
    const selected = canvas(page).locator('[data-editor-selected="true"]').first();
    const servicesTitle = `خدمات${ZWNJ} ویژهٔ ما`;
    await typeInto(page, selected.locator('[data-editable-scope="section"][data-editable-field="title"]'), servicesTitle);
    await expect(canvas(page).getByText(servicesTitle).first()).toBeVisible();
    await shot(page, "04-services-section-added-and-edited");

    // 8-9. Another page, then back to Home: nothing is lost.
    await inspector(page).getByRole("button", { name: "صفحه‌ها", exact: true }).click();
    await inspector(page).getByRole("button", { name: "افزودن صفحه" }).click();
    await inspector(page).getByLabel("عنوان صفحه", { exact: true }).last().fill("درباره کلینیک");
    await inspector(page).getByLabel("آدرس صفحه", { exact: true }).last().fill("about");
    await page.keyboard.press("Tab");   // leaving the field commits the address
    const select = page.locator("[data-page-select]");
    await expect(canvas(page).locator("[data-empty-page]")).toBeVisible();
    await shot(page, "05-second-page-empty-state");
    await select.selectOption({ index: 0 });
    await expect(field(page, "hero", "title").first()).toHaveText(newTitle);
    await expect(canvas(page).getByText(servicesTitle).first()).toBeVisible();

    // 10. Undo and redo a text edit (a second edit, so the two are clearly separate steps).
    await typeInto(page, field(page, "hero", "subtitle"), "ویرایش برای آزمون واگرد");
    await page.getByRole("heading", { level: 1 }).first().click();
    await page.getByRole("button", { name: "واگرد", exact: true }).click();
    await expect(field(page, "hero", "subtitle").first()).not.toHaveText("ویرایش برای آزمون واگرد");
    await page.getByRole("button", { name: "ازنو", exact: true }).click();
    await expect(field(page, "hero", "subtitle").first()).toHaveText("ویرایش برای آزمون واگرد");

    // 11-12. Save and reload.
    await save(page, project.id);
    await page.reload();
    await expect(field(page, "hero", "title").first()).toHaveText(newTitle);
    await expect(canvas(page).getByText(servicesTitle).first()).toBeVisible();
    await shot(page, "06-after-save-and-reload");

    // 13. Preview.
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
    await expect(page.locator('[data-canvas-interactive="false"]').getByText(newTitle).first()).toBeVisible();
    await expect(page.locator('[data-canvas-interactive="false"] [data-editable-field]')).toHaveCount(0);
    await shot(page, "07-preview");
    await page.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();

    // 14-15. Publish and verify the public site.
    await publish(page, project.id);
    const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const visitor = await anon.newPage();
    await visitor.goto(`/site/${project.id}`);
    await expect(visitor.getByText(newTitle).first()).toBeVisible();
    await expect(visitor.getByText(servicesTitle).first()).toBeVisible();
    await expect(visitor.getByText("ویرایش برای آزمون واگرد").first()).toBeVisible();
    await expect(visitor.locator('[style*="site-media-object"], img[src*="site-media-object"]').first()).toBeVisible();
    await expect(visitor.locator("[data-editable-field], [contenteditable]")).toHaveCount(0);
    await shot(visitor, "08-public-site");
    await visitor.goto(`/site/${project.id}/about`);
    await expect(visitor.locator("body")).toContainText("کلینیک");
    await anon.close();

    // 16. The template and the other pages are intact.
    const final = (await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content.storeBuilderV16;
    const finalTitles: string[] = final.pages[0].sections.map((s: { title: string }) => s.title);
    for (const title of templateSectionTitles) expect(finalTitles, `template section "${title}" is still there`).toContain(title);
    expect(final.pages.map((p: { title: string }) => p.title)).toEqual(["خانه", "درباره کلینیک"]);
    expect(final.pages[1].slug).toBe("about");
    expect(final.pages[1].sections).toEqual([]);
    expect(final.header).toEqual(initial.header);
    expect(final.footer).toEqual(initial.footer);
    expect(final.design).toEqual(initial.design);
  } finally { await context.close(); await api.dispose(); }
});

for (const [label, route, name] of [[/شرکت حرفه‌ای/, "/dashboard/websites/corporate", "corporate"], [/موسسه حقوقی/, "/dashboard/websites/corporate", "legal"], [/Loadder Commerce Modern V1/, "/dashboard/websites/store", "store"]] as const) {
  test(`${name}: click, edit in place, replace the image, save, reload, publish, public site`, async ({ browser }) => {
    test.setTimeout(240_000);
    const { api, context } = await signIn(browser);
    const page = await context.newPage();
    try {
      const project = await createFrom(page, route, label);
      const text = `عنوان${ZWNJ} تازه ${name}`;
      await field(page, "hero", "title").first().click();
      await typeInto(page, field(page, "hero", "title"), text);
      const heading = canvas(page).locator('[data-editable-scope="section"][data-editable-field="title"]');
      await expect(heading.first()).toBeVisible();
      await typeInto(page, heading, `بخش${ZWNJ} ${name}`);
      const prior = (await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content.storeBuilderV16.hero.imageUrl as string;
      await canvas(page).locator('[data-editor-element="hero"] [data-inline-media-control] input[type=file]').first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
      await expect.poll(async () => (await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content.storeBuilderV16.hero.imageUrl).not.toBe(prior);
      await shot(page, `10-${name}-edited`);
      await save(page, project.id);
      await page.reload();
      await expect(field(page, "hero", "title").first()).toHaveText(text);
      await publish(page, project.id);
      const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const visitor = await anon.newPage();
      await visitor.goto(name === "store" ? `/store/${project.id}` : `/site/${project.id}`);
      await expect(visitor.getByText(text).first()).toBeVisible();
      await expect(visitor.getByText(`بخش${ZWNJ} ${name}`).first()).toBeVisible();
      await expect(visitor.locator('[style*="site-media-object"], img[src*="site-media-object"]').first()).toBeVisible();
      await shot(visitor, `11-${name}-public`);
      await anon.close();
    } finally { await context.close(); await api.dispose(); }
  });
}
