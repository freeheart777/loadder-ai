import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Home V2 — production surface.
 *
 * Structural assertions about the approved Home: the entry's three answers and
 * where each lands, the four zones and their order, tools reachable without
 * passing anything, the empty first zone reading as a starting point rather
 * than a shortage, phone width, and no canonical token reaching the screen.
 *
 * Every response is stubbed at the network boundary, so the suite proves the
 * surface without a server and without touching one. The app must be served
 * with its API on the page's own origin, or the browser discards the stubbed
 * credentialed responses as cross-origin and the session never resolves:
 *
 *   VITE_API_BASE_URL=http://localhost:5173 npx vite --port 5173
 *   E2E_BASE_URL=http://localhost:5173 npx playwright test e2e/home
 *

 * PW_CHROMIUM_PATH is an escape hatch for sandboxes that ship a browser
 * Playwright did not install; CI leaves it unset and uses its own.
 */
const executablePath = process.env.PW_CHROMIUM_PATH;
if (executablePath) test.use({ launchOptions: { executablePath } });

const ZONES = ["به شما نیاز دارد", "در جریان", "تازه‌ترین چیزی که دیدم", "ابزارهای شما"];

const IDENTITY = {
  user: { id: "user-1", name: "آزاده", mobile: "", email: null, status: "active" },
  memberships: [{ id: "m-1", role: "member", status: "active", workspace: { id: "w-1", name: "آزمایش", slug: "test", status: "active" } }],
  activeWorkspace: { id: "w-1", name: "آزمایش", slug: "test", status: "active" },
};

const ATTENTION_ITEM = {
  signalId: "EXPERIMENT_WINDOW_CLOSED_NO_DECISION",
  band: "DECIDE_TODAY",
  facts: [
    { label: "DECISION_STATE", value: "DEFERRED", sourceRef: { type: "TEST", id: "f-1" } },
    { label: "MEASUREMENT_WINDOW_ENDED_AT", value: "2026-09-09T10:00:00.000Z", sourceRef: { type: "TEST", id: "f-2" } },
  ],
  beliefs: [],
  unknown: ["CAUSALITY"],
  action: { label: "REVIEW_EXPERIMENT_OUTCOME", requiredApproval: "HUMAN_REVIEW", executable: false, deepLink: "/dashboard/growth-loop/experiment-1" },
  explainability: {},
  whyThisIsHere: "MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION",
};

const SECOND_ITEM = { ...ATTENTION_ITEM, band: "REVIEW", signalId: "CONTENT_CANDIDATE_STUCK" };

type Options = { items?: unknown[]; runs?: unknown[]; findings?: unknown[]; failAttention?: boolean; failFindings?: boolean };

/**
 * The app talks to its API on another origin with credentials, so a stubbed
 * response needs the CORS headers a real one would carry. Without them the
 * browser discards the body and the session never resolves.
 */
function reply(route: Route, body: unknown, status = 200) {
  const origin = new URL(route.request().frame().page().url() || "http://localhost").origin;
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
    },
    body: JSON.stringify(body),
  });
}

async function stub(page: Page, options: Options = {}) {
  const { items = [ATTENTION_ITEM, SECOND_ITEM], runs = [], findings = [], failAttention = false, failFindings = false } = options;
  // One route that dispatches by path, so there is no question about which of
  // several overlapping patterns Playwright picks.
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return reply(route, IDENTITY);
    if (path === "/api/mission-control") {
      return failAttention
        ? reply(route, { success: false }, 503)
        : reply(route, { success: true, missionControl: { contractVersion: 1, generatedAt: "2026-09-09T12:00:00.000Z", items, banners: [], signalStatus: [], bounds: { maxItems: 7, truncated: false } } });
    }
    if (path === "/api/growth/copilot/runs") return reply(route, { success: true, items: runs });
    if (path === "/api/intelligence/semantic/findings") return failFindings ? reply(route, { success: false }, 503) : reply(route, { success: true, findings });
    return reply(route, { success: true });
  });
}

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

test.describe("home", () => {
  test("the entry asks one question and offers three answers", async ({ page }) => {
    await stub(page);
    await open(page, "/start");
    await expect(page.locator("[data-start-title]")).toHaveText("هنوز چیزی درباره کسب‌وکار شما نمی‌دانم.");
    await expect(page.locator("[data-start-path]")).toHaveCount(3);
  });

  test("«می‌دانم چه لازم دارم» reaches a capability without passing through Home", async ({ page }) => {
    await stub(page);
    await open(page, "/start");
    await page.locator('[data-start-path="tools"]').click();
    await expect(page.locator("[data-start-tool]")).toHaveCount(12);
    await expect(page.locator('[data-start-tool="/dashboard/crm"]')).toHaveAttribute("href", "/dashboard/crm");
    await expect(page.locator("[data-zone]")).toHaveCount(0);
  });

  test("the other two answers reach Home", async ({ page }) => {
    await stub(page);
    await open(page, "/start");
    await page.locator('[data-start-path="home"]').first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-zone]").first()).toBeVisible();
  });

  test("Home holds exactly the four zones, in order", async ({ page }) => {
    await stub(page);
    await open(page, "/dashboard");
    const zones = page.locator("[data-zone]");
    await expect(zones).toHaveCount(4);
    for (const [index, label] of ZONES.entries()) {
      await expect(zones.nth(index)).toHaveAttribute("data-zone", label);
    }
  });

  test("zone one shows one item, with depth behind «چرا» and the rest one click away", async ({ page }) => {
    await stub(page);
    await open(page, "/dashboard");
    await expect(page.locator("[data-attention-item]")).toHaveCount(1);
    await expect(page.locator("[data-attention-action]")).toHaveAttribute("href", "/dashboard/growth-loop/experiment-1");
    await expect(page.locator("[data-attention-why]")).toBeVisible();
    await expect(page.locator("[data-attention-more]")).toHaveAttribute("href", "/dashboard/attention");
  });

  test("an empty zone one reads as a starting point, not a shortage", async ({ page }) => {
    await stub(page, { items: [] });
    await open(page, "/dashboard");
    const empty = page.locator("[data-attention-unknown-state]");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("هنوز چیزی درباره کسب‌وکار شما نمی‌دانم.");
    await expect(page.locator("[data-first-action]")).toHaveCount(3);
    await expect(page.locator('[data-first-action="/dashboard/websites"]')).toHaveAttribute("href", "/dashboard/websites");
    for (const banned of ["داده", "موجود نیست", "راه‌اندازی", "خطا"]) {
      expect(await empty.innerText()).not.toContain(banned);
    }
  });

  test("zone two excludes prepared human-review work even when zone one has the same business problem", async ({ page }) => {
    await stub(page, {
      runs: [
        { id: "r-1", capability: "CREATE_CONTENT_VARIANT", status: "PREPARED", createdAt: "2026-09-08T10:00:00.000Z" },
        { id: "r-2", capability: "CREATE_CONTENT_VARIANT", status: "SUCCEEDED", createdAt: "2026-09-07T10:00:00.000Z" },
      ],
    });
    await open(page, "/dashboard");
    await expect(page.locator("[data-attention-item]")).toHaveCount(1);
    await expect(page.locator('[data-zone="در جریان"]')).toContainText("الان کاری در جریان نیست");
    await expect(page.locator("[data-progress-row]")).toHaveCount(0);
    await expect(page.locator("progress, [role=progressbar]")).toHaveCount(0);
  });

  test("zone three states a recorded finding and its limit, including not knowing yet", async ({ page }) => {
    await stub(page, {
      findings: [
        { id: "f-1", semanticType: "listening_attention_state", state: "RISING", calculatedAt: "2026-09-08T10:00:00.000Z", confidence: null },
        { id: "f-2", semanticType: "competitive_visibility_state", state: "INSUFFICIENT_EVIDENCE", calculatedAt: "2026-09-08T10:00:00.000Z", confidence: null },
        { id: "f-3", semanticType: "unregistered_type", state: "WHATEVER", calculatedAt: null, confidence: null },
      ],
    });
    await open(page, "/dashboard");
    const rows = page.locator("[data-learned-row]");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("بیشتر شده");
    await expect(rows.nth(1)).toContainText("هنوز برای گفتنش کافی نمی‌دانم");
    await expect(page.locator('[data-zone="تازه‌ترین چیزی که دیدم"]')).toContainText("دلیلش را نمی‌دانم");
  });

  test("tools stay reachable and stay below the decision", async ({ page }) => {
    await stub(page);
    await open(page, "/dashboard");
    await expect(page.locator("[data-home-tool]")).toHaveCount(12);
    await expect(page.locator('[data-home-tool="/dashboard/ads"]')).toHaveAttribute("href", "/dashboard/ads");
    const attention = await page.locator("[data-attention-item]").boundingBox();
    const firstTool = await page.locator("[data-home-tool]").first().boundingBox();
    expect(firstTool!.y).toBeGreaterThan(attention!.y);
  });

  test("a failing zone dims itself and leaves the rest of Home usable", async ({ page }) => {
    await stub(page, { failAttention: true, runs: [{ id: "r-1", capability: "CREATE_CONTENT_VARIANT", status: "PREPARED", createdAt: null }] });
    await open(page, "/dashboard");
    await expect(page.locator('[data-zone="به شما نیاز دارد"]')).toContainText("در دسترس نیست");
    await expect(page.locator('[data-zone="در جریان"]')).toContainText("الان کاری در جریان نیست");
    await expect(page.locator("[data-home-tool]")).toHaveCount(12);
  });

  test("all unavailable read sources remain visibly unavailable", async ({ page }) => {
    await stub(page, { failAttention: true, failFindings: true });
    await open(page, "/dashboard");
    await expect(page.locator('[data-zone="به شما نیاز دارد"]')).toContainText("در دسترس نیست");
    await expect(page.locator('[data-zone="تازه‌ترین چیزی که دیدم"]')).toContainText("در دسترس نیست");
    await expect(page.locator('[data-zone="در جریان"]')).toContainText("الان کاری در جریان نیست");
  });

  test("navigation is Home, Tools and Account, with no module sidebar", async ({ page }) => {
    await stub(page);
    await open(page, "/dashboard");
    await expect(page.locator("aside")).toHaveCount(0);
    await expect(page.locator("[data-nav]")).toHaveCount(3);
    await page.locator('[data-nav="account"]').click();
    await expect(page.locator("[data-account-panel]")).toBeVisible();
    await expect(page.locator("[data-account-signout]")).toBeVisible();
  });

  test("no canonical token reaches the screen", async ({ page }) => {
    await stub(page, {
      runs: [{ id: "r-1", capability: "CREATE_CONTENT_VARIANT", status: "PREPARED", createdAt: "2026-09-08T10:00:00.000Z" }],
      findings: [{ id: "f-1", semanticType: "listening_attention_state", state: "RISING", calculatedAt: "2026-09-08T10:00:00.000Z", confidence: null }],
    });
    await open(page, "/dashboard");
    await expect(page.locator("[data-attention-item]")).toBeVisible();
    await page.locator("[data-attention-why] summary").click();
    const body = await page.locator("body").innerText();
    for (const token of [
      "DECIDE_TODAY", "EXPERIMENT_WINDOW_CLOSED_NO_DECISION", "DEFERRED", "CAUSALITY",
      "REVIEW_EXPERIMENT_OUTCOME", "CREATE_CONTENT_VARIANT", "PREPARED",
      "listening_attention_state", "RISING", "Mission Control", "Business Brain",
    ]) {
      expect(body, token).not.toContain(token);
    }
    expect(body.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? []).toEqual([]);
  });

  test("Home and the entry fit a 390px phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stub(page, {
      runs: [{ id: "r-1", capability: "CREATE_CONTENT_VARIANT", status: "PREPARED", createdAt: "2026-09-08T10:00:00.000Z" }],
      findings: [{ id: "f-1", semanticType: "listening_attention_state", state: "RISING", calculatedAt: "2026-09-08T10:00:00.000Z", confidence: null }],
    });
    for (const path of ["/start", "/start?view=tools", "/dashboard", "/dashboard/attention"]) {
      await open(page, path);
      await expect(page.locator("[data-home-chrome]")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});
