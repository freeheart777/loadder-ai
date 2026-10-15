import { expect, request, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Legal firm -> Booking Studio, through the real UI: create from the law template, reach Booking from the Studio,
// define a provider and a service there, and see them stamped with THIS site only.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

async function signIn(browser: Browser): Promise<{ api: APIRequestContext; context: BrowserContext }> {
  const api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `092${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Legal E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Legal E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}
const ok = async (r: Awaited<ReturnType<APIRequestContext["get"]>>) => { const b = await r.json(); expect(r.ok(), JSON.stringify(b)).toBeTruthy(); return b; };

test("a law firm site reaches Booking Studio from the Studio and manages its own bookings", async ({ browser }) => {
  test.setTimeout(150_000);
  const { api, context } = await signIn(browser);
  const page: Page = await context.newPage();
  try {
    await page.goto("/dashboard/websites");
    await page.getByRole("link", { name: "ساخت سایت جدید", exact: true }).first().click();
    await page.getByRole("button", { name: /حقوقی/ }).first().click();
    const created = page.waitForResponse((r) => r.url() === `${apiBaseURL}/api/site-projects` && r.request().method() === "POST");
    await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
    const body = await (await created).json();
    const id = body.project.id as string;
    await expect(page).toHaveURL(new RegExp(`project=${id}`));
    const detail = await ok(await api.get(`/api/site-projects/${id}`));
    expect(body.project.siteType).toBe("LEGAL");
    expect(detail.capabilities).toContain("booking");

    // The Studio offers Booking management (desktop header and the mobile menu both carry it).
    const booking = page.locator('[data-site-manager="booking"]').first();
    await expect(booking).toHaveAttribute("href", "/dashboard/booking");
    await booking.click();
    await expect(page).toHaveURL(/\/dashboard\/booking\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const go = async (module: string) => { await page.locator(`a[href$="/booking/${module}"]`).first().click(); await expect(page).toHaveURL(new RegExp(`/booking/${module}$`)); };
    await go("providers");
    await page.getByLabel("نام ارائه‌دهنده").fill("وکیل آزمون");
    await page.getByRole("button", { name: "افزودن ارائه‌دهنده" }).click();
    await expect(page.locator("[data-provider]").filter({ hasText: "وکیل آزمون" })).toBeVisible();
    await go("services");
    await page.getByLabel("نام خدمت").fill("مشاورهٔ حقوقی");
    await page.getByRole("button", { name: "افزودن خدمت" }).click();
    await expect(page.locator("[data-service]").filter({ hasText: "مشاورهٔ حقوقی" })).toBeVisible();
    await page.getByLabel("ارائه‌دهنده", { exact: true }).selectOption({ label: "وکیل آزمون" });
    await page.getByLabel("خدمت", { exact: true }).selectOption({ label: "مشاورهٔ حقوقی" });
    await page.getByRole("button", { name: /^اتصال / }).click();
    await expect(page.getByRole("status")).toContainText("متصل شد");
    await go("schedules");
    await page.getByLabel(/زمان$/).first().selectOption({ label: "وکیل آزمون" });
    await page.getByRole("button", { name: "افزودن زمان" }).click();
    await expect(page.locator("[data-slot]").first()).toBeVisible();

    // Publish the site, then a visitor finds this service on the law firm's own booking page.
    await page.goto(`/dashboard/websites/corporate?project=${id}`);
    const published = page.waitForResponse((r) => r.url() === `${apiBaseURL}/api/site-projects/${id}/publish` && r.status() === 200);
    await page.getByRole("button", { name: /^انتشار/ }).first().click();
    await published;
    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    await pub.goto(`/site/${id}/booking`);
    await expect(pub.getByRole("button", { name: /مشاورهٔ حقوقی/ })).toBeVisible();
    await pub.getByRole("button", { name: /مشاورهٔ حقوقی/ }).click();
    await pub.getByRole("button", { name: /مرحله بعد|ادامه|بعدی/ }).first().click();
    await expect(pub.getByRole("button", { name: /وکیل آزمون/ })).toBeVisible();
    await visitor.close();

    // Another workspace never sees this site's booking.
    const other = await signIn(browser);
    expect((await other.api.get(`/api/booking?siteProjectId=${id}`)).status()).toBe(404);
    await other.context.close(); await other.api.dispose();
  } finally { await context.close(); await api.dispose(); }
});
