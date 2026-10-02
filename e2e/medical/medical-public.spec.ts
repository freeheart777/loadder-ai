import { expect, request, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { navaMedicalV1 } from "../../src/components/store-studio-v16/templates/nava-medical-v1";

const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
const ok = async (response: APIResponse) => { const body = await response.json(); expect(response.ok(), JSON.stringify(body)).toBeTruthy(); return body; };

let api: APIRequestContext, siteId = "";
let serviceA = "", serviceB = "", providerA = "", providerB = "";
const date = (() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10))();
const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
const spa = (path = "") => `/site/${siteId}${path}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: apiBase });
  const mobile = `091${String(Date.now()).slice(-8)}`;
  const otp = await ok(await api.post("/api/auth/send-otp", { data: { mobile, name: "Medical E2E" } }));
  await ok(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
  const created = await ok(await api.post("/api/site-projects", { data: { name: "مرکز درمانی نوا", siteType: "MEDICAL", content: {} } }));
  siteId = created.project.id;

  // Canonical Booking, scoped to this Medical site only.
  const post = async (path: string, data: object) => ok(await api.post(path, { data: { siteProjectId: siteId, ...data } }));
  serviceA = (await post("/api/booking/services", { name: "ویزیت آزمون الف", durationMinutes: 45, modalities: ["IN_PERSON", "VIDEO"], priceAmount: 1200000, priceCurrency: "IRT" })).service.id;
  serviceB = (await post("/api/booking/services", { name: "ویزیت آزمون ب", durationMinutes: 20, modalities: ["IN_PERSON"] })).service.id;
  providerA = (await post("/api/booking/providers", { name: "دکتر آزمون الف" })).provider.id;
  providerB = (await post("/api/booking/providers", { name: "دکتر آزمون ب" })).provider.id;
  await post(`/api/booking/providers/${providerA}/services/${serviceA}`, {});
  await post(`/api/booking/providers/${providerB}/services/${serviceB}`, {});
  // Dr. A offers only video for this service, although the service also allows in-person.
  await ok(await api.put(`/api/booking/providers/${providerA}/services/${serviceA}/modalities`, { data: { siteProjectId: siteId, modalities: ["VIDEO"] } }));
  await post("/api/booking/availability", { providerId: providerA, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 3 });

  // The NAVA starter, with its sample cards linked to the real Booking records.
  const tpl = JSON.parse(JSON.stringify(navaMedicalV1));
  const pageOf = (slug: string) => tpl.pages.find((p: { slug: string }) => p.slug === slug);
  const services = pageOf("services").sections.find((s: { id: string }) => s.id === "services-directory").items;
  services[0].bookingServiceId = serviceA; services[1].bookingServiceId = serviceB;
  const doctors = pageOf("doctors").sections.find((s: { id: string }) => s.id === "doctors-directory").items;
  doctors[0].bookingProviderId = providerA; doctors[1].bookingProviderId = providerB;
  const content = { storeBuilderV16: { design: tpl.design, header: tpl.header, hero: tpl.hero, nav: tpl.nav, footer: tpl.footer, seo: tpl.seo, sections: tpl.sections, pages: [{ id: "page-home", title: "خانه", slug: "", isHome: true, showInNav: true, navLabel: "خانه", seo: { title: "خانه", description: "" }, sections: tpl.sections }, ...tpl.pages] } };
  await ok(await api.patch(`/api/site-projects/${siteId}`, { data: { content, idempotencyKey: `med-${Date.now()}` } }));
  await ok(await api.post(`/api/site-projects/${siteId}/publish`));
});
test.afterAll(async () => { await api?.dispose().catch(() => undefined); });

test("public NAVA pages render from the canonical V16 document at desktop and 390px", async ({ browser }) => {
  for (const [name, viewport] of [["desktop", { width: 1280, height: 800 }], ["390", { width: 390, height: 844 }]] as const) {
    const context = await browser.newContext({ viewport }), page = await context.newPage();
    await page.goto(spa());
    await expect(page.getByText("سلامت شما، با توجه و زمان کافی")).toBeVisible();
    await expect(page.locator('a[href$="/booking"]').first()).toBeVisible();
    for (const text of ["تخصص‌ها و خدمات", "پزشکان", "چرا این مرکز", "امکانات مرکز", "مسیر مراجعه", "تماس و نشانی"]) await expect(page.getByRole("heading", { name: text }).first()).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `test-results/medical-home-${name}.png`, fullPage: true });
    for (const [slug, heading] of [["services", "همهٔ خدمات"], ["doctors", "همهٔ پزشکان"], ["clinic", "دربارهٔ مرکز"], ["magazine", "مجلهٔ سلامت"]] as const) {
      await page.goto(spa(`/${slug}`));
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      await noOverflow(page);
    }
    await context.close();
  }
});

test("services: category chips filter, detail shows canonical Booking facts, CTA preselects the service", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await page.goto(spa("/services"));
  await expect(page.locator("[data-category-chips] button")).toHaveCount(4);
  await expect(page.locator("[data-detail-link]")).toHaveCount(4);
  await page.locator("[data-category-chips]").getByRole("button", { name: "تشخیصی" }).click();
  await expect(page.locator("[data-detail-link]")).toHaveCount(1);
  await page.locator("[data-category-chips]").getByRole("button", { name: "همه" }).click();
  await page.locator("article", { hasText: "خدمت نمونه یک" }).getByRole("link", { name: "بیشتر بخوانید" }).click();
  await expect(page.getByRole("heading", { name: "خدمت نمونه یک" })).toBeVisible();
  const facts = page.locator('[data-booking-facts="service"]');
  await expect(facts).toContainText("۴۵ دقیقه"); await expect(facts).toContainText("حضوری، ویدئویی"); await expect(facts).toContainText("۱٬۲۰۰٬۰۰۰ IRT");
  await expect(page.locator('[data-booking-facts="doctors"]').getByRole("link", { name: "پزشک نمونه یک" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: "test-results/medical-service-detail-390.png", fullPage: true });
  // An unlinked sample card shows no invented facts.
  await page.goto(spa("/services"));
  await page.locator("article", { hasText: "خدمت نمونه سه" }).getByRole("link", { name: "بیشتر بخوانید" }).click();
  await expect(page.locator("[data-booking-facts]")).toHaveCount(0);
  await context.close();
});

test("complete anonymous Medical booking from a service CTA, site-scoped, without echoing contact", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await page.goto(spa("/services"));
  await page.locator("article", { hasText: "خدمت نمونه یک" }).getByRole("link", { name: "بیشتر بخوانید" }).click();
  await page.locator("[data-booking-cta]").click();
  await expect(page).toHaveURL(new RegExp(`/booking\\?service=${serviceA}`));
  await expect(page.getByRole("heading", { name: "مدرس" })).toBeVisible();
  await expect(page.getByRole("button", { name: "دکتر آزمون الف" })).toBeVisible();
  await expect(page.getByText("دکتر آزمون ب")).toHaveCount(0);
  await page.getByRole("button", { name: "دکتر آزمون الف" }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await expect(page.getByRole("heading", { name: "نوع کلاس" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ویدئویی" })).toBeVisible();
  await expect(page.getByRole("button", { name: "حضوری" }), "this doctor does not offer in-person").toHaveCount(0);
  await page.getByRole("button", { name: "ویدئویی" }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByLabel("تاریخ").fill(date);
  await page.getByRole("button", { name: /^10:00/ }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByLabel("نام هنرجو").fill("بیمار آزمون"); await page.getByLabel("شماره تماس").fill("09120000000");
  await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByRole("button", { name: "تأیید و ثبت" }).click();
  const reference = (await page.getByRole("heading", { name: /کد پیگیری/ }).innerText()).split(":")[1].trim();
  expect(reference).toMatch(/^BK-/);
  await noOverflow(page);
  const confirmation = await ok(await api.get(`/api/auth/site/${siteId}/booking/confirmations/${reference}`));
  expect(confirmation.confirmation.customer.contact, "a Medical confirmation never returns the patient's phone").toBeNull();
  const scoped = (await ok(await api.get(`/api/booking?siteProjectId=${siteId}`))).appointments as Array<{ booking_reference: string; site_project_id: string }>;
  expect(scoped.find((a) => a.booking_reference === reference)?.site_project_id).toBe(siteId);
  expect((scoped.find((a) => a.booking_reference === reference) as { modality?: string }).modality).toBe("VIDEO");
  const legacy = (await ok(await api.get("/api/booking"))).appointments as unknown[];
  expect(legacy, "the legacy operator view never sees Medical appointments").toHaveLength(0);
  await context.close();
});

test("doctors: profile shows only their services; CTA preselects doctor and their single service", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await page.goto(spa("/doctors"));
  await expect(page.locator("[data-category-chips] button")).toHaveCount(3);
  await page.locator("article", { hasText: "پزشک نمونه یک" }).getByRole("link", { name: "بیشتر بخوانید" }).click();
  await expect(page.getByRole("heading", { name: "پزشک نمونه یک" })).toBeVisible();
  const services = page.locator('[data-booking-facts="services"]');
  await expect(services.getByRole("link", { name: "خدمت نمونه یک" })).toBeVisible();
  await expect(services.getByText("خدمت نمونه دو")).toHaveCount(0);
  await expect(services).toContainText("ویدئویی");
  await expect(services, "the doctor's own modes, not the whole service's").not.toContainText("حضوری");
  await noOverflow(page);
  await page.screenshot({ path: "test-results/medical-doctor-profile-390.png", fullPage: true });
  await page.locator("[data-booking-cta]").click();
  await expect(page.getByRole("heading", { name: "نوع کلاس" }), "doctor and their only service are already known").toBeVisible();
  await context.close();
});

test("magazine article and clinic page; SSR page mirrors chips, facts and booking links", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await page.goto(spa("/magazine"));
  await page.locator("article", { hasText: "مقاله نمونه یک" }).getByRole("link", { name: "بیشتر بخوانید" }).click();
  await expect(page.getByRole("heading", { name: "مقاله نمونه یک" })).toBeVisible();
  await expect(page.getByText("جایگزین توصیهٔ پزشکی نیست")).toBeVisible();
  await noOverflow(page);
  await page.goto(spa("/clinic"));
  await expect(page.getByRole("heading", { name: "امکانات" }).first()).toBeVisible();
  await context.close();

  const list = await (await api.get(`/api/auth/sites/${siteId}/services`)).text();
  expect(list).toContain('data-medical-public="true"'); expect(list).toContain('class="chips"');
  expect(list).toContain(`href="/api/auth/sites/${siteId}/booking"`);
  const detail = await api.get(`/api/auth/sites/${siteId}/services/${encodeURIComponent("خدمت-نمونه-یک")}`);
  expect(detail.status()).toBe(200);
  const html = await detail.text();
  expect(html).toContain("<dt>مدت</dt><dd>۴۵ دقیقه</dd>");
  expect(html).toContain(`booking?service=${serviceA}`);
});
