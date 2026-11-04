import { expect, test } from "@playwright/test";
import { createVerifiedUser, latestEmail, login, sql, uniqueEmail } from "./accounts-helpers";

test("registration: validation, verification pending, resend, unverified login, verify link → dashboard", async ({ page, request }) => {
  const email = uniqueEmail("reg");
  await page.goto("/register");
  // Client-side validation before anything is sent.
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill("short1");
  await page.locator('input[name="confirmPassword"]').fill("short2");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
  await expect(page.getByText("Passwords don't match.")).toBeVisible();

  await page.locator('input[name="password"]').fill("analytical-1843");
  await page.locator('input[name="confirmPassword"]').fill("analytical-1843");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=/, { timeout: 45_000 });
  await expect(page.getByText(email)).toBeVisible();

  // Profile row was created by the database trigger.
  const rows = await sql<{ full_name: string }>(request, "select p.full_name from profiles p join auth.users u on u.id = p.id where u.email = $1", [email]);
  expect(rows).toEqual([{ full_name: "Ada Lovelace" }]);

  // Logging in before verifying is refused and explained.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill("analytical-1843");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/verify-email\?.*reason=unverified/);
  await expect(page.getByTestId("unverified-notice")).toBeVisible();

  // Protected dashboard is not reachable.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

  // Resend issues a new link; the generic message doesn't reveal account existence.
  await page.goto(`/verify-email?email=${encodeURIComponent(email)}`);
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByTestId("form-message")).toContainText("If that address has an unverified account");
  const mail = await latestEmail(request, email, "signup");

  await page.goto(mail.link);
  await expect(page).toHaveURL(/\/dashboard\?notice=verified/);
  await expect(page.getByTestId("dashboard-greeting")).toContainText("Ada Lovelace");
  await expect(page.getByTestId("dashboard-notice")).toContainText("verified");

  // A used link cannot be replayed.
  await page.context().clearCookies();
  await page.goto(mail.link);
  await expect(page).toHaveURL(/\/login\?error=link-invalid/);
  await expect(page.getByTestId("query-message")).toContainText("invalid or has expired");
});

test("registration rejects an email that already has an account", async ({ page, request }) => {
  const user = await createVerifiedUser(request, "Existing User");
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Someone Else");
  await page.getByLabel("Email").fill(user.email);
  await page.locator('input[name="password"]').fill("another-pass-99");
  await page.locator('input[name="confirmPassword"]').fill("another-pass-99");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("An account with this email already exists")).toBeVisible();
});

test("login: wrong password, remembered session, redirect back to ?next, guest pages, logout", async ({ page, request, browser }) => {
  const user = await createVerifiedUser(request, "Login Tester");
  await login(page, user.email, "wrong-password-1");
  await expect(page.getByTestId("form-message")).toHaveText("Email or password is incorrect.");

  await page.goto("/dashboard/projects");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fprojects/);
  await page.getByLabel("Email").fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/projects$/);

  // Session cookies survive a reload and a new tab; signed-in users skip /login.
  await page.reload();
  await expect(page.getByRole("heading", { name: "My QR projects" })).toBeVisible();
  const tab = await page.context().newPage();
  await tab.goto("/login");
  await expect(tab).toHaveURL(/\/dashboard$/);
  await expect(tab.getByTestId("account-link")).toHaveText("Dashboard");
  await tab.close();

  // Open-redirect attempts fall back to the dashboard.
  const ctx = await browser.newContext({ baseURL: "http://localhost:3101" });
  const other = await ctx.newPage();
  await login(other, user.email, user.password, "https://evil.example/phish");
  await expect(other).toHaveURL("http://localhost:3101/dashboard");
  await ctx.close();

  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/\?notice=signed-out/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("password reset: request, link, new password, old password rejected, link not reusable", async ({ page, request }) => {
  const user = await createVerifiedUser(request, "Reset Tester");
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByTestId("form-message")).toContainText("If an account exists");

  // Unknown addresses get the same answer (no account enumeration).
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByTestId("form-message")).toContainText("If an account exists");

  const mail = await latestEmail(request, user.email, "recovery");
  await page.goto(mail.link);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByText(`For ${user.email}`)).toBeVisible();
  await page.getByRole("textbox", { name: "New password", exact: true }).fill("brand-new-pass-7");
  await page.getByRole("textbox", { name: "Confirm new password" }).fill("brand-new-pass-8");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Passwords don't match.")).toBeVisible();
  await page.getByRole("textbox", { name: "Confirm new password" }).fill("brand-new-pass-7");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/dashboard\?notice=password-updated/);
  await expect(page.getByTestId("dashboard-notice")).toContainText("password has been updated");

  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/\?notice=signed-out/);
  await login(page, user.email, user.password);
  await expect(page.getByTestId("form-message")).toHaveText("Email or password is incorrect.");
  await login(page, user.email, "brand-new-pass-7");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().clearCookies();
  await page.goto(mail.link);
  await expect(page).toHaveURL(/\/forgot-password\?error=link-invalid/);
  await page.goto("/reset-password");
  await expect(page.getByTestId("reset-invalid")).toBeVisible();
});

test("anonymous visitors keep full QR features but cannot reach private pages", async ({ page }) => {
  for (const path of ["/dashboard", "/dashboard/history", "/dashboard/templates", "/dashboard/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  await page.goto("/create?type=url&url=https%3A%2F%2Fexample.com");
  await expect(page.locator("[data-scan]").first()).toHaveAttribute("data-scan", "pass", { timeout: 20_000 });
  await expect(page.getByTestId("save-panel")).toContainText("Saving projects needs a free account");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByTestId("account-link")).toHaveText("Log in");
});
