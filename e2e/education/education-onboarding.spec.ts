import { expect, request, test, type APIRequestContext, type APIResponse, type Browser, type BrowserContext } from "@playwright/test";

// Education student onboarding through the REAL operator UI and the REAL invite exchange. Nothing is seeded:
// the operator signs in on the sign-in screen, the app (a Business Builder project), the student account and the
// one-time invite are created through the product's own API/UI, the student redeems the invite in a fresh browser,
// and unauthorized and cross-workspace access is checked against the same endpoints. No external delivery
// provider is involved: the invite token is shown to the operator, who hands it to the student.

const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");

const noOverflow = async (page: import("@playwright/test").Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const ok = async (response: APIResponse) => { const body = await response.json(); expect(response.ok(), JSON.stringify(body)).toBeTruthy(); return body; };
const uniqueMobile = () => `091${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;

let operator: BrowserContext;
let siteId = "", appId = "", appName = "";
let studentToken = "";
const student = { email: "student@example.test", inviteToken: "", userId: "" };

async function apiSignIn(name: string): Promise<{ api: APIRequestContext }> {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = uniqueMobile();
  const otp = await ok(await api.post("/api/auth/send-otp", { data: { mobile, name } }));
  await ok(await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } }));
  return { api };
}

test.describe.configure({ mode: "serial" });

test("operator signs in on the real sign-in screen", async ({ browser }) => {
  operator = await browser.newContext();
  const page = await operator.newPage();
  await page.goto("/signup");
  await page.getByPlaceholder("مثلاً علی رضایی").fill("اپراتور آموزشگاه");
  await page.getByPlaceholder("09123456789").fill(uniqueMobile());
  const sent = page.waitForResponse((response) => response.url() === `${apiBase}/api/auth/send-otp` && response.request().method() === "POST");
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  const otp = await (await sent).json();
  expect(otp.developmentOtp, "development codes are exposed only in this test environment").toMatch(/^\d{5}$/);
  await page.getByPlaceholder("•••••").fill(otp.developmentOtp);
  await page.getByRole("button", { name: "ورود به پنل" }).click();
  // A brand-new operator lands on the product's start page, an established one on the dashboard.
  await expect(page).toHaveURL(/\/(dashboard|start)/);
  expect((await operator.request.get(`${apiBase}/api/auth/me`)).status(), "the session cookie works against the API").toBe(200);
  await page.close();
});

test("operator opens an Education project and its app, and creates a student invitation in the access panel", async () => {
  const api = operator.request;
  // The Education site and the Business Builder app (the student account system) come from the real API.
  siteId = (await ok(await api.post(`${apiBase}/api/site-projects`, { data: { name: "آموزشگاه ثبت‌نام", siteType: "EDUCATION", content: {} } }))).project.id;
  await ok(await api.post(`${apiBase}/api/site-projects/${siteId}/publish`));
  const app = (await ok(await api.post(`${apiBase}/api/business-builder/projects`, { data: { intent: "سامانه ثبت‌نام دانشجویان آموزشگاه", locale: "fa-IR" } }))).project;
  appId = app.id; appName = app.name;

  const page = await operator.newPage();
  await page.goto(`/dashboard/websites/${siteId}/control`);
  await expect(page.getByRole("heading", { name: "آموزشگاه ثبت‌نام" })).toBeVisible();

  await page.goto(`/dashboard/business-builder/apps/${appId}`);
  const panel = page.locator("section", { hasText: "کاربران و نقش‌های اپ" });
  await expect(panel).toBeVisible();
  await panel.getByPlaceholder("user@example.com").fill(student.email);
  await panel.locator("select").selectOption("customer");
  await panel.getByRole("button", { name: "افزودن", exact: true }).click();
  const row = panel.locator("div", { hasText: student.email }).filter({ has: page.getByRole("button", { name: "دعوت" }) }).last();
  await expect(row).toContainText("customer · active");

  await row.getByRole("button", { name: "دعوت", exact: true }).click();
  await expect(panel.getByText(`دعوت یک‌بارمصرف برای ${student.email} ساخته شد.`)).toBeVisible();
  student.inviteToken = (await panel.locator("code").innerText()).trim();
  expect(student.inviteToken).toMatch(/^[A-Za-z0-9_-]{30,}$/);
  await page.screenshot({ path: "test-results/education-onboarding-operator-invite-desktop.png", fullPage: true });

  // Persisted through the API: a fresh load of the panel and the API list both show the student.
  await page.reload();
  await expect(page.locator("section", { hasText: "کاربران و نقش‌های اپ" })).toContainText(student.email);
  const users = (await ok(await api.get(`${apiBase}/api/business-builder/projects/${appId}/app-users`))).users as Array<{ id: string; email: string; role: string; status: string }>;
  const created = users.find((user) => user.email === student.email);
  expect(created, "the student exists in the app").toBeTruthy();
  expect([created!.role, created!.status]).toEqual(["customer", "active"]);
  student.userId = created!.id;
  await page.close();
});

test("operator enrols the student from the Education Control Center", async () => {
  const page = await operator.newPage();
  await page.goto(`/dashboard/websites/${siteId}/control/people`);
  await expect(page.getByText("هنوز دانشجویی ثبت‌نام نشده است.")).toBeVisible();
  const select = page.getByLabel("کاربر مشتری");
  const value = await select.locator("option", { hasText: student.email }).first().getAttribute("value");
  expect(value, "the invited student is offered as an enrolment candidate").toBeTruthy();
  await select.selectOption(value!);
  await page.getByRole("button", { name: "ثبت‌نام دانشجو" }).click();
  await expect(page.locator('[data-enrollment-status="active"]')).toContainText(student.email);
  await page.close();
});

test("the app is closed to students until the operator opens it in the access panel", async ({ browser }) => {
  const portal = `/learn/${appId}/${siteId}`;
  // A draft app is not served: the invite is not even looked up (and is not consumed by the attempt).
  const closed = await browser.newContext(), closedPage = await closed.newPage();
  const attempt = closedPage.waitForResponse((response) => response.url().includes("/invite/exchange") && response.request().method() === "POST");
  await closedPage.goto(`${portal}?invite=${student.inviteToken}`);
  expect((await attempt).status(), "a draft app is not served").toBe(404);
  await expect(closedPage.locator("[data-portal-bookings]")).toHaveCount(0);
  await expect(closedPage.locator("article")).toHaveCount(0);
  await closed.close();

  const page = await operator.newPage();
  await page.goto(`/dashboard/business-builder/apps/${appId}`);
  const statusBar = page.locator("[data-app-status]");
  await expect(statusBar).toHaveAttribute("data-app-status", "draft");
  await expect(statusBar).toContainText("برای کاربران بسته است");
  await page.locator("[data-app-status-toggle]").click();
  await expect(page.getByText("اپ برای کاربران دعوت‌شده فعال شد.")).toBeVisible();
  await expect(statusBar).toHaveAttribute("data-app-status", "ready");
  await page.reload();
  await expect(page.locator("[data-app-status]")).toHaveAttribute("data-app-status", "ready");
  await page.screenshot({ path: "test-results/education-onboarding-operator-app-ready-desktop.png", fullPage: true });
  await page.close();
});

test("the student redeems the invite and reaches the Education portal; the invite is single-use", async ({ browser }) => {
  const portal = `/learn/${appId}/${siteId}`;
  const context = await browser.newContext(), page = await context.newPage();
  const exchanged = page.waitForResponse((response) => response.url().includes("/invite/exchange") && response.request().method() === "POST");
  await page.goto(`${portal}?invite=${student.inviteToken}`);
  const exchange = await exchanged;
  expect(exchange.status()).toBe(201);
  studentToken = (await exchange.json()).session.token;
  await expect(page.getByText("ثبت‌نام فعال ندارد")).toHaveCount(0);
  await expect(page.locator("[data-portal-bookings]")).toBeVisible();
  await expect(page.getByText("هنوز منبع آموزشی‌ای برای شما منتشر نشده است.")).toBeVisible();
  expect(page.url(), "the one-time token never stays in the address bar").not.toContain("invite=");
  await noOverflow(page);
  await page.screenshot({ path: "test-results/education-onboarding-student-portal-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({ path: "test-results/education-onboarding-student-portal-390.png", fullPage: true });

  // The session persists in this browser; the portal survives a reload without the invite.
  await page.reload();
  await expect(page.locator("[data-portal-bookings]")).toBeVisible();
  await context.close();

  // Single use: the same invite in another browser does not sign anyone in.
  const replay = await browser.newContext(), replayPage = await replay.newPage();
  const second = replayPage.waitForResponse((response) => response.url().includes("/invite/exchange"));
  await replayPage.goto(`${portal}?invite=${student.inviteToken}`);
  expect((await second).status(), "a redeemed invite is refused").toBeGreaterThanOrEqual(400);
  await expect(replayPage.locator("[data-portal-bookings]")).toHaveCount(0);
  await replay.close();
});

test("unauthorized visitors and students without an enrolment are denied", async ({ browser }) => {
  const portal = `/learn/${appId}/${siteId}`;
  const raw = `${apiBase}/api/auth/public/apps/${appId}/education/sites/${siteId}/resources`;
  const anonymousApi = await request.newContext();
  expect((await anonymousApi.get(raw)).status(), "no session, no resources").toBe(401);
  expect((await anonymousApi.get(raw, { headers: { "X-Loadder-App-Token": "forged", "X-Loadder-App-Project": appId } })).status(), "a forged token").toBe(401);

  const anon = await (await browser.newContext()).newPage();
  await anon.goto(portal);
  await expect(anon.getByText("از لینک دعوتی که برای شما ارسال شده وارد شوید")).toBeVisible();
  await expect(anon.locator("[data-portal-bookings]")).toHaveCount(0);
  await anon.context().close();

  // A second student with a valid invite but NO enrolment signs in and is still denied the classroom.
  const api = operator.request;
  const user = (await ok(await api.post(`${apiBase}/api/business-builder/projects/${appId}/app-users`, { data: { email: "outsider@example.test", role: "customer" } }))).user;
  const invite = (await ok(await api.post(`${apiBase}/api/business-builder/projects/${appId}/app-users/${user.id}/invite`, { data: {} }))).invite.token as string;
  const outsider = await (await browser.newContext()).newPage();
  await outsider.goto(`${portal}?invite=${invite}`);
  await expect(outsider.getByText("ثبت‌نام فعال ندارد")).toBeVisible();
  await expect(outsider.locator("article")).toHaveCount(0);
  await outsider.context().close();
});

test("another workspace can neither see nor use this app, its students or its Education site", async () => {
  const { api: other } = await apiSignIn("اپراتور دیگر");
  const foreign = `${apiBase}/api/business-builder/projects/${appId}`;
  const unknown = "11111111-1111-4111-8111-111111111111";

  // The foreign operator learns nothing: A's app looks exactly like one that does not exist.
  for (const path of ["app-users"]) {
    const mine = await other.get(`${foreign}/${path}`), none = await other.get(`${apiBase}/api/business-builder/projects/${unknown}/${path}`);
    expect([mine.status(), await mine.text()]).toEqual([none.status(), await none.text()]);
    expect(mine.status()).toBeGreaterThanOrEqual(400);
  }
  expect((await other.post(`${foreign}/app-users/${student.userId}/invite`, { data: {} })).ok(), "cannot mint invites for another workspace's student").toBe(false);
  expect((await other.post(`${foreign}/app-users`, { data: { email: "intruder@example.test", role: "admin" } })).ok(), "cannot add users to another workspace's app").toBe(false);
  expect((await other.post(`${foreign}/status`, { data: { status: "draft" } })).ok(), "cannot close another workspace's app").toBe(false);
  expect((await other.get(`${apiBase}/api/site-projects/${siteId}/learning-enrollments`)).ok(), "cannot list another workspace's enrolments").toBe(false);
  expect((await other.post(`${apiBase}/api/site-projects/${siteId}/learning-enrollments`, { data: { authProjectId: appId, appUserId: student.userId } })).ok(), "cannot enrol into another workspace's site").toBe(false);

  // Their own Education site cannot take our student, and the student's session does not open it.
  const ownSite = (await ok(await other.post(`${apiBase}/api/site-projects`, { data: { name: "آموزشگاه دیگر", siteType: "EDUCATION", content: {} } }))).project.id;
  await ok(await other.post(`${apiBase}/api/site-projects/${ownSite}/publish`));
  const candidates = await other.get(`${apiBase}/api/site-projects/${ownSite}/learning-enrollments/candidates`);
  expect(JSON.stringify(await candidates.json())).not.toContain(student.email);
  expect((await other.post(`${apiBase}/api/site-projects/${ownSite}/learning-enrollments`, { data: { authProjectId: appId, appUserId: student.userId } })).ok(), "our student cannot be enrolled by another workspace").toBe(false);
  const crossSite = await request.newContext();
  const res = await crossSite.get(`${apiBase}/api/auth/public/apps/${appId}/education/sites/${ownSite}/resources`, { headers: { "X-Loadder-App-Token": studentToken, "X-Loadder-App-Project": appId } });
  expect(res.status(), "a student session is bound to its own workspace's site").toBeGreaterThanOrEqual(400);
  expect(await res.text()).not.toMatch(/storageKey|site-media/);
  // Nothing the other workspace tried changed anything: the app is still open for its own student.
  const still = await request.newContext();
  expect((await still.get(`${apiBase}/api/auth/public/apps/${appId}/education/sites/${siteId}/resources`, { headers: { "X-Loadder-App-Token": studentToken, "X-Loadder-App-Project": appId } })).status()).toBe(200);
  await other.dispose();
});

test.afterAll(async () => { await operator?.close().catch(() => undefined); });
