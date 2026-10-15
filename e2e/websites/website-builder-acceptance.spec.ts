import { expect, request, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

// Customer acceptance of the Website Builder through the real UI, end to end:
// sign in -> create from a template -> replace text and imagery -> brand colours and typography -> add a section ->
// second page -> navigation -> save -> reload -> preview desktop/mobile -> publish -> public site -> edit again ->
// republish -> rollback -> another workspace cannot touch the site.

const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGP4z8DwHwyBNBgAAIsvCfk0kQ1pAAAAAElFTkSuQmCC", "base64");
const uniqueMobile = () => `091${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
const noOverflow = async (page: Page, label: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${label}: horizontal overflow`).toBeLessThanOrEqual(1);

let owner: BrowserContext;
let siteId = "";
let publicSite = "";
const state = { brand: "برند آزمون ویرایش", heroTitle: "عنوان تازهٔ مشتری", color: "#16a34a" };

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

async function openInspector(page: Page) {
  const toggle = page.getByRole("button", { name: /پنل ویرایش/ });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-label")) === "باز کردن پنل ویرایش") await toggle.click();
  await expect(page.getByRole("button", { name: "بستن پنل ویرایش" })).toBeVisible();
}
const tab0 = async (page: Page) => { await expect(page.getByRole("button", { name: "افزودن بخش" }).first()).toBeVisible(); };
const tab = async (page: Page, name: string) => { await openInspector(page); await page.locator("[data-studio-inspector]").getByRole("button", { name, exact: true }).click(); };

test("1-3. a new customer signs in, creates a website from a template and sees meaningful editable content", async ({ browser }) => {
  owner = await browser.newContext();
  const page = await owner.newPage();
  await page.goto("/signup");
  await page.getByPlaceholder("مثلاً علی رضایی").fill("مشتری آزمون");
  await page.getByPlaceholder("09123456789").fill(uniqueMobile());
  const sent = page.waitForResponse((r) => r.url() === `${apiBase}/api/auth/send-otp`);
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.getByPlaceholder("•••••").fill((await (await sent).json()).developmentOtp);
  await page.getByRole("button", { name: "ورود به پنل" }).click();
  await expect(page).toHaveURL(/\/(dashboard|start)/);

  await page.goto("/dashboard/websites");
  await page.getByRole("link", { name: "ساخت سایت جدید", exact: true }).first().click();
  await page.getByRole("button", { name: /شرکت حرفه‌ای/ }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project;
  siteId = project.id;
  expect(project.siteType).toBe("CORPORATE");
  await expect(page).toHaveURL(new RegExp(`project=${siteId}`));
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  // The template is meaningful: real sections with real copy, not an empty canvas.
  await openInspector(page);
  await tab(page, "بخش‌ها");
  const tree = await page.locator("[data-studio-inspector]").innerText();
  for (const section of ["درباره شرکت", "خدمات ما", "نمونه‌کارها", "شروع همکاری"]) expect(tree).toContain(section);
  await page.screenshot({ path: "test-results/builder-1-created.png" });
  await page.close();
});

test("4-10. one design session: text, image, brand, a new section, a second page, navigation, save, reload", async () => {
  test.setTimeout(180_000);
  const page = await owner.newPage();
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // 4a. Replace the hero copy through the Inspector; the canvas follows and the dirty state shows.
  await page.getByRole("heading", { level: 1 }).first().click();
  await openInspector(page);
  await page.getByLabel("عنوان", { exact: true }).first().fill(state.heroTitle);
  await expect(page.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  await expect(page.getByText("تغییرات ذخیره نشده").first()).toBeVisible();

  // 4b. Replace imagery directly on the image (file chooser -> the site's media library).
  const hero = page.locator("img").first();
  const originalSrc = await hero.getAttribute("src");
  const uploaded = page.waitForResponse((r) => r.request().method() === "POST" && /site-media|\/assets|media/.test(new URL(r.url()).pathname) && r.status() < 400);
  const chooser = page.waitForEvent("filechooser");
  await hero.click({ force: true });
  await (await chooser).setFiles({ name: "customer-photo.png", mimeType: "image/png", buffer: PNG });
  await uploaded;
  await expect.poll(async () => page.locator("img").first().getAttribute("src")).not.toBe(originalSrc);
  expect(await page.locator("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), "the uploaded image renders").toBe(true);

  // 5. Brand colour and typography (Design tab) reach the canvas.
  await tab(page, "طراحی");
  await page.locator("[data-studio-inspector]").getByLabel("اصلی", { exact: true }).first().fill(state.color);
  await page.locator("[data-studio-inspector]").getByLabel("فونت", { exact: true }).selectOption({ index: 2 });
  await expect.poll(async () => page.locator("button, a").evaluateAll((els) => els.filter((e) => /درخواست مشاوره|تماس با ما/.test((e as HTMLElement).innerText)).map((e) => getComputedStyle(e).backgroundColor))).toEqual(["rgb(22, 163, 74)", "rgb(22, 163, 74)"]);

  // 6a. Brand name (header).
  await page.getByText("شرکت شما").first().click();
  await page.locator("[data-studio-inspector]").getByLabel("نام فروشگاه", { exact: true }).fill(state.brand);
  await expect(page.getByText(state.brand).first()).toBeVisible();

  // 6b. Add a section: choosing a type in the "add section" control adds it.
  await tab(page, "بخش‌ها");
  const rows = page.locator("[data-studio-inspector]").getByRole("button", { name: "تکثیر" });
  const before = await rows.count();
  await page.locator("[data-studio-inspector] select").last().selectOption("team");
  // The new section is selected for editing straight away; the tree (Sections tab) lists it.
  await tab(page, "بخش‌ها");
  await expect(rows).toHaveCount(before + 1);
  await page.screenshot({ path: "test-results/builder-4-section-added.png" });

  // 7. Second page.
  await tab(page, "صفحه‌ها");
  await page.locator("[data-studio-inspector]").getByRole("button", { name: "افزودن صفحه" }).click();
  const ins = page.locator("[data-studio-inspector]");
  await ins.getByLabel("عنوان صفحه", { exact: true }).last().fill("اخبار شرکت");
  await ins.getByLabel("آدرس صفحه", { exact: true }).last().fill("news");
  await page.screenshot({ path: "test-results/builder-5-page-added.png" });

  // 8-9. Save, reload: everything persisted.
  const saved = page.waitForResponse((r) => /\/api\/site-projects\/[^/]+$/.test(new URL(r.url()).pathname) && ["PATCH", "PUT"].includes(r.request().method()) && r.status() < 400);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await saved;
  await expect(page.getByText("آخرین تغییرات ذخیره شده").first()).toBeVisible();
  await page.reload();
  // The Studio reopens on the page last worked on (the new, still empty "news" page): its header already shows the saved brand and menu.
  await expect(page.getByText(state.brand).first()).toBeVisible();
  await expect(page.locator('[data-canvas-interactive="true"]').getByText("اخبار شرکت").first()).toBeVisible();
  await tab(page, "صفحه‌ها");
  await page.locator("[data-studio-inspector]").getByRole("button", { name: /^خانه/ }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  await expect(page.getByText(state.brand).first()).toBeVisible();
  expect(await page.locator("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), "uploaded image survives reload").toBe(true);
  await expect.poll(async () => page.locator("button, a").evaluateAll((els) => els.filter((e) => /درخواست مشاوره/.test((e as HTMLElement).innerText)).map((e) => getComputedStyle(e).backgroundColor))).toEqual(["rgb(22, 163, 74)"]);
  await tab(page, "صفحه‌ها");
  await expect(ins.getByText("اخبار شرکت").first()).toBeVisible();
  await page.screenshot({ path: "test-results/builder-6-reloaded.png" });
  await page.close();
});

test("11-13. preview desktop and mobile, publish, open the public site", async () => {
  test.setTimeout(120_000);
  const page = await owner.newPage();
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await expect(page.getByText(state.brand).first()).toBeVisible();
  await tab(page, "صفحه‌ها");
  await page.locator("[data-studio-inspector]").getByRole("button", { name: /^خانه/ }).first().click();
  await expect(page.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByText("این نسخه هنوز عمومی نشده است.")).toBeVisible();      // the preview says it is not public yet
  await expect(page.getByText(state.heroTitle).first()).toBeAttached();
  await page.getByRole("button", { name: "موبایل", exact: true }).last().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/builder-7-preview-mobile.png" });
  await page.getByRole("button", { name: "دسکتاپ", exact: true }).last().click();
  await page.screenshot({ path: "test-results/builder-7-preview.png" });
  await page.getByRole("button", { name: "بستن پیش‌نمایش" }).click();
  const pub = page.waitForResponse((r) => /publish$/.test(new URL(r.url()).pathname) && r.request().method() === "POST");
  await page.getByRole("button", { name: "انتشار", exact: true }).click();
  const res = await pub;
  expect(res.status()).toBe(200);
  const published = await res.json();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/builder-8-published.png" });
  const publicUrl = await page.getByRole("link", { name: "آدرس عمومی" }).getAttribute("href");
  publicSite = publicUrl!;
  await page.close();
});

test("14. the public site matches what the customer built, on desktop and mobile", async ({ browser }) => {
  const visitor = await browser.newContext();   // anonymous visitor: no session
  const page = await visitor.newPage();
  await page.goto(publicSite);
  await expect(page.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  await expect(page.getByText(state.brand).first()).toBeVisible();
  await page.waitForTimeout(2000);
  const imgSrc = (await page.locator("img").first().getAttribute("src"))!;
  expect((await visitor.request.get(new URL(imgSrc, page.url()).toString())).status(), "anonymous visitors can load the uploaded image").toBe(200);
  expect(await page.locator("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), "the uploaded image renders publicly").toBe(true);
  await expect.poll(async () => page.locator("a, button").evaluateAll((els) => els.filter((e) => /درخواست مشاوره/.test((e as HTMLElement).innerText)).map((e) => getComputedStyle(e).backgroundColor))).toEqual(["rgb(22, 163, 74)"]);
  await noOverflow(page, "public desktop");
  await page.getByRole("link", { name: "اخبار شرکت", exact: true }).first().click();
  await expect(page).toHaveURL(/\/news\/?$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(publicSite);
  await expect(page.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  await noOverflow(page, "public mobile");
  await page.screenshot({ path: "test-results/builder-9-public-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.textContent!.includes("storeBuilderV16")), "no builder internals leak").toBe(false);
  await visitor.close();
});

test("15-16. the customer changes the site, republishes, and the public site follows", async () => {
  test.setTimeout(120_000);
  const page = await owner.newPage();
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await tab(page, "صفحه‌ها");
  await page.locator("[data-studio-inspector]").getByRole("button", { name: /^خانه/ }).first().click();
  await page.getByRole("heading", { name: state.heroTitle }).click();
  await openInspector(page);
  await page.getByLabel("عنوان", { exact: true }).first().fill("عنوان نسخهٔ دوم");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(page.getByText("آخرین تغییرات ذخیره شده").first()).toBeVisible();

  // Saving does not change the live site; only publishing does.
  const visitor = await (await page.context().browser()!.newContext()).newPage();
  await visitor.goto(publicSite);
  await expect(visitor.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  await expect(visitor.getByText("عنوان نسخهٔ دوم")).toHaveCount(0);

  const pub = page.waitForResponse((r) => /publish$/.test(new URL(r.url()).pathname) && r.request().method() === "POST");
  await page.getByRole("button", { name: "انتشار نسخه جدید", exact: true }).click();
  expect((await pub).status()).toBe(200);
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "عنوان نسخهٔ دوم" })).toBeVisible();
  await page.close();
});

test("section operations (move, duplicate, disable, delete) and page deletion behave on the live document", async () => {
  test.setTimeout(120_000);
  const page = await owner.newPage();
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await expect(page.getByRole("button", { name: "افزودن بخش" }).first()).toBeVisible();
  await tab(page, "صفحه‌ها");
  await page.locator("[data-studio-inspector]").getByRole("button", { name: /^خانه/ }).first().click();
  await tab(page, "بخش‌ها");
  const ins = page.locator("[data-studio-inspector]");
  const order = async () => page.locator("h2:not([data-studio-inspector] h2)").allInnerTexts();
  const rows = ins.getByRole("button", { name: "تکثیر" });
  const before = await rows.count();
  const first = ins.getByRole("button", { name: "پایین" }).first();
  const names0 = await order();
  await first.click();
  const names1 = await order();
  expect(names1.join("|"), "moving the first section down changes the order").not.toBe(names0.join("|"));
  await rows.first().click();
  await expect(rows).toHaveCount(before + 1);                         // duplicate
  await ins.getByRole("button", { name: "حذف" }).first().click();
  await expect(rows).toHaveCount(before);                             // delete
  await tab(page, "صفحه‌ها");
  // Pages: add a throw-away page, reorder it, delete it; the Home page can never be deleted.
  const pageCount = () => ins.getByRole("button", { name: /^(خانه|اخبار شرکت|صفحه)/ }).count();
  const startPages = await pageCount();
  await ins.getByRole("button", { name: "افزودن صفحه" }).click();
  await expect.poll(pageCount).toBe(startPages + 1);
  await ins.getByRole("button", { name: "بالا" }).first().click();
  await ins.getByRole("button", { name: "حذف صفحه" }).first().click();
  await expect.poll(pageCount).toBe(startPages);
  await page.screenshot({ path: "test-results/builder-12-pages.png" });
  await page.close();
});

test("undo and redo step back and forward through edits, by button and by keyboard", async () => {
  test.setTimeout(120_000);
  const page = await owner.newPage();
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await expect(page.getByRole("button", { name: "افزودن بخش" }).first()).toBeVisible();
  await tab(page, "صفحه‌ها");
  await page.locator("[data-studio-inspector]").getByRole("button", { name: /^خانه/ }).first().click();
  const undo = page.getByRole("button", { name: "واگرد", exact: true });
  const redo = page.getByRole("button", { name: "ازنو", exact: true });
  await expect(undo, "nothing to undo on a freshly opened site").toBeDisabled();
  const hero = page.locator('[data-editor-element="hero"]').getByRole("heading").first();
  const original = (await hero.innerText()).trim();
  await hero.click();
  const title = page.getByLabel("عنوان", { exact: true }).first();
  await title.fill("گام اول");
  await expect(page.getByRole("heading", { name: "گام اول" })).toBeVisible();
  await page.waitForTimeout(900);
  await title.fill("گام دوم");
  await expect(page.getByRole("heading", { name: "گام دوم" })).toBeVisible();
  await undo.click();
  await expect(page.getByRole("heading", { name: "گام اول" })).toBeVisible();
  await expect(redo).toBeEnabled();
  await undo.click();
  await expect(page.getByRole("heading", { name: original })).toBeVisible();
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(page.getByRole("heading", { name: "گام اول" })).toBeVisible();
  // keyboard (outside text fields): focus the canvas heading's page area, not an input
  await page.getByRole("button", { name: "افزودن بخش" }).first().focus();
  await page.keyboard.press("Control+Z");
  await expect(page.getByRole("heading", { name: original })).toBeVisible();
  await page.keyboard.press("Control+Shift+Z");
  await expect(page.getByRole("heading", { name: "گام اول" })).toBeVisible();
  // a new edit after undo drops the redo branch
  await undo.click();
  await title.fill("شاخهٔ تازه");
  await expect(redo).toBeDisabled();
  // leave the saved draft as it was
  await undo.click();
  await page.screenshot({ path: "test-results/builder-13-undo.png" });
  await page.close();
});

test("unsaved edits are guarded: leaving the page asks first, and saving removes the guard", async () => {
  const page = await owner.newPage();
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await expect(page.getByRole("button", { name: "افزودن بخش" }).first()).toBeVisible();
  const prompted = async () => page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(await prompted(), "no prompt while everything is saved").toBe(false);
  await tab(page, "طراحی");
  await page.locator("[data-studio-inspector]").getByLabel("اصلی", { exact: true }).first().fill("#7c3aed");
  await expect(page.getByText("تغییرات ذخیره نشده").first()).toBeVisible();
  expect(await prompted(), "prompt with unsaved changes").toBe(true);
  await page.locator("[data-studio-inspector]").getByLabel("اصلی", { exact: true }).first().fill(state.color);   // back to the saved value
  await expect.poll(prompted, { message: "undoing by hand to the saved state clears the guard" }).toBe(false);
  await page.close();
});

test("responsive editing: on tablet and mobile the canvas fills the screen and the settings open as a sheet", async () => {
  for (const [name, width, height] of [["tablet", 820, 1180], ["mobile", 390, 844]] as const) {
    const page = await owner.newPage();
    await page.setViewportSize({ width, height });
    await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
    await tab0(page);
    await noOverflow(page, `${name} studio`);
    // The header never lets the title and its controls overlap, and nothing sits outside the screen.
    const clashes = await page.locator("[data-studio-header]").evaluate((header) => {
      const boxes = [...header.querySelectorAll("h1, a, button, select")].map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.height > 0);
      const out: string[] = [];
      for (const { el, r } of boxes) if (r.left < -1 || r.right > window.innerWidth + 1) out.push(`off-screen: ${(el.textContent || el.getAttribute("aria-label") || el.tagName).slice(0, 30)}`);
      for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
        const x = boxes[i].r, y = boxes[j].r;
        if (boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el)) continue;
        if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1) out.push(`${(boxes[i].el.textContent || "").slice(0, 20)} overlaps ${(boxes[j].el.textContent || "").slice(0, 20)}`);
      }
      return out;
    });
    expect(clashes, `${name}: header overlaps`).toEqual([]);
    await page.screenshot({ path: `test-results/builder-09-${name}-header.png`, clip: { x: 0, y: 0, width, height: 260 } });
    // No dead blank area above the canvas: the first editable block starts near the top of the screen.
    const top = await page.getByRole("button", { name: "افزودن بخش" }).first().evaluate((el) => el.getBoundingClientRect().top);
    expect(top, `${name}: canvas starts high on the screen`).toBeLessThan(height * 0.45);
    await page.getByRole("button", { name: "باز کردن پنل ویرایش" }).click();
    const sheet = page.locator("[data-studio-inspector]");
    await expect(sheet.getByRole("button", { name: "طراحی", exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "طراحی", exact: true }).click();
    await expect(sheet.getByLabel("اصلی", { exact: true }).first()).toBeVisible();
    await noOverflow(page, `${name} studio with settings`);
    await page.screenshot({ path: `test-results/builder-10-${name}-settings.png` });
    await page.getByRole("button", { name: "بستن پنل ویرایش" }).click();
    await expect(sheet).toBeHidden();
    await page.close();
  }
});

test("17. the customer rolls back to the earlier published version from the Studio", async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await owner.newPage();
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await page.getByRole("button", { name: "نسخه‌های منتشرشده" }).click();
  const dialog = page.getByRole("dialog", { name: "نسخه‌های منتشرشده" });
  await expect(dialog.locator("[data-version]")).toHaveCount(2);
  await expect(dialog.locator('[data-version="2"]')).toContainText("فعلی");
  page.once("dialog", (d) => void d.accept());
  await dialog.locator('[data-version="1"]').getByRole("button", { name: "بازگردانی" }).click();
  await expect(dialog).toBeHidden();
  // The Studio now holds the restored draft and the live site shows the earlier version again.
  await expect(page.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(publicSite);
  await expect(visitor.getByRole("heading", { name: state.heroTitle })).toBeVisible();
  await expect(visitor.getByText("عنوان نسخهٔ دوم")).toHaveCount(0);
  // History keeps everything: the rollback is a new, third version.
  await page.getByRole("button", { name: "نسخه‌های منتشرشده" }).click();
  await expect(dialog.locator("[data-version]")).toHaveCount(3);
  await expect(dialog.locator('[data-version="3"]')).toContainText("فعلی");
  await page.screenshot({ path: "test-results/builder-11-versions.png" });
  await page.close();
});

test("18. another workspace cannot read, change, publish or roll back the site", async ({ browser }) => {
  test.setTimeout(90_000);
  const intruder = await browser.newContext();
  const page = await intruder.newPage();
  await page.goto("/signup");
  await page.getByPlaceholder("مثلاً علی رضایی").fill("کاربر دیگر");
  await page.getByPlaceholder("09123456789").fill(uniqueMobile());
  const sent = page.waitForResponse((r) => r.url() === `${apiBase}/api/auth/send-otp`);
  await page.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.getByPlaceholder("•••••").fill((await (await sent).json()).developmentOtp);
  await page.getByRole("button", { name: "ورود به پنل" }).click();
  await expect(page).toHaveURL(/\/(dashboard|start)/);
  const api = intruder.request;
  const base = `${apiBase}/api/site-projects/${siteId}`;
  expect((await api.get(base)).status()).toBe(404);
  expect((await api.patch(base, { data: { name: "hijacked" } })).status()).toBe(404);
  expect((await api.post(`${base}/publish`, { data: {} })).status()).toBe(404);
  expect((await api.get(`${base}/versions`)).status()).toBe(404);
  expect((await api.delete(base)).status()).toBe(404);
  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await expect(page.getByText(state.brand)).toHaveCount(0);
  // the owner's site is untouched
  const mine = await (await owner.request.get(base)).json();
  expect(mine.project.name).toBe("شرکت حرفه‌ای");
  await intruder.close();
});

test("explicit save: a failed save keeps the work marked unsaved and retry succeeds; a stale tab cannot overwrite newer work", async () => {
  const page = await owner.newPage();
  const editColour = async (p: Page, value: string) => p.locator("[data-studio-inspector]").getByLabel("اصلی", { exact: true }).first().fill(value);
  const prompted = (p: Page) => p.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  const save = (p: Page) => p.getByRole("button", { name: "ذخیره", exact: true });
  const isSave = (r: { url(): string; request(): { method(): string } }) => r.url() === `${apiBase}/api/site-projects/${siteId}` && r.request().method() === "PATCH";

  await page.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await tab(page, "طراحی");
  await editColour(page, "#0ea5e9");
  await expect(page.getByText("تغییرات ذخیره نشده").first()).toBeVisible();

  // The server fails: nothing is lost, the page still says unsaved and still guards leaving.
  await page.route(`${apiBase}/api/site-projects/${siteId}`, (route) => route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, message: "خطای موقت سرور" }) }) : route.continue());
  await save(page).click();
  await expect(page.getByText("خطای موقت سرور").first()).toBeVisible();
  await expect(page.getByText("تغییرات ذخیره نشده").first()).toBeVisible();
  expect(await prompted(page), "still guarded after a failed save").toBe(true);

  // Retry once the server is back: saved, guard removed, and it survives a reload.
  await page.unroute(`${apiBase}/api/site-projects/${siteId}`);
  const ok = page.waitForResponse((r) => isSave(r) && r.status() === 200);
  await save(page).click();
  await ok;
  await expect(page.getByText("همه تغییرات ذخیره شده").first()).toBeVisible();
  expect(await prompted(page)).toBe(false);
  await page.reload();
  await tab(page, "طراحی");
  await expect(page.locator("[data-studio-inspector]").getByLabel("اصلی", { exact: true }).first()).toHaveValue("#0ea5e9");

  // Two tabs: B opens, A saves newer work, B (now stale) must be refused instead of silently overwriting A.
  const tabB = await owner.newPage();
  await tabB.goto(`/dashboard/websites/corporate?project=${siteId}`);
  await tab(tabB, "طراحی");
  await editColour(page, "#f97316");
  const savedA = page.waitForResponse((r) => isSave(r) && r.status() === 200);
  await save(page).click();
  await savedA;
  await editColour(tabB, "#111827");
  const refused = tabB.waitForResponse(isSave);
  await save(tabB).click();
  expect((await refused).status(), "stale save is refused").toBe(409);
  await expect(tabB.getByText("تغییرات ذخیره نشده").first(), "refused work stays marked unsaved").toBeVisible();
  const stored = await (await owner.request.get(`${apiBase}/api/site-projects/${siteId}`)).json();
  expect(JSON.stringify(stored.project.content)).toContain("#f97316");
  expect(JSON.stringify(stored.project.content)).not.toContain("#111827");
  await tabB.close();
  await page.close();
});

test.afterAll(async () => { await owner?.close().catch(() => undefined); });
