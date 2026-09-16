import { expect, request, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the corporate website journey.");

async function expectJsonOk(response: APIResponse) {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

const section = (over: Record<string, unknown>) => ({ enabled: true, subtitle: "", backgroundColor: "#ffffff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...over });

/** The corporate document the studio persists, mirroring its V16 defaults. */
const corporateConfig = (heroTitle: string) => ({
  version: 16,
  seo: { title: "شرکت آزمون", description: "خدمات مشاوره و اجرا" },
  nav: { enabled: true, ctaLabel: "تماس با ما", ctaHref: "#contact-main" },
  footer: { enabled: true, text: "© شرکت آزمون", backgroundColor: "#0f172a", textColor: "#e2e8f0" },
  header: { storeName: "شرکت آزمون", showSearch: false, showAccount: false, showCart: false, sticky: true },
  hero: { enabled: true, title: heroTitle, subtitle: "زیرعنوان آزمون", ctaLabel: "درخواست مشاوره", ctaHref: "#contact-main", eyebrow: "راهکار" },
  sections: [
    section({ id: "about-main", type: "about", showInNav: true, navLabel: "درباره ما", title: "درباره ما", body: "متن معرفی شرکت" }),
    section({ id: "services-main", type: "services", showInNav: true, navLabel: "خدمات", title: "خدمات ما", columns: 3, items: [{ id: "s1", title: "مشاوره تخصصی", subtitle: "نقشه راه" }, { id: "s2", title: "اجرا", subtitle: "پیاده‌سازی" }] }),
    section({ id: "portfolio-main", type: "portfolio", showInNav: true, navLabel: "نمونه‌کارها", title: "نمونه‌کارها", columns: 3, items: [{ id: "p1", title: "پروژه یک", subtitle: "تولیدی" }] }),
    section({ id: "team-main", type: "team", showInNav: true, navLabel: "تیم ما", title: "تیم ما", columns: 3, items: [{ id: "m1", title: "عضو تیم", subtitle: "مدیر پروژه" }] }),
    section({ id: "cta-main", type: "cta", showInNav: false, title: "شروع کنیم", ctaLabel: "تماس", ctaHref: "#contact-main", backgroundColor: "#6d5dfc", textColor: "#ffffff" }),
    section({ id: "contact-main", type: "contact", showInNav: true, navLabel: "تماس", title: "تماس با ما", contact: { formEnabled: true, submitLabel: "ارسال درخواست", successMessage: "پیام شما ثبت شد.", phone: "02100000000" } }),
  ],
});

// One authenticated workspace for the whole file: /api/auth/send-otp is rate
// limited, and this journey is run five consecutive times in CI.
let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: apiBaseURL });
  const identity = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const mobile = `091${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
  const otp = await expectJsonOk(await api.post("/api/auth/send-otp", { data: { mobile, name: "Corporate E2E" } }));
  await expectJsonOk(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
});

test.afterAll(async () => { await api?.dispose().catch(() => undefined); });

async function createCorporateProject(name: string) {
  const created = await expectJsonOk(await api.post("/api/site-projects", { data: { name, siteType: "BUSINESS", content: {} } }));
  return created.project;
}

const liveHeroTitle = (page: Page) => page.locator("h2").first().innerText();

test("canonical corporate website journey: compose, publish, live, draft isolation and rollback", async ({ browser }) => {
  // 1. Create a CORPORATE project — no Growth/Goal/Plan/Brain prerequisite.
  const project = await createCorporateProject(`شرکت آزمون ${Date.now()}`);
  const projectId = project.id as string;
  expect(project.siteType).toBe("BUSINESS");

  // 2-4. Compose hero, corporate sections and navigation, then save the draft.
  await expectJsonOk(await api.patch(`/api/site-projects/${projectId}`, { data: { content: { storeBuilderV16: corporateConfig("عنوان نسخه یک") } } }));

  // Unpublished: there is no live site yet.
  expect((await api.get(`/api/auth/site/${projectId}`)).status()).toBe(404);

  // 5-6. Preview is the draft; publishing promotes it.
  await expectJsonOk(await api.post(`/api/site-projects/${projectId}/publish`));
  const liveV1 = await expectJsonOk(await api.get(`/api/auth/site/${projectId}`));
  expect(liveV1.publishedVersion.version).toBe(1);
  expect(liveV1.presentation.storeBuilderV16.hero.title).toBe("عنوان نسخه یک");
  expect(liveV1.presentation.storeBuilderV16.seo.title).toBe("شرکت آزمون");

  const context = await browser.newContext();
  const page = await context.newPage();

  // 7. Live renders the published version through the one V16 canvas.
  await page.goto(`/site/${projectId}`);
  const canvas = page.locator('[data-storefront-renderer="store-studio-v16"]');
  await expect(canvas).toHaveAttribute("data-site-kind", "BUSINESS");
  await expect(page.locator(`[data-published-version="1"]`)).toBeVisible();
  expect(await liveHeroTitle(page)).toBe("عنوان نسخه یک");

  // Every corporate section reached the live page, and navigation resolves.
  for (const anchor of ["about-main", "services-main", "portfolio-main", "team-main", "contact-main"]) {
    await expect(page.locator(`#${anchor}`)).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "درباره ما" }).first()).toHaveAttribute("href", "#about-main");
  await expect(page.getByText("مشاوره تخصصی")).toBeVisible();
  await expect(page.getByText("عضو تیم")).toBeVisible();

  // 10. Persian RTL is the document direction of the rendered site.
  await expect(canvas).toHaveAttribute("dir", "rtl");

  // 8. A draft edit must not alter what is live.
  await expectJsonOk(await api.patch(`/api/site-projects/${projectId}`, { data: { content: { storeBuilderV16: corporateConfig("عنوان نسخه دو") } } }));
  await page.reload();
  expect(await liveHeroTitle(page), "an unpublished draft edit must not reach the live site").toBe("عنوان نسخه یک");

  // Publishing the edit promotes it.
  await expectJsonOk(await api.post(`/api/site-projects/${projectId}/publish`));
  await page.reload();
  expect(await liveHeroTitle(page)).toBe("عنوان نسخه دو");

  // 9. Rollback restores the earlier published version.
  const versions = await expectJsonOk(await api.get(`/api/site-projects/${projectId}/versions`));
  const firstVersion = versions.versions.find((entry: { version: number }) => entry.version === 1);
  await expectJsonOk(await api.post(`/api/site-projects/${projectId}/publish-rollback`, { data: { targetVersionId: firstVersion.id } }));
  await page.reload();
  expect(await liveHeroTitle(page), "rollback must restore the earlier live truth").toBe("عنوان نسخه یک");

  await context.close();
});

test("the live contact form creates a real lead, and 390px has no horizontal overflow", async ({ browser }) => {
  const project = await createCorporateProject(`شرکت فرم ${Date.now()}`);
  const projectId = project.id as string;
  await expectJsonOk(await api.patch(`/api/site-projects/${projectId}`, { data: { content: { storeBuilderV16: corporateConfig("عنوان فرم") } } }));
  await expectJsonOk(await api.post(`/api/site-projects/${projectId}/publish`));

  // 11. 390px mobile: the critical content fits with no horizontal page scroll.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`/site/${projectId}`);
  await expect(page.locator("#contact-main")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "390px must not scroll horizontally").toBeLessThanOrEqual(1);

  // The contact form is real: submitting it persists a canonical lead.
  await page.getByLabel("نام و نام خانوادگی").fill("سارا رضایی");
  await page.getByLabel("شماره تماس").fill("09120000000");
  await page.getByLabel("شرح درخواست").fill("درخواست مشاوره از تست");
  await page.getByRole("button", { name: "ارسال درخواست" }).click();
  await expect(page.locator('[data-lead-state="submitted"]')).toBeVisible();

  await context.close();
});
