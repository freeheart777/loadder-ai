import { expect, request, test, type Browser, type Page } from "@playwright/test";

// V17 phase 4: direct image replacement on the canvas through the existing site media pipeline.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGP4z8DwHwyBNBgAAIsvCfk0kQ1pAAAAAElFTkSuQmCC", "base64");
async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Inline Img E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Inline Img E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}
async function createFrom(page: Page, route: string, label: RegExp | null) {
  await page.goto(`${route}?new=1`);
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  if (label) { await page.getByRole("button", { name: label }).first().click(); await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click(); }
  else await page.getByRole("button", { name: /خالی/ }).first().click();
  const project = (await (await created).json()).project as { id: string };
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project;
}
const canvas = (page: Page) => page.locator('[data-canvas-interactive="true"]');
const heroControl = (page: Page) => canvas(page).locator('[data-editor-element="hero"] [data-inline-media-control]').first();
const heroImage = async (api: Awaited<ReturnType<typeof signIn>>["api"], id: string) => (await (await api.get(`/api/site-projects/${id}`)).json()).project.content.storeBuilderV16.hero.imageUrl as string;

test("Medical: the replace action is discoverable, works by mouse and keyboard, persists, and reaches preview and the public site", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", /کلینیک و پزشک/);
    const before = await heroImage(api, project.id);
    const chip = heroControl(page).locator("[data-media-chip]");
    // Another element is selected (the hero is selected on first open), so the hero's action is quiet until it is selected, hovered or focused.
    await canvas(page).locator('[data-editor-element="header"] [data-editable-field="storeName"]').click();
    await page.mouse.move(2, 2);
    await expect(chip).toHaveCSS("opacity", "0");

    // Selecting the hero makes the action visible, with a clear label.
    await canvas(page).locator('[data-editor-element="hero"] [data-editable-field="subtitle"]').click();
    await expect(chip).toHaveCSS("opacity", "1");
    await expect(chip).toHaveText(/تعویض عکس|افزودن عکس/);

    // Keyboard: the file input is a real tab stop and Enter opens the chooser.
    const input = heroControl(page).locator("input[type=file]");
    await input.focus();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    const uploaded = page.waitForResponse((r) => r.request().method() === "POST" && /media\/upload/.test(r.url()) && r.status() < 400);
    await (await chooserPromise).setFiles({ name: "clinic.png", mimeType: "image/png", buffer: PNG });
    await uploaded;
    await expect.poll(() => heroImage(api, project.id), { message: "the new image is saved with the draft" }).not.toBe(before);
    const after = await heroImage(api, project.id);
    expect(after).toContain("/site-media-object/");

    // The canvas shows it (and it actually loads).
    await expect(canvas(page).locator('[data-editor-element="hero"] [style*="background-image"]').first()).toBeVisible();
    await page.reload();
    expect(await heroImage(api, project.id)).toBe(after);

    // Preview and the public site use the same image, and the public image URL answers without a login.
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
    await expect(page.locator('[data-canvas-interactive="false"] [style*="site-media-object"]').first()).toBeVisible();
    await page.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    const anon = await browser.newContext();
    const visitor = await anon.newPage();
    await visitor.goto(`/site/${project.id}`);
    await expect(visitor.locator('[style*="site-media-object"]').first()).toBeVisible();
    expect((await anon.request.get(after)).status()).toBe(200);
    await anon.close();
  } finally { await context.close(); await api.dispose(); }
});

test("a failed or invalid upload keeps the previous image and says so", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", /شرکت حرفه‌ای/);
    const before = await heroImage(api, project.id);
    const input = heroControl(page).locator("input[type=file]");
    // Server failure.
    await page.route(/\/media\/upload/, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, message: "آپلود موقتاً ناموفق بود" }) }));
    await input.setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("آپلود موقتاً ناموفق بود").first()).toBeVisible();
    expect(await heroImage(api, project.id)).toBe(before);
    await page.unroute(/\/media\/upload/);
    // Not an image at all: refused before anything is sent.
    let sent = 0;
    page.on("request", (r) => { if (/media\/upload/.test(r.url())) sent += 1; });
    await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText(/نوع فایل|فرمت|مجاز/).first()).toBeVisible();
    expect(sent).toBe(0);
    expect(await heroImage(api, project.id)).toBe(before);
  } finally { await context.close(); await api.dispose(); }
});

test("a blank site shows an always-visible add-image action on an empty image slot", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", null);
    const empties = canvas(page).locator('[data-media-empty="true"]');
    const count = await empties.count();
    expect(count, "a blank site has an empty image slot").toBeGreaterThan(0);
    const control = empties.first();
    await expect(control.locator("[data-media-chip]")).toHaveCSS("opacity", "1");   // visible without hover or selection
    await expect(control.locator("[data-media-chip]")).toHaveText(/افزودن/);
    await control.locator("input[type=file]").setInputFiles({ name: "first.png", mimeType: "image/png", buffer: PNG });
    await expect(canvas(page).locator('[data-media-empty="true"]')).toHaveCount(count - 1);
    const stored = JSON.stringify((await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content);
    expect(stored).toContain("/site-media-object/");
  } finally { await context.close(); await api.dispose(); }
});

test("Store: the hero image is replaced directly and the public storefront shows it", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/store", /Loadder Commerce Modern V1/);
    const before = await heroImage(api, project.id);
    await heroControl(page).locator("input[type=file]").setInputFiles({ name: "store.png", mimeType: "image/png", buffer: PNG });
    await expect.poll(() => heroImage(api, project.id)).not.toBe(before);
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    await page.goto(`/store/${project.id}`);
    await expect(page.locator('img[src*="site-media-object"], [style*="site-media-object"]').first()).toBeVisible();
  } finally { await context.close(); await api.dispose(); }
});
