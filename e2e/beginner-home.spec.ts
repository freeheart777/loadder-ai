import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Beginner Home V1 acceptance.
 *
 * Runs against the Vite dev build, where beginner_home_v1 defaults ON. The
 * legacy branch is proven from the same build with ?beginner_home_v1=0.
 */

const IDENTITY = {
  user: { id: "user-1", name: "مریم رستمی", mobile: "", email: null, status: "active" },
  memberships: [{ id: "m-1", role: "owner", status: "active", workspace: { id: "w-1", name: "کارگاه", slug: "w", status: "active" } }],
  activeWorkspace: { id: "w-1", name: "کارگاه", slug: "w", status: "active" },
};

const fact = (label: string, value: string, id = "f-1") => ({ label, value, sourceRef: { type: "TEST", id } });

function item(signalId: string, index: number, deepLink: string, band = "REVIEW") {
  return {
    signalId,
    band,
    facts:
      signalId === "EXPERIMENT_WINDOW_CLOSED_NO_DECISION"
        ? [fact("EXPERIMENT_STATUS", "COMPLETED", `s-${index}`), fact("MEASUREMENT_WINDOW_ENDED_AT", "2026-09-01T10:00:00.000Z", `w-${index}`), fact("DECISION_STATE", "NO_DECISION", `d-${index}`)]
        : [fact("CANDIDATE_STATE", "RECONCILIATION_REQUIRED", `c-${index}`), fact("CREATED_AT", "2026-09-02T08:00:00.000Z", `t-${index}`)],
    beliefs: [],
    unknown: signalId === "EXPERIMENT_WINDOW_CLOSED_NO_DECISION" ? ["CAUSALITY", "EXPERIMENT_EFFECTIVENESS"] : ["PROVIDER_OUTCOME"],
    action: { label: "REVIEW_EXPERIMENT_OUTCOME", requiredApproval: "HUMAN_REVIEW", executable: false, deepLink },
    explainability: { index },
    whyThisIsHere: signalId === "EXPERIMENT_WINDOW_CLOSED_NO_DECISION" ? "MEASUREMENT_WINDOW_ENDED_WITHOUT_GOVERNED_DECISION" : "PROVIDER_OUTCOME_REQUIRES_RECONCILIATION",
  };
}

const EXPERIMENT_LINK = "/dashboard/growth-loop/experiment-1";

function missionControl(items: unknown[], signalStatus = [{ signalId: "S1", status: "ok" }, { signalId: "S2", status: "ok" }, { signalId: "S3", status: "ok" }, { signalId: "S4", status: "ok" }]) {
  return { contractVersion: 1, generatedAt: "2026-09-09T12:00:00.000Z", items, banners: [], signalStatus, bounds: { maxItems: 7, truncated: false } };
}

/** Every non-GET API call the page makes, so "no execution" is proven at the network layer. */
function recordWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && request.method() !== "GET") writes.push(`${request.method()} ${url.pathname}`);
  });
  return writes;
}

const BUSINESS_STATE_EMPTY = { experiments: { open: [], truncated: false }, content: { pendingCandidateIds: [], reconciliationRequiredIds: [], truncated: false } };

async function stub(page: Page, body: unknown, status = 200, extras: { state?: unknown; findings?: unknown[] } = {}) {
  await page.route("**/api/auth/me", (route: Route) => route.fulfill({ json: IDENTITY }));
  await page.route("**/api/mission-control", (route: Route) => route.fulfill({ status, json: body }));
  await page.route("**/api/business-state", (route: Route) => route.fulfill({ json: { success: true, state: extras.state ?? BUSINESS_STATE_EMPTY } }));
  await page.route("**/api/intelligence/semantic/findings**", (route: Route) => route.fulfill({ json: { success: true, findings: extras.findings ?? [] } }));
}

const FORBIDDEN = ["Mission Control", "Growth Loop", "Evidence", "Assessment", "Candidate", "Attribution", "Causality", "Policy", "Governance", "EXPERIMENT_", "RECONCILIATION_", "DECIDE_TODAY", "CRM"];

async function assertBeginnerVocabulary(page: Page) {
  const text = await page.locator("main").innerText();
  for (const term of FORBIDDEN) expect(text, `Level 1 leaked "${term}"`).not.toContain(term);
  expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(text).not.toMatch(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/);
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("one item: a beginner gets one dominant recommendation, why, and details", async ({ page }) => {
  const writes = recordWrites(page);
  await stub(page, { success: true, missionControl: missionControl([item("EXPERIMENT_WINDOW_CLOSED_NO_DECISION", 0, EXPERIMENT_LINK, "DECIDE_TODAY")]) });
  await page.goto("/dashboard");

  await expect(page.getByText("امروز یک موضوع نیاز به توجه شما دارد.")).toBeVisible();
  await expect(page.locator('[data-recommendation="primary"]')).toHaveCount(1);

  // The five fixed sections answer the four questions a non-technical owner asks.
  for (const label of ["چه دیدم", "برداشت من", "پیشنهاد من", "از شما چه می‌خواهم", "اگر قبول کنید"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("خرج: ۰ تومان", { exact: false })).toBeVisible();

  // No 13-tool launcher in the initial view.
  await assertBeginnerVocabulary(page);
  await assertNoOverflow(page);

  // Level 2 — canonical facts, one reasoning line, one explicit unknown.
  await page.locator('[data-action="why"]').click();
  const drawer = page.locator("[data-why-drawer]");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("پایان دورهٔ نتیجه‌گیری")).toBeVisible();
  await expect(drawer.getByText("هنوز تصمیمی نگرفته‌اید")).toBeVisible();
  await expect(drawer.locator("[data-unknown]")).toContainText("هنوز نمی‌دانم");
  await assertBeginnerVocabulary(page);

  // Level 3 — the untouched expert Decision Room.
  await expect(drawer.locator('[data-action="details"]')).toHaveAttribute("href", EXPERIMENT_LINK);
  await page.locator('[data-action="accept"]').click();
  await expect(page).toHaveURL(EXPERIMENT_LINK);

  // Nothing was executed: the beginner surface issued no write of any kind.
  expect(writes).toEqual([]);
});

test("zero items: an honest calm state, never fabricated business health", async ({ page }) => {
  await stub(page, { success: true, missionControl: missionControl([]) });
  await page.goto("/dashboard");
  await expect(page.getByText("فعلاً موضوع فوری برای تصمیم‌گیری ندارید.")).toBeVisible();
  await expect(page.locator("[data-empty-state]")).toBeVisible();
  await expect(page.locator('[data-recommendation="primary"]')).toHaveCount(0);
  await assertBeginnerVocabulary(page);
  await assertNoOverflow(page);
});

test("several items: one primary, two collapsed, one bounded overflow line", async ({ page }) => {
  const items = [
    item("EXPERIMENT_WINDOW_CLOSED_NO_DECISION", 0, EXPERIMENT_LINK, "DECIDE_TODAY"),
    ...Array.from({ length: 5 }, (_, index) => item("CONTENT_CANDIDATE_STUCK", index + 1, EXPERIMENT_LINK)),
  ];
  await stub(page, { success: true, missionControl: missionControl(items) });
  await page.goto("/dashboard");

  await expect(page.getByText("امروز ۶ موضوع نیاز به توجه شما دارد.")).toBeVisible();
  await expect(page.locator('[data-recommendation="primary"]')).toHaveCount(1);
  await expect(page.locator('[data-recommendation="secondary"]')).toHaveCount(2);
  await expect(page.locator("[data-overflow-line]")).toHaveText("۳ مورد دیگر");

  // The primary card is the first canonical item, not a re-ranked one.
  await expect(page.locator('[data-recommendation="primary"]')).toHaveAttribute("data-signal", "EXPERIMENT_WINDOW_CLOSED_NO_DECISION");

  // "فعلاً نه" records nothing and simply moves on.
  await page.locator('[data-action="decline"]').click();
  await expect(page.locator('[data-recommendation="primary"]')).toHaveAttribute("data-signal", "CONTENT_CANDIDATE_STUCK");
  await assertBeginnerVocabulary(page);
  await assertNoOverflow(page);
});

test("partial signal failure is stated, and total failure is never shown as good news", async ({ page }) => {
  await stub(page, {
    success: true,
    missionControl: missionControl([item("CONTENT_CANDIDATE_STUCK", 0, EXPERIMENT_LINK)], [
      { signalId: "S1", status: "ok" },
      { signalId: "S2", status: "failed" },
      { signalId: "S3", status: "ok" },
      { signalId: "S4", status: "failed" },
    ]),
  });
  await page.goto("/dashboard");
  await expect(page.locator('[data-signal-state="partial"]')).toContainText("این فهرست کامل نیست");
  await expect(page.locator('[data-recommendation="primary"]')).toHaveCount(1);
  await assertBeginnerVocabulary(page);

  await page.route("**/api/mission-control", (route) => route.fulfill({ status: 500, json: { success: false, code: "MISSION_CONTROL_READ_FAILED" } }));
  await page.reload();
  const unreadable = page.locator('[data-signal-state="unreadable"]');
  await expect(unreadable).toBeVisible();
  await expect(unreadable).toContainText("نه اینکه همه‌چیز روبه‌راه است");
  await expect(page.getByText("فعلاً موضوع فوری برای تصمیم‌گیری ندارید.")).toHaveCount(0);
  await expect(page.locator("[data-empty-state]")).toHaveCount(0);
  await assertNoOverflow(page);
});

test("expert capability stays reachable behind همه ابزارها, and the flag restores the legacy surface", async ({ page }) => {
  test.setTimeout(60_000);
  await stub(page, { success: true, missionControl: missionControl([item("EXPERIMENT_WINDOW_CLOSED_NO_DECISION", 0, EXPERIMENT_LINK)]) });
  await page.goto("/dashboard");

  // Zone 4 needs no click at all: tools are directly on Home, never gated.
  await expect(page.locator("[data-zone='tools'] [data-tool]")).toHaveCount(14);
  await expect(page.getByRole("link", { name: "مشتری‌ها" })).toHaveAttribute("href", "/dashboard/crm");

  // The full expert surface remains reachable in place; no route changed.
  await expect(page.locator("[data-all-tools-toggle]")).toHaveAttribute("aria-expanded", "false");
  await page.locator("[data-all-tools-toggle]").click();
  await expect(page.locator("[data-all-tools-toggle]")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "CRM" })).toHaveAttribute("href", "/dashboard/crm");
  await expect(page.getByRole("link", { name: "تولید محتوا" })).toHaveAttribute("href", "/dashboard/content");
  await expect(page.getByRole("heading", { name: /چه چیزی الان به توجهت نیاز دارد/ })).toBeVisible();
  await assertNoOverflow(page);

  // Existing routes still resolve (client-side navigation, no backend needed).
  await page.getByRole("link", { name: "مشتری‌ها" }).first().click();
  await expect(page).toHaveURL("/dashboard/crm");

  // beginner_home_v1 off must render exactly the pre-existing dashboard.
  await page.goto("/dashboard?beginner_home_v1=0");
  await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible();
  await expect(page.getByText("ابزارهای کسب‌وکار")).toBeVisible();
  await expect(page.locator("[data-status-sentence]")).toHaveCount(0);
  await assertNoOverflow(page);
});

test("four zones render in fixed order with tools always reachable", async ({ page }) => {
  const writes = recordWrites(page);
  await stub(page, { success: true, missionControl: missionControl([item("EXPERIMENT_WINDOW_CLOSED_NO_DECISION", 0, EXPERIMENT_LINK, "DECIDE_TODAY")]) }, 200, {
    state: { experiments: { open: [{ id: "e-1", status: "RUNNING" }], truncated: false }, content: { pendingCandidateIds: ["c-1"], reconciliationRequiredIds: [], truncated: false } },
    findings: [{ id: "f-1", state: "INCONCLUSIVE", calculatedAt: "2026-09-08T10:00:00.000Z", value: { observedCount: 2, reasons: [] } }],
  });
  await page.goto("/dashboard");

  // Zone 1 — exactly one primary attention item.
  await expect(page.locator('[data-recommendation="primary"]')).toHaveCount(1);

  // All four zone headings, in order.
  const headings = ["به شما نیاز دارد", "در حال انجام", "چیزی که یاد گرفته‌ام", "ابزارهای کسب‌وکار"];
  for (const heading of headings) await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  const tops = await Promise.all(headings.map((h) => page.getByRole("heading", { name: h }).boundingBox().then((b) => b!.y)));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));

  // Zone 2 — counted canonical records, and what wants the owner comes first.
  const lines = page.locator('[data-in-progress="lines"] li');
  await expect(lines).toHaveCount(2);
  await expect(lines.first()).toContainText("منتظر نظر شماست");

  // Zone 3 — observation is always paired with its boundary.
  await expect(page.locator('[data-learned="finding"]')).toContainText("۲ نفر");
  await expect(page.locator("[data-learned-boundary]")).toContainText("هنوز نمی‌دانم");

  // Zone 4 — every tool directly reachable, Persian-first, no plan required.
  await expect(page.locator("[data-tool]")).toHaveCount(14);
  await expect(page.getByRole("link", { name: "مشتری‌ها" })).toHaveAttribute("href", "/dashboard/crm");
  await expect(page.getByRole("link", { name: "آمار و نتیجه‌ها" })).toHaveAttribute("href", "/dashboard/analytics");

  await assertBeginnerVocabulary(page);
  await assertNoOverflow(page);
  expect(writes).toEqual([]);
});

test("mobile keeps the decision above the tools and stays within the viewport", async ({ page }) => {
  await stub(page, { success: true, missionControl: missionControl([item("EXPERIMENT_WINDOW_CLOSED_NO_DECISION", 0, EXPERIMENT_LINK, "DECIDE_TODAY")]) });
  await page.goto("/dashboard");

  const card = await page.locator('[data-recommendation="primary"]').boundingBox();
  const tools = await page.locator('[data-zone="tools"]').boundingBox();
  // Hierarchy: the decision is on the first screen, the tools are below it.
  expect(card!.y).toBeLessThan(844);
  expect(tools!.y).toBeGreaterThan(card!.y);
  await expect(page.locator("[data-tool]")).toHaveCount(14);
  await assertNoOverflow(page);
  await assertBeginnerVocabulary(page);
});

test("each zone fails on its own without blanking the others", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: IDENTITY }));
  await page.route("**/api/mission-control", (route) => route.fulfill({ json: { success: true, missionControl: missionControl([item("CONTENT_CANDIDATE_STUCK", 0, EXPERIMENT_LINK)]) } }));
  await page.route("**/api/business-state", (route) => route.fulfill({ status: 500, json: { success: false } }));
  await page.route("**/api/intelligence/semantic/findings**", (route) => route.fulfill({ status: 500, json: { success: false } }));
  await page.goto("/dashboard");

  await expect(page.locator('[data-recommendation="primary"]')).toHaveCount(1);
  await expect(page.locator('[data-in-progress="unreadable"]')).toBeVisible();
  await expect(page.locator('[data-learned="unreadable"]')).toBeVisible();
  // A source that cannot be read is never dressed up as good news.
  await expect(page.locator('[data-in-progress="empty"]')).toHaveCount(0);
  await expect(page.locator('[data-learned="empty"]')).toHaveCount(0);
  await expect(page.locator("[data-tool]")).toHaveCount(14);
  await assertBeginnerVocabulary(page);
  await assertNoOverflow(page);
});
