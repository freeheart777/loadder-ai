import { expect, request, test, type Browser, type Page } from "@playwright/test";

// Evidence capture (not an assertion suite): Studio + published page screenshot of every template.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
const shots = process.env.TEMPLATE_SHOTS || "test-results/templates";
const sitesBase = process.env.E2E_SITES_BASE_URL || "";
test.use({ actionTimeout: 15_000 });

async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Gallery" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Gallery" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 900 } }) };
}

const TEMPLATES: [string, string, RegExp][] = [
  ["medical", "/dashboard/websites/corporate", /کلینیک و پزشک/],
  ["nava", "/dashboard/websites/corporate", /نوا/],
  ["legal", "/dashboard/websites/corporate", /موسسه حقوقی/],
  ["education", "/dashboard/websites/corporate", /مرکز آموزشی/],
  ["corporate", "/dashboard/websites/corporate", /شرکت حرفه‌ای/],
  ["hybrid", "/dashboard/websites/corporate", /کسب‌وکار ترکیبی/],
  ["store", "/dashboard/websites/store", /Commerce Modern/],
];

async function create(page: Page, route: string, label: RegExp) {
  await page.goto(`${route}?new=1`);
  await page.getByRole("button", { name: label }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project as { id: string };
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project;
}

test("picker screenshot", async ({ browser }) => {
  const { context } = await signIn(browser);
  const page = await context.newPage();
  await page.goto("/dashboard/websites/corporate?new=1");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/00-picker.png`, fullPage: true });
});

for (const [key, route, label] of TEMPLATES) {
  test(`shots: ${key}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { api, context } = await signIn(browser);
    const page = await context.newPage();
    const project = await create(page, route, label);
    await page.waitForTimeout(1200);
    await page.locator('[data-canvas-interactive="true"]').first().screenshot({ path: `${shots}/${key}-studio-top.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${shots}/${key}-studio-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    const pub = await api.post(`/api/site-projects/${project.id}/publish`, { data: {} });
    if (pub.ok()) {
      const view = await context.newPage();
      await view.goto(`/site/${project.id}`);
      await view.waitForTimeout(2500);
      await view.screenshot({ path: `${shots}/${key}-public.png`, fullPage: true });
    }
  });
}
