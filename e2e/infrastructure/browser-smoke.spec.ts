import { expect, test } from "@playwright/test";

test("launches Chromium and renders a deterministic local document", async ({ page }) => {
  await page.goto(
    "data:text/html,<title>Loadder%20E2E</title><h1>Loadder%20Browser%20E2E%20Ready</h1>",
  );

  await expect(page).toHaveTitle("Loadder E2E");
  await expect(
    page.getByRole("heading", { name: "Loadder Browser E2E Ready" }),
  ).toBeVisible();
});
