import { expect, request, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { createConfigFromTemplate, TEMPLATES } from "../../src/components/store-studio-v16/templates/registry";
import { EDITOR_ONLY } from "../support/editor-only-copy";

// Batch A, browser level: a website created from each starter and published AS-IS is what a visitor sees.
// It must read like a website (no instructions to the editor), keep its real content, skip optional sections
// that hold nothing yet, and still publish and render. The visitor-facing text is read from the real public SPA.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the starter-copy journey.");

const CASES: { id: string; route: string; label: RegExp; publicPath: (id: string) => string; absentTitles: string[] }[] = [
  { id: "medical-practice-v1", route: "/dashboard/websites/corporate", label: /کلینیک و پزشک/, publicPath: (id) => `/site/${id}`, absentTitles: ["تجربه مراجعان"] },
  { id: "legal-firm-v1", route: "/dashboard/websites/corporate", label: /موسسه حقوقی/, publicPath: (id) => `/site/${id}`, absentTitles: [] },
  { id: "education-center-v1", route: "/dashboard/websites/corporate", label: /مرکز آموزشی/, publicPath: (id) => `/site/${id}`, absentTitles: [] },
  { id: "corporate-company-v1", route: "/dashboard/websites/corporate", label: /شرکت حرفه‌ای/, publicPath: (id) => `/site/${id}`, absentTitles: ["مشتریان و شرکای ما"] },
  { id: "hybrid-business-v1", route: "/dashboard/websites/corporate", label: /کسب‌وکار ترکیبی/, publicPath: (id) => `/site/${id}`, absentTitles: [] },
  { id: "commerce-modern-v1", route: "/dashboard/websites/store", label: /Commerce Modern/, publicPath: (id) => `/store/${id}`, absentTitles: [] },
];

test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: "serial" });

let api: APIRequestContext;
let context: BrowserContext;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000); // the sign-in may have to wait out the OTP rate limit left by an earlier spec
  api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `091${String(Date.now()).slice(-8)}`;
  // send-otp is rate limited (5/min per IP); one sign-in serves every case below.
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Starter Copy E2E" } });
  for (let attempt = 0; sent.status() === 429 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, ((Number(sent.headers()["retry-after"]) || 60) + 1) * 1000));
    sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Starter Copy E2E" } });
  }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 900 } });
});

test.afterAll(async () => { await context?.close(); await api?.dispose(); });

for (const entry of CASES) {
  test(`${entry.id}: a starter published as-is shows no editor instructions and keeps its real content`, async () => {
    test.setTimeout(90_000);
    const template = TEMPLATES.find((candidate) => candidate.id === entry.id)!;
    const config = createConfigFromTemplate(template);
    const page = await context.newPage();
    try {
      await page.goto(`${entry.route}?new=1`);
      await page.getByRole("button", { name: entry.label }).first().click();
      const created = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects` && res.request().method() === "POST");
      await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
      const response = await created;
      expect(response.status()).toBe(201);
      const project = (await response.json()).project as { id: string };
      await expect(page.locator("[data-studio-header]")).toBeVisible();

      const published = await api.post(`/api/site-projects/${project.id}/publish`, { data: {} });
      expect(published.status(), "publishing a fresh starter still works").toBe(200);

      const visitor = await context.newPage();
      await visitor.goto(entry.publicPath(project.id));
      await expect(visitor.getByText(config.hero.title).first()).toBeVisible({ timeout: 20_000 });
      await visitor.waitForTimeout(800);
      const text = await visitor.locator("body").innerText();

      for (const [label, pattern] of EDITOR_ONLY) expect(text, `published ${entry.id} shows a ${label}`).not.toMatch(pattern);
      // The Store's empty image block used to tell visitors to "add an image with +"; that belongs to the Studio only.
      expect(text).not.toContain("از + همین");
      expect(text).not.toContain("تصویر کمپین شما");

      if (entry.id !== "commerce-modern-v1") {
        // Real content survives: the hero headline and the title of every enabled starter section are on the page.
                const enabledTitles = (config.pages?.length ? config.pages[0].sections : config.sections).filter((section) => section.enabled).map((section) => section.title);
        expect(enabledTitles.length).toBeGreaterThanOrEqual(4);
        for (const title of enabledTitles) expect(text, `${entry.id} lost its "${title}" section`).toContain(title);
        // Optional sections without content are not published as unfinished blocks.
        for (const title of entry.absentTitles) expect(text, `${entry.id} still publishes the empty "${title}" section`).not.toContain(title);
      }
      await visitor.close();
    } finally {
      await page.close();
    }
  });
}

test("a published store with an image-less banner does not tell visitors to add an image", async () => {
  test.setTimeout(60_000);
  // Same shape the Store journey creates through the API: a bare V16 document, so its banner and hero have no image yet.
  const created = await api.post("/api/site-projects", { data: { name: "فروشگاه بدون تصویر", siteType: "STORE", content: { storeBuilderV16: { version: 16 } } } });
  expect(created.status()).toBe(201);
  const projectId = (await created.json()).project.id as string;
  expect((await api.post(`/api/site-projects/${projectId}/publish`, { data: {} })).status()).toBe(200);
  const visitor = await context.newPage();
  try {
    await visitor.goto(`/store/${projectId}`);
    await expect(visitor.getByText("منتخب فروشگاه").first()).toBeVisible({ timeout: 20_000 });
    const text = await visitor.locator("body").innerText();
    expect(text).not.toContain("از + همین");
    expect(text).not.toContain("تصویر کمپین شما");
    // The Studio keeps its guidance: the same document opened for editing still says how to add the image.
    await visitor.goto(`/dashboard/websites/store?project=${projectId}`);
    await expect(visitor.locator("[data-studio-header]")).toBeVisible({ timeout: 20_000 });
    await expect(visitor.getByText(/از \+ همین/).first()).toBeVisible();
  } finally {
    await visitor.close();
  }
});

test("a disabled starter section can be turned on in the Studio, then saves, publishes and appears on the site and in its menu", async () => {
  test.setTimeout(90_000);
  const page = await context.newPage();
  try {
    await page.goto("/dashboard/websites/corporate?new=1");
    await page.getByRole("button", { name: /کلینیک و پزشک/ }).first().click();
    const created = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects` && res.request().method() === "POST");
    await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
    const projectId = ((await (await created).json()).project as { id: string }).id;
    await expect(page.locator("[data-studio-header]")).toBeVisible();

    // The starter publishes without the empty testimonials block.
    expect((await api.post(`/api/site-projects/${projectId}/publish`, { data: {} })).status()).toBe(200);
    const before = await context.newPage();
    await before.goto(`/site/${projectId}`);
    await expect(before.getByText("پزشکان ما").first()).toBeVisible({ timeout: 20_000 });
    expect(await before.locator("body").innerText()).not.toContain("تجربه مراجعان");
    await before.close();

    // The customer turns the section on in the Studio's section list and saves.
    // "تنظیمات دقیق" opens the Studio's tabs (sections, pages, design) for the customer.
    const sectionsTab = page.getByRole("button", { name: "بخش‌ها", exact: true });
    if (!(await sectionsTab.isVisible())) await page.getByText("تنظیمات دقیق").first().click();
    await sectionsTab.click();
    const row = page.locator("[data-studio-inspector]").locator("div").filter({ hasText: /^تجربه مراجعان/ }).filter({ has: page.getByRole("checkbox") }).last();
    const toggle = row.getByRole("checkbox").first();
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await page.getByRole("button", { name: "ذخیره", exact: true }).click();
    await expect(page.getByText("همه تغییرات ذخیره شده").first()).toBeVisible();

    // Published again, the section and its menu entry are there, and the rest of the page is unchanged.
    expect((await api.post(`/api/site-projects/${projectId}/publish`, { data: {} })).status()).toBe(200);
    const after = await context.newPage();
    await after.goto(`/site/${projectId}`);
    await expect(after.getByText("تجربه مراجعان").first()).toBeVisible({ timeout: 20_000 });
    await expect(after.getByRole("link", { name: "نظرات", exact: true }).first()).toBeVisible();
    for (const title of ["پزشکان ما", "خدمات کلینیک", "مسیر درمان", "درخواست نوبت"]) await expect(after.getByText(title).first()).toBeVisible();
    await after.close();
  } finally {
    await page.close();
  }
});
