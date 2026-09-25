import { expect, request, test, type APIRequestContext, type APIResponse, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL;

if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the Store Studio journey.");

type Journey = {
  api: APIRequestContext;
  context: BrowserContext;
  page: Page;
  projectId: string;
  network: Array<{ method: string; status: number; url: string }>;
  consoleErrors: string[];
  pageErrors: string[];
};

async function expectJsonOk(response: APIResponse) {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

async function createJourney(browser: Browser, testInfo: TestInfo): Promise<Journey> {
  const api = await request.newContext({ baseURL: apiBaseURL });
  const identity = `${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const mobile = `090${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
  const otp = await expectJsonOk(await api.post("/api/auth/send-otp", { data: { mobile, name: "Store Studio E2E" } }));
  expect(otp.developmentOtp).toMatch(/^\d+$/);
  await expectJsonOk(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
  const created = await expectJsonOk(await api.post("/api/site-projects", {
    data: { name: `فروشگاه آزمون ${identity}`, siteType: "STORE", content: {} },
  }));
  const context = await browser.newContext({ storageState: await api.storageState() });
  const page = await context.newPage();
  const network: Journey["network"] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith(apiBaseURL)) network.push({ method: response.request().method(), status: response.status(), url: response.url() });
  });
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { api, context, page, projectId: created.project.id, network, consoleErrors, pageErrors };
}

async function finishJourney(journey: Journey, testInfo: TestInfo) {
  await testInfo.attach("network-summary.json", {
    body: Buffer.from(JSON.stringify(journey.network, null, 2)),
    contentType: "application/json",
  });
  expect(journey.pageErrors, "uncaught browser errors").toEqual([]);
  expect(journey.consoleErrors, "browser console errors").toEqual([]);
  const unexpected = journey.network.filter(({ status }) => status >= 400);
  expect(unexpected, "unexpected API 4xx/5xx responses").toEqual([]);
  await journey.context.close().catch(() => undefined);
  await journey.api.dispose().catch(() => undefined);
}

async function openStudio(page: Page) {
  await page.goto("/dashboard/websites");
  await expect(page.getByRole("heading", { name: "فروشگاه شما" })).toBeVisible();
  await expect(page.locator('[data-studio-version="16"]')).toBeVisible();
  await expect(page.locator('[data-canvas-interactive="true"]')).toBeVisible();
}

test("canonical authenticated Store Studio V16 customer journey", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const journey = await createJourney(browser, testInfo);
  try {
    await test.step("authenticated Studio load and Hero persistence", async () => {
      await openStudio(journey.page);
      await journey.page.getByRole("heading", { name: "خریدی ساده، سریع و مطمئن", exact: true }).click();
      await journey.page.getByLabel("عنوان", { exact: true }).fill("قهرمان فارسی فروشگاه");
      await journey.page.getByLabel("چیدمان", { exact: true }).selectOption("background");
      await expect(journey.page.locator('[data-editor-element="hero"]')).toContainText("قهرمان فارسی فروشگاه");
      await expect(journey.page.locator('[data-hero-layout="background"]')).toBeVisible();
      await expect(journey.page.locator('[data-hero-layout="background"] [data-hero-overlay]')).toBeVisible();

      const persisted = journey.page.waitForResponse((response) =>
        response.url() === `${apiBaseURL}/api/site-projects/${journey.projectId}`
        && response.request().method() === "PATCH"
        && response.status() === 200,
      );
      await journey.page.getByRole("button", { name: "ذخیره", exact: true }).click();
      await persisted;
      await expect(journey.page.getByText("طراحی ذخیره شد.")).toBeVisible();

      await journey.page.reload();
      await expect(journey.page.locator('[data-editor-element="hero"]')).toContainText("قهرمان فارسی فروشگاه");
      await journey.page.getByRole("heading", { name: "قهرمان فارسی فروشگاه", exact: true }).click();
      await expect(journey.page.getByLabel("عنوان", { exact: true })).toHaveValue("قهرمان فارسی فروشگاه");
      await expect(journey.page.getByLabel("چیدمان", { exact: true })).toHaveValue("background");
    });

    await test.step("the Studio save is recorded in draft revision history", async () => {
      const history = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}/document-revisions`));
      expect(history.current, "the save produced a revision").toBeGreaterThanOrEqual(1);
      expect(history.revisions.length).toBeGreaterThanOrEqual(1);
      for (const revision of history.revisions as Array<{ documentHash: string; document?: unknown }>) {
        expect(revision.documentHash).toMatch(/^[0-9a-f]{64}$/);
        expect(revision.document, "the summary carries no document payload").toBeUndefined();
      }
      const detail = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}`));
      expect(detail.draftRevision, "the editor reloads on the current revision").toBe(history.current);
    });

    await test.step("Persian product creation and reload persistence", async () => {
      await journey.page.getByRole("button", { name: "+ افزودن محصول از کاتالوگ واقعی", exact: true }).click();
      await journey.page.getByRole("button", { name: "ساخت محصول جدید", exact: true }).click();
      await journey.page.getByLabel("نام محصول", { exact: true }).fill("کرم زعفران ویژه");
      await journey.page.getByLabel(/^قیمت \(/).fill("۴۵۰٬۰۰۰");

      const created = journey.page.waitForResponse((response) =>
        response.url() === `${apiBaseURL}/api/stores/${journey.projectId}/products`
        && response.request().method() === "POST"
        && response.status() === 201,
      );
      await journey.page.getByRole("button", { name: "ساخت و افزودن به فروشگاه", exact: true }).click();
      await created;
      await expect(journey.page.locator('[data-editor-element="product-card"]')).toContainText("کرم زعفران ویژه");

      await journey.page.reload();
      await expect(journey.page.locator('[data-editor-element="product-card"]')).toContainText("کرم زعفران ویژه");
      await expect(journey.page.locator('[data-editor-element="product-card"]')).toContainText("۴۵۰٬۰۰۰");
    });

    await test.step("draft preview, immutable live publication and rollback stay in parity", async () => {
      const publishedA = journey.page.waitForResponse((response) => response.url() === `${apiBaseURL}/api/site-projects/${journey.projectId}/publish` && response.request().method() === "POST" && response.status() === 200);
      await journey.page.getByRole("button", { name: "انتشار نسخه", exact: true }).click();
      await publishedA;
      await expect(journey.page.getByText("نسخه منتشرشده با موفقیت ایجاد شد.")).toBeVisible();

      await journey.page.goto(`/store/${journey.projectId}`);
      await expect(journey.page.locator('[data-storefront-renderer="store-studio-v16"]')).toBeVisible();
      await expect(journey.page.getByRole("heading", { name: "قهرمان فارسی فروشگاه", exact: true })).toBeVisible();
      const versionA = await journey.page.locator("main[data-published-version-id]").getAttribute("data-published-version-id");
      expect(versionA).toBeTruthy();

      await openStudio(journey.page);
      await journey.page.getByRole("heading", { name: "قهرمان فارسی فروشگاه", exact: true }).click();
      await journey.page.getByLabel("عنوان", { exact: true }).fill("پیش‌نویس منتشرنشده ب");
      const savedB = journey.page.waitForResponse((response) => response.url() === `${apiBaseURL}/api/site-projects/${journey.projectId}` && response.request().method() === "PATCH" && response.status() === 200);
      await journey.page.getByRole("button", { name: "ذخیره", exact: true }).click();
      await savedB;
      await journey.page.getByRole("button", { name: "پیش‌نمایش پیش‌نویس", exact: true }).click();
      await expect(journey.page.locator('[data-canvas-interactive="false"]').getByRole("heading", { name: "پیش‌نویس منتشرنشده ب", exact: true })).toBeVisible();
      await expect(journey.page.locator('[data-canvas-interactive="false"] [data-hero-layout="background"]')).toBeVisible();
      await journey.page.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();

      await journey.page.goto(`/store/${journey.projectId}`);
      await expect(journey.page.getByRole("heading", { name: "قهرمان فارسی فروشگاه", exact: true })).toBeVisible();
      await expect(journey.page.getByText("پیش‌نویس منتشرنشده ب")).toHaveCount(0);

      await openStudio(journey.page);
      const publishedB = journey.page.waitForResponse((response) => response.url() === `${apiBaseURL}/api/site-projects/${journey.projectId}/publish` && response.status() === 200);
      await journey.page.getByRole("button", { name: "انتشار نسخه", exact: true }).click();
      await publishedB;
      await journey.page.goto(`/store/${journey.projectId}`);
      await expect(journey.page.getByRole("heading", { name: "پیش‌نویس منتشرنشده ب", exact: true })).toBeVisible();

      await expectJsonOk(await journey.api.post(`/api/site-projects/${journey.projectId}/publish-rollback`, { data: { targetVersionId: versionA } }));
      await journey.page.reload();
      await expect(journey.page.getByRole("heading", { name: "قهرمان فارسی فروشگاه", exact: true })).toBeVisible();
      await journey.page.setViewportSize({ width: 390, height: 844 });
      const overflow = await journey.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await journey.page.setViewportSize({ width: 1280, height: 900 });
      await openStudio(journey.page);
    });

    await test.step("inline product validation sends no request", async () => {
      await journey.page.getByRole("button", { name: "+ افزودن محصول از کاتالوگ واقعی", exact: true }).click();
      await journey.page.getByRole("button", { name: "ساخت محصول جدید", exact: true }).click();
      const before = journey.network.filter(({ method, url }) => method === "POST" && url.endsWith(`/api/stores/${journey.projectId}/products`)).length;
      await journey.page.getByRole("button", { name: "ساخت و افزودن به فروشگاه", exact: true }).click();
      await expect(journey.page.getByRole("alert")).toBeVisible();
      const after = journey.network.filter(({ method, url }) => method === "POST" && url.endsWith(`/api/stores/${journey.projectId}/products`)).length;
      expect(after).toBe(before);
      await journey.page.reload();
      await expect(journey.page.locator('[data-studio-version="16"]')).toBeVisible();
    });

    await test.step("mobile 390x844 smoke has no horizontal overflow", async () => {
      await journey.page.setViewportSize({ width: 390, height: 844 });
      await journey.page.getByRole("button", { name: "موبایل", exact: true }).click();
      await expect(journey.page.locator('[data-preview-device="mobile"]')).toBeVisible();
      await expect(journey.page.getByRole("button", { name: "ذخیره", exact: true })).toBeVisible();
      const overflow = await journey.page.evaluate(() => ({
        body: document.body.scrollWidth - document.body.clientWidth,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(overflow.body).toBeLessThanOrEqual(1);
      expect(overflow.document).toBeLessThanOrEqual(1);
    });
  } finally {
    await finishJourney(journey, testInfo);
  }
});
