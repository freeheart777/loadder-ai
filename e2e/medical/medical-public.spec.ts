import fs from "node:fs";
import { expect, request, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { navaMedicalV1 } from "../../src/components/store-studio-v16/templates/nava-medical-v1";

const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
const ok = async (response: APIResponse) => { const body = await response.json(); expect(response.ok(), JSON.stringify(body)).toBeTruthy(); return body; };

let api: APIRequestContext, siteId = "";
let serviceA = "", serviceB = "", providerA = "", providerB = "";
const doctorSessions: Record<string, { token: string; expiresAt: string; displayName: string | null }> = {};
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
  await post("/api/booking/availability", { providerId: providerA, weekday, startsAt: "12:00", endsAt: "13:00", capacity: 3 });

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
  await ok(await api.post(`/api/site-projects/${siteId}/patient-identity`));
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

test("patient signs in with mobile + OTP, books with that identity, and signs out", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await page.goto(spa("/patient"));
  await expect(page.getByRole("heading", { name: "ورود با شمارهٔ موبایل" })).toBeVisible();
  await noOverflow(page);
  await page.getByLabel("شمارهٔ موبایل").fill("۰۹۱۲۳۴۵۶۷۸۹");
  await page.getByRole("button", { name: "ارسال کد" }).click();
  await expect(page.getByLabel("کد تأیید")).toBeVisible();
  await expect(page.getByRole("button", { name: /ارسال مجدد/ }), "resend is throttled by the server cooldown").toBeDisabled();
  const devCode = (await page.locator("[data-dev-otp] bdi").innerText()).trim();
  expect(devCode).toMatch(/^\d{6}$/);
  await page.getByLabel("کد تأیید").fill(devCode === "000000" ? "111111" : "000000");
  await page.getByLabel("نام").fill("بیمار آزمون");
  await page.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(page.getByRole("alert")).toContainText("کد معتبر نیست یا منقضی شده است");
  await page.getByLabel("کد تأیید").fill(devCode);
  await page.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(page.locator('[data-sign-in-state="signed-in"]')).toContainText("بیمار آزمون");
  await page.screenshot({ path: "test-results/medical-patient-signed-in-390.png", fullPage: true });

  // The session carries into Booking: the appointment is linked to this patient, not matched by name.
  await page.getByRole("link", { name: "رزرو نوبت" }).click();
  await page.getByRole("button", { name: /ویزیت آزمون الف/ }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByRole("button", { name: "دکتر آزمون الف" }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByRole("button", { name: "ویدئویی" }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByLabel("تاریخ").fill(date);
  await page.getByRole("button", { name: /^10:00/ }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByLabel("نام هنرجو").fill("بیمار آزمون"); await page.getByLabel("شماره تماس").fill("09123456789");
  await page.getByRole("button", { name: "ادامه" }).click(); await page.getByRole("button", { name: "تأیید و ثبت" }).click();
  const reference = (await page.getByRole("heading", { name: /کد پیگیری/ }).innerText()).split(":")[1].trim();
  const appointments = (await ok(await api.get(`/api/booking?siteProjectId=${siteId}`))).appointments as Array<{ booking_reference: string; app_user_id: string | null; auth_project_id: string | null; customer_name: string }>;
  const linked = appointments.find((entry) => entry.booking_reference === reference)!;
  expect(linked.app_user_id).toBeTruthy(); expect(linked.auth_project_id).toBeTruthy();
  const anonymousSameName = appointments.filter((entry) => entry.customer_name === "بیمار آزمون" && entry.booking_reference !== reference);
  expect(anonymousSameName.every((entry) => entry.app_user_id === null), "an earlier anonymous booking with the same name stays unclaimed").toBe(true);

  // Patient portal: this patient's own appointment, same record the operator sees.
  await page.getByRole("link", { name: "مشاهدهٔ در نوبت‌های من" }).click();
  await expect(page).toHaveURL(new RegExp("/patient/portal$"));
  const next = page.locator('[data-appointment="next"]');
  await expect(next).toContainText("ویزیت آزمون الف"); await expect(next).toContainText("دکتر آزمون الف"); await expect(next).toContainText("ویدئویی"); await expect(next).toContainText(reference); await expect(next).toContainText("در انتظار تأیید");
  await expect(page.locator("[data-appointment]"), "the earlier anonymous booking with the same name is not claimed").toHaveCount(1);
  await expect(page.locator("main")).not.toContainText(/پرداخت|پیام|لغو نوبت|تغییر زمان/);
  await noOverflow(page);
  await page.screenshot({ path: "test-results/medical-patient-portal-390.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await noOverflow(page);
  await page.screenshot({ path: "test-results/medical-patient-portal-desktop.png", fullPage: true });

  // Another patient sees none of it.
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } }), otherPage = await other.newPage();
  await otherPage.goto(spa("/patient/portal"));
  await expect(otherPage, "no session redirects to sign-in").toHaveURL(new RegExp("/patient\\?next="));
  await otherPage.getByLabel("شمارهٔ موبایل").fill("09129998888");
  await otherPage.getByRole("button", { name: "ارسال کد" }).click();
  await otherPage.getByLabel("کد تأیید").fill((await otherPage.locator("[data-dev-otp] bdi").innerText()).trim());
  await otherPage.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(otherPage.locator("[data-patient-portal]")).toBeVisible();
  await expect(otherPage.locator("[data-portal-empty]")).toBeVisible();
  await expect(otherPage.locator("[data-appointment]")).toHaveCount(0);
  await other.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "خروج" }).click();
  await expect(page.getByLabel("شمارهٔ موبایل")).toBeVisible();
  const stored = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("loadder-")));
  expect(stored).toHaveLength(0);
  await context.close();
});

test("doctor portal: own appointments and schedule only, confirm, availability, other doctor sees nothing", async ({ browser }) => {
  const doctors = [["09127770001", providerA], ["09127770002", providerB]] as const;
  for (const [mobile, providerId] of doctors) await ok(await api.post(`/api/site-projects/${siteId}/doctor-identities`, { data: { providerId, mobile, displayName: providerId === providerA ? "دکتر آزمون الف" : "دکتر آزمون ب" } }));
  const signIn = async (mobile: string) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
    await page.goto(spa("/doctor"));
    await page.getByLabel("شمارهٔ موبایل پزشک").fill(mobile);
    await page.getByRole("button", { name: "ارسال کد" }).click();
    await page.getByLabel("کد تأیید پزشک").fill((await page.locator("[data-dev-otp] bdi").innerText()).trim());
    await page.getByRole("button", { name: "تأیید و ورود" }).click();
    await expect(page.getByRole("button", { name: "خروج" })).toBeVisible();
    doctorSessions[mobile] = await page.evaluate((id) => JSON.parse(sessionStorage.getItem(`loadder-doctor:${id}`) || "null"), siteId);
    return { context, page };
  };
  // An unknown number is told nothing different and gets no account.
  const stranger = await browser.newContext(), strangerPage = await stranger.newPage();
  await strangerPage.goto(spa("/doctor"));
  await strangerPage.getByLabel("شمارهٔ موبایل پزشک").fill("09120001111");
  await strangerPage.getByRole("button", { name: "ارسال کد" }).click();
  await expect(strangerPage.locator("[data-dev-otp]")).toHaveCount(0);
  await strangerPage.getByLabel("کد تأیید پزشک").fill("123456");
  await strangerPage.getByRole("button", { name: "تأیید و ورود" }).click();
  await expect(strangerPage.getByRole("alert")).toContainText("کد معتبر نیست");
  await stranger.close();

  const a = await signIn("09127770001");
  await expect(a.page.locator('[data-appointment="upcoming"]').first()).toContainText("بیمار آزمون");
  const count = await a.page.locator('[data-appointment="upcoming"]').count();
  expect(count).toBeGreaterThanOrEqual(2);
  await expect(a.page.locator("main")).not.toContainText("دکتر آزمون ب");
  await noOverflow(a.page);
  await a.page.screenshot({ path: "test-results/medical-doctor-portal-390.png", fullPage: true });
  await a.page.getByRole("button", { name: "تأیید نوبت" }).first().click();
  await expect(a.page.locator('[data-appointment="upcoming"]').filter({ hasText: "تأییدشده" })).toHaveCount(1);
  // own availability: add and cancel
  await a.page.getByLabel("روز هفته").selectOption("3");
  await a.page.getByRole("button", { name: "افزودن زمان" }).click();
  const added = a.page.locator("[data-slot]").filter({ hasText: "چهارشنبه" });
  await expect(added).toHaveCount(1);
  await added.getByRole("button", { name: "لغو" }).click();
  await expect(a.page.locator('[data-slot="CANCELLED"]')).toHaveCount(1);
  const confirmed = ((await ok(await api.get(`/api/booking?siteProjectId=${siteId}`))).appointments as Array<{ provider_id: string; status: string }>).filter((x) => x.provider_id === providerA && x.status === "CONFIRMED");
  expect(confirmed, "the operator sees the doctor's confirmation on the same canonical record").toHaveLength(1);
  await a.context.close();

  const b = await signIn("09127770002");
  await expect(b.page.locator("[data-doctor-empty]")).toBeVisible();
  await expect(b.page.locator("[data-appointment]")).toHaveCount(0);
  await expect(b.page.locator("main")).not.toContainText("بیمار آزمون");
  await b.context.close();
});

test("private documents: patient uploads, doctor of that appointment reads, others and operators are held back", async ({ browser }) => {
  const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const pub = `/api/auth/site/${siteId}`;
  const anon = await request.newContext({ baseURL: apiBase });
  // API-level patient sign-in and booking (the UI journeys are covered above).
  const otp = await ok(await anon.post(`${pub}/patient/otp`, { data: { mobile: "09128880001" } }));
  const signed = await ok(await anon.post(`${pub}/patient/verify`, { data: { mobile: "09128880001", code: otp.developmentOtp, name: "بیمار مدارک" } }));
  const identity = { "X-Loadder-App-Token": signed.session.token, "X-Loadder-App-Project": signed.authProjectId };
  const booked = await ok(await anon.post(`${pub}/booking/appointments`, { headers: identity, data: { serviceId: serviceA, providerId: providerA, date, startsAt: "12:00", customerName: "بیمار مدارک", customerContact: "09128880001", modality: "VIDEO" } }));
  const appointmentId = booked.appointment.id as string;

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(([id, session]) => { sessionStorage.setItem(`loadder-patient:${id}`, JSON.stringify(session)); }, [siteId, { token: signed.session.token, authProjectId: signed.authProjectId, expiresAt: signed.session.expiresAt, displayName: "بیمار مدارک" }] as const);
  const page = await context.newPage();
  await page.goto(spa("/patient/portal"));
  await page.getByRole("button", { name: "مدارک" }).first().click();
  await expect(page.locator("[data-documents-empty]")).toBeVisible();
  // SVG and other types are refused with a truthful message.
  await page.getByLabel("عنوان مدرک").fill("تصویر");
  await page.getByLabel("فایل مدرک").setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>") });
  await page.getByRole("button", { name: "بارگذاری خصوصی" }).click();
  await expect(page.getByRole("alert")).toContainText("فقط فایل‌های PDF");
  await page.getByLabel("عنوان مدرک").fill("نتیجه آزمایش خون");
  await page.getByLabel("فایل مدرک").setInputFiles({ name: "blood.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "بارگذاری خصوصی" }).click();
  await expect(page.locator("[data-document]")).toContainText("نتیجه آزمایش خون");
  await expect(page.locator("[data-document]")).toContainText("بررسی امنیتی انجام نشده");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-document]").getByRole("button", { name: "دانلود" }).click()]);
  expect(fs.readFileSync((await download.path())!).equals(PDF)).toBe(true);
  await noOverflow(page);
  await page.screenshot({ path: "test-results/medical-patient-documents-390.png", fullPage: true });

  // The patient's own file is unreachable without their session, and without a public path.
  const row = await anon.get(`${pub}/patient/appointments/${appointmentId}/documents`, { headers: { "X-Loadder-App-Token": "forged" } });
  expect(row.status()).toBe(401);
  const documents = (await ok(await anon.get(`${pub}/patient/appointments/${appointmentId}/documents`, { headers: identity }))).documents as Array<{ id: string }>;
  expect(JSON.stringify(documents)).not.toMatch(/storage|sha256|private/i);

  // The assigned doctor reads it; the other doctor cannot.
  // Doctor sessions come from the doctor-portal journey above (sign-in is throttled per number).
  const doctorSession = async (mobile: string) => ({ "X-Loadder-App-Token": doctorSessions[mobile].token });
  const docA = await doctorSession("09127770001"), docB = await doctorSession("09127770002");
  expect((await anon.get(`${pub}/doctor/appointments/${appointmentId}/documents`, { headers: docB })).status(), "another doctor's appointment").toBe(404);
  expect((await anon.get(`${pub}/doctor/documents/${documents[0].id}/file`, { headers: docB })).status()).toBe(404);
  const mine = await anon.get(`${pub}/doctor/documents/${documents[0].id}/file`, { headers: docA });
  expect(mine.status()).toBe(200); expect((await mine.body()).equals(PDF)).toBe(true);
  expect(mine.headers()["cache-control"]).toBe("no-store"); expect(mine.headers()["x-content-type-options"]).toBe("nosniff");

  const doctorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await doctorContext.addInitScript(([id, session]) => { sessionStorage.setItem(`loadder-doctor:${id}`, JSON.stringify(session)); }, [siteId, doctorSessions["09127770001"]] as const);
  const doctorPage = await doctorContext.newPage();
  await doctorPage.goto(spa("/doctor"));
  const item = doctorPage.locator('[data-appointment="upcoming"]').filter({ hasText: "بیمار مدارک" });
  await item.getByRole("button", { name: "مدارک" }).click();
  await expect(item.locator("[data-document]")).toContainText("نتیجه آزمایش خون");
  await noOverflow(doctorPage);
  await doctorPage.context().close();

  // Operators see metadata only; opening a file needs a stated reason and is audited.
  const listed = await ok(await api.get(`/api/site-projects/${siteId}/medical-documents`));
  expect(JSON.stringify(listed)).not.toContain("نتیجه آزمایش خون");
  expect((await api.post(`/api/site-projects/${siteId}/medical-documents/${documents[0].id}/access`, { data: {} })).status()).toBe(400);
  const opened = await api.post(`/api/site-projects/${siteId}/medical-documents/${documents[0].id}/access`, { data: { reason: "درخواست پشتیبانی توسط بیمار" } });
  expect(opened.status()).toBe(200); expect((await opened.body()).equals(PDF)).toBe(true);

  // Deleting removes access for everyone.
  await page.locator("[data-document]").getByRole("button", { name: "حذف" }).click();
  await expect(page.locator("[data-documents-empty]")).toBeVisible();
  expect((await anon.get(`${pub}/doctor/documents/${documents[0].id}/file`, { headers: docA })).status()).toBe(404);
  await context.close(); await anon.dispose();
});

test("Medical Control Center: real counts, every tab on canonical data, no fabricated modules", async ({ browser }) => {
  test.setTimeout(120_000);
  const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const pub = `/api/auth/site/${siteId}`;
  // A second patient with a document, created through the public API.
  const anon = await request.newContext({ baseURL: apiBase });
  const otp = await ok(await anon.post(`${pub}/patient/otp`, { data: { mobile: "09128880002" } }));
  const signed = await ok(await anon.post(`${pub}/patient/verify`, { data: { mobile: "09128880002", code: otp.developmentOtp, name: "بیمار فایل" } }));
  const identity = { "X-Loadder-App-Token": signed.session.token, "X-Loadder-App-Project": signed.authProjectId };
  const booked = await ok(await anon.post(`${pub}/booking/appointments`, { headers: identity, data: { serviceId: serviceA, providerId: providerA, date, startsAt: "12:00", customerName: "بیمار فایل", customerContact: "09128880002", modality: "VIDEO" } }));
  const up = await anon.post(`${pub}/patient/appointments/${booked.appointment.id}/documents`, { headers: { ...identity, "Content-Type": "application/pdf", "X-Document-Title": encodeURIComponent("پرونده"), "X-Document-Filename": "a.pdf" }, data: PDF });
  expect(up.status()).toBe(201);

  const context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 390, height: 844 } }), page = await context.newPage();
  const tab = (key: string) => page.locator(`[data-tab="${key}"]`);
  await page.goto(`/dashboard/websites/${siteId}/medical`);
  await expect(page.getByRole("heading", { name: "مرکز درمانی نوا" })).toBeVisible();
  await expect(page.locator("[data-tab]")).toHaveCount(9);
  await expect(page.locator("main")).not.toContainText(/پرداخت‌ها|پیام‌ها/);

  // Dashboard numbers equal the canonical API counts.
  const summary = (await ok(await api.get(`/api/site-projects/${siteId}/medical/summary`))).summary;
  expect(summary.patients).toBeGreaterThanOrEqual(2); expect(summary.documents).toBeGreaterThanOrEqual(1);
  await expect(page.locator('[data-stat="بیماران"]')).toContainText(summary.patients.toLocaleString("fa-IR"));
  await expect(page.locator('[data-stat="پزشکان"]')).toContainText(summary.providers.toLocaleString("fa-IR"));
  await expect(page.locator('[data-stat="مدارک فعال"]')).toContainText(summary.documents.toLocaleString("fa-IR"));
  await noOverflow(page);
  await page.screenshot({ path: "test-results/medical-control-center-390.png", fullPage: true });

  await tab("patients").click();
  await expect(page.locator("[data-patient]").first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(".invalid");
  await expect(page.locator("[data-patient]").filter({ hasText: "09128880002" }), "numbers are masked").toHaveCount(0);
  await noOverflow(page);

  await tab("doctors").click();
  await expect(page.locator("[data-doctor]").filter({ hasText: "دکتر آزمون الف" })).toContainText("ورود فعال");
  await page.getByLabel("نام پزشک").fill("دکتر پنل");
  await page.getByRole("button", { name: "افزودن پزشک" }).click();
  const fresh = page.locator("article").filter({ hasText: "دکتر پنل" });
  await fresh.getByLabel("موبایل دکتر پنل").fill("09127770003");
  await fresh.getByRole("button", { name: "تعریف ورود" }).click();
  await expect(page.locator("[data-doctor]").filter({ hasText: "دکتر پنل" })).toContainText("ورود فعال");
  await page.locator("article").filter({ hasText: "دکتر پنل" }).getByRole("button", { name: "لغو دسترسی" }).click();
  await expect(page.locator("[data-doctor]").filter({ hasText: "دکتر پنل" })).toContainText("ورود لغوشده");
  await noOverflow(page);

  await tab("services").click();
  await page.getByLabel("نام خدمت").fill("خدمت پنل");
  await page.getByRole("button", { name: "افزودن خدمت" }).click();
  await expect(page.locator("[data-service]").filter({ hasText: "خدمت پنل" })).toContainText("حضوری");
  await page.getByLabel("پزشک", { exact: true }).selectOption({ label: "دکتر پنل" });
  await page.getByLabel("خدمت", { exact: true }).selectOption({ label: "خدمت پنل" });
  await page.getByRole("button", { name: "اتصال پزشک به خدمت" }).click();
  await expect(page.getByRole("status")).toContainText("متصل شد");
  await noOverflow(page);

  await tab("schedules").click();
  await page.getByLabel("پزشک زمان").selectOption({ label: "دکتر پنل" });
  await page.getByRole("button", { name: "افزودن زمان" }).click();
  await expect(page.locator("[data-slot]").filter({ hasText: "09:00–10:00" }).first()).toBeVisible();

  await tab("appointments").click();
  await expect(page.locator("[data-appointment-row]").first()).toBeVisible();
  const pending = page.locator("article").filter({ hasText: "بیمار فایل" });
  await pending.getByRole("button", { name: "تأیید" }).click();
  await expect(page.locator("article").filter({ hasText: "بیمار فایل" })).toContainText("تأییدشده");
  await noOverflow(page);

  await tab("content").click();
  await expect(page.locator("[data-site-status]")).toContainText("منتشرشده");

  await tab("files").click();
  await expect(page.locator("[data-file]").first()).toContainText("application/pdf");
  await expect(page.locator("main")).not.toContainText("پرونده");
  const row = page.locator("article").filter({ hasText: "بدون اسکن" }).first();
  await row.getByRole("button", { name: "باز کردن" }).click();
  await expect(page.getByRole("alert")).toContainText("دلیل دسترسی");
  await row.getByLabel("دلیل دسترسی").fill("پیگیری درخواست پشتیبانی بیمار");
  const [download] = await Promise.all([page.waitForEvent("download"), row.getByRole("button", { name: "باز کردن" }).click()]);
  expect(fs.readFileSync((await download.path())!).equals(PDF)).toBe(true);
  await noOverflow(page);

  await tab("settings").click();
  await expect(page.locator("[data-otp-state]")).toContainText("شبیه‌ساز");
  await expect(page.locator("[data-documents-state]")).toContainText("آمادهٔ تولید نیست");
  await expect(page.locator("[data-settings]")).toContainText("فعال");
  await page.screenshot({ path: "test-results/medical-control-center-settings-390.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await noOverflow(page);
  await page.screenshot({ path: "test-results/medical-control-center-desktop.png", fullPage: true });
  await context.close(); await anon.dispose();
});
