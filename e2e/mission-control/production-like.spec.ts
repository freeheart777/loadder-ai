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

test("real OTP user reaches durable Mission Control attention and valid destinations", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const mobile = `090${String(Date.now() + testInfo.workerIndex).slice(-8)}`;
  await loginThroughUi(page, mobile);
  const identity = await page.evaluate(async () => {
    const response = await fetch("/api/auth/me");
    if (!response.ok) throw new Error("Authenticated identity unavailable");
    return response.json();
  });
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
  await expect(page.getByRole("heading", { name: /چه چیزی الان به توجهت نیاز دارد/ })).toBeVisible();
  await expect(page.getByText("پنجره سنجش آزمایش بسته شده است")).toBeVisible();
  await expect(page.getByText("نامزد محتوا نیازمند بررسی است")).toBeVisible();
  await expect(page.getByText("Business Context نیازمند بازبینی است")).toHaveCount(0);

  const growthLink = page.getByRole("link", { name: "بررسی نتیجه آزمایش" });
  await expect(growthLink).toHaveAttribute("href", `/dashboard/growth-loop/${first.experimentId}`);
  await growthLink.click();
  await expect(page).toHaveURL(`/dashboard/growth-loop/${first.experimentId}`);
  await expect(page.getByRole("heading", { name: "چرخهٔ رشد قابل توضیح" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /چه چیزی الان به توجهت نیاز دارد/ })).toBeVisible();

  const contentLink = page.getByRole("link", { name: "بررسی نامزد محتوا" });
  await expect(contentLink).toHaveAttribute("href", "/dashboard/content");
  await contentLink.click();
  await expect(page).toHaveURL("/dashboard/content");
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /CRM/ }).click();
  await expect(page).toHaveURL("/dashboard/crm");

  await page.goto("/dashboard");
  await page.reload();
  await expect(page.getByText("پنجره سنجش آزمایش بسته شده است")).toBeVisible();
  expect(missionReads).toBeGreaterThanOrEqual(3);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: /چه چیزی الان به توجهت نیاز دارد/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "بررسی نتیجه آزمایش" })).toBeVisible();
  await expect(page.getByRole("link", { name: /CRM/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /تولید محتوا/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
