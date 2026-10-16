import { expect, request, test, type Browser, type Page } from "@playwright/test";

// V17 phase 2: real inline text editing on the canvas, through save, reload, preview and the published site.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

const ZWNJ = "‌";
async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `099${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Inline E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Inline E2E" } }); }
  const otp = await sent.json();
  expect((await api.post("/api/auth/verify-otp", { data: { mobile, code: otp.developmentOtp } })).ok()).toBeTruthy();
  return { api, context: await browser.newContext({ storageState: await api.storageState() }) };
}
async function createFrom(page: Page, label: RegExp) {
  await page.goto("/dashboard/websites/corporate?new=1");
  await page.getByRole("button", { name: label }).first().click();
  const created = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ساخت از روی قالب انتخاب‌شده", exact: true }).click();
  const project = (await (await created).json()).project as { id: string };
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`));
  await expect(page.locator("[data-studio-header]")).toBeVisible();
  return project;
}
const canvas = (page: Page) => page.locator('[data-canvas-interactive="true"]');
const field = (page: Page, scope: string, name: string) => canvas(page).locator(`[data-editable-scope="${scope}"][data-editable-field="${name}"]`).first();
const dirty = (page: Page) => page.getByText("تغییرات ذخیره نشده").first();
const saveBtn = (page: Page) => page.getByRole("button", { name: "ذخیره", exact: true });
async function editText(page: Page, locator: ReturnType<typeof field>, text: string, finish: "Enter" | "Escape" | "blur" = "Enter") {
  await locator.dblclick();
  await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
  if (finish === "blur") await page.locator("[data-studio-header] h1").click(); else await page.keyboard.press(finish);
  await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(0);
}
const saveAndWait = async (page: Page, id: string) => {
  const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${id}` && r.request().method() === "PATCH" && r.status() === 200);
  await saveBtn(page).click();
  await saved;
};

test("Medical: click selects, double click edits in place; Persian, English and ZWNJ survive save, reload, preview and the public site", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, /کلینیک و پزشک/);
    const title = field(page, "hero", "title");
    const original = (await title.innerText()).trim();
    expect(original.length).toBeGreaterThan(3);

    // Single click only selects. It does not start editing.
    await title.click();
    await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(0);
    await expect(page.locator("[data-studio-inspector]")).toContainText("بنر اصلی");

    // Ordinary typing: the caret stays where it is typed (character by character).
    await title.dblclick();
    await page.keyboard.press("ControlOrMeta+a");
    const typed = `سلام${ZWNJ}دنیا Clinic ۱۲۳`;
    await page.keyboard.insertText(typed.slice(0, 5));
    for (const ch of typed.slice(5)) await page.keyboard.insertText(ch);
    await page.keyboard.press("Enter");
    await expect(field(page, "hero", "title")).toHaveText(typed);
    await expect(dirty(page)).toBeVisible();

    // Escape cancels and leaves the document untouched.
    const beforeCancel = await field(page, "hero", "title").innerText();
    await field(page, "hero", "title").dblclick();
    await page.keyboard.insertText(" حذف‌شدنی");
    await page.keyboard.press("Escape");
    await expect(field(page, "hero", "title")).toHaveText(beforeCancel);

    // Subtitle with English text, committed by clicking elsewhere (blur).
    await editText(page, field(page, "hero", "subtitle"), "Hello inline World", "blur");
    await expect(field(page, "hero", "subtitle")).toHaveText("Hello inline World");

    // Plain-text paste: markup on the clipboard never reaches the document.
    await field(page, "hero", "eyebrow").dblclick();
    await page.keyboard.press("ControlOrMeta+a");
    await field(page, "hero", "eyebrow").evaluate((el) => {
      const data = new DataTransfer();
      data.setData("text/html", "<b onclick=alert(1)>پررنگ</b>");
      data.setData("text/plain", "متن ساده");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await page.keyboard.press("Enter");
    await expect(field(page, "hero", "eyebrow")).toHaveText("متن ساده");
    await expect(canvas(page).locator("b[onclick]")).toHaveCount(0);

    // Entering edit mode never starts a section drag.
    await field(page, "hero", "title").dblclick();
    const prevented = await canvas(page).locator('[data-editing="true"]').evaluate((el) => { const e = new DragEvent("dragstart", { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; });
    expect(prevented).toBe(true);
    await page.keyboard.press("Escape");

    // Undo / redo are app-level steps: one per committed edit, not per keystroke.
    await page.locator("[data-studio-header] h1").click();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(field(page, "hero", "eyebrow")).not.toHaveText("متن ساده");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(field(page, "hero", "subtitle")).not.toHaveText("Hello inline World");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(field(page, "hero", "subtitle")).toHaveText("Hello inline World");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(field(page, "hero", "eyebrow")).toHaveText("متن ساده");
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(field(page, "hero", "title")).toHaveText(original);   // three undo steps (eyebrow, subtitle, title): per edit, not per keystroke
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(field(page, "hero", "title")).toHaveText(typed);

    // A section heading edits the same way, in the document of THIS page.
    const sectionTitle = canvas(page).locator('[data-editable-scope="section"][data-editable-field="title"]').first();
    await sectionTitle.scrollIntoViewIfNeeded();
    await editText(page, sectionTitle, `پزشکان${ZWNJ}ما ✓`);

    // Save, reload, the text is back, byte for byte (ZWNJ included).
    await saveAndWait(page, project.id);
    await expect(page.getByText("همه تغییرات ذخیره شده").first()).toBeVisible();
    const stored = JSON.stringify((await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content);
    expect(stored).toContain(typed);
    expect(stored).toContain("Hello inline World");
    expect(stored).not.toContain("onclick");
    await page.reload();
    await expect(field(page, "hero", "title")).toHaveText(typed);
    await expect(field(page, "hero", "subtitle")).toHaveText("Hello inline World");

    // Keyboard: Enter on the focused text starts editing; Escape leaves.
    await field(page, "hero", "title").focus();
    await page.keyboard.press("Enter");
    await expect(canvas(page).locator('[data-editing="true"]')).toHaveCount(1);
    await page.keyboard.press("Escape");

    // Preview shows it, publish, and the public site shows exactly the saved text.
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
    await expect(page.locator('[data-canvas-interactive="false"]').getByText(typed).first()).toBeVisible();
    await expect(page.locator('[data-canvas-interactive="false"] [data-editable-field]'), "no editing surface in preview").toHaveCount(0);
    await page.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/site/${project.id}`);
    await expect(visitor.getByText(typed).first()).toBeVisible();
    await expect(visitor.getByText("Hello inline World").first()).toBeVisible();
    await expect(visitor.locator("[data-editable-field], [contenteditable]"), "no editing surface on the public site").toHaveCount(0);
    await visitor.context().close();
  } finally { await context.close(); await api.dispose(); }
});

test("a failed save keeps an inline edit unsaved; a stale second tab is refused with 409", async ({ browser }) => {
  test.setTimeout(180_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, /شرکت حرفه‌ای/);
    await editText(page, field(page, "hero", "title"), "ویرایش یک");
    await page.route(`${apiBase}/api/site-projects/${project.id}`, (route) => route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, message: "خطای موقت" }) }) : route.continue());
    await saveBtn(page).click();
    await expect(page.getByText("خطای موقت").first()).toBeVisible();
    await expect(dirty(page)).toBeVisible();
    await page.unroute(`${apiBase}/api/site-projects/${project.id}`);
    await saveAndWait(page, project.id);

    const tabB = await context.newPage();
    await tabB.goto(`/dashboard/websites/corporate?project=${project.id}`);
    await expect(field(tabB, "hero", "title")).toHaveText("ویرایش یک");
    await editText(page, field(page, "hero", "title"), "ویرایش دو");
    await saveAndWait(page, project.id);
    await editText(tabB, field(tabB, "hero", "title"), "ویرایش کهنه");
    const refused = tabB.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${project.id}` && r.request().method() === "PATCH");
    await saveBtn(tabB).click();
    expect((await refused).status()).toBe(409);
    await expect(dirty(tabB)).toBeVisible();
    expect(JSON.stringify((await (await api.get(`/api/site-projects/${project.id}`)).json()).project.content)).toContain("ویرایش دو");
  } finally { await context.close(); await api.dispose(); }
});

for (const [label, name] of [[/شرکت حرفه‌ای/, "Corporate"], [/موسسه حقوقی/, "Legal"]] as const) {
  test(`${name}: hero and section heading edit inline, save, reload and publish`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { api, context } = await signIn(browser);
    const page = await context.newPage();
    try {
      const project = await createFrom(page, label);
      const text = `عنوان ${name}${ZWNJ}نو`;
      await editText(page, field(page, "hero", "title"), text);
      const heading = canvas(page).locator('[data-editable-scope="section"][data-editable-field="title"]').first();
      await heading.scrollIntoViewIfNeeded();
      await editText(page, heading, `بخش ${name} ✓`);
      await saveAndWait(page, project.id);
      await page.reload();
      await expect(field(page, "hero", "title")).toHaveText(text);
      await expect(canvas(page).getByText(`بخش ${name} ✓`).first()).toBeVisible();
      const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
      await page.getByRole("button", { name: "انتشار", exact: true }).click();
      await published;
      const visitor = await (await browser.newContext()).newPage();
      await visitor.goto(`/site/${project.id}`);
      await expect(visitor.getByText(text).first()).toBeVisible();
      await expect(visitor.getByText(`بخش ${name} ✓`).first()).toBeVisible();
      await visitor.context().close();
    } finally { await context.close(); await api.dispose(); }
  });
}
