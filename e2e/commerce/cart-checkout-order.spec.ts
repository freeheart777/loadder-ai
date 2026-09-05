import {
  expect,
  request,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type TestInfo,
} from "@playwright/test";

const apiBaseURL = process.env.E2E_API_BASE_URL;

if (!apiBaseURL) throw new Error("E2E_API_BASE_URL is required for the commerce journey.");

type Product = {
  id: string;
  name: string;
  currency: string;
  basePriceMinor: number;
  variants: Array<{ id: string }>;
};
type NetworkEntry = { method: string; status: number; url: string };

let adminApi: APIRequestContext;
let projectId = "";
let product: Product;

async function expectJsonOk(response: APIResponse) {
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

function observe(page: Page) {
  const network: NetworkEntry[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/api/")) {
      network.push({ method: response.request().method(), status: response.status(), url: response.url() });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { network, consoleErrors, pageErrors };
}

async function assertAndon(evidence: ReturnType<typeof observe>, testInfo: TestInfo) {
  await testInfo.attach("network-summary.json", {
    body: Buffer.from(JSON.stringify(evidence.network, null, 2)),
    contentType: "application/json",
  });
  expect(evidence.pageErrors, "uncaught browser errors").toEqual([]);
  expect(evidence.consoleErrors, "browser console errors").toEqual([]);
  expect(evidence.network.filter(({ status }) => status >= 400), "unexpected API 4xx/5xx responses").toEqual([]);
}

async function addFixtureProductThroughUi(page: Page) {
  await page.goto(`/store/${projectId}`);
  const card = page.locator("article").filter({ hasText: product.name }).last();
  await expect(card).toBeVisible();
  const cartCreated = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === `/api/auth/storefront/${projectId}/carts`
    && response.status() === 201,
  );
  const itemAdded = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && /\/api\/auth\/storefront\/carts\/[^/]+\/items$/.test(new URL(response.url()).pathname)
    && response.status() === 201,
  );
  await card.getByRole("button", { name: "افزودن", exact: true }).click();
  await Promise.all([cartCreated, itemAdded]);
  await expect(page.getByText("به سبد خرید اضافه شد.")).toBeVisible();
  return page.evaluate((id) => localStorage.getItem(`loadder-public-cart:${id}`), projectId);
}

test.describe.serial("canonical public Cart → Checkout → Order journey", () => {
  test.beforeAll(async (_fixtures, testInfo) => {
    adminApi = await request.newContext({ baseURL: apiBaseURL });
    const identity = `${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const mobile = `090${identity.replace(/\D/g, "").slice(-8).padStart(8, "0")}`;
    const otp = await expectJsonOk(await adminApi.post("/api/auth/send-otp", {
      data: { mobile, name: "Commerce Journey E2E" },
    }));
    expect(otp.developmentOtp).toMatch(/^\d+$/);
    await expectJsonOk(await adminApi.post("/api/auth/verify-otp", {
      data: { mobile, code: otp.developmentOtp },
    }));
    const created = await expectJsonOk(await adminApi.post("/api/site-projects", {
      data: { name: `فروشگاه مسیر خرید ${identity}`, siteType: "STORE", content: {} },
    }));
    projectId = created.project.id;
    const catalog = await expectJsonOk(await adminApi.post(`/api/stores/${projectId}/products`, {
      data: {
        name: "زعفران ممتاز تست مرورگر",
        description: "محصول ایزوله برای اثبات مسیر واقعی خرید",
        currency: "IRT",
        basePriceMinor: 45_000_000,
        inventoryQuantity: 10,
        status: "ACTIVE",
        sku: `E2E-${identity}`,
      },
    }));
    product = catalog.product;
    expect(product.variants).toHaveLength(1);
  });

  test.afterAll(async () => adminApi?.dispose());

  test("persists cart quantity, completes manual checkout, and reloads the real order", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const evidence = observe(page);
    const cartId = await addFixtureProductThroughUi(page);
    expect(cartId).toMatch(/^cart_/);

    await page.getByRole("link", { name: "سبد خرید", exact: true }).click();
    await expect(page).toHaveURL(`/store/${projectId}/cart`);
    const cartItem = page.locator("article").filter({ hasText: product.name });
    await expect(cartItem).toContainText("۱");
    await expect(page.getByText("۴۵۰٬۰۰۰ تومان").first()).toBeVisible();

    const quantityUpdated = page.waitForResponse((response) =>
      response.request().method() === "PUT"
      && new URL(response.url()).pathname === `/api/auth/storefront/carts/${cartId}/items/${product.variants[0].id}`
      && response.status() === 200,
    );
    await cartItem.getByRole("button").last().click();
    const updateBody = await (await quantityUpdated).json();
    expect(updateBody.cart.items[0].quantity).toBe(2);
    await expect(cartItem).toContainText("۲");
    await expect(page.getByText("۹۰۰٬۰۰۰ تومان").first()).toBeVisible();

    await page.reload();
    await expect(page.locator("article").filter({ hasText: product.name })).toContainText("۲");
    await page.getByRole("link", { name: "ادامه و ثبت سفارش", exact: true }).click();
    await expect(page).toHaveURL(`/store/${projectId}/checkout`);
    await page.getByLabel("نام و نام خانوادگی").fill("نگار رضایی");
    await page.getByLabel("شماره موبایل").fill("۰۹۱۲۱۲۳۴۵۶۷");
    await page.getByLabel("استان").fill("تهران");
    await page.getByLabel("شهر").fill("تهران");
    await page.getByLabel("کد پستی").fill("۱۴۱۶۷۵۳۹۱۱");
    await page.getByLabel("آدرس کامل").fill("خیابان ولیعصر، پلاک ۱۲، واحد ۳");

    const checkoutCompleted = page.waitForResponse((response) =>
      response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/auth/storefront/carts/${cartId}/checkout`
      && response.status() === 201,
    );
    await page.getByRole("button", { name: "ثبت سفارش", exact: true }).click();
    const checkoutBody = await (await checkoutCompleted).json();
    const orderId = checkoutBody.order.id as string;
    expect(checkoutBody.order.items[0]).toMatchObject({
      productName: product.name,
      quantity: 2,
      lineTotalMinor: 90_000_000,
    });
    await expect(page).toHaveURL(`/store/${projectId}/order-success/${orderId}`);
    await expect(page.getByText(orderId, { exact: true })).toBeVisible();
    await expect(page.getByText(`${product.name} × ۲`, { exact: true })).toBeVisible();
    await expect(page.getByText("۹۰۰٬۰۰۰ تومان").first()).toBeVisible();
    expect(await page.evaluate((id) => localStorage.getItem(`loadder-public-cart:${id}`), projectId)).toBeNull();

    const reloadedOrder = page.waitForResponse((response) =>
      response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/auth/storefront/orders/${orderId}`
      && response.status() === 200,
    );
    await page.reload();
    const persisted = await (await reloadedOrder).json();
    expect(persisted.order).toMatchObject({ id: orderId, totalMinor: 90_000_000 });
    await expect(page.getByText(`${product.name} × ۲`, { exact: true })).toBeVisible();
    await assertAndon(evidence, testInfo);
  });

  test("invalid checkout stays visible, sends no checkout request, and creates no order", async ({ page }, testInfo) => {
    const evidence = observe(page);
    await addFixtureProductThroughUi(page);
    await page.getByRole("link", { name: "سبد خرید", exact: true }).click();
    await page.getByRole("link", { name: "ادامه و ثبت سفارش", exact: true }).click();
    const beforeOrders = await expectJsonOk(await adminApi.get(`/api/stores/${projectId}/orders`));
    const checkoutPostsBefore = evidence.network.filter(({ method, url }) =>
      method === "POST" && new URL(url).pathname.endsWith("/checkout"),
    ).length;
    await page.getByLabel("نام و نام خانوادگی").fill("مشتری ناقص");
    await page.getByLabel("شماره موبایل").fill("۰۹۱۲۱۲۳۴۵۶۷");
    await page.getByRole("button", { name: "ثبت سفارش", exact: true }).click();
    await expect(page.getByText("نام، موبایل و آدرس را کامل کن.")).toBeVisible();
    await expect(page).toHaveURL(`/store/${projectId}/checkout`);
    const checkoutPostsAfter = evidence.network.filter(({ method, url }) =>
      method === "POST" && new URL(url).pathname.endsWith("/checkout"),
    ).length;
    expect(checkoutPostsAfter).toBe(checkoutPostsBefore);
    const afterOrders = await expectJsonOk(await adminApi.get(`/api/stores/${projectId}/orders`));
    expect(afterOrders.orders).toHaveLength(beforeOrders.orders.length);
    await assertAndon(evidence, testInfo);
  });

  test("390x844 mobile cart exposes the critical checkout actions without overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const evidence = observe(page);
    await addFixtureProductThroughUi(page);
    await page.getByRole("link", { name: "سبد خرید", exact: true }).click();
    await expect(page.getByRole("link", { name: "ادامه", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "ادامه", exact: true }).click();
    await expect(page.getByRole("button", { name: "ثبت سفارش", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
    await assertAndon(evidence, testInfo);
  });
});
