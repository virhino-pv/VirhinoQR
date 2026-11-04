import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { BUILTIN_TEMPLATES } from "../../src/lib/templates/builtin";
import { encodePngRgba } from "../helpers/png";
import { expectScans } from "./helpers";

const URL_TEXT = "https://qr-studio.example/templates-e2e";
const previewSvg = async (page: Page) => decodeURIComponent((await page.getByTestId("qr-preview").getAttribute("src"))!);

async function openStudio(page: Page) {
  await page.goto(`/create?type=url&url=${encodeURIComponent(URL_TEXT)}`);
  await expectScans(page);
  await page.getByTestId("pane-templates").locator("summary").click();
}

test("every built-in template applies, updates the controls and scans", async ({ page }) => {
  await openStudio(page);
  const grid = page.getByTestId("builtin-templates");
  await expect(grid.locator("[data-template]")).toHaveCount(BUILTIN_TEMPLATES.length);
  for (const t of BUILTIN_TEMPLATES) {
    await grid.locator(`[data-template="${t.id}"]`).click();
    await expect(grid.locator(`[data-template="${t.id}"]`)).toHaveAttribute("aria-pressed", "true");
    await expectScans(page);
  }
  // The last applied template (transparent) is reflected in the colour controls.
  await expect(page.getByLabel("Transparent background")).toBeChecked();
  await page.getByRole("button", { name: "Reset design" }).click();
  await expect(grid.locator('[data-template="classic"]')).toHaveAttribute("aria-pressed", "true");
});

test("category filter narrows the gallery", async ({ page }) => {
  await openStudio(page);
  await page.getByRole("group", { name: "Filter templates" }).getByRole("button", { name: "Print" }).click();
  const expected = BUILTIN_TEMPLATES.filter((t) => t.category === "print").length;
  await expect(page.getByTestId("builtin-templates").locator("[data-template]")).toHaveCount(expected);
});

test("save, persist across reload, apply, rename and delete a user template", async ({ page }) => {
  await openStudio(page);
  await expect(page.getByTestId("no-user-templates")).toBeVisible();

  // Customise, then save.
  await page.getByTestId("builtin-templates").locator('[data-template="ocean"]').click();
  await page.getByTestId("pane-shapes").locator("summary").click();
  await page.getByTestId("body-shapes").getByRole("radio", { name: "Dots" }).click();
  const designed = await previewSvg(page);

  await page.getByRole("button", { name: "Save current design" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Give the template a name" })).toBeVisible();
  await page.getByLabel("Template name").fill("  Ocean   dots ");
  await page.getByRole("button", { name: "Save current design" }).click();
  await expect(page.getByTestId("template-status")).toContainText("Saved “Ocean dots”");
  await expect(page.locator('[data-user-template="Ocean dots"]')).toBeVisible();

  // Persisted in IndexedDB.
  await page.reload();
  await page.getByTestId("pane-templates").locator("summary").click();
  await expect(page.locator('[data-user-template="Ocean dots"]')).toBeVisible();
  const before = await previewSvg(page);
  expect(before).not.toBe(designed); // fresh page starts from the default design
  await page.getByRole("button", { name: "Apply Ocean dots" }).click();
  await expect.poll(() => previewSvg(page)).toBe(designed);
  await expectScans(page);

  // Rename.
  await page.getByRole("button", { name: "Rename Ocean dots" }).click();
  await page.getByLabel("New name for Ocean dots").fill("Seaside");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.locator('[data-user-template="Seaside"]')).toBeVisible();

  // Delete asks first; cancel keeps it, confirm removes it.
  await page.getByRole("button", { name: "Delete Seaside" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete template?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator('[data-user-template="Seaside"]')).toBeVisible();
  await page.getByRole("button", { name: "Delete Seaside" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("no-user-templates")).toBeVisible();
  await page.reload();
  await page.getByTestId("pane-templates").locator("summary").click();
  await expect(page.getByTestId("no-user-templates")).toBeVisible();
});

test("templates with a logo export to JSON and import into a fresh browser profile", async ({ page, browser }) => {
  await openStudio(page);
  // Add a logo, save a template that includes it.
  await page.getByTestId("pane-logo").locator("summary").click();
  const s = 48;
  const rgba = new Uint8Array(s * s * 4);
  for (let i = 0; i < s * s; i++) rgba.set([190, 18, 60, 255], i * 4);
  await page.getByTestId("logo-input").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: Buffer.from(encodePngRgba(s, s, rgba)) });
  await expect(page.getByTestId("logo-thumb")).toBeVisible();
  await page.getByTestId("builtin-templates").locator('[data-template="berry"]').click();
  await expect(page.getByTestId("logo-thumb")).toBeVisible(); // built-ins keep the user's logo
  await page.getByLabel("Template name").fill("Berry with logo");
  await page.getByRole("button", { name: "Save current design" }).click();
  await expect(page.locator('[data-user-template="Berry with logo"]')).toContainText("With logo");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export templates" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^qr-studio-templates-\d{8}\.json$/);
  const file = readFileSync((await download.path())!, "utf8");
  const json = JSON.parse(file);
  expect(json.format).toBe("qr-studio-templates");
  expect(json.templates[0].logo.dataUrl).toMatch(/^data:image\/png;base64,/);

  // A new context has empty IndexedDB, like another device.
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await openStudio(other);
  await expect(other.getByTestId("no-user-templates")).toBeVisible();
  await other.getByTestId("template-import").setInputFiles({ name: "templates.json", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(other.getByTestId("template-status")).toContainText("Imported 1 template.");
  await other.getByRole("button", { name: "Apply Berry with logo" }).click();
  await expect(other.getByTestId("qr-ec")).toHaveText("H");
  expect(await previewSvg(other)).toContain("<image");
  await expectScans(other);
  await ctx.close();
});

test("invalid template files are rejected with a clear message", async ({ page }) => {
  await openStudio(page);
  const input = page.getByTestId("template-import");
  await input.setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{not json") });
  await expect(page.getByTestId("template-status")).toContainText("not valid JSON");
  await input.setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ hello: "world" })) });
  await expect(page.getByTestId("template-status")).toContainText("not a QR Studio templates file");
  const partly = { format: "qr-studio-templates", version: 1, templates: [{ name: "Broken", design: { ec: "Z" } }] };
  await input.setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(partly)) });
  await expect(page.getByTestId("template-status")).toContainText("Imported 0 templates. Skipped 1: Broken");
  await expect(page.getByTestId("no-user-templates")).toBeVisible();
});

test("templates page lists every template and opens it in the studio", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { level: 1, name: "QR code templates" })).toBeVisible();
  await expect(page.locator("[data-template-card]")).toHaveCount(BUILTIN_TEMPLATES.length);
  await page.getByRole("link", { name: "Use template: Sunset" }).click();
  await expect(page).toHaveURL(/\/create\?template=sunset/);
  await expect(page.getByTestId("builtin-templates").locator('[data-template="sunset"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('#main form [name="url"]').fill("example.com");
  await expect(page.getByTestId("qr-payload")).toHaveText("https://example.com");
  await expectScans(page);
  expect(await previewSvg(page)).toContain("<radialGradient");
});

test("homepage showcase opens its template in the studio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radiogroup", { name: "Example styles" }).getByRole("radio", { name: /Teal dots/ }).click();
  await page.getByRole("link", { name: "Use this template" }).click();
  await expect(page).toHaveURL(/template=teal-dots/);
  await expect(page.getByTestId("builtin-templates").locator('[data-template="teal-dots"]')).toHaveAttribute("aria-pressed", "true");
});
