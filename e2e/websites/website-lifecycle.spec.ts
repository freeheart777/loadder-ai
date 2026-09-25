import { expect, request, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { businessLaunchTemplates } from "../../src/components/store-studio-v16/templates/business-launch-v1";

// Website Builder V16 lifecycle, for every shipped template:
// open Studio → apply template → save → edit → section add/move/copy/delete →
// save → draft preview (3 devices) → shareable preview link → publish →
// public /s/:slug URL at desktop / tablet / mobile widths.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the website lifecycle journey.");

type Case = { route: string; label: string; heroTitle: string; sectionTitles: string[]; commerce: boolean };
const cases: Case[] = [
  ...businessLaunchTemplates.map((template) => ({
    route: "/dashboard/websites/corporate",
    label: template.label,
    heroTitle: String(template.hero?.title || ""),
    sectionTitles: template.sections.map((section) => section.title).filter(Boolean),
    commerce: false,
  })),
  {
    route: "/dashboard/websites",
    label: "Loadder Commerce Modern V1",
    heroTitle: "کالای مورد نظرتان را با بهترین قیمت پیدا کنید",
    sectionTitles: ["فروش شگفت‌انگیز", "دسته‌بندی‌های پرطرفدار"],
    commerce: true,
  },
];

test.use({ actionTimeout: 10_000 });

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function signIn(browser: Browser, testInfo: TestInfo) {
  const api = await request.newContext({ baseURL: apiBaseURL });
  const identity = `${Date.now()}${testInfo.workerIndex}${Math.floor(Math.random() * 1e6)}`;
  const mobile = `091${identity.slice(-8).padStart(8, "0")}`;
  // send-otp is rate limited (5/min per IP); five templates sign in back to back.
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Website Lifecycle E2E" } });
  for (let attempt = 0; sent.status() === 429 && attempt < 3; attempt += 1) {
    const retryAfter = Number(sent.headers()["retry-after"]) || 60;
    await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
    sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Website Lifecycle E2E" } });
  }
  const otp = await sent.json();
  expect(otp.developmentOtp).toMatch(/^\d+$/);
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  const context = await browser.newContext({ storageState: await api.storageState() });
  await api.dispose();
  return context;
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 500) problems.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`); });
  return problems;
}

async function brokenImages(page: Page, scope = "body") {
  return page.locator(`${scope} img`).evaluateAll((images) => images
    .filter((img) => (img as HTMLImageElement).getAttribute("src"))
    .filter((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth === 0)
    .map((img) => (img as HTMLImageElement).getAttribute("src")));
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function saveDraft(page: Page) {
  const saved = page.waitForResponse((response) => response.url().startsWith(`${apiBaseURL}/api/site-projects/`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  expect((await saved).status()).toBe(200);
}

// Select a section itself (not its inline-editable heading) by clicking the
// section container's corner, then wait for the editor to mark it selected.
async function selectSection(page: Page, title: string) {
  const section = page.locator(SECTION_ELEMENTS, { has: page.getByRole("heading", { name: title, exact: true }) }).first();
  await section.click({ position: { x: 6, y: 6 } });
  await expect(section).toHaveAttribute("data-editor-selected", "true");
}

// Page sections only (not the hero, header or product cards), in canvas order.
const SECTION_ELEMENTS = '[data-canvas-interactive="true"] :is([data-editor-element="section"], [data-editor-element="banner"], [data-editor-element="trust"])';
// Each section's own title is its first h2/h3 (corporate sections use h2, store sections h3).
const sectionTitlesInOrder = (page: Page) => page.locator(SECTION_ELEMENTS).evaluateAll((sections) => sections
  .map((section) => (section.querySelector("h2, h3") as HTMLElement | null)?.innerText.trim() || "")
  .filter(Boolean));

for (const scenario of cases) {
  test(`${scenario.label}: template → edit → preview → publish → /s/:slug`, async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const context = await signIn(browser, testInfo);
    const page = await context.newPage();
    const problems = watch(page);
    try {
      // Open Studio: the project is created on entry, the canvas is editable.
      console.log(`[step] ${scenario.label} → open studio`);
      await page.goto(scenario.route);
      await expect(page.locator('[data-studio-version="16"]')).toBeVisible();
      // Store-only shortcuts and pages exist only on a commerce site.
      await expect(page.getByRole("button", { name: "تخفیف‌ها" })).toHaveCount(scenario.commerce ? 1 : 0);
      await expect(page.getByRole("button", { name: "بنر", exact: true })).toHaveCount(scenario.commerce ? 1 : 0);
      await expect(page.locator("option", { hasText: "سبد خرید" })).toHaveCount(scenario.commerce ? 1 : 0);

      // Apply the template, then persist it.
      console.log(`[step] ${scenario.label} → apply template`);
      await page.getByRole("button", { name: "قالب‌ها", exact: true }).click();
      await page.getByRole("button", { name: new RegExp(scenario.label) }).first().click();
      await saveDraft(page);
      const canvas = page.locator('[data-canvas-interactive="true"]');
      await expect(canvas.getByText(scenario.heroTitle, { exact: true }).first()).toBeVisible();
      for (const title of scenario.sectionTitles) await expect(canvas.getByText(title, { exact: true }).first(), `section "${title}"`).toBeVisible();
      expect(await brokenImages(page, '[data-canvas-interactive="true"]'), "no broken template images").toEqual([]);

      // Edit the hero title through the inspector.
      console.log(`[step] ${scenario.label} → edit hero`);
      const newTitle = `عنوان تازه ${Date.now()}`;
      await canvas.getByText(scenario.heroTitle, { exact: true }).first().click();
      await page.getByLabel("عنوان", { exact: true }).fill(newTitle);
      await expect(canvas.getByText(newTitle, { exact: true }).first()).toBeVisible();

      // Section operations on the first titled section: move down, copy, delete, insert.
      console.log(`[step] ${scenario.label} → section operations`);
      const before = await sectionTitlesInOrder(page);
      expect(before.length).toBeGreaterThan(1);
      const first = before[0];
      await selectSection(page, first);
      await page.getByTitle("پایین‌تر").first().click();
      const moved = await sectionTitlesInOrder(page);
      expect(moved.indexOf(first), "section moved down").toBe(1);
      await selectSection(page, first);
      await page.getByTitle("کپی").first().click();
      // A copy is titled "<title> (کپی)" and becomes the selected section.
      const copyTitle = `${first} (کپی)`;
      await expect.poll(async () => (await sectionTitlesInOrder(page)).includes(copyTitle), { message: "section copied" }).toBe(true);
      await expect(page.locator(SECTION_ELEMENTS, { has: page.getByRole("heading", { name: copyTitle, exact: true }) })).toHaveAttribute("data-editor-selected", "true");
      await page.getByTitle("حذف").first().click();
      await expect.poll(async () => (await sectionTitlesInOrder(page)).includes(copyTitle), { message: "copy deleted" }).toBe(false);
      expect(await sectionTitlesInOrder(page), "back to the moved order").toEqual(moved);
      const countBeforeInsert = await page.locator(SECTION_ELEMENTS).count();
      await page.getByRole("button", { name: "افزودن بخش در این نقطه" }).first().click();
      await page.locator('[aria-expanded="true"] + div button, [aria-expanded="true"] ~ div button').first().click();
      await expect.poll(() => page.locator(SECTION_ELEMENTS).count(), { message: "section inserted" }).toBe(countBeforeInsert + 1);
      await saveDraft(page);

      // Draft preview: non-interactive canvas, all three devices.
      console.log(`[step] ${scenario.label} → draft preview`);
      await page.getByRole("button", { name: "پیش‌نمایش پیش‌نویس", exact: true }).click();
      const preview = page.locator('[data-canvas-interactive="false"]');
      await expect(preview.getByText(newTitle, { exact: true }).first()).toBeVisible();
      for (const [label] of [["دسکتاپ"], ["تبلت"], ["موبایل"]]) {
        await page.locator("[data-draft-preview]").getByRole("button", { name: label, exact: true }).click();
        await expect(preview.getByText(newTitle, { exact: true }).first()).toBeVisible();
      }

      // Shareable server-rendered preview link.
      console.log(`[step] ${scenario.label} → preview link`);
      await page.getByRole("button", { name: "ساخت لینک پیش‌نمایش", exact: true }).click();
      const previewHref = await page.locator("[data-preview-link]").getAttribute("href");
      expect(previewHref).toMatch(/\/preview\/sites\/[^/?]+\?token=/);
      const previewPage = await context.newPage();
      const previewResponse = await previewPage.goto(previewHref!);
      expect(previewResponse?.status()).toBe(200);
      await expect(previewPage.getByText(newTitle).first()).toBeVisible();
      await previewPage.close();
      await page.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();

      // Publish and open the user-facing URL.
      console.log(`[step] ${scenario.label} → publish`);
      const published = page.waitForResponse((response) => response.url().endsWith("/publish") && response.request().method() === "POST");
      await page.getByRole("button", { name: "انتشار نسخه", exact: true }).click();
      expect((await published).status()).toBe(200);
      const publicLink = page.locator("[data-public-url] a");
      await expect(publicLink).toBeVisible();
      const publicUrl = await publicLink.getAttribute("href");
      expect(publicUrl).toMatch(/\/s\/[^/]+$/);

      const site = await context.newPage();
      const siteProblems = watch(site);
      for (const viewport of viewports) {
        await site.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await site.goto(publicUrl!);
        expect(response?.status(), `public site ${viewport.name}`).toBe(200);
        await expect(site.getByText(newTitle).first()).toBeVisible();
        expect(await horizontalOverflow(site), `no horizontal scroll on ${viewport.name}`).toBeLessThanOrEqual(1);
        expect(await brokenImages(site), `no broken images on ${viewport.name}`).toEqual([]);
        await site.screenshot({ path: testInfo.outputPath(`public-${viewport.name}.png`), fullPage: true });
      }
      await site.close();

      // Studio canvas at the three device widths.
      console.log(`[step] ${scenario.label} → studio responsive`);
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await expect(canvas.getByText(newTitle, { exact: true }).first()).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`studio-${viewport.name}.png`) });
      }
      expect([...problems, ...siteProblems], "no console errors, page errors or 5xx").toEqual([]);
    } finally {
      await context.close();
    }
  });
}
