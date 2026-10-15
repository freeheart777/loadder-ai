import { expect, request, test, type Browser } from "@playwright/test";

// Blank website (no template) through the real UI, and private preview-link access control.
// Needs the real public-site runtime (the origin of published sites and preview links): run with e2e/websites/run-website-e2e.sh.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `094${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Blank E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Blank E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}

test("blank website: create, edit, save, reload, preview link, publish, public site; preview link access control", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    await page.goto("/dashboard/websites/corporate?new=1");
    const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
    await page.getByRole("button", { name: "ساخت سایت خالی", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const project = (await response.json()).project;
    await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
    expect(project.siteType).toBe("CORPORATE");

    // A blank site is a real, editable skeleton: header, sections and footer exist.
    const canvas = page.locator('[data-canvas-interactive="true"]');
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(canvas.getByRole("button", { name: "افزودن بخش در اینجا" }).first()).toBeVisible();

    // Edit, save, reload: the edit persists.
    const title = `سایت خالی ${Date.now()}`;
    await page.getByRole("heading", { level: 1 }).first().click();
    const toggle = page.getByRole("button", { name: /پنل ویرایش/ });
    if ((await toggle.getAttribute("aria-label")) === "باز کردن پنل ویرایش") await toggle.click();
    await page.getByLabel("عنوان", { exact: true }).first().fill(title);
    const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${project.id}` && r.request().method() === "PATCH" && r.status() === 200);
    await page.getByRole("button", { name: "ذخیره", exact: true }).click();
    await saved;
    await page.reload();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Before publishing nothing is public; the private preview link shows the draft.
    const siteUrl = `/site/${project.id}`;
    const anon = await browser.newContext();
    const visitor = await anon.newPage();
    const beforePublish = await visitor.goto(siteUrl);
    await expect(visitor.getByText(title), "an unpublished draft is not public").toHaveCount(0);
    void beforePublish;

    const token = await api.post(`/api/site-projects/${project.id}/preview-token`);
    expect(token.status()).toBe(201);
    const previewUrl: string = (await token.json()).previewUrl;
    expect(previewUrl).toContain(`/preview/sites/${project.id}?token=`);
    const anonApi = await request.newContext();
    const ok = await anonApi.get(previewUrl);
    expect(ok.status(), "the private link works without a session (it is the capability)").toBe(200);
    expect(await ok.text()).toContain(title);
    expect(ok.headers()["x-robots-tag"] ?? "", "preview is not indexed").toMatch(/noindex/i);
    const origin = new URL(previewUrl).origin, secret = new URL(previewUrl).searchParams.get("token")!;
    expect((await anonApi.get(`${origin}/preview/sites/${project.id}`)).status(), "no token").toBe(401);
    expect((await anonApi.get(`${origin}/preview/sites/${project.id}?token=${"a".repeat(48)}`)).status(), "wrong token").toBe(404);
    expect((await anonApi.get(`${origin}/preview/sites/${project.id}?token=short`)).status(), "malformed token").toBe(401);
    expect((await anonApi.get(`${origin}/preview/sites/00000000-0000-0000-0000-000000000000?token=${secret}`)).status(), "token of another project").toBe(404);

    // Publish: the public site shows it; a later draft edit reaches the preview link but not the public site.
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    await visitor.goto(siteUrl);
    await expect(visitor.getByText(title).first()).toBeVisible();
    const draft = `${title} پیش‌نویس`;
    await page.getByRole("heading", { level: 1 }).first().click();
    await page.getByLabel("عنوان", { exact: true }).first().fill(draft);
    const saved2 = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${project.id}` && r.request().method() === "PATCH" && r.status() === 200);
    await page.getByRole("button", { name: "ذخیره", exact: true }).click();
    await saved2;
    expect(await (await anonApi.get(previewUrl)).text()).toContain(draft);
    await visitor.reload();
    await expect(visitor.getByText(draft), "unpublished edits stay private").toHaveCount(0);
    await expect(visitor.getByText(title).first()).toBeVisible();

    // Another workspace cannot mint a preview link for this site.
    const other = await signIn(browser);
    expect((await other.api.post(`/api/site-projects/${project.id}/preview-token`)).status()).toBe(404);
    await other.context.close(); await other.api.dispose();
    await anon.close(); await anonApi.dispose();
  } finally { await context.close(); await api.dispose(); }
});

test("blank store: created as STORE, publishes, and the public storefront opens", async ({ browser }) => {
  test.setTimeout(120_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    await page.goto("/dashboard/websites/store?new=1");
    const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
    await page.getByRole("button", { name: "شروع از فروشگاه خالی", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const project = (await response.json()).project;
    expect(project.siteType).toBe("STORE");
    await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
    await expect(page.locator('[data-studio-version="16"]')).toBeVisible();
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    await page.goto(`/store/${project.id}`);
    await expect(page.locator('[data-storefront-renderer="store-studio-v16"]')).toBeVisible();
  } finally { await context.close(); await api.dispose(); }
});
