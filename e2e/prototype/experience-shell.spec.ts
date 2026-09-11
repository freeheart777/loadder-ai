import { test, expect, type Page } from "@playwright/test";

/**
 * Browser proof for the dev-only Experience Shell.
 *
 * These are structural assertions about the approved Experience Map, not
 * snapshots of copy: which screen each answer reaches, that Home holds exactly
 * four zones in order, that direct tool access is never gated, that the
 * Decision Room is reachable from a detail view and nowhere else, and that no
 * screen renders a module sidebar.
 *
 * Requires a dev server (the shell is excluded from production builds):
 *   E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/prototype
 *
 * PW_CHROMIUM_PATH is an escape hatch for sandboxes that ship a browser
 * Playwright did not install; CI leaves it unset and uses its own.
 */
const executablePath = process.env.PW_CHROMIUM_PATH;
if (executablePath) test.use({ launchOptions: { executablePath } });

const ROUTE = "/prototype/experience-shell";

const ZONES = ["به شما نیاز دارد", "در جریان", "چیزی که یاد گرفته‌ام", "ابزارهای شما"];

async function open(page: Page, screen?: string) {
  // "commit", not the default "load": with no API server behind the dev proxy a
  // pending auth request can hold the load event open indefinitely. The
  // retrying visibility check below is what actually waits for the render.
  await page.goto(screen ? `${ROUTE}?screen=${screen}` : ROUTE, { waitUntil: "commit" });
  await expect(page.locator("[data-shell-screen]")).toBeVisible();
}

test.describe("experience shell", () => {
  test("first entry admits it knows nothing and offers three answers", async ({ page }) => {
    await open(page);
    await expect(page.locator("[data-shell-screen]")).toHaveAttribute("data-shell-screen", "entry");
    await expect(page.locator("[data-shell-title]")).toHaveText("هنوز چیزی درباره کسب‌وکار شما نمی‌دانم.");
    await expect(page.locator("[data-shell-path]")).toHaveCount(3);
  });

  test("«می‌دانم چه لازم دارم» reaches capabilities directly", async ({ page }) => {
    await open(page);
    await page.locator('[data-shell-path="tools"]').click();
    await expect(page.locator("[data-shell-screen]")).toHaveAttribute("data-shell-screen", "tools");
    const tools = page.locator("[data-shell-tool]");
    await expect(tools).toHaveCount(12);
    // Nothing on the way: no decision was asked before the tools appeared.
    await expect(page.locator("[data-shell-attention]")).toHaveCount(0);
  });

  test("«یک مشکل دارم» reaches Home", async ({ page }) => {
    await open(page);
    await page.locator('[data-shell-path="home"]').click();
    await expect(page.locator("[data-shell-screen]")).toHaveAttribute("data-shell-screen", "home");
  });

  test("«نمی‌دانم» reaches the growth path, which then hands over to Home", async ({ page }) => {
    await open(page);
    await page.locator('[data-shell-path="growth"]').click();
    await expect(page.locator("[data-shell-screen]")).toHaveAttribute("data-shell-screen", "growth");
    await expect(page.locator("[data-shell-step]")).toHaveCount(3);
    await page.locator("[data-shell-to-home]").click();
    await expect(page.locator("[data-shell-screen]")).toHaveAttribute("data-shell-screen", "home");
  });

  test("Home holds exactly the four zones, in order", async ({ page }) => {
    await open(page, "home");
    const zones = page.locator("[data-shell-zone]");
    await expect(zones).toHaveCount(4);
    for (const [index, label] of ZONES.entries()) {
      await expect(zones.nth(index)).toHaveAttribute("data-shell-zone", label);
    }
  });

  test("no tool is the primary experience: tools sit last, under the decision", async ({ page }) => {
    await open(page, "home");
    const attention = await page.locator("[data-shell-attention]").boundingBox();
    const firstTool = await page.locator("[data-shell-tool]").first().boundingBox();
    expect(attention).not.toBeNull();
    expect(firstTool).not.toBeNull();
    expect(firstTool!.y).toBeGreaterThan(attention!.y);
  });

  test("direct access survives inside Home: zone four is the same ungated grid", async ({ page }) => {
    await open(page, "home");
    await expect(page.locator("[data-shell-tool]")).toHaveCount(12);
    await expect(page.locator('[data-shell-tool="/dashboard/crm"]')).toHaveAttribute("href", "/dashboard/crm");
  });

  test("the Brain is a static entry point that asks for nothing", async ({ page }) => {
    await open(page, "home");
    await page.locator("[data-shell-brain-entry]").click();
    await expect(page.locator("[data-shell-screen]")).toHaveAttribute("data-shell-screen", "brain");
    // A place to look: no decision, and no way on to anything that asks for one.
    await expect(page.locator("[data-shell-attention]")).toHaveCount(0);
    await expect(page.locator("[data-shell-past-decisions]")).toHaveCount(0);
  });

  test("the Decision Room is reachable from detail and from nowhere else", async ({ page }) => {
    for (const screen of ["entry", "tools", "growth", "home", "brain"]) {
      await open(page, screen);
      await expect(page.locator("[data-shell-past-decisions]")).toHaveCount(0);
    }
    await open(page, "home");
    await page.locator("[data-shell-why]").click();
    await expect(page.locator("[data-shell-screen]")).toHaveAttribute("data-shell-screen", "detail");
    const link = page.locator("[data-shell-past-decisions]");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/dashboard/growth-loop/experiment-1");
  });

  test("no screen renders a module sidebar", async ({ page }) => {
    for (const screen of ["entry", "tools", "growth", "home", "detail", "brain"]) {
      await open(page, screen);
      await expect(page.locator("aside")).toHaveCount(0);
      await expect(page.locator("nav")).toHaveCount(0);
      // One step back is the whole of the navigation.
      await expect(page.locator("[data-shell-back]")).toHaveCount(screen === "entry" ? 0 : 1);
    }
  });

  test("every screen fits its viewport at desktop and phone width", async ({ page }) => {
    for (const size of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      for (const screen of ["entry", "tools", "growth", "home", "detail", "brain"]) {
        await open(page, screen);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${screen} at ${size.width}px`).toBe(0);
      }
    }
  });
});
