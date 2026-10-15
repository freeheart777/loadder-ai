import { expect, request, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the Site Platform browser closure.");

test.use({ actionTimeout: 12_000 });

type Project = { id: string; siteType: string };

async function signIn(browser: Browser, name: string): Promise<{ api: APIRequestContext; context: BrowserContext }> {
  const api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `091${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name } });
  // Sign-in codes are rate limited per client (5 a minute): honour Retry-After like a real client instead of weakening the limiter.
  if (sent.status() === 429) {
    const waitSeconds = Math.min(65, Number(sent.headers()["retry-after"]) || 61);
    await new Promise((resolve) => setTimeout(resolve, (waitSeconds + 1) * 1000));
    sent = await api.post("/api/auth/send-otp", { data: { mobile, name } });
  }
  const otp = await sent.json();
  expect(sent.ok(), JSON.stringify(otp)).toBeTruthy();
  const verified = await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } });
  expect(verified.ok(), await verified.text()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}

async function expectOk(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

async function createFromCustomerEntry(page: Page, label: string): Promise<Project> {
  await page.goto("/dashboard/websites");
  await page.getByRole("link", { name: "ساخت سایت جدید", exact: true }).first().click();
  await page.getByRole("button", { name: new RegExp(label) }).first().click();
  const created = page.waitForResponse((response) => response.url() === `${apiBaseURL}/api/site-projects` && response.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const response = await created;
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(201);
  await expect(page).toHaveURL(new RegExp(`project=${body.project.id}`));
  return body.project;
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const desktopManager = (page: Page, id: string) => page.locator(`[data-site-manager="${id}"]`).first();
const mobileManager = (page: Page, id: string) => page.locator(`[data-site-manager="${id}"]`).last();

async function expectMobileActionableControlCenter(page: Page, expected: "booking" | "no-booking") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const center = page.locator("[data-control-center]");
  await expect(center).toBeVisible();
  const websites = center.getByRole("link", { name: "وب‌سایت‌ها" });
  await expect(websites).toHaveAttribute("href", "/dashboard/websites");
  if (expected === "booking") {
    const booking = center.getByRole("link", { name: "نوبت‌دهی" });
    await expect(booking).toHaveAttribute("href", "/dashboard/booking");
    await booking.click();
    await expect(page).toHaveURL(/\/dashboard\/booking$/);
    await page.goto("/dashboard");
  } else await expect(center.getByRole("link", { name: "نوبت‌دهی" })).toHaveCount(0);
  await websites.click();
  await expect(page).toHaveURL(/\/dashboard\/websites$/);
  expect(await overflow(page), "Control Center mobile horizontal overflow").toBeLessThanOrEqual(1);
}

async function expectMobileBookingDestination(page: Page, projectId: string, destination: { href: string; url: RegExp }) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dashboard/websites/corporate?project=${projectId}`);
  await expect(page.locator("[data-site-manager-menu]")).toBeVisible();
  const booking = mobileManager(page, "booking");
  await expect(booking).toHaveAttribute("href", destination.href);
  await booking.click();
  await expect(page).toHaveURL(destination.url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await overflow(page), "Booking destination mobile horizontal overflow").toBeLessThanOrEqual(1);
}

test("Medical customer entry persists Booking capability and Booking Studio manages canonical records", async ({ browser }) => {
  test.setTimeout(120_000);
  const { api, context } = await signIn(browser, "Medical Closure E2E");
  const page = await context.newPage();
  try {
    const medical = await createFromCustomerEntry(page, "کلینیک و پزشک");
    const detail = await expectOk(await api.get(`/api/site-projects/${medical.id}`));
    expect(detail.capabilities).toContain("booking");
    expect(medical.siteType).toBe("MEDICAL");
    // The starter choice is project truth. Returning to the Studio must not
    // reopen a second template/type picker or let UI state choose a new type.
    await page.reload();
    await expect(page.locator("[data-persisted-site-type]")).toContainText("کلینیک و پزشک");
    await expect(page.getByRole("button", { name: "قالب‌ها", exact: true })).toHaveCount(0);
    await expect(page.locator("[data-create-another-site]").first()).toHaveAttribute("href", "/dashboard/websites");

    // A Medical site manages its Booking in ITS OWN Control Center (site-scoped), not in the workspace studio.
    const controlRoot = `/dashboard/websites/${medical.id}/control`;
    await expect(desktopManager(page, "booking")).toHaveAttribute("href", `${controlRoot}/appointments`);
    await desktopManager(page, "booking").click();
    await expect(page).toHaveURL(new RegExp(`${controlRoot}/appointments$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("نوبتی برای نمایش وجود ندارد.")).toBeVisible();
    const go = async (module: string) => { await page.locator(`a[href$="/control/${module}"]`).first().click(); await expect(page).toHaveURL(new RegExp(`/control/${module}$`)); };

    await go("providers");
    await expect(page.getByText("هنوز پزشکی تعریف نشده است.")).toBeVisible();
    await page.getByLabel("نام پزشک").fill("دکتر آزمون");
    await page.getByRole("button", { name: "افزودن پزشک" }).click();
    await expect(page.locator("[data-provider]").filter({ hasText: "دکتر آزمون" })).toBeVisible();

    await go("services");
    await expect(page.getByText("هنوز خدمتی تعریف نشده است.")).toBeVisible();
    await page.getByLabel("نام خدمت").fill("ویزیت اولیه");
    await page.getByRole("button", { name: "افزودن خدمت" }).click();
    await expect(page.locator("[data-service]").filter({ hasText: "ویزیت اولیه" })).toBeVisible();
    await page.getByLabel("پزشک", { exact: true }).selectOption({ label: "دکتر آزمون" });
    await page.getByLabel("خدمت", { exact: true }).selectOption({ label: "ویزیت اولیه" });
    await page.getByRole("button", { name: "اتصال پزشک به خدمت" }).click();
    await expect(page.getByRole("status")).toContainText("متصل شد");

    await go("schedules");
    await page.getByLabel("پزشک زمان").selectOption({ label: "دکتر آزمون" });
    await page.getByRole("button", { name: "افزودن زمان" }).click();
    await expect(page.locator("[data-slot]").filter({ hasText: "09:00–10:00" }).first()).toBeVisible();

    // The records are the canonical Booking records, stamped with THIS site and invisible everywhere else.
    const scoped = await expectOk(await api.get(`/api/booking?siteProjectId=${medical.id}`));
    expect(scoped.services.map((item: { name: string; site_project_id: string }) => [item.name, item.site_project_id])).toEqual([["ویزیت اولیه", medical.id]]);
    expect(scoped.providers.map((item: { name: string; site_project_id: string }) => [item.name, item.site_project_id])).toEqual([["دکتر آزمون", medical.id]]);
    expect(scoped.associations).toHaveLength(1);
    expect(scoped.availability).toHaveLength(1);
    const workspaceView = await expectOk(await api.get("/api/booking"));
    expect(workspaceView.services.map((item: { name: string }) => item.name), "strict Medical scope: nothing in the workspace-level view").not.toContain("ویزیت اولیه");
    expect(workspaceView.providers.map((item: { name: string }) => item.name)).not.toContain("دکتر آزمون");

    // Persistence: a fresh load of the module shows the stored records.
    await page.goto(`${controlRoot}/services`);
    await expect(page.locator("[data-service]").filter({ hasText: "ویزیت اولیه" })).toBeVisible();

    await expectMobileBookingDestination(page, medical.id, { href: `${controlRoot}/appointments`, url: new RegExp(`${controlRoot}/appointments$`) });
  } finally { await context.close(); await api.dispose(); }
});

test("Ecommerce starter reopens in the canonical Store Studio without a second type choice", async ({ browser }) => {
  test.setTimeout(120_000);
  const { api, context } = await signIn(browser, "Ecommerce Starter E2E");
  const page = await context.newPage();
  try {
    const ecommerce = await createFromCustomerEntry(page, "Loadder Commerce Modern V1");
    expect(ecommerce.siteType).toBe("ECOMMERCE");
    const detail = await expectOk(await api.get(`/api/site-projects/${ecommerce.id}`));
    expect(detail.capabilities).toEqual(expect.arrayContaining(["commerce", "payments"]));
    await expect(page).toHaveURL(new RegExp(`/dashboard/websites/store\\?project=${ecommerce.id}`));
    await page.reload();
    await expect(page.locator("[data-persisted-site-type]")).toContainText("فروشگاه اینترنتی");
    await expect(page.getByRole("button", { name: "قالب‌ها", exact: true })).toHaveCount(0);
  } finally { await context.close(); await api.dispose(); }
});

test("Legal has its own persisted Booking capability and a non-Booking project cannot obtain it", async ({ browser }) => {
  test.setTimeout(120_000);
  const legalSession = await signIn(browser, "Legal Closure E2E");
  const page = await legalSession.context.newPage();
  try {
    const legal = await createFromCustomerEntry(page, "موسسه حقوقی");
    const detail = await expectOk(await legalSession.api.get(`/api/site-projects/${legal.id}`));
    expect(detail.capabilities).toContain("booking");
    expect(legal.siteType).toBe("LEGAL");
    // Legal has Booking but no site appointments module: its action is the workspace Booking Studio.
    await expect(desktopManager(page, "booking")).toHaveAttribute("href", "/dashboard/booking");
    await desktopManager(page, "booking").click();
    await expect(page).toHaveURL(/\/dashboard\/booking$/);
    await expect(page.getByRole("heading", { name: "استودیوی نوبت‌دهی" })).toBeVisible();
    await expect(page.getByText("نوبتی برای نمایش وجود ندارد.")).toBeVisible();
    await page.locator('a[href$="/dashboard/booking/services"]').first().click();
    await expect(page).toHaveURL(/\/dashboard\/booking\/services$/);
    await expect(page.getByText("هنوز خدمتی تعریف نشده است.")).toBeVisible();
    // The site's own Control Center does not offer a modules it lacks: the old per-site booking address resolves to its overview.
    await page.goto(`/dashboard/websites/${legal.id}/control/appointments`);
    await expect(page).toHaveURL(new RegExp(`/dashboard/websites/${legal.id}/control$`));
    await expectMobileActionableControlCenter(page, "booking");
    await expectMobileBookingDestination(page, legal.id, { href: "/dashboard/booking", url: /\/dashboard\/booking$/ });
  } finally { await legalSession.context.close(); await legalSession.api.dispose(); }

  const blankSession = await signIn(browser, "Booking Disabled Closure E2E");
  const blankPage = await blankSession.context.newPage();
  try {
    const corporate = await createFromCustomerEntry(blankPage, "شرکت حرفه‌ای");
    const detail = await expectOk(await blankSession.api.get(`/api/site-projects/${corporate.id}`));
    expect(detail.capabilities).not.toContain("booking");
    await expect(desktopManager(blankPage, "booking")).toHaveCount(0);
    await expect(desktopManager(blankPage, "content")).toHaveAttribute("href", "/dashboard/content");
    await expect(desktopManager(blankPage, "commerce")).toHaveCount(0);
    const denied = await blankSession.api.get("/api/booking");
    expect(denied.status()).toBe(403);
    const summary = await expectOk(await blankSession.api.get("/api/control-center/summary"));
    expect(summary.actions.some((action: { id: string }) => action.id === "websites")).toBeTruthy();
    expect(summary.actions.some((action: { id: string }) => action.id === "booking")).toBeFalsy();
    expect(summary.actions.some((action: { id: string }) => action.id === "content")).toBeTruthy();
    expect(summary.actions.some((action: { id: string }) => action.id === "commerce")).toBeFalsy();
    await blankPage.goto("/dashboard");
    const center = blankPage.locator("[data-control-center]");
    await expect(center.getByRole("link", { name: "محتوا" })).toHaveAttribute("href", "/dashboard/content");
    await expect(center.getByRole("link", { name: "تجارت" })).toHaveCount(0);
    await expectMobileActionableControlCenter(blankPage, "no-booking");
  } finally { await blankSession.context.close(); await blankSession.api.dispose(); }
});

test("Control Center is truthful and Hybrid exposes only its persisted Content and Commerce links", async ({ browser }) => {
  test.setTimeout(120_000);
  const enabled = await signIn(browser, "Control Center Closure E2E");
  const page = await enabled.context.newPage();
  try {
    await createFromCustomerEntry(page, "کلینیک و پزشک");
    await page.goto("/dashboard");
    const center = page.locator("[data-control-center]");
    await expect(center).toBeVisible();
    await expect(center.getByRole("link", { name: "وب‌سایت‌ها" })).toHaveAttribute("href", "/dashboard/websites");
    await expect(center.getByRole("link", { name: "نوبت‌دهی" })).toHaveAttribute("href", "/dashboard/booking");
    await expectMobileActionableControlCenter(page, "booking");

    const hybrid = await createFromCustomerEntry(page, "کسب‌وکار ترکیبی");
    const detail = await expectOk(await enabled.api.get(`/api/site-projects/${hybrid.id}`));
    expect(detail.capabilities).toEqual(expect.arrayContaining(["core", "blog", "commerce"]));
    await page.setViewportSize({ width: 1440, height: 900 });
    // Control Center actions are derived from persisted workspace capabilities,
    // so Hybrid must expose the canonical operational destinations as well.
    await page.goto("/dashboard");
    const hybridCenter = page.locator("[data-control-center]");
    await expect(hybridCenter.getByRole("link", { name: "محتوا" })).toHaveAttribute("href", "/dashboard/content");
    await expect(hybridCenter.getByRole("link", { name: "تجارت" })).toHaveAttribute("href", "/dashboard/websites/commerce");
    await page.goto(`/dashboard/websites/corporate?project=${hybrid.id}`);
    await expect(desktopManager(page, "content")).toHaveAttribute("href", "/dashboard/content");
    await expect(desktopManager(page, "commerce")).toHaveAttribute("href", "/dashboard/websites/commerce");
    await expect(desktopManager(page, "booking")).toHaveCount(0);
    await page.locator('[data-storefront-renderer="store-studio-v16"]').first().click();
    await expect(page.getByRole("button", { name: "صفحه‌ها", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "صفحه‌ها", exact: true }).click();
    await expect(page.locator('[data-page-manager="v16"]')).toBeVisible();
    await expect(page.getByText("صفحه خانه آدرس اصلی سایت است و حذف نمی‌شود.")).toBeVisible();
    await desktopManager(page, "content").click();
    await expect(page).toHaveURL(/\/dashboard\/content$/);
    await page.goto(`/dashboard/websites/corporate?project=${hybrid.id}`);
    await desktopManager(page, "commerce").click();
    await expect(page).toHaveURL(/\/dashboard\/websites\/commerce$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/websites/corporate?project=${hybrid.id}`);
    await expect(page.locator("[data-site-manager-menu]")).toBeVisible();
    await expect(mobileManager(page, "content")).toBeVisible();
    await expect(mobileManager(page, "commerce")).toBeVisible();
    await expect(mobileManager(page, "booking")).toHaveCount(0);
    expect(await overflow(page), "Hybrid customer navigation mobile horizontal overflow").toBeLessThanOrEqual(1);
    await mobileManager(page, "content").click();
    await expect(page).toHaveURL(/\/dashboard\/content$/);
    await page.goto(`/dashboard/websites/corporate?project=${hybrid.id}`);
    await expect(mobileManager(page, "commerce")).toBeVisible();
    await mobileManager(page, "commerce").click();
    await expect(page).toHaveURL(/\/dashboard\/websites\/commerce$/);
    await page.goto(`/dashboard/websites/corporate?project=${hybrid.id}`);
    await expect(mobileManager(page, "content")).toBeVisible();
    await expect(mobileManager(page, "commerce")).toBeVisible();
  } finally { await enabled.context.close(); await enabled.api.dispose(); }

  const empty = await signIn(browser, "Empty Control Center Closure E2E");
  const emptyPage = await empty.context.newPage();
  try {
    const summary = await expectOk(await empty.api.get("/api/control-center/summary"));
    expect(summary.counts).toMatchObject({ projects: 0, services: 0, providers: 0, appointments: 0, leads: 0, orders: 0 });
    expect(summary.actions).toEqual([]);
    await emptyPage.setViewportSize({ width: 390, height: 844 });
    await emptyPage.goto("/dashboard");
    const center = emptyPage.locator("[data-control-center]");
    await expect(center.getByText("هنوز داده عملیاتی در این Workspace ثبت نشده است.")).toBeVisible();
    await expect(center.getByRole("link", { name: "نوبت‌دهی" })).toHaveCount(0);
    expect(await overflow(emptyPage), "empty Control Center mobile horizontal overflow").toBeLessThanOrEqual(1);
  } finally { await empty.context.close(); await empty.api.dispose(); }
});
