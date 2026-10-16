import { expect, request, test, type Browser, type Page } from "@playwright/test";

// V17 phase 7: the Studio bar keeps what editing needs; secondary actions live in one discoverable menu.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Toolbar E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Toolbar E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}
async function createFrom(page: Page, route: string, label: RegExp) {
  await page.goto(`${route}?new=1`);
  await page.getByRole("button", { name: label }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project as { id: string };
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project;
}
const header = (page: Page) => page.locator("[data-studio-header]");
const more = (page: Page) => page.locator("[data-studio-more]");
const menu = (page: Page) => page.locator("[data-studio-more-menu]");

async function layoutProblems(page: Page) {
  return header(page).evaluate((el) => {
    const out: string[] = [];
    const boxes = [...el.querySelectorAll("h1, a, button, select")].map((node) => ({ node, r: node.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.height > 0);
    for (const { node, r } of boxes) if (r.left < -1 || r.right > window.innerWidth + 1) out.push(`off-screen: ${(node.textContent || node.getAttribute("aria-label") || node.tagName).trim().slice(0, 24)}`);
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      if (a.node.contains(b.node) || b.node.contains(a.node)) continue;
      if (a.r.left < b.r.right - 1 && b.r.left < a.r.right - 1 && a.r.top < b.r.bottom - 1 && b.r.top < a.r.bottom - 1) out.push(`${(a.node.textContent || "").trim().slice(0, 16)} overlaps ${(b.node.textContent || "").trim().slice(0, 16)}`);
    }
    return out;
  });
}

test("Medical: the bar shows only primary actions; every secondary action is in the more menu, reachable by mouse and keyboard", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", /کلینیک و پزشک/);
    // Primary controls are visible in the bar.
    await expect(header(page).getByRole("heading", { level: 1 })).toBeVisible();
    await expect(header(page).getByText(/همه تغییرات ذخیره شده|تغییرات ذخیره‌نشده/).first()).toBeVisible();
    for (const name of ["واگرد", "ازنو", "دسکتاپ", "تبلت", "موبایل"]) await expect(header(page).getByRole("button", { name, exact: true })).toBeVisible();
    for (const name of ["پیش‌نمایش", "ذخیره", "انتشار"]) await expect(header(page).getByRole("button", { name, exact: true })).toBeVisible();
    await expect(more(page)).toBeVisible();
    // Secondary actions are not in the bar itself.
    for (const name of ["مرکز کنترل", "سایت‌های من", "ساخت سایت دیگر", "مدیریت نوبت‌دهی"]) await expect(header(page).getByRole("link", { name, exact: true }), `"${name}" lives in the menu`).toHaveCount(0);
    await expect(menu(page)).toHaveCount(0);

    // Open by keyboard; items are real menu items; Escape closes and returns focus.
    await more(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu(page)).toBeVisible();
    await expect(more(page)).toHaveAttribute("aria-expanded", "true");
    for (const label of ["سایت‌های من", "ساخت سایت دیگر", "مدیریت محتوا", "مدیریت نوبت‌دهی", "مرکز کنترل"]) await expect(menu(page).getByRole("menuitem", { name: label })).toBeVisible();
    await expect(menu(page)).toContainText("نوع سایت: کلینیک و پزشک");
    await expect(menu(page).getByRole("menuitem", { name: "نسخه‌های منتشرشده" }), "no versions before the first publish").toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    await expect(more(page)).toBeFocused();
    // Clicking elsewhere closes it too.
    await more(page).click();
    await expect(menu(page)).toBeVisible();
    await page.locator('[data-canvas-interactive="true"]').click({ position: { x: 5, y: 5 }, force: true });
    await expect(menu(page)).toHaveCount(0);

    // After publishing, versions and the public address appear and work.
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await header(page).getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    await more(page).click();
    await expect(menu(page).getByRole("menuitem", { name: "آدرس عمومی" })).toHaveAttribute("href", `/site/${project.id}`);
    await menu(page).getByRole("menuitem", { name: "نسخه‌های منتشرشده" }).click();
    await expect(page.getByRole("dialog", { name: "نسخه‌های منتشرشده" })).toBeVisible();
    await page.getByRole("dialog", { name: "نسخه‌های منتشرشده" }).getByRole("button", { name: "بستن", exact: true }).click();

    // Control Center link works from the menu.
    await more(page).click();
    await menu(page).getByRole("menuitem", { name: "مرکز کنترل" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/websites/${project.id}/control$`));
  } finally { await context.close(); await api.dispose(); }
});

test("the bar stays compact and free of overlaps at desktop, tablet and phone widths, and the menu fits the screen", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", /کلینیک و پزشک/);
    for (const [name, width, height, maxHeight] of [["desktop", 1440, 900, 150], ["laptop", 1024, 768, 160], ["tablet", 820, 1180, 200], ["phone", 390, 844, 300]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(`/dashboard/websites/corporate?project=${project.id}`);
      await expect(header(page)).toBeVisible();
      expect(await layoutProblems(page), `${name}: header overlaps or overflows`).toEqual([]);
      const box = (await header(page).boundingBox())!;
      expect(box.height, `${name}: header height`).toBeLessThanOrEqual(maxHeight);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
      await more(page).click();
      const m = (await menu(page).boundingBox())!;
      expect(m.x, `${name}: menu inside the screen (left)`).toBeGreaterThanOrEqual(-1);
      expect(m.x + m.width, `${name}: menu inside the screen (right)`).toBeLessThanOrEqual(width + 1);
      expect(m.y + m.height, `${name}: menu inside the screen (bottom)`).toBeLessThanOrEqual(height + 1);
      await page.screenshot({ path: `test-results/toolbar-${name}.png`, clip: { x: 0, y: 0, width, height: Math.min(height, 420) } });
      await page.keyboard.press("Escape");
    }
  } finally { await context.close(); await api.dispose(); }
});

test("Store: the same bar; the menu offers sales management and no booking", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    await createFrom(page, "/dashboard/websites/store", /Loadder Commerce Modern V1/);
    await more(page).click();
    for (const label of ["سایت‌های من", "ساخت سایت دیگر", "مدیریت فروش", "مرکز کنترل"]) await expect(menu(page).getByRole("menuitem", { name: label })).toBeVisible();
    await expect(menu(page).getByRole("menuitem", { name: "مدیریت نوبت‌دهی" })).toHaveCount(0);
    await expect(menu(page)).toContainText("نوع سایت: فروشگاه اینترنتی");
  } finally { await context.close(); await api.dispose(); }
});
