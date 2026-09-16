import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL;
if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the corporate hardening journey.");

async function expectJsonOk(response: APIResponse) {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

const section = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id, type, enabled: true, title: `عنوان ${id}`, subtitle: "", body: "متن",
  backgroundColor: "#ffffff", textColor: "#0f172a", spacingTop: 32, spacingBottom: 32, ...extra,
});

const hardenedConfig = () => ({
  version: 16,
  header: { storeName: "شرکت سخت", showSearch: false, showAccount: false, showCart: false, sticky: true },
  // An author link with a hostile scheme must never become a working link.
  nav: { enabled: true, ctaLabel: "تماس", ctaHref: "javascript:alert(1)" },
  hero: { enabled: true, title: "عنوان خانه", subtitle: "زیرعنوان", ctaLabel: "بیشتر", ctaHref: "/contact" },
  footer: { enabled: true, text: "© شرکت" },
  seo: { title: "سایت", description: "توضیح سایت" },
  pages: [
    { id: "h", title: "خانه", slug: "", showInNav: true, seo: { title: "خانه | شرکت سخت", description: "توضیح خانه" }, sections: [section("a", "about")] },
    {
      id: "c", title: "تماس", slug: "contact", showInNav: true,
      seo: { title: "تماس | شرکت سخت", description: "توضیح تماس" },
      sections: [section("b", "contact", { contact: { formEnabled: true, submitLabel: "ارسال درخواست", successMessage: "پیام شما ثبت شد.", phone: "02100000000" } })],
    },
  ],
});

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: apiBaseURL });
  const identity = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const mobile = `093${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
  const otp = await expectJsonOk(await api.post("/api/auth/send-otp", { data: { mobile, name: "Hardening E2E" } }));
  await expectJsonOk(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
});

test.afterAll(async () => { await api?.dispose().catch(() => undefined); });

async function publishedSite() {
  const created = await expectJsonOk(await api.post("/api/site-projects", { data: { name: `شرکت سخت ${Date.now()}`, siteType: "BUSINESS", content: {} } }));
  const id = created.project.id as string;
  await expectJsonOk(await api.patch(`/api/site-projects/${id}`, { data: { content: { storeBuilderV16: hardenedConfig() } } }));
  await expectJsonOk(await api.post(`/api/site-projects/${id}/publish`));
  return id;
}

test("the live site publishes no hostile link and marks the internal address noindex", async ({ browser }) => {
  const siteId = await publishedSite();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/site/${siteId}`);
  await expect(page.locator('[data-page-slug=""]')).toBeVisible();

  // The rejected CTA is shown as text, and no anchor carries a hostile scheme.
  await expect(page.locator('[data-link-rejected="true"]').first()).toBeVisible();
  const hrefs = await page.locator("a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") || ""));
  expect(hrefs.some((href) => /^(javascript|data|vbscript):/i.test(href)), `hostile href published: ${hrefs}`).toBeFalsy();

  // The internal address is never the indexable one.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  // No customer domain is attached, so no canonical may be invented.
  expect(await page.locator('link[rel="canonical"]').count()).toBe(0);

  await context.close();
});

test("the contact form keeps working for a person while the honeypot stays hidden", async ({ browser }) => {
  const siteId = await publishedSite();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`/site/${siteId}/contact`);
  await expect(page.locator('[data-page-slug="contact"]')).toBeVisible();

  // The honeypot exists for bots. It is positioned off-screen rather than
  // display:none, which many form-fillers skip, so "hidden" is asserted the way
  // it is actually achieved: outside the viewport, unfocusable, unannounced.
  const honeypot = page.locator('[data-honeypot="true"]');
  await expect(honeypot).toHaveCount(1);
  await expect(honeypot).toHaveAttribute("tabindex", "-1");
  await expect(honeypot).toHaveAttribute("aria-hidden", "true");
  const box = await honeypot.boundingBox();
  expect(box, "the honeypot renders for bots").not.toBeNull();
  expect(box!.x + box!.width, "the honeypot sits outside the viewport").toBeLessThan(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.getByLabel("نام و نام خانوادگی").fill("سارا رضایی");
  await page.getByLabel("شماره تماس").fill("09125550000");
  await page.getByLabel("شرح درخواست").fill("درخواست مشاوره واقعی");
  await page.getByRole("button", { name: "ارسال درخواست" }).click();
  await expect(page.locator('[data-lead-state="submitted"]')).toBeVisible();

  await context.close();
});
