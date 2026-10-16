import { expect, request, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { TEMPLATES } from "../../src/components/store-studio-v16/templates/registry";

// V18 customer acceptance: each template must be a finished website AND its supported business journey must work.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
const shots = process.env.V18_SHOTS || "test-results/v18";
test.use({ actionTimeout: 15_000 });

async function signIn(browser: Browser): Promise<{ api: APIRequestContext; context: BrowserContext }> {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "V18 Journey" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "V18 Journey" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1440, height: 900 } }) };
}
const ok = async (r: Awaited<ReturnType<APIRequestContext["get"]>>) => { const b = await r.json(); expect(r.ok(), JSON.stringify(b)).toBeTruthy(); return b; };
async function createFrom(page: Page, label: RegExp) {
  await page.goto("/dashboard/websites/corporate?new=1");
  await page.getByRole("button", { name: label }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project as { id: string; siteType: string };
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project;
}
const canvas = (page: Page) => page.locator('[data-canvas-interactive="true"]');
const typeInto = async (page: Page, locator: ReturnType<Page["locator"]>, text: string) => {
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().dblclick();
  await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
  await page.keyboard.press("Enter");
  await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(0);
};
const save = async (page: Page, id: string) => {
  const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${id}` && r.request().method() === "PATCH" && r.status() === 200);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await saved;
};
const publish = async (page: Page, id: string) => {
  const done = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${id}/publish`) && r.status() === 200);
  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  await done;
};
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const submitLead = async (page: Page, name: string) => {
  await page.getByLabel("نام و نام خانوادگی").fill(name);
  await page.getByLabel("شماره تماس").fill("09120000000");
  await page.getByLabel("شرح درخواست").fill("درخواست آزمون پذیرش");
  await page.getByRole("button", { name: /ارسال/ }).last().click();
  await expect(page.locator('[data-lead-state="submitted"]')).toBeVisible();
};

test("picker: every template shows a live preview of its real design", async ({ browser }) => {
  const { context } = await signIn(browser);
  const page = await context.newPage();
  await page.goto("/dashboard/websites/corporate?new=1");
  for (const template of TEMPLATES) {
    const preview = page.locator(`[data-template-preview="${template.id}"]`);
    await expect(preview, template.label).toBeVisible();
    if (template.hero?.title) await expect(preview, `${template.label} preview shows the template's own hero`).toContainText(template.hero.title);
    expect(await preview.locator("img").count(), `${template.label} preview carries real imagery`).toBeGreaterThan(0);
  }
  // Inert and not editable: nothing in a preview can be focused, clicked or edited.
  await expect(page.locator("[data-template-preview] [inert]")).toHaveCount(TEMPLATES.length);
  await expect(page.locator("[data-template-preview] [contenteditable]")).toHaveCount(0);
  await page.screenshot({ path: `${shots}/picker.png`, fullPage: true });
  await context.close();
});

test("Medical clinic: create, customize, connect Booking, publish, a visitor books an appointment", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  const project = await createFrom(page, /کلینیک و پزشک/);
  expect(project.siteType).toBe("MEDICAL");
  const id = project.id;
  try {
    // Customize in place.
    const title = "کلینیک آرامش؛ مراقبت از شما";
    await typeInto(page, canvas(page).locator('[data-editable-scope="hero"][data-editable-field="title"]'), title);
    await save(page, id);

    // Existing Booking system (site-scoped): doctor, service, link, weekly availability.
    const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const post = async (path: string, data: object) => ok(await api.post(path, { data: { siteProjectId: id, ...data } }));
    const service = (await post("/api/booking/services", { name: "ویزیت عمومی", durationMinutes: 30, modalities: ["IN_PERSON"] })).service.id;
    const provider = (await post("/api/booking/providers", { name: "دکتر نمونه" })).provider.id;
    await post(`/api/booking/providers/${provider}/services/${service}`, {});
    await post("/api/booking/availability", { providerId: provider, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 2 });
    await publish(page, id);

    const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/site/${id}`);
    await expect(visitor.getByText(title).first()).toBeVisible();
    await noOverflow(visitor);
    await shot(visitor, "medical-public-mobile");
    // Entry point: the hero action leads into the existing booking journey.
    await visitor.getByRole("link", { name: "رزرو نوبت" }).first().click();
    await expect(visitor).toHaveURL(new RegExp(`/site/${id}/booking`));
    // Error state: continuing without a choice says what is missing.
    await visitor.getByRole("button", { name: "ادامه" }).click();
    await expect(visitor.getByText("یک خدمت یا تخصص را انتخاب کنید.")).toBeVisible();
    await visitor.getByRole("button", { name: /ویزیت عمومی/ }).click(); await visitor.getByRole("button", { name: "ادامه" }).click();
    await visitor.getByRole("button", { name: "دکتر نمونه" }).click(); await visitor.getByRole("button", { name: "ادامه" }).click();
    await visitor.getByRole("button", { name: "حضوری" }).click(); await visitor.getByRole("button", { name: "ادامه" }).click();
    await visitor.getByLabel("تاریخ").fill(date);
    await visitor.getByRole("button", { name: /^۱۰:۰۰/ }).click(); await visitor.getByRole("button", { name: "ادامه" }).click();
    await visitor.getByLabel("نام بیمار").fill("بیمار آزمون"); await visitor.getByLabel("شماره تماس").fill("09120000000");
    await visitor.getByRole("button", { name: "ادامه" }).click();
    await visitor.getByRole("button", { name: "تأیید و ثبت" }).click();
    await expect(visitor.getByText("نوبت شما ثبت شد")).toBeVisible();
    expect((await visitor.getByRole("heading", { name: /کد پیگیری/ }).innerText())).toContain("BK-");
    await shot(visitor, "medical-booking-confirmation");
    await visitorContext.close();
  } finally { await context.close(); }
});

test("Hybrid: customize services and products, supported journeys work, unsupported ones are not faked", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  const project = await createFrom(page, /کسب‌وکار ترکیبی/);
  expect(project.siteType).toBe("HYBRID");
  const id = project.id;
  try {
    // Customize a service and a product in place.
    await typeInto(page, canvas(page).locator('[data-editable-scope="item"][data-editable-field="title"]').filter({ hasText: "ساخت سفارشی" }), "ساخت مبلمان سفارشی");
    await typeInto(page, canvas(page).locator('[data-editable-scope="item"][data-editable-field="title"]').filter({ hasText: "ست ظروف چوب" }), "ست ظروف چوب راش");
    await save(page, id);
    await publish(page, id);

    // Boundary, stated by the backend: Commerce is STORE-only, so a HYBRID project cannot create products or a cart.
    const refused = await api.post(`/api/stores/${id}/products`, { data: { name: "محصول", price: 1000 } });
    expect(refused.status(), "Commerce must stay STORE-only").toBe(409);
    expect((await refused.json()).code).toBe("NOT_STORE_PROJECT");

    const visitorContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/site/${id}`);
    await expect(visitor.getByText("ساخت مبلمان سفارشی").first()).toBeVisible();
    await expect(visitor.getByText("ست ظروف چوب راش").first()).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "محصولات آماده" })).toBeVisible();
    // Display-only showcase: no cart, price, checkout or add-to-cart anywhere.
    await expect(visitor.locator("[data-add-to-cart], [data-cart], [data-checkout]")).toHaveCount(0);
    await expect(visitor.getByRole("button", { name: /افزودن به سبد|پرداخت|خرید/ })).toHaveCount(0);
    // The hero action reaches the showcase; the inquiry form creates a real lead.
    await visitor.getByRole("link", { name: "مشاهده محصولات" }).first().click();
    await expect(visitor).toHaveURL(/#products-main$/);
    await submitLead(visitor, "مشتری ترکیبی");
    await shot(visitor, "hybrid-public");
    await noOverflow(visitor);
    await visitorContext.close();
  } finally { await context.close(); }
});

test("Education: create, the home sells the courses, the booking entry works, enquiry creates a lead", async ({ browser }) => {
  test.setTimeout(240_000);
  const { context } = await signIn(browser);
  const page = await context.newPage();
  const project = await createFrom(page, /مرکز آموزشی/);
  const id = project.id;
  try {
    await publish(page, id);
    const visitorContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/site/${id}`);
    await expect(visitor.getByRole("heading", { name: "دوره‌های آموزشی" }).first()).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "مدرسان" }).first()).toBeVisible();
    expect(await visitor.locator("img").count(), "course and instructor photography").toBeGreaterThanOrEqual(5);
    await submitLead(visitor, "هنرجوی آزمون");
    await shot(visitor, "education-public");
    await visitor.getByRole("link", { name: "رزرو کلاس" }).first().click();
    await expect(visitor).toHaveURL(new RegExp(`/site/${id}/booking`));
    await expect(visitor.locator("[data-booking-experience]")).toBeVisible();
    await visitorContext.close();
  } finally { await context.close(); }
});

for (const [name, label, expectedType] of [["Corporate", /شرکت حرفه‌ای/, "CORPORATE"], ["Legal", /موسسه حقوقی/, "LEGAL"]] as const) {
  test(`${name}: create, customize, publish, the contact flow creates a lead`, async ({ browser }) => {
    test.setTimeout(200_000);
    const { context } = await signIn(browser);
    const page = await context.newPage();
    const project = await createFrom(page, label);
    expect(project.siteType).toBe(expectedType);
    try {
      const title = `${name} آزمون؛ همراه مطمئن شما`;
      await typeInto(page, canvas(page).locator('[data-editable-scope="hero"][data-editable-field="title"]'), title);
      await save(page, project.id);
      await publish(page, project.id);
      const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const visitor = await visitorContext.newPage();
      await visitor.goto(`/site/${project.id}`);
      await expect(visitor.getByText(title).first()).toBeVisible();
      await noOverflow(visitor);
      await submitLead(visitor, `${name} مشتری`);
      await shot(visitor, `${name.toLowerCase()}-public-mobile`);
      await visitorContext.close();
    } finally { await context.close(); }
  });
}
