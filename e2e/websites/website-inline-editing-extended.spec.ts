import { expect, request, test, type Browser, type Page } from "@playwright/test";

// V17 phase 3: inline editing beyond headings (descriptions, items, CTA labels, brand, footer, Store headings),
// with page isolation, safe exits and Inspector synchronisation.
const apiBase = process.env.E2E_API_BASE_URL;
if (!apiBase) throw new Error("E2E_API_BASE_URL is required.");
test.use({ actionTimeout: 15_000 });

const ZWNJ = "‌";
async function signIn(browser: Browser) {
  const api = await request.newContext({ baseURL: apiBase });
  const mobile = `093${`${Date.now()}${Math.floor(Math.random() * 999)}`.slice(-8)}`;
  let sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Inline Ext E2E" } });
  if (sent.status() === 429) { await new Promise((r) => setTimeout(r, 62_000)); sent = await api.post("/api/auth/send-otp", { data: { mobile, name: "Inline Ext E2E" } }); }
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
const canvas = (page: Page) => page.locator('[data-canvas-interactive="true"]');
const editing = (page: Page) => canvas(page).locator('[data-editing="true"]');
const field = (page: Page, scope: string, name: string) => canvas(page).locator(`[data-editable-scope="${scope}"][data-editable-field="${name}"]`);
async function type(page: Page, locator: ReturnType<typeof field>, text: string, finish: "Enter" | "Control+Enter" | "blur" = "Enter") {
  await locator.scrollIntoViewIfNeeded();
  await locator.dblclick();
  await expect(editing(page)).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
  if (finish === "blur") await page.locator("[data-studio-header] h1").click(); else await page.keyboard.press(finish === "Enter" ? "Enter" : "ControlOrMeta+Enter");
  await expect(editing(page)).toHaveCount(0);
}
const save = async (page: Page, id: string) => {
  const saved = page.waitForResponse((r) => r.url() === `${apiBase}/api/site-projects/${id}` && r.request().method() === "PATCH" && r.status() === 200);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await saved;
};
const openInspector = async (page: Page) => { const t = page.getByRole("button", { name: /پنل ویرایش/ }); if ((await t.getAttribute("aria-label")) === "باز کردن پنل ویرایش") await t.click(); };

test("Medical: descriptions, service/team items, CTA label (with spaces), brand and footer edit inline and reach the public site", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", /کلینیک و پزشک/);
    const wanted = {
      brand: `کلینیک${ZWNJ}آرامش`, cta: "همین حالا نوبت بگیرید", item: `دکتر${ZWNJ}آزمون`, itemBody: "توضیح تازهٔ پزشک با Latin 42", footer: "همهٔ حقوق محفوظ است ۱۴۰۵",
    };
    await type(page, field(page, "header", "storeName").first(), wanted.brand);
    await type(page, field(page, "hero", "ctaLabel"), wanted.cta);   // typing spaces inside a button must not click it
    const itemTitle = field(page, "item", "title").first();
    await expect(itemTitle, "medical template has repeated items").toBeVisible();
    await type(page, itemTitle, wanted.item);
    const itemBody = field(page, "item", "body").first();
    if (await itemBody.count()) await type(page, itemBody, wanted.itemBody, "Control+Enter");
    await type(page, field(page, "footer", "text"), wanted.footer);
    await expect(page.getByText("تغییرات ذخیره نشده").first()).toBeVisible();

    // The Inspector shows the same value (one document state, two views of it).
    await field(page, "hero", "ctaLabel").click();
    await openInspector(page);
    await expect(page.locator("[data-studio-inspector] input").filter({ has: page.locator(":scope") }).first()).toBeVisible();
    const inspectorValues = await page.locator("[data-studio-inspector] input").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
    expect(inspectorValues).toContain(wanted.cta);

    await save(page, project.id);
    await page.reload();
    await expect(field(page, "header", "storeName").first()).toHaveText(wanted.brand);
    await expect(field(page, "hero", "ctaLabel")).toHaveText(wanted.cta);
    await expect(field(page, "item", "title").first()).toHaveText(wanted.item);
    await expect(field(page, "footer", "text")).toHaveText(wanted.footer);

    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/site/${project.id}`);
    for (const text of [wanted.brand, wanted.cta, wanted.item, wanted.footer]) await expect(visitor.getByText(text).first()).toBeVisible();
    await visitor.context().close();
    expect(errors).toEqual([]);
  } finally { await context.close(); await api.dispose(); }
});

test("pages stay isolated; delete, hide and page switches leave editing safely", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const project = await createFrom(page, "/dashboard/websites/corporate", /شرکت حرفه‌ای/);
    const homeTitleBefore = await field(page, "hero", "title").innerText();
    // A second page with its own section.
    await openInspector(page);
    const inspector = page.locator("[data-studio-inspector]");
    await inspector.getByRole("button", { name: "صفحه‌ها", exact: true }).click();
    await inspector.getByRole("button", { name: "افزودن صفحه" }).click();
    await inspector.getByRole("button", { name: "بخش‌ها", exact: true }).click();
    await inspector.locator("label", { hasText: "افزودن بخش" }).locator("select").selectOption("text");
    await expect(field(page, "hero", "title"), "no hero on page 2").toHaveCount(0);
    const pageBTitle = field(page, "section", "title").first();
    await type(page, pageBTitle, "عنوان فقط صفحهٔ دوم");

    // Back on Home: its content is untouched and page B's text is not there.
    const select = page.locator("[data-page-select]");
    const homeId = (await select.locator("option").first().getAttribute("value"))!;
    const pageBId = await select.inputValue();
    await select.selectOption(homeId);
    await expect(canvas(page).getByText("عنوان فقط صفحهٔ دوم")).toHaveCount(0);
    await expect(field(page, "hero", "title")).toHaveText(homeTitleBefore);

    // Switching pages while a field is being edited commits it to ITS page and leaves editing.
    await field(page, "hero", "title").dblclick();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("ویرایش در حال انجام");
    await select.selectOption(pageBId);
    await expect(editing(page)).toHaveCount(0);
    await select.selectOption(homeId);
    await expect(field(page, "hero", "title")).toHaveText("ویرایش در حال انجام");
    await select.selectOption(pageBId);
    await expect(canvas(page).getByText("ویرایش در حال انجام")).toHaveCount(0);
    await expect(field(page, "section", "title").first()).toHaveText("عنوان فقط صفحهٔ دوم");

    // Deleting a section while editing its heading exits editing without errors.
    await field(page, "section", "title").first().click();
    await field(page, "section", "title").first().dblclick();
    await expect(editing(page)).toHaveCount(1);
    await page.keyboard.insertText(" +");
    await canvas(page).locator('[data-editor-selected="true"] button[title="حذف"]').first().click();
    await expect(canvas(page).locator("[data-editable-scope='section']"), "the section is gone").toHaveCount(0);
    await expect(editing(page)).toHaveCount(0);
    expect(errors).toEqual([]);
    await save(page, project.id);
  } finally { await context.close(); await api.dispose(); }
});

test("Store: hero, brand and section headings edit inline; product cards, prices and checkout stay under their own controls", async ({ browser }) => {
  test.setTimeout(240_000);
  const { api, context } = await signIn(browser);
  const page = await context.newPage();
  try {
    const project = await createFrom(page, "/dashboard/websites/store", /Loadder Commerce Modern V1/);
    expect(await canvas(page).getAttribute("data-site-kind")).toBe("STORE");
    // Nothing inside product cards (names, prices, badges) is a generic editable text.
    await expect(canvas(page).locator('[data-editor-element="product-card"] [data-editable-field]')).toHaveCount(0);
    const heading = field(page, "section", "title").first();
    await expect(heading).toBeVisible();
    await type(page, heading, "پرفروش‌ترین‌ها این هفته");
    await type(page, field(page, "hero", "title"), `فروشگاه${ZWNJ}من`);
    await type(page, field(page, "header", "storeName").first(), "برند من");
    await save(page, project.id);
    await page.reload();
    await expect(field(page, "hero", "title")).toHaveText(`فروشگاه${ZWNJ}من`);
    await expect(canvas(page).getByText("پرفروش‌ترین‌ها این هفته").first()).toBeVisible();
    const published = page.waitForResponse((r) => r.url().endsWith(`/api/site-projects/${project.id}/publish`) && r.status() === 200);
    await page.getByRole("button", { name: "انتشار", exact: true }).click();
    await published;
    await page.goto(`/store/${project.id}`);
    await expect(page.getByText(`فروشگاه${ZWNJ}من`).first()).toBeVisible();
    await expect(page.getByText("پرفروش‌ترین‌ها این هفته").first()).toBeVisible();
    await expect(page.locator("[data-editable-field], [contenteditable]")).toHaveCount(0);
  } finally { await context.close(); await api.dispose(); }
});
