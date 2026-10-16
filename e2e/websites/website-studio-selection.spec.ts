import { expect, request, test, type Browser, type Page } from "@playwright/test";

// V17 phase 5: one selection drives the canvas, the floating toolbar and the Inspector.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Selection E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Selection E2E" } }); }
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
const sections = (page: Page) => canvas(page).locator('[data-editor-element="section"], [data-editor-element="banner"], [data-editor-element="trust"]');
const inspector = (page: Page) => page.locator("[data-studio-inspector]");
const openInspector = async (page: Page) => { const t = page.getByRole("button", { name: /پنل ویرایش/ }); if ((await t.getAttribute("aria-label")) === "باز کردن پنل ویرایش") await t.click(); };
const toolbar = (page: Page) => canvas(page).locator('[data-editor-selected="true"] [data-element-toolbar]').first();

test("Medical: the selected section's toolbar offers valid actions; hide, show, duplicate, move and delete keep canvas and Inspector in agreement", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    await createFrom(page, "/dashboard/websites/corporate", /کلینیک و پزشک/);
    await openInspector(page);
    const total = await sections(page).count();
    expect(total).toBeGreaterThan(2);

    // Selecting text selects its section: toolbar, Inspector header and the section list agree.
    const first = sections(page).first();
    await first.locator('[data-editable-field="title"]').first().click();
    await expect(toolbar(page)).toBeVisible();
    for (const title of ["بالاتر", "پایین‌تر", "کپی", "پنهان کردن", "حذف"]) await expect(toolbar(page).locator(`button[title="${title}"]`)).toHaveCount(1);
    await expect(toolbar(page).locator('button[title="بالاتر"]'), "the first section cannot move up").toBeDisabled();
    await expect(toolbar(page).locator('button[title="پایین‌تر"]')).toBeEnabled();
    const name = (await first.locator('[data-editable-field="title"]').first().innerText()).trim();
    await expect(inspector(page)).toContainText(name.slice(0, 12));

    // The last section cannot move down.
    const last = sections(page).last();
    await last.scrollIntoViewIfNeeded();
    await last.locator('[data-editable-field="title"]').first().click();
    await expect(toolbar(page).locator('button[title="پایین‌تر"]')).toBeDisabled();
    await expect(toolbar(page).locator('button[title="بالاتر"]')).toBeEnabled();

    // Move, duplicate.
    const second = sections(page).nth(1);
    const secondName = (await second.locator('[data-editable-field="title"]').first().innerText()).trim();
    await second.locator('[data-editable-field="title"]').first().click();
    await toolbar(page).locator('button[title="بالاتر"]').click();
    await expect(sections(page).first().locator('[data-editable-field="title"]').first()).toHaveText(secondName);
    await toolbar(page).locator('button[title="کپی"]').click();
    await expect(sections(page)).toHaveCount(total + 1);

    // Hide: the section leaves the canvas, nothing stale stays selected, and the Sections list can show it again.
    await toolbar(page).locator('button[title="پنهان کردن"]').click();
    await expect(sections(page)).toHaveCount(total);
    await expect(canvas(page).locator('[data-editor-selected="true"] [data-element-toolbar]')).toHaveCount(0);
    await inspector(page).getByRole("button", { name: "بخش‌ها", exact: true }).click();
    const hidden = inspector(page).locator('input[type="checkbox"]:not(:checked)');
    await expect(hidden).toHaveCount(1);
    await hidden.check();
    await expect(sections(page)).toHaveCount(total + 1);

    // Delete removes exactly that section.
    await sections(page).nth(1).locator('[data-editable-field="title"]').first().click();
    await toolbar(page).locator('button[title="حذف"]').click();
    await expect(sections(page)).toHaveCount(total);
    expect(await canvas(page).locator('[data-editor-selected="true"] [data-element-toolbar]').count()).toBeLessThanOrEqual(1);
  } finally { await context.close(); await api.dispose(); }
});

test("an empty page shows a useful empty state, never another page's Hero; adding a section selects it", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    await createFrom(page, "/dashboard/websites/corporate", /شرکت حرفه‌ای/);
    await openInspector(page);
    await inspector(page).getByRole("button", { name: "صفحه‌ها", exact: true }).click();
    await inspector(page).getByRole("button", { name: "افزودن صفحه" }).click();
    await inspector(page).getByRole("button", { name: "ویرایش", exact: true }).click();

    await expect(canvas(page).locator("[data-empty-page]")).toBeVisible();
    await expect(inspector(page).locator("[data-inspector-empty-page]")).toBeVisible();
    await expect(inspector(page)).not.toContainText("ویترین اصلی");
    await expect(canvas(page).locator('[data-editor-element="hero"]')).toHaveCount(0);

    // Inspector shortcut opens the Sections tab.
    await inspector(page).locator("[data-inspector-empty-page] button").click();
    await expect(inspector(page).locator("label", { hasText: "افزودن بخش" })).toBeVisible();

    // Canvas button adds a section, which becomes the selection.
    await canvas(page).locator("[data-empty-page] button").click();
    await expect(sections(page)).toHaveCount(1);
    await expect(canvas(page).locator("[data-empty-page]")).toHaveCount(0);
    await expect(toolbar(page)).toBeVisible();
  } finally { await context.close(); await api.dispose(); }
});

test("Store: section toolbar actions are the same set, and the Hero toolbar offers none of the section-only actions", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    await createFrom(page, "/dashboard/websites/store", /Loadder Commerce Modern V1/);
    const section = sections(page).first();
    await section.scrollIntoViewIfNeeded();
    await section.locator('[data-editable-field="title"]').first().click();
    for (const title of ["بالاتر", "پایین‌تر", "کپی", "پنهان کردن", "حذف"]) await expect(toolbar(page).locator(`button[title="${title}"]`)).toHaveCount(1);
    await canvas(page).locator('[data-editor-element="hero"] [data-editable-field="subtitle"]').click();
    for (const title of ["بالاتر", "پایین‌تر", "کپی", "پنهان کردن", "حذف"]) await expect(toolbar(page).locator(`button[title="${title}"]`), `hero has no "${title}"`).toHaveCount(0);
    await expect(inspector(page)).toContainText("بنر اصلی");
  } finally { await context.close(); await api.dispose(); }
});
