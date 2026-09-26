import { expect, request, test, type Page, type Request } from "@playwright/test";
import { businessLaunchTemplates } from "../../src/components/store-studio-v16/templates/business-launch-v1";

// Release blocker regression: the real UI path
//   template card → "ساخت از روی قالب انتخاب‌شده" → POST /api/site-projects → Studio
// must succeed for the SAME template twice in one workspace. The Studio names
// a template-created project after the template label, so the second create
// reuses the slug; it used to fail with "UNIQUE constraint failed:
// site_projects.workspace_id, site_projects.slug" (SITE_PROJECT_INTERNAL_ERROR).
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the template creation journey.");

test.use({ actionTimeout: 10_000 });

const template = businessLaunchTemplates[0];

async function createFromTemplate(page: Page) {
  await page.goto("/dashboard/websites/corporate?new=1");
  await page.getByRole("button", { name: new RegExp(template.label) }).first().click();
  const posted = page.waitForRequest((req: Request) => req.url() === `${apiBaseURL}/api/site-projects` && req.method() === "POST");
  const answered = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects` && res.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const [req, res] = await Promise.all([posted, answered]);
  const body = await res.json();
  return { payload: req.postDataJSON(), status: res.status(), body };
}

test(`creating a website from "${template.label}" twice in one workspace never fails on the slug`, async ({ browser }) => {
  test.setTimeout(120_000);
  const api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `092${String(Date.now()).slice(-8)}`;
  const otp = await (await api.post("/api/auth/send-otp", { data: { mobile, name: "Template Creation E2E" } })).json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  const context = await browser.newContext({ storageState: await api.storageState() });
  await api.dispose();
  const page = await context.newPage();
  try {
    const first = await createFromTemplate(page);
    // The exact UI creation contract: named after the template, BUSINESS, a V16 document.
    expect(first.payload).toMatchObject({ name: template.label, siteType: "BUSINESS" });
    expect(first.payload.content?.storeBuilderV16?.version).toBe(16);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    await expect(page).toHaveURL(new RegExp(`project=${first.body.project.id}`));
    await expect(page.locator('[data-studio-version="16"]')).toBeVisible();

    const second = await createFromTemplate(page);
    expect(second.payload.name, "same template, same name").toBe(first.payload.name);
    expect(second.status, JSON.stringify(second.body)).toBe(201);
    expect(second.body.project.slug).not.toBe(first.body.project.slug);
    await expect(page).toHaveURL(new RegExp(`project=${second.body.project.id}`));
    await expect(page.locator('[data-studio-version="16"]')).toBeVisible();
    await expect(page.getByText("UNIQUE constraint failed")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
