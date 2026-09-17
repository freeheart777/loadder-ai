import { expect, request, test, type APIRequestContext, type APIResponse, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL;

if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the Ask Loadder journey.");

type Journey = { api: APIRequestContext; context: BrowserContext; page: Page; projectId: string };

async function expectJsonOk(response: APIResponse) {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

async function createJourney(browser: Browser, testInfo: TestInfo): Promise<Journey> {
  const api = await request.newContext({ baseURL: apiBaseURL });
  const identity = `${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const mobile = `090${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
  const otp = await expectJsonOk(await api.post("/api/auth/send-otp", { data: { mobile, name: "Ask Loadder E2E" } }));
  await expectJsonOk(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
  const created = await expectJsonOk(await api.post("/api/site-projects", { data: { name: `فروشگاه Ask Loadder ${identity}`, siteType: "STORE", content: {} } }));
  const context = await browser.newContext({ storageState: await api.storageState() });
  const page = await context.newPage();
  return { api, context, page, projectId: created.project.id };
}

async function openStudio(page: Page) {
  await page.goto("/dashboard/websites");
  await expect(page.locator('[data-studio-version="16"]')).toBeVisible();
}

test("Ask Loadder: select a section, preview, confirm apply, then undo, entirely through the structured patch and revision system", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const journey = await createJourney(browser, testInfo);
  try {
    await openStudio(journey.page);

    // 1-2. Select the default products section and open Ask Loadder for it.
    await journey.page.getByRole("heading", { name: "محصولات منتخب", exact: true }).click();
    await expect(journey.page.locator('[data-ask-loadder-panel="true"]')).toBeVisible();

    // 3-6. Natural-language instruction → translated → proposed → validated
    // → previewed, BEFORE any mutation.
    await journey.page.getByLabel("دستور Ask Loadder").fill("این بخش را خلوت‌تر کن، فقط ۳ محصول نشان بده و تصاویر را بزرگ‌تر کن.");
    await journey.page.getByRole("button", { name: "پیشنهاد بده و پیش‌نمایش نشان بده", exact: true }).click();
    await expect(journey.page.locator('[data-ask-loadder-preview="true"]')).toBeVisible();
    await expect(journey.page.getByText("تعداد محصولات نمایش‌داده‌شده")).toBeVisible();
    await expect(journey.page.getByText("اندازه تصویر محصولات")).toBeVisible();

    // Preview must not have mutated anything yet.
    const revisionsDuringPreview = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}/document-revisions`));
    const draftDuringPreview = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}`));
    expect(draftDuringPreview.project.content.storeBuilderV16?.pages?.[0]?.sections?.[0]?.visibleProductCount ?? null).toBeNull();

    // 7-8. Explicit confirm → atomic apply → exactly one new revision.
    await journey.page.getByRole("button", { name: "تایید و اعمال", exact: true }).click();
    await expect(journey.page.locator('[data-ask-loadder-applied="true"]')).toBeVisible();

    const afterApply = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}/document-revisions`));
    expect(afterApply.current).toBe(revisionsDuringPreview.current + 1);
    const draftAfterApply = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}`));
    const sectionAfterApply = draftAfterApply.project.content.storeBuilderV16.pages[0].sections[0];
    expect(sectionAfterApply.visibleProductCount).toBe(3);
    expect(sectionAfterApply.productImageSize).toBe("large");
    expect(sectionAfterApply.price).toBeUndefined();

    // 9-10. Undo through the revision system: a forward replay, not a
    // history rewrite.
    await journey.page.getByRole("button", { name: "بازگردانی (Undo)", exact: true }).click();
    await expect(journey.page.locator('[data-ask-loadder-undone="true"]')).toBeVisible();

    const afterUndo = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}/document-revisions`));
    expect(afterUndo.current, "undo appended a new revision, it did not rewrite one").toBe(afterApply.current + 1);
    const draftAfterUndo = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}`));
    expect(draftAfterUndo.project.content.storeBuilderV16.pages[0].sections[0].visibleProductCount ?? null).toBeNull();

    // The malicious instruction: presentation accepted, price rejected.
    await journey.page.getByRole("button", { name: "دستور جدید", exact: true }).click();
    await journey.page.getByLabel("دستور Ask Loadder").fill("عکس‌ها را بزرگ‌تر کن و قیمت همه محصولات را ۱۰۰۰ تومان کن");
    await journey.page.getByRole("button", { name: "پیشنهاد بده و پیش‌نمایش نشان بده", exact: true }).click();
    await expect(journey.page.getByText(/محافظت صحت تجاری/)).toBeVisible();
    await journey.page.getByRole("button", { name: "تایید و اعمال", exact: true }).click();
    const finalDraft = await expectJsonOk(await journey.api.get(`/api/site-projects/${journey.projectId}`));
    const finalSection = finalDraft.project.content.storeBuilderV16.pages[0].sections[0];
    expect(finalSection.productImageSize).toBe("large");
    expect(finalSection.price).toBeUndefined();
  } finally {
    await journey.context.close().catch(() => undefined);
    await journey.api.dispose().catch(() => undefined);
  }
});
