import { expect, request, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the multi-page corporate journey.");

async function expectJsonOk(response: APIResponse) {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

const section = (id: string, type: string, title: string) => ({
  id, type, enabled: true, title, subtitle: "", body: `متن ${title}`,
  backgroundColor: "#ffffff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32,
  ...(["services", "team", "portfolio"].includes(type)
    ? { columns: 3, items: [{ id: `${id}-1`, title: `${title} یک`, subtitle: "توضیح" }] }
    : {}),
  ...(type === "contact"
    ? { contact: { formEnabled: true, submitLabel: "ارسال", successMessage: "ثبت شد", phone: "02100000000" } }
    : {}),
});

const page = (id: string, title: string, slug: string, type: string) => ({
  id, title, slug, showInNav: true, navLabel: title,
  seo: { title: `${title} | شرکت آزمون`, description: `توضیح سئو ${title}` },
  sections: [section(`${id}-s`, type, title)],
});

/** A real five-page corporate site: /, /services, /team, /portfolio, /contact. */
const multiPageConfig = (homeTitle: string) => ({
  version: 16,
  header: { storeName: "شرکت آزمون", showSearch: false, showAccount: false, showCart: false, sticky: true },
  hero: { enabled: true, title: homeTitle, subtitle: "زیرعنوان", ctaLabel: "تماس", ctaHref: "/contact", eyebrow: "راهکار" },
  nav: { enabled: true, ctaLabel: "تماس با ما", ctaHref: "/contact" },
  footer: { enabled: true, text: "© شرکت آزمون", backgroundColor: "#0f172a", textColor: "#e2e8f0" },
  seo: { title: "شرکت آزمون", description: "توضیح سایت" },
  pages: [
    { ...page("page-home", "خانه", "", "about"), seo: { title: "خانه | شرکت آزمون", description: "توضیح سئو خانه" } },
    page("page-services", "خدمات", "services", "services"),
    page("page-team", "تیم ما", "team", "team"),
    page("page-portfolio", "نمونه‌کارها", "portfolio", "portfolio"),
    page("page-contact", "تماس", "contact", "contact"),
  ],
});

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: apiBaseURL });
  const identity = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const mobile = `092${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
  const otp = await expectJsonOk(await api.post("/api/auth/send-otp", { data: { mobile, name: "Multi Page E2E" } }));
  await expectJsonOk(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
});

test.afterAll(async () => { await api?.dispose().catch(() => undefined); });

async function publishedSite(homeTitle = "عنوان خانه") {
  const created = await expectJsonOk(await api.post("/api/site-projects", {
    data: { name: `شرکت چندصفحه ${Date.now()}`, siteType: "BUSINESS", content: {} },
  }));
  const id = created.project.id as string;
  await expectJsonOk(await api.patch(`/api/site-projects/${id}`, { data: { content: { storeBuilderV16: multiPageConfig(homeTitle) }, idempotencyKey: `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}` } }));
  await expectJsonOk(await api.post(`/api/site-projects/${id}/publish`));
  return id;
}

const heading = (page: Page) => page.locator("h1, h2").first().innerText();
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const viewport of [
  { name: "desktop", size: { width: 1280, height: 900 } },
  { name: "mobile 390px", size: { width: 390, height: 844 } },
]) {
  test(`${viewport.name}: Home → Services → Team → Contact by navigation, by direct URL, with no overflow`, async ({ browser }) => {
    const siteId = await publishedSite();
    const context = await browser.newContext({ viewport: viewport.size });
    const page = await context.newPage();

    // Home
    await page.goto(`/site/${siteId}`);
    await expect(page.locator('[data-page-slug=""]')).toBeVisible();
    await expect(page).toHaveTitle("خانه | شرکت آزمون");
    expect(await noOverflow(page), "home must not scroll horizontally").toBeLessThanOrEqual(1);

    // Navigate by the site menu, which is built from pages[].
    for (const [label, slug, expected] of [["خدمات", "services", "خدمات"], ["تیم ما", "team", "تیم ما"], ["تماس", "contact", "تماس"]] as const) {
      await page.getByRole("link", { name: label, exact: true }).first().click();
      await expect(page.locator(`[data-page-slug="${slug}"]`)).toBeVisible();
      expect(await heading(page)).toContain(expected);
      // Each page carries its own canonical SEO.
      await expect(page).toHaveTitle(`${label} | شرکت آزمون`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", `توضیح سئو ${label}`);
      expect(await noOverflow(page), `${slug} must not scroll horizontally`).toBeLessThanOrEqual(1);
    }

    // Direct URL entry and a hard reload resolve the same page.
    for (const slug of ["services", "team", "portfolio", "contact"]) {
      await page.goto(`/site/${siteId}/${slug}`);
      await expect(page.locator(`[data-page-slug="${slug}"]`)).toBeVisible();
      await page.reload();
      await expect(page.locator(`[data-page-slug="${slug}"]`)).toBeVisible();
      expect(await noOverflow(page), `${slug} after reload`).toBeLessThanOrEqual(1);
    }

    // Only published pages resolve.
    await page.goto(`/site/${siteId}/not-a-page`);
    await expect(page.locator('[data-page-missing="true"]')).toBeVisible();

    await context.close();
  });
}

test("a draft page never reaches the live site until it is published, and rollback restores the collection", async ({ browser }) => {
  const siteId = await publishedSite("نسخه یک");
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`/site/${siteId}`);
  await expect(page.locator('[data-published-version="1"]')).toBeVisible();

  // Draft: add a page and retitle Home. Neither may appear live.
  const draft = multiPageConfig("نسخه دو");
  draft.pages.push(page_("page-news", "اخبار", "news"));
  await expectJsonOk(await api.patch(`/api/site-projects/${siteId}`, { data: { content: { storeBuilderV16: draft }, idempotencyKey: `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}` } }));
  await page.goto(`/site/${siteId}/news`);
  await expect(page.locator('[data-page-missing="true"]')).toBeVisible();
  await page.goto(`/site/${siteId}`);
  expect(await heading(page)).toContain("نسخه یک");

  // Publishing promotes the whole collection.
  await expectJsonOk(await api.post(`/api/site-projects/${siteId}/publish`));
  await page.goto(`/site/${siteId}/news`);
  await expect(page.locator('[data-page-slug="news"]')).toBeVisible();

  // Rollback restores the earlier published collection.
  const versions = await expectJsonOk(await api.get(`/api/site-projects/${siteId}/versions`));
  const first = versions.versions.find((entry: { version: number }) => entry.version === 1);
  await expectJsonOk(await api.post(`/api/site-projects/${siteId}/publish-rollback`, { data: { targetVersionId: first.id } }));
  await page.goto(`/site/${siteId}/news`);
  await expect(page.locator('[data-page-missing="true"]')).toBeVisible();
  await page.goto(`/site/${siteId}`);
  expect(await heading(page)).toContain("نسخه یک");

  await context.close();
});

function page_(id: string, title: string, slug: string) {
  return page(id, title, slug, "about");
}
