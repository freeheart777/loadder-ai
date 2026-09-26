import { expect, request, test, type Browser, type Page } from "@playwright/test";
import { businessLaunchTemplates } from "../../src/components/store-studio-v16/templates/business-launch-v1";

// Website Builder V16 release flow, for every shipped template:
// template → create → Studio → edit → save → preview → (private preview link)
// → publish → public address at desktop / tablet / mobile.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the website release flow.");

test.use({ actionTimeout: 15_000 });

type Case = { route: string; label: string; heroTitle: string; commerce: boolean };
const cases: Case[] = [
  ...businessLaunchTemplates.map((template) => ({ route: "/dashboard/websites/corporate", label: template.label, heroTitle: String(template.hero?.title || ""), commerce: false })),
  { route: "/dashboard/websites", label: "Loadder Commerce Modern V1", heroTitle: "کالای مورد نظرتان را با بهترین قیمت پیدا کنید", commerce: true },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `093${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  // send-otp is rate limited (5/min per IP); wait out the window when several flows run back to back.
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Website Release E2E" } });
  for (let attempt = 0; sent.status() === 429 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, ((Number(sent.headers()["retry-after"]) || 60) + 1) * 1000));
    sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Website Release E2E" } });
  }
  const otp = await sent.json();
  expect(otp.developmentOtp, "AUTH_EXPOSE_DEV_OTP=true is required").toMatch(/^\d+$/);
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  const context = await browser.newContext({ storageState: await api.storageState() });
  await api.dispose();
  return context;
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => { if (response.status() >= 500) problems.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`); });
  return problems;
}

for (const scenario of cases) {
  test(`${scenario.label}: create → edit → save → preview → publish → public address`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await signIn(browser);
    const page = await context.newPage();
    const problems = watch(page);
    try {
      // Template → create project → Studio.
      await page.goto(`${scenario.route}?new=1`);
      await page.getByRole("button", { name: new RegExp(scenario.label) }).first().click();
      const created = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects` && res.request().method() === "POST");
      await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
      const createdResponse = await created;
      expect(createdResponse.status()).toBe(201);
      const project = (await createdResponse.json()).project;
      await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
      const canvas = page.locator('[data-canvas-interactive="true"]');
      await expect(canvas.getByText(scenario.heroTitle, { exact: true }).first()).toBeVisible();

      // Edit the hero title and save.
      const newTitle = `نسخه انتشار ${Date.now()}`;
      await canvas.getByText(scenario.heroTitle, { exact: true }).first().click();
      await page.getByLabel("عنوان", { exact: true }).fill(newTitle);
      const saved = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects/${project.id}` && res.request().method() === "PATCH");
      await page.getByRole("button", { name: "ذخیره", exact: true }).click();
      expect((await saved).status()).toBe(200);

      // Draft preview (+ private server-rendered preview link for corporate sites).
      await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
      await expect(page.locator('[data-canvas-interactive="false"]').getByText(newTitle, { exact: true }).first()).toBeVisible();
      if (!scenario.commerce) {
        await page.getByRole("button", { name: /ساخت لینک/ }).click();
        const link = page.getByRole("link", { name: "بازکردن لینک خصوصی پیش‌نمایش" });
        await expect(link).toBeVisible();
        const previewPage = await context.newPage();
        const previewResponse = await previewPage.goto((await link.getAttribute("href"))!);
        expect(previewResponse?.status(), "private preview link").toBe(200);
        await expect(previewPage.getByText(newTitle).first()).toBeVisible();
        await previewPage.close();
      }
      await page.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();

      // Publish and open the public address.
      const published = page.waitForResponse((res) => res.url().endsWith(`/api/site-projects/${project.id}/publish`) && res.request().method() === "POST");
      await page.getByRole("button", { name: "انتشار", exact: true }).click();
      expect((await published).status()).toBe(200);
      const publicLink = page.getByRole("link", { name: /آدرس عمومی/ });
      await expect(publicLink).toBeVisible();
      const href = await publicLink.getAttribute("href");
      expect(href).toBe(`${scenario.commerce ? "/store" : "/site"}/${project.id}`);

      const site = await context.newPage();
      const siteProblems = watch(site);
      for (const viewport of viewports) {
        await site.setViewportSize({ width: viewport.width, height: viewport.height });
        await site.goto(href!);
        await expect(site.getByText(newTitle).first(), `public site on ${viewport.name}`).toBeVisible();
        expect(await site.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `no horizontal scroll on ${viewport.name}`).toBeLessThanOrEqual(1);
      }
      await site.close();
      expect([...problems, ...siteProblems], "no page errors or 5xx").toEqual([]);
    } finally {
      await context.close();
    }
  });
}
