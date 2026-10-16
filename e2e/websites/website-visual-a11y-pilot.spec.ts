import AxeBuilder from "@axe-core/playwright";
import { expect, request, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

// Pilot: visual regression + accessibility for the published Medical and Hybrid starters, created from the real
// template picker and published as-is. Baselines live next to this file (…-snapshots/) and were generated only
// after the pages were reviewed by eye. They are platform specific (Playwright suffixes them with the OS), so CI on
// another OS needs its own baselines: regenerate with `--update-snapshots` ONLY after reviewing the new pages.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the visual/accessibility pilot.");

const SITES = [
  { key: "medical", label: /کلینیک و پزشک/ },
  { key: "hybrid", label: /کسب‌وکار ترکیبی/ },
] as const;
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

// KNOWN ISSUE (found by this pilot, not fixed in Batch A because the renderer is out of that batch's scope):
// the subtitle of the call-to-action banner is the section text colour at 80% opacity on the brand colour, which
// measures 4.13:1 (Medical) and 3.81:1 (Hybrid) against the 4.5:1 WCAG AA minimum. It is the ONLY tolerated finding.
// The expected-fail test at the bottom flips to red the day the contrast is fixed, as the reminder to delete this entry.
const KNOWN_CONTRAST_TARGET = ".opacity-80.mt-2";

test.use({ actionTimeout: 15_000 });

let api: APIRequestContext;
let context: BrowserContext;
const published: Record<string, string> = {};

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `090${String(Date.now()).slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Visual Pilot E2E" } });
  for (let attempt = 0; sent.status() === 429 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, ((Number(sent.headers()["retry-after"]) || 60) + 1) * 1000));
    sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Visual Pilot E2E" } });
  }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  context = await browser.newContext({ storageState: await api.storageState(), viewport: VIEWPORTS.desktop });
  for (const site of SITES) {
    const page = await context.newPage();
    await page.goto("/dashboard/websites/corporate?new=1");
    await page.getByRole("button", { name: site.label }).first().click();
    const created = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects` && res.request().method() === "POST");
    await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
    const projectId = ((await (await created).json()).project as { id: string }).id;
    await expect(page.locator("[data-studio-header]")).toBeVisible();
    expect((await api.post(`/api/site-projects/${projectId}/publish`, { data: {} })).status()).toBe(200);
    published[site.key] = projectId;
    await page.close();
  }
});

test.afterAll(async () => { await context?.close(); await api?.dispose(); });

// A page is "ready" when its web fonts and every image have finished loading, so a screenshot never captures a half-painted page.
async function openReady(page: Page, projectId: string) {
  await page.goto(`/site/${projectId}`);
  await expect(page.locator("footer").first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => { img.addEventListener("load", resolve); img.addEventListener("error", resolve); }))));
  });
  expect(await page.evaluate(() => [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length), "broken images").toBe(0);
  await page.waitForTimeout(400);
}

for (const site of SITES) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test(`${site.key} starter, ${viewportName}: visual baseline, no horizontal overflow, no serious accessibility violations`, async () => {
      test.setTimeout(90_000);
      const page = await context.newPage();
      try {
        await page.setViewportSize(viewport);
        await openReady(page, published[site.key]);

        // Layout sanity first: a clipped or overflowing page must fail loudly, whatever the pixels say.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "horizontal overflow").toBeLessThanOrEqual(0);

        // Accessibility: WCAG 2.0/2.1 A and AA. Serious and critical findings fail the test; the rest is listed for the report.
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
        const blocking = serious.map((violation) => ({ ...violation, nodes: violation.nodes.filter((node) => !(violation.id === "color-contrast" && node.target.join(" ") === KNOWN_CONTRAST_TARGET)) })).filter((violation) => violation.nodes.length > 0);
        test.info().annotations.push({ type: "axe", description: JSON.stringify(results.violations.map((violation) => `${violation.impact}:${violation.id}×${violation.nodes.length}`)) });
        expect(blocking.map((violation) => `${violation.impact}:${violation.id}×${violation.nodes.length} ${violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} :: ${(node.any[0]?.message ?? node.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 170)}`).join(" || ")}`), "serious/critical accessibility violations").toEqual([]);

        // Visual regression: the whole published page. Tolerance absorbs anti-aliasing only; a layout or copy change must be reviewed.
        await expect(page).toHaveScreenshot(`${site.key}-${viewportName}.png`, { fullPage: true, maxDiffPixelRatio: 0.005, animations: "disabled" });
      } finally {
        await page.close();
      }
    });
  }
}

test("KNOWN ISSUE: the call-to-action subtitle meets WCAG AA contrast (expected to fail until the renderer is fixed)", async () => {
  test.fail(true, "CTA subtitle uses 80% opacity: 4.13:1 on Medical and 3.81:1 on Hybrid, below the 4.5:1 minimum. Fix the contrast, then delete KNOWN_CONTRAST_TARGET and this test.");
  const page = await context.newPage();
  try {
    await page.setViewportSize(VIEWPORTS.desktop);
    for (const site of SITES) {
      await openReady(page, published[site.key]);
      const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(results.violations.flatMap((violation) => violation.nodes.map((node) => node.target.join(" "))), `${site.key} contrast`).toEqual([]);
    }
  } finally {
    await page.close();
  }
});
