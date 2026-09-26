import { expect, request, test, type Page } from "@playwright/test";
import { legalFirmStarterV1 as template } from "../../src/components/store-studio-v16/templates/business-legal-firm-v1";

// Legal Firm Starter (business.legal.firm.v1) in the real Studio:
// template loads → every section renders → Inspector edits (text, repeater
// item, icon) and a section move persist after save + reload → preview on
// desktop and mobile.
const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the Legal Firm Starter journey.");

test.use({ actionTimeout: 15_000 });

const SECTION_ELEMENTS = '[data-canvas-interactive="true"] [data-editor-element="section"]';
const sectionTitles = (page: Page) => page.locator(SECTION_ELEMENTS).evaluateAll((sections) =>
  sections.map((section) => (section.querySelector("h2, h3") as HTMLElement | null)?.innerText.trim() || "").filter(Boolean));

async function selectSection(page: Page, title: string) {
  const section = page.locator(SECTION_ELEMENTS, { has: page.getByRole("heading", { name: title, exact: true }) }).first();
  await section.click({ position: { x: 6, y: 6 } });
  await expect(section).toHaveAttribute("data-editor-selected", "true");
}

async function save(page: Page, projectId: string) {
  const saved = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects/${projectId}` && res.request().method() === "PATCH");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  expect((await saved).status()).toBe(200);
}

test("Legal Firm Starter: loads, renders every section, and persists Inspector edits", async ({ browser }) => {
  test.setTimeout(180_000);
  const api = await request.newContext({ baseURL: apiBaseURL });
  const mobile = `095${String(Date.now()).slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Legal Template E2E" } });
  for (let attempt = 0; sent.status() === 429 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, ((Number(sent.headers()["retry-after"]) || 60) + 1) * 1000));
    sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Legal Template E2E" } });
  }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  const context = await browser.newContext({ storageState: await api.storageState() });
  await api.dispose();
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    // Template loads: create from the template and open it in Studio.
    await page.goto("/dashboard/websites/corporate?new=1");
    await page.getByRole("button", { name: new RegExp(template.label) }).first().click();
    const created = page.waitForResponse((res) => res.url() === `${apiBaseURL}/api/site-projects` && res.request().method() === "POST");
    await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
    const project = (await (await created).json()).project;
    await expect(page).toHaveURL(new RegExp(`project=${project.id}`));

    // Sections render: hero + all 8 spec sections, in order, with their repeater items and icons.
    const canvas = page.locator('[data-canvas-interactive="true"]');
    await expect(canvas.getByText(String(template.hero?.title), { exact: true }).first()).toBeVisible();
    await expect.poll(() => sectionTitles(page)).toEqual(template.sections.map((section) => section.title));
    for (const section of template.sections) for (const item of section.items || []) {
      await expect(canvas.getByText(item.title, { exact: true }).first(), `${section.id}: ${item.title}`).toBeVisible();
    }
    await expect(canvas.locator('[data-item-icon="scales"]').first()).toBeVisible();

    // Inspector edits on the practice-areas section: section title, first item title, first item icon.
    const practice = template.sections.find((section) => section.id === "practice-main")!;
    await selectSection(page, practice.title);
    const titles = page.getByLabel("عنوان", { exact: true });
    await titles.nth(0).fill("حوزه‌های تخصصی ما");
    await titles.nth(1).fill("حقوق خانواده و ارث");
    await page.getByLabel("آیکون", { exact: true }).first().selectOption("gavel");
    await expect(canvas.locator('[data-item-icon="gavel"]').first()).toBeVisible();

    // Reorder: move the metrics section below practice areas.
    await selectSection(page, template.sections[0].title);
    await page.getByTitle("پایین‌تر").first().click();
    await save(page, project.id);

    // Fields persist after save: reload the project from the server.
    await page.reload();
    await expect(page.locator('[data-studio-version="16"]')).toBeVisible();
    const expectedOrder = template.sections.map((section) => section.title);
    [expectedOrder[0], expectedOrder[1]] = ["حوزه‌های تخصصی ما", expectedOrder[0]];
    await expect.poll(() => sectionTitles(page)).toEqual(expectedOrder);
    await expect(canvas.getByText("حقوق خانواده و ارث", { exact: true }).first()).toBeVisible();
    await expect(canvas.locator('[data-item-icon="gavel"]').first()).toBeVisible();

    // Preview: desktop and mobile.
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
    const preview = page.locator('[data-canvas-interactive="false"]');
    for (const device of ["دسکتاپ", "موبایل"]) {
      await page.locator("[data-draft-preview]").getByRole("button", { name: device, exact: true }).click();
      await expect(preview.getByText("حوزه‌های تخصصی ما", { exact: true }).first()).toBeVisible();
      await expect(preview.getByText(template.sections.at(-1)!.title, { exact: true }).first()).toBeVisible();
    }
    expect(pageErrors, "no page errors").toEqual([]);
  } finally {
    await context.close();
  }
});
