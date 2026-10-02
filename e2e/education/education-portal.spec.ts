import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { expect, request, test, type APIRequestContext, type APIResponse, type Browser, type Page } from "@playwright/test";

const apiBase = process.env.E2E_API_BASE_URL, dbPath = process.env.E2E_DATABASE_PATH, videoFixture = process.env.E2E_VIDEO_FIXTURE;
if (!apiBase || !dbPath || !videoFixture) throw new Error("E2E_API_BASE_URL, E2E_DATABASE_PATH and E2E_VIDEO_FIXTURE are required.");
const Database = createRequire(import.meta.url)("../../server/node_modules/better-sqlite3");

const sha = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const ok = async (response: APIResponse) => { const body = await response.json(); expect(response.ok(), JSON.stringify(body)).toBeTruthy(); return body; };
const b64url = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(64, 1)]);
const MEDIA = "https://media.example.test";

let api: APIRequestContext, siteId = "", workspaceId = "", authId = "", cookies: Awaited<ReturnType<APIRequestContext["storageState"]>>;
const invites: Record<string, string> = {};
const users: Record<string, string> = {};

const section = (over: Record<string, unknown>) => ({ enabled: true, subtitle: "", backgroundColor: "#2e2c28", textColor: "#f5f0e5", spacingTop: 32, spacingBottom: 32, ...over });
const educationDoc = () => ({
  version: 16, seo: { title: "آموزشگاه آزمون", description: "آموزش موسیقی" }, nav: { enabled: true, ctaLabel: "رزرو", ctaHref: "#" }, footer: { enabled: true, text: "© آزمون" },
  header: { storeName: "آموزشگاه آزمون", showSearch: false, showAccount: false, showCart: false, sticky: true },
  hero: { enabled: false, title: "", subtitle: "", ctaLabel: "", ctaHref: "" },
  pages: [
    { id: "page-home", title: "خانه", slug: "", isHome: true, showInNav: true, sections: [section({ id: "about-main", type: "about", title: "درباره", body: "متن" })] },
    { id: "page-performances", title: "اجراها", slug: "performances", showInNav: true, sections: [section({ id: "performances-directory", type: "portfolio", title: "اجراها", columns: 3, items: [
      { id: "p1", title: "اجرای ویدئویی", subtitle: "کنسرت", body: "شرح اجرا", imageUrl: `${MEDIA}/poster.png`, videoUrl: `${MEDIA}/performance.webm` },
      { id: "p2", title: "اجرای بدون ویدئو", subtitle: "برنامه", body: "هنوز ضبطی نیست" },
      { id: "p3", title: "اجرای خراب", subtitle: "برنامه", body: "فایل در دسترس نیست", videoUrl: `${MEDIA}/missing.webm` },
    ] })] },
  ],
  sections: [],
});

async function routeMedia(page: Page) {
  await page.route(`${MEDIA}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/performance.webm") return route.fulfill({ status: 200, contentType: "video/webm", body: fs.readFileSync(videoFixture!) });
    if (path === "/poster.png") return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.fulfill({ status: 404, body: "missing" });
  });
}
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const operatorContext = (browser: Browser) => browser.newContext({ storageState: cookies });

async function seedStudent(db: any, key: string, email: string) {
  const id = crypto.randomUUID(), token = crypto.randomBytes(24).toString("base64url"), ts = new Date().toISOString();
  db.prepare("INSERT INTO business_builder_app_users(id,workspace_id,project_id,email,display_name,role,status,created_at,updated_at) VALUES(?,?,?,?,?, 'customer','active',?,?)").run(id, workspaceId, authId, email, key, ts, ts);
  db.prepare("INSERT INTO business_builder_app_invites(id,workspace_id,project_id,app_user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(), workspaceId, authId, id, sha(token), new Date(Date.now() + 3_600_000).toISOString(), ts);
  users[key] = id; invites[key] = token;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: apiBase });
  const mobile = `091${String(Date.now()).slice(-8)}`;
  const otp = await ok(await api.post("/api/auth/send-otp", { data: { mobile, name: "Education E2E" } }));
  await ok(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
  cookies = await api.storageState();
  const created = await ok(await api.post("/api/site-projects", { data: { name: "آموزشگاه آزمون", siteType: "EDUCATION", content: {} } }));
  siteId = created.project.id;
  await ok(await api.patch(`/api/site-projects/${siteId}`, { data: { content: { storeBuilderV16: educationDoc() }, idempotencyKey: `edu-${Date.now()}` } }));
  await ok(await api.post(`/api/site-projects/${siteId}/publish`));

  // No public API creates an app user without generating a whole Business Builder
  // project, so the fixture rows are inserted; sign-in itself is the real invite exchange.
  const db = new Database(dbPath);
  workspaceId = db.prepare("SELECT workspace_id AS id FROM site_projects WHERE id=?").get(siteId).id;
  authId = crypto.randomUUID();
  const ts = new Date().toISOString();
  db.prepare("INSERT INTO business_builder_projects(id,workspace_id,name,intent,locale,status,created_at,updated_at) VALUES(?,?,?,?,?,'ready',?,?)").run(authId, workspaceId, "Students", "students", "fa-IR", ts, ts);
  await seedStudent(db, "alice", "alice@example.test");
  await seedStudent(db, "bob", "bob@example.test");
  await seedStudent(db, "carol", "carol@example.test");
  db.close();
});
test.afterAll(async () => { await api?.dispose().catch(() => undefined); });

test("Control Center: real counts, enrol an existing customer, upload private files, revoke", async ({ browser }) => {
  const context = await operatorContext(browser), page = await context.newPage();
  const cc = (module = "") => `/dashboard/websites/${siteId}/control${module ? `/${module}` : ""}`;
  await page.goto(`/dashboard/websites/${siteId}/education`);
  await expect(page, "the old per-vertical address lands on the one Control Center route").toHaveURL(new RegExp(`${cc()}$`));
  await expect(page.getByRole("heading", { name: "آموزشگاه آزمون" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "نمای کلی" })).toBeVisible();
  await page.goto(cc("people")); await expect(page.getByText("هنوز دانشجویی ثبت‌نام نشده است.")).toBeVisible();
  await page.goto(cc("files")); await expect(page.getByText("هنوز منبع خصوصی‌ای بارگذاری نشده است.")).toBeVisible();
  await page.goto(cc("services")); await expect(page.getByText(/هنوز دوره‌ای تعریف نشده است|این بخش فقط برای مالک یا مدیر Workspace/)).toBeVisible();

  await page.goto(cc("people"));
  await page.getByLabel("کاربر مشتری").selectOption({ label: "alice · alice@example.test (Students)" });
  await page.getByRole("button", { name: "ثبت‌نام دانشجو" }).click();
  await expect(page.locator('[data-enrollment-status="active"]')).toContainText("alice@example.test");
  await page.getByLabel("کاربر مشتری").selectOption({ label: "carol · carol@example.test (Students)" });
  await page.getByRole("button", { name: "ثبت‌نام دانشجو" }).click();
  await expect(page.locator('[data-enrollment-status="active"]')).toHaveCount(2);

  await page.goto(cc("files"));
  const uploads: [string, string, Buffer, string][] = [["جزوه جلسه یک", "lesson.pdf", PDF, "application/pdf"], ["تمرین صوتی", "practice.mp3", MP3, "audio/mpeg"], ["ویدئوی آموزشی", "lesson.webm", fs.readFileSync(videoFixture), "video/webm"]];
  for (const [title, name, buffer, mimeType] of uploads) {
    await page.getByLabel("عنوان منبع").fill(title);
    await page.getByLabel("فایل منبع").setInputFiles({ name, mimeType, buffer });
    await page.getByRole("button", { name: "بارگذاری خصوصی" }).click();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  }
  await page.goto(cc());
  await expect(page.getByRole("heading", { name: "نمای کلی" })).toBeVisible();
  await expect(page.locator('[data-stat="دانشجوی فعال"]')).toContainText("۲");
  await expect(page.locator('[data-stat="منبع آموزشی"]')).toContainText("۳");
  await expect(page.locator("main")).not.toContainText(/درآمد|حضور و غیاب|پیام جدید/);

  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: "test-results/education-control-center-390.png", fullPage: true });

  await page.goto(cc("people"));
  await page.locator('[data-enrollment-status="active"]', { hasText: "carol@example.test" }).getByRole("button", { name: "لغو دسترسی" }).click();
  await expect(page.locator('[data-enrollment-status="revoked"]')).toContainText("carol@example.test");
  await context.close();
});

test("Control Center: Education sidebar vocabulary, Booking management on canonical records, website connection", async ({ browser }) => {
  const EDUCATION_NAV = ["نمای کلی", "محتوا", "دانشجویان", "مدرس‌ها", "دوره‌ها", "برنامهٔ مدرس‌ها", "رزروها", "منابع آموزشی"];
  const context = await operatorContext(browser), page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/dashboard/websites/${siteId}/control`);
  await expect(page.locator('[data-cc-kind="EDUCATION"]')).toBeVisible();
  const side = (await page.locator("[data-cc-sidebar]").boundingBox())!;
  expect(side.x + side.width, "sidebar hugs the right edge").toBeGreaterThanOrEqual(1280 - 1);
  expect(await page.locator("[data-cc-sidebar] [data-tab]").allInnerTexts()).toEqual(EDUCATION_NAV);
  const nav = await page.locator("[data-cc-sidebar]").innerText();
  for (const term of ["بیمار", "پزشک", "نوبت‌ها", "درمان", "پرداخت‌ها", "پیام‌ها", "تحلیل"]) expect(nav, `no "${term}" in the Education navigation`).not.toContain(term);
  await noOverflow(page);
  await page.screenshot({ path: "test-results/control-center-education-desktop.png", fullPage: true });

  // Website connection, both directions.
  await expect(page.locator('[data-cc-action="view-website"]')).toHaveAttribute("href", `/site/${siteId}`);
  await page.locator('[data-cc-action="edit-website"]').click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/websites/corporate\\?project=${siteId}`));
  await expect(page.locator("[data-studio-control-center]")).toBeVisible({ timeout: 20_000 });
  await page.locator("[data-studio-control-center]").click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/websites/${siteId}/control$`));

  // Booking management: create a course and a teacher through the Control Center; they are canonical Booking records.
  await page.goto(`/dashboard/websites/${siteId}/control/providers`);
  await expect(page.getByRole("heading", { name: "مدرس‌ها" })).toBeVisible();
  await page.getByLabel("نام مدرس").fill("مدرس کنترل"); await page.getByRole("button", { name: "افزودن مدرس" }).click();
  await expect(page.locator("[data-provider]").filter({ hasText: "مدرس کنترل" })).toBeVisible();
  await page.goto(`/dashboard/websites/${siteId}/control/services`);
  await page.getByLabel("نام دوره").fill("دوره کنترل"); await page.getByRole("button", { name: "افزودن دوره" }).click();
  await expect(page.locator("[data-service]").filter({ hasText: "دوره کنترل" })).toBeVisible();
  await page.getByLabel("مدرس", { exact: true }).selectOption({ label: "مدرس کنترل" });
  await page.getByLabel("دوره", { exact: true }).selectOption({ label: "دوره کنترل" });
  await page.getByRole("button", { name: "اتصال مدرس به دوره" }).click();
  await expect(page.getByRole("status")).toContainText("متصل شد");
  const stored = await ok(await api.get(`/api/booking?siteProjectId=${siteId}`));
  expect(stored.services.find((x: { name: string }) => x.name === "دوره کنترل")?.site_project_id).toBe(siteId);
  expect(stored.providers.find((x: { name: string }) => x.name === "مدرس کنترل")?.site_project_id).toBe(siteId);
  // The public Education booking reads the very same records.
  const catalog = await ok(await api.get(`/api/auth/site/${siteId}/booking/services`));
  expect(catalog.services.map((x: { name: string }) => x.name)).toContain("دوره کنترل");
  await page.goto(`/dashboard/websites/${siteId}/control/appointments`);
  await expect(page.getByRole("heading", { name: "رزروها" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/بیمار|پزشک/);

  // 390px: compact bar + menu, no overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-cc-sidebar]")).toBeHidden();
  await page.locator("[data-cc-menu-button]").click();
  await expect(page.locator("[data-cc-menu] [data-tab]")).toHaveCount(8);
  await noOverflow(page);
  await page.screenshot({ path: "test-results/control-center-education-390-menu.png", fullPage: true });
  await context.close();
});

test("Student Portal: sign-in required, non-enrolled denied, enrolled student reads and downloads, revoked denied", async ({ browser }) => {
  const portal = `/learn/${authId}/${siteId}`;
  const raw = `${apiBase}/api/auth/public/apps/${authId}/education/sites/${siteId}/resources`;
  expect((await api.get(raw, { headers: {} })).status()).toBe(401);

  const anon = await (await browser.newContext()).newPage();
  await anon.goto(portal);
  await expect(anon.getByText("از لینک دعوتی که برای شما ارسال شده وارد شوید")).toBeVisible();
  await anon.context().close();

  const bobPage = await (await browser.newContext()).newPage();
  await bobPage.goto(`${portal}?invite=${invites.bob}`);
  await expect(bobPage.getByText("ثبت‌نام فعال ندارد")).toBeVisible();
  await expect(bobPage.locator("article")).toHaveCount(0);
  expect(bobPage.url()).not.toContain("invite=");
  await bobPage.context().close();

  const carolPage = await (await browser.newContext()).newPage();
  await carolPage.goto(`${portal}?invite=${invites.carol}`);
  await expect(carolPage.getByText("ثبت‌نام فعال ندارد")).toBeVisible();
  await carolPage.context().close();

  const context = await browser.newContext(), page = await context.newPage();
  const bodies: string[] = [];
  page.on("response", async (response) => { if (response.url().includes("/education/sites/") && response.headers()["content-type"]?.includes("json")) bodies.push(await response.text().catch(() => "")); });
  await page.goto(`${portal}?invite=${invites.alice}`);
  await expect(page.locator("article")).toHaveCount(3);
  for (const title of ["جزوه جلسه یک", "تمرین صوتی", "ویدئوی آموزشی"]) await expect(page.getByRole("heading", { name: title })).toBeVisible();
  expect(bodies.join("")).not.toMatch(/storageKey|storage_key|site-media/);
  await expect(page.locator("main")).not.toContainText(/پرداخت|پیام|حضور|جلسهٔ بعدی/);

  const pdfCard = page.locator("article", { hasText: "جزوه جلسه یک" });
  await expect(pdfCard.getByRole("button", { name: "پخش" })).toHaveCount(0);
  const [download] = await Promise.all([page.waitForEvent("download"), pdfCard.getByRole("button", { name: "دانلود امن" }).click()]);
  expect(fs.readFileSync((await download.path())!).equals(PDF)).toBe(true);

  await page.locator("article", { hasText: "تمرین صوتی" }).getByRole("button", { name: "پخش" }).click();
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await page.locator("article", { has: page.getByRole("heading", { name: "ویدئوی آموزشی" }) }).getByRole("button", { name: "پخش" }).click();
  await expect(page.locator("video")).toHaveAttribute("src", /^blob:/);

  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: "test-results/education-student-portal-390.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "test-results/education-student-portal-desktop.png", fullPage: true });

  const operator = await request.newContext({ baseURL: apiBase, storageState: cookies });
  const { enrollments } = await ok(await operator.get(`/api/site-projects/${siteId}/learning-enrollments`));
  const aliceEnrollment = enrollments.find((entry: { student: { email: string } }) => entry.student.email === "alice@example.test");
  await ok(await operator.delete(`/api/site-projects/${siteId}/learning-enrollments/${aliceEnrollment.id}`));
  await page.reload();
  await expect(page.getByText("ثبت‌نام فعال ندارد")).toBeVisible();
  await operator.dispose();
  await context.close();
});

test("Performance detail: poster + native player, unavailable state, error state, no overflow at 390px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await routeMedia(page);
  const slug = (title: string) => encodeURIComponent(title.replace(/\s+/g, "-"));

  await page.goto(`/site/${siteId}/performances/${slug("اجرای ویدئویی")}`);
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", `${MEDIA}/performance.webm`);
  await expect(video).toHaveAttribute("poster", `${MEDIA}/poster.png`);
  await expect(video).toHaveAttribute("controls", "");
  await expect(page.locator('[data-video-state="ready"]')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: "test-results/education-performance-video-390.png", fullPage: true });

  await page.goto(`/site/${siteId}/performances/${slug("اجرای بدون ویدئو")}`);
  await expect(page.getByText("ویدئوی این اجرا هنوز منتشر نشده است.")).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);

  await page.goto(`/site/${siteId}/performances/${slug("اجرای خراب")}`);
  await expect(page.getByRole("alert")).toContainText("پخش ویدئو ممکن نیست");
  await noOverflow(page);

  // Server-rendered published page: the same item renders a native player.
  const html = await ok(await api.get(`/api/auth/site/${siteId}`)).catch(() => null);
  expect(html).not.toBeNull();
  const ssr = await api.get(`/api/auth/sites/${siteId}/performances/${slug("اجرای ویدئویی")}`);
  expect(ssr.status()).toBe(200);
  const markup = await ssr.text();
  expect(markup).toContain(`src="${MEDIA}/performance.webm"`);
  expect(markup).toContain('data-performance-video="true"');
  await context.close();
});

test("Authenticated booking links to the student: booking -> confirmation -> Student Portal -> Booking Studio", async ({ browser }) => {
  const operator = await request.newContext({ baseURL: apiBase, storageState: cookies });
  const when = new Date(Date.now() + 7 * 86_400_000), date = when.toISOString().slice(0, 10), weekday = when.getUTCDay();
  const service = (await ok(await operator.post("/api/booking/services", { data: { name: "پیانو مقدماتی", durationMinutes: 45, modalities: ["ONLINE"] } }))).service;
  const provider = (await ok(await operator.post("/api/booking/providers", { data: { name: "مدرس آزمون" } }))).provider;
  await ok(await operator.post(`/api/booking/providers/${provider.id}/services/${service.id}`));
  await ok(await operator.post("/api/booking/availability", { data: { providerId: provider.id, weekday, startsAt: "10:00", endsAt: "11:00", capacity: 5 } }));
  await ok(await operator.post("/api/booking/availability", { data: { providerId: provider.id, weekday, startsAt: "12:00", endsAt: "13:00", capacity: 5 } }));

  const db = new Database(dbPath);
  await seedStudent(db, "dave", "dave@example.test"); await seedStudent(db, "erin", "erin@example.test");
  db.close();
  for (const key of ["dave", "erin"]) await ok(await operator.post(`/api/site-projects/${siteId}/learning-enrollments`, { data: { authProjectId: authId, appUserId: users[key] } }));

  // Anonymous booking stays possible and is never auto-claimed, even with the same name/contact.
  const anonymous = await ok(await api.post(`/api/auth/site/${siteId}/booking/appointments`, { data: { serviceId: service.id, providerId: provider.id, date, startsAt: "12:00", customerName: "هنرجوی آزمون", customerContact: "09120000000", modality: "ONLINE" } }));
  const forged = await api.post(`/api/auth/site/${siteId}/booking/appointments`, { headers: { "X-Loadder-App-Token": "forged", "X-Loadder-App-Project": authId }, data: { serviceId: service.id, providerId: provider.id, date, startsAt: "12:00", customerName: "x", customerContact: "1" } });
  expect(forged.status()).toBe(401);

  const context = await browser.newContext(), page = await context.newPage();
  await page.goto(`/learn/${authId}/${siteId}?invite=${invites.dave}`);
  await expect(page.locator("article")).toHaveCount(3);
  await expect(page.locator("[data-portal-bookings]")).toContainText("هنوز رزروی با حساب شما ثبت نشده است");
  await page.getByRole("link", { name: "رزرو کلاس جدید" }).click();

  await page.getByRole("button", { name: /پیانو مقدماتی/ }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByRole("button", { name: "مدرس آزمون" }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByRole("button", { name: "آنلاین" }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByLabel("تاریخ").fill(date);
  await page.getByRole("button", { name: /^10:00/ }).click(); await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByLabel("نام هنرجو").fill("هنرجوی آزمون"); await page.getByLabel("شماره تماس").fill("09120000000");
  // Typed text must be readable on the white fields (it was white-on-white through the global dark-theme input rule).
  const inputContrast = await page.evaluate(() => { const lum = (c: string) => { const [r, g, b] = (c.match(/[\d.]+/g) || []).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }; return [...document.querySelectorAll("main input")].map((el) => 1.05 / (lum(getComputedStyle(el).color) + 0.05)); });
  expect(inputContrast.length).toBeGreaterThan(0); for (const ratio of inputContrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("button", { name: "ادامه" }).click();
  await page.getByRole("button", { name: "تأیید و ثبت" }).click();
  const reference = (await page.getByRole("heading", { name: /کد پیگیری/ }).innerText()).split(":")[1].trim();
  expect(reference).toMatch(/^BK-/);
  // Same intended wall-clock time as the slot that was picked, never shifted by the viewer's zone.
  await expect(page.locator("[data-appointment-when]")).toContainText("ساعت ۱۰:۰۰");
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.getByRole("link", { name: "بازگشت به پرتال آموزشی" }).click();

  const next = page.locator('[data-appointment="next"]');
  await expect(next).toContainText("پیانو مقدماتی"); await expect(next).toContainText("مدرس آزمون"); await expect(next).toContainText("آنلاین"); await expect(next).toContainText(reference);
  await expect(page.locator('[data-appointment]')).toHaveCount(1);
  await expect(page.locator("main")).not.toContainText(/پرداخت|پیام|حضور و غیاب/);
  await noOverflow(page);
  await page.screenshot({ path: "test-results/education-portal-booking-390.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "test-results/education-portal-booking-desktop.png", fullPage: true });

  // Another enrolled student with no linked booking sees none of it (and not the anonymous one).
  const erinPage = await (await browser.newContext()).newPage();
  await erinPage.goto(`/learn/${authId}/${siteId}?invite=${invites.erin}`);
  await expect(erinPage.locator("[data-portal-bookings]")).toContainText("هنوز رزروی با حساب شما ثبت نشده است");
  await expect(erinPage.locator("[data-appointment]")).toHaveCount(0);
  await erinPage.context().close();

  // Booking Studio / admin sees the same canonical appointments; only the authenticated one carries the link.
  const admin = (await ok(await operator.get("/api/booking"))).appointments as Array<{ booking_reference: string; app_user_id: string | null; customer_name: string }>;
  expect(admin.find((entry) => entry.booking_reference === reference)?.app_user_id).toBe(users.dave);
  expect(admin.find((entry) => entry.booking_reference === anonymous.confirmation.reference)?.app_user_id).toBeNull();
  const adminContext = await browser.newContext({ storageState: cookies }), adminPage = await adminContext.newPage();
  await adminPage.goto("/dashboard/booking");
  await expect(adminPage.getByText("هنرجوی آزمون").first()).toBeVisible();
  await adminContext.close(); await context.close(); await operator.dispose();
});
