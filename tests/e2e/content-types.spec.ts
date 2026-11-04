import { expect, test } from "@playwright/test";
import { CONTENT_TYPES, buildPayload } from "../../src/lib/payloads";
import { expectScans, fillForm } from "./helpers";

test.describe("all 22 content types in the real UI", () => {
  for (const type of CONTENT_TYPES) {
    test(`${type.id}: form → exact payload → scannable preview`, async ({ page }) => {
      await page.goto(`/create?type=${type.id}`);
      await expect(page.getByRole("heading", { name: `2. ${type.label} content` })).toBeVisible();
      await expect(page.getByTestId("preview-empty")).toBeVisible();
      if (type.tier === "linked") await expect(page.getByText("Static link — no hosting yet")).toBeVisible();

      await fillForm(page, type, type.sample);
      const expected = buildPayload(type, type.sample);
      if (expected.status !== "ok") throw new Error("invalid sample");
      await expect(page.getByTestId("qr-payload")).toHaveText(expected.payload);
      await expect(page.getByTestId("qr-preview")).toBeVisible();
      await expectScans(page);
    });
  }
});

test("validation: errors appear after blur and clear when fixed", async ({ page }) => {
  await page.goto("/create?type=email");
  const to = page.locator('[name="to"]');
  await to.fill("not-an-email");
  await to.blur();
  await expect(page.getByRole("alert").filter({ hasText: "valid email" })).toBeVisible();
  await expect(to).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("preview-empty")).toContainText("Fix the highlighted fields");
  await to.fill("hello@example.com");
  await expect(to).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("qr-payload")).toHaveText("mailto:hello@example.com");
});

test("download without content highlights the form instead of producing a file", async ({ page }) => {
  await page.goto("/create?type=wifi");
  await page.getByTestId("download").click();
  await expect(page.getByTestId("export-status")).toContainText("Complete the content form");
  await expect(page.getByRole("alert").filter({ hasText: "Network name (SSID) is required" })).toBeVisible();
});

test("switching types keeps each draft", async ({ page }) => {
  await page.goto("/create?type=text");
  await page.locator('[name="text"]').fill("first draft");
  await page.locator('[data-type="phone"]').click();
  await page.locator('[name="phone"]').fill("+44 20 7946 0958");
  await page.locator('[data-type="text"]').click();
  await expect(page.locator('[name="text"]')).toHaveValue("first draft");
  await expect(page).toHaveURL(/type=text/);
});

test("Tamil text is encoded as UTF-8 and scans", async ({ page }) => {
  await page.goto("/create?type=text");
  await page.locator('[name="text"]').fill("தமிழ் மொழி — வணக்கம்");
  await expect(page.getByTestId("qr-payload")).toHaveText("தமிழ் மொழி — வணக்கம்");
  await expectScans(page);
});

test("too much data for the chosen version shows an encoding error", async ({ page }) => {
  await page.goto("/create?type=text");
  await page.getByTestId("pane-advanced").locator("summary").click();
  await page.locator("#qr-version").selectOption("1");
  await page.locator('[name="text"]').fill("This text is far too long for a version 1 QR code at level M.");
  await expect(page.getByText(/Version 1 cannot hold this content/)).toBeVisible();
});
