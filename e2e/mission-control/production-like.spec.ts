import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_BASE_URL;
const databasePath = process.env.E2E_DATABASE_PATH;
if (!apiBaseUrl || !databasePath) throw new Error("Mission Control acceptance URLs/database are required");

type DemoResult = {
  experimentId: string;
  candidateId: string;
  attentionCandidateId: string;
  leadId: string;
};

function seed(workspaceId: string, userId: string, membershipId: string) {
  const output = execFileSync(process.execPath, ["e2e/growth/seed-growth-loop.mjs", "reuse", workspaceId, userId, membershipId], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_PATH: databasePath,
    },
    encoding: "utf8",
  });
  const line = output.trim().split("\n").at(-1);
  if (!line) throw new Error("Growth fixture did not return a result");
  return JSON.parse(line) as DemoResult;
}

async function loginThroughUi(page: Page, mobile: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("مثلاً علی رضایی").fill("کاربر پذیرش لودر");
  await page.getByPlaceholder("09123456789").fill(mobile);
  await page.getByRole("button", { name: "ادامه" }).click();
  const exposed = page.getByText(/کد محیط توسعه: \d{5}/);
  await expect(exposed).toBeVisible();
  const code = (await exposed.textContent())?.match(/\d{5}/)?.[0];
  expect(code).toBeTruthy();
  await page.locator('input[maxlength="5"]').fill(code!);
  await page.getByRole("button", { name: "ورود به پنل" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * beginner_home_v1 keeps /dashboard but puts the expert surface behind
 * "همه ابزارها". This opens it when the flag is on and no-ops when it is off,
 * so the acceptance below proves the same expert capability either way.
 */
async function openExpertSurface(page: Page) {
  const toggle = page.locator("[data-all-tools-toggle]");
  const grid = page.getByText("ابزارهای کسب‌وکار");
  await expect(toggle.or(grid).first()).toBeVisible();
  if (await toggle.count()) await toggle.click();
  await expect(grid).toBeVisible();
}

test("real OTP user reaches durable Mission Control attention and valid destinations", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const mobile = `090${String(Date.now() + testInfo.workerIndex).slice(-8)}`;
  await loginThroughUi(page, mobile);
  const identityResponse = await page.request.get(`${apiBaseUrl}/api/auth/me`);
  expect(identityResponse.ok()).toBeTruthy();
  const identity = await identityResponse.json();
  const membership = identity.memberships.find((entry: { workspace: { id: string } }) => entry.workspace.id === identity.activeWorkspace.id);
  const first = seed(identity.activeWorkspace.id, identity.user.id, membership.id);
  const second = seed(identity.activeWorkspace.id, identity.user.id, membership.id);
  expect(second.experimentId).toBe(first.experimentId);
  expect(second.candidateId).toBe(first.candidateId);
  expect(second.attentionCandidateId).toBe(first.attentionCandidateId);
  expect(second.leadId).toBe(first.leadId);

  let missionReads = 0;
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/mission-control" && response.ok()) missionReads += 1;
  });
  await page.reload();
  await openExpertSurface(page);
  await expect(page.getByRole("heading", { name: /چه چیزی الان به توجهت نیاز دارد/ })).toBeVisible();
  await expect(page.getByText("پنجره سنجش آزمایش بسته شده است")).toBeVisible();
  await expect(page.getByText("نامزد محتوا نیازمند بررسی است")).toBeVisible();
  await expect(page.getByText("Business Context نیازمند بازبینی است")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toMatch(/EXPERIMENT_OUTCOME_REVIEW|RECONCILIATION_REQUIRED|growth-e2e|آزمون مرورگر|آزمایشی/);

  const growthLink = page.getByRole("link", { name: "بررسی نتیجه آزمایش" });
  await expect(growthLink).toHaveAttribute("href", `/dashboard/growth-loop/${first.experimentId}`);
  await growthLink.click();
  await expect(page).toHaveURL(`/dashboard/growth-loop/${first.experimentId}`);
  await expect(page.getByRole("heading", { name: "چرخهٔ رشد قابل توضیح" })).toBeVisible();
  const growthBody = await page.locator("body").innerText();
  expect(growthBody).not.toMatch(/EXPERIMENT_OUTCOME_REVIEW|RECONCILIATION_REQUIRED|growth-e2e|fixture-v1|deterministic-e2e|آزمون مرورگر|آزمایشی/);
  const internalTokens = growthBody.match(/\b[A-Z][A-Z0-9_]{2,}\b/g)?.filter((token) => token !== "CRM") ?? [];
  expect(internalTokens).toEqual([]);
  await page.getByRole("button", { name: "ارزیابی شواهد" }).click();
  await expect(page.getByText("لودر هنوز نتیجه‌گیری نمی‌کند.")).toBeVisible();
  await page.getByRole("button", { name: "پذیرش برای بررسی" }).click();
  await expect(page.getByText("تصمیم ثبت شد.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("تصمیم ثبت شد.")).toBeVisible();
  await page.goBack();
  await openExpertSurface(page);
  await expect(page.getByRole("heading", { name: /چه چیزی الان به توجهت نیاز دارد/ })).toBeVisible();

  const contentLink = page.getByRole("link", { name: "بررسی نامزد محتوا" });
  await expect(contentLink).toHaveAttribute("href", `/dashboard/growth-loop/${first.experimentId}`);
  await contentLink.click();
  await expect(page).toHaveURL(`/dashboard/growth-loop/${first.experimentId}`);
  await expect(page.locator('[data-candidate-state="RECONCILIATION_REQUIRED"]')).toContainText("نیازمند تطبیق انسانی");
  await page.goto("/dashboard");
  await openExpertSurface(page);
  await page.getByRole("link", { name: /CRM/ }).click();
  await expect(page).toHaveURL("/dashboard/crm");
  for (const name of ["نیلوفر پارسا", "کیان مهرگان", "رها نیک‌فر"]) await expect(page.getByText(name).first()).toBeVisible();

  await page.goto("/dashboard");
  await page.reload();
  await openExpertSurface(page);
  await expect(page.getByText("نامزد محتوا نیازمند بررسی است")).toBeVisible();
  await expect(page.getByText("پنجره سنجش آزمایش بسته شده است")).toHaveCount(0);
  expect(missionReads).toBeGreaterThanOrEqual(3);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: /چه چیزی الان به توجهت نیاز دارد/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "بررسی نامزد محتوا" })).toBeVisible();
  await expect(page.getByRole("link", { name: /CRM/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /تولید محتوا/ })).toBeVisible();
  await page.getByRole("link", { name: "بررسی نامزد محتوا" }).click();
  const mobileNav = page.getByRole("navigation", { name: "دسترسی سریع" });
  await expect(mobileNav.getByRole("link", { name: "داشبورد" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "CRM" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "محتوا" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
