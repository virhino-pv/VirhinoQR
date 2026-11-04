import { expect, test } from "@playwright/test";

// Runs against the regular `npm run build` output, which has no Supabase configuration.
test("without Supabase configuration accounts are disabled gracefully", async ({ page }) => {
  for (const path of ["/login", "/register", "/forgot-password"]) {
    await page.goto(path);
    await expect(page.getByTestId("accounts-unavailable")).toBeVisible();
  }
  await page.goto("/dashboard/projects");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/create?type=url&url=https%3A%2F%2Fexample.com");
  await expect(page.locator("[data-scan]").first()).toHaveAttribute("data-scan", "pass", { timeout: 20_000 });
  await expect(page.getByTestId("account-link")).toHaveCount(0);
  await expect(page.getByTestId("save-panel")).toHaveCount(0);
});
