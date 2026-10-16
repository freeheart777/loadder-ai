import { expect, request, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// V17 phase 8: touch, keyboard, screen-reader labels, RTL / mixed text and small-screen safety.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

const ZWNJ = "‌";
async function signIn(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "A11y E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "A11y E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ ...options, storageState: await api.storageState() }) as BrowserContext };
}
async function createFrom(page: Page, label: RegExp) {
  await page.goto("/dashboard/websites/corporate?new=1");
  await page.getByRole("button", { name: label }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project as { id: string };
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project;
}
const canvas = (page: Page) => page.locator('[data-canvas-interactive="true"]');
const field = (page: Page, scope: string, name: string) => canvas(page).locator(`[data-editable-scope="${scope}"][data-editable-field="${name}"]`).first();
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const save = async (page: Page, id: string) => {
  const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${id}` && r.request().method() === "PATCH" && r.status() === 200);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await saved;
};
const stored = async (api: Awaited<ReturnType<typeof signIn>>["api"], id: string) => JSON.stringify((await (await api.get(`/api/site-projects/${id}`)).json()).project.content);

test("phone: tap selects, a second tap edits in place, tapping away commits, and the settings sheet opens and closes", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  try {
    const project = await createFrom(page, /کلینیک و پزشک/);
    const title = field(page, "hero", "title");
    // Select a different element first so the hero starts unselected.
    await canvas(page).locator('[data-editor-element="header"] [data-editable-field="storeName"]').tap();
    await title.scrollIntoViewIfNeeded();
    await title.tap();
    await expect(canvas(page).locator('[data-editor-element="hero"][data-editor-selected="true"]')).toHaveCount(1);
    await expect(canvas(page).locator('[data-editing="true"]'), "the first tap only selects").toHaveCount(0);
    await title.tap();
    await expect(canvas(page).locator('[data-editing="true"]'), "the second tap edits").toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText(`تلفن همراه ${ZWNJ}ما Mobile ۱۲۳`);
    await page.getByRole("heading", { level: 1 }).first().tap();   // tapping away commits
    await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(0);
    await expect(field(page, "hero", "title")).toHaveText(`تلفن همراه ${ZWNJ}ما Mobile ۱۲۳`);
    expect(await overflow(page), "no horizontal overflow while editing on a phone").toBeLessThanOrEqual(1);

    // Settings sheet: opens from the toggle, Escape closes it, nothing overflows.
    await page.getByRole("button", { name: "باز کردن پنل ویرایش" }).tap();
    const sheet = page.locator("[data-studio-inspector]");
    await expect(sheet.getByRole("button", { name: "طراحی", exact: true })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "باز کردن پنل ویرایش" })).toBeVisible();

    await save(page, project.id);
    expect(await stored(api, project.id)).toContain(`تلفن همراه ${ZWNJ}ما Mobile ۱۲۳`);
    // Touch targets of the selected element's toolbar are comfortable.
    await canvas(page).locator('[data-editor-element="section"] [data-editable-field="title"]').first().tap();
    const buttons = canvas(page).locator('[data-editor-selected="true"] [data-element-toolbar] button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i += 1) { const box = (await buttons.nth(i).boundingBox())!; expect(Math.min(box.width, box.height), `toolbar button ${i} is at least 40px on touch`).toBeGreaterThanOrEqual(40); }
  } finally { await context.close(); await api.dispose(); }
});

test("keyboard and screen reader: visible focus, Enter edits, Escape leaves, controls have names, destructive action is undoable", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser, { viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await createFrom(page, /شرکت حرفه‌ای/);
    // Focus is visible on a selectable element and on an editable text.
    const hero = canvas(page).locator('[data-editor-element="hero"]');
    await hero.focus();
    await page.keyboard.press("Tab");   // moves into the hero's focusable content
    const title = field(page, "hero", "title");
    await title.focus();
    const outline = await title.evaluate((el) => { const s = getComputedStyle(el); return `${s.outlineStyle}:${s.outlineWidth}`; });
    expect(outline, "editable text shows a focus outline").not.toMatch(/^none/);
    await expect(title).toHaveAttribute("aria-description", /Enter/);
    await page.keyboard.press("Enter");
    const surface = canvas(page).locator('[data-editing="true"]');
    await expect(surface).toHaveAttribute("role", "textbox");
    await expect(surface).toHaveAttribute("aria-label", /ویرایش متن/);
    await page.keyboard.insertText(" +");
    await page.keyboard.press("Escape");
    await expect(surface).toHaveCount(0);
    await expect(title, "Escape cancelled the edit").not.toContainText("+");
    await expect(title, "focus stays usable after leaving the editor").toBeVisible();

    // Section toolbar buttons are named; delete is separated from the others and can be undone.
    const section = canvas(page).locator('[data-editor-element="section"]').first();
    await section.locator('[data-editable-field="title"]').first().click();
    const total = await canvas(page).locator('[data-editor-element="section"], [data-editor-element="banner"], [data-editor-element="trust"]').count();
    for (const name of ["بالاتر", "پایین‌تر", "کپی", "پنهان کردن", "حذف"]) await expect(canvas(page).getByRole("button", { name, exact: true }).first()).toBeVisible();
    await canvas(page).getByRole("button", { name: "حذف", exact: true }).first().click();
    await expect(canvas(page).locator('[data-editor-element="section"], [data-editor-element="banner"], [data-editor-element="trust"]')).toHaveCount(total - 1);
    await page.getByRole("button", { name: "واگرد", exact: true }).click();
    await expect(canvas(page).locator('[data-editor-element="section"], [data-editor-element="banner"], [data-editor-element="trust"]')).toHaveCount(total);
  } finally { await context.close(); await api.dispose(); }
});

test("long headings, long page names and mixed Persian / English text stay inside the screen and are saved unchanged", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    const project = await createFrom(page, /موسسه حقوقی/);
    const longUnbroken = "ب".repeat(150);
    const longWords = "این یک عنوان بسیار طولانی برای آزمون ".repeat(4).trim();
    const mixed = `دفتر Law & Partners ${ZWNJ}تهران 2025 (Tehran)`;
    const edit = async (locator: ReturnType<typeof field>, text: string) => {
      await locator.scrollIntoViewIfNeeded();
      await locator.dblclick();
      await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(1);
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.insertText(text);
      await page.keyboard.press("Enter");
      await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(0);
    };
    await edit(field(page, "hero", "title"), longUnbroken);
    expect(await overflow(page), "an unbroken 150-letter heading does not widen the page").toBeLessThanOrEqual(1);
    await edit(field(page, "hero", "title"), longWords);
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    const heroBox = (await field(page, "hero", "title").boundingBox())!;
    expect(heroBox.x).toBeGreaterThanOrEqual(-1);
    expect(heroBox.x + heroBox.width).toBeLessThanOrEqual(391);
    await edit(field(page, "hero", "subtitle"), mixed);
    await expect(field(page, "hero", "subtitle")).toHaveText(mixed);

    // A very long page name in the selector, the menu and the page list.
    await page.getByRole("button", { name: "باز کردن پنل ویرایش" }).tap();
    const sheet = page.locator("[data-studio-inspector]");
    await sheet.getByRole("button", { name: "صفحه‌ها", exact: true }).click();
    await sheet.getByRole("button", { name: "افزودن صفحه" }).click();
    const longName = "نام بسیار بلند برای یک صفحه از وب‌سایت ".repeat(2).trim();
    await sheet.getByLabel("عنوان صفحه", { exact: true }).last().fill(longName);
    expect(await overflow(page), "a long page name does not overflow").toBeLessThanOrEqual(1);
    const boxes = await page.locator("[data-studio-header]").evaluate((el) => [...el.querySelectorAll("select, button, h1")].map((n) => { const r = n.getBoundingClientRect(); return [r.left, r.right]; }));
    for (const [left, right] of boxes) { expect(left).toBeGreaterThanOrEqual(-1); expect(right).toBeLessThanOrEqual(391); }
    await page.keyboard.press("Escape");
    await save(page, project.id);
    const content = await stored(api, project.id);
    expect(content).toContain(longWords);
    expect(content).toContain(mixed);
    expect(content).toContain(longName);
  } finally { await context.close(); await api.dispose(); }
});
