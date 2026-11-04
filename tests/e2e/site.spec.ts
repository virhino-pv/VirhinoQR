import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectScans } from "./helpers";

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

test("homepage: sections, live hero generator and entry into the studio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Design QR codes");
  for (const id of ["types", "features", "how-it-works", "use-cases", "faq"]) await expect(page.locator(`#${id}`)).toBeAttached();
  await expect(page.locator("#types a[href^='/create?type=']")).toHaveCount(22);

  const hero = page.getByRole("img", { name: /QR code preview for/ });
  const before = await hero.getAttribute("src");
  await page.getByLabel("Paste a link to try it").fill("my-cafe.example/menu");
  await expect(page.getByText("Live preview of https://my-cafe.example/menu")).toBeVisible();
  await expect.poll(() => hero.getAttribute("src")).not.toBe(before);

  await page.getByRole("link", { name: /Customise & download/ }).click();
  await expect(page).toHaveURL(/\/create\?type=url&url=/);
  await expect(page.getByTestId("qr-payload")).toHaveText("https://my-cafe.example/menu");
  await expectScans(page);
});

test("homepage: style showcase renders live variants; FAQ expands", async ({ page }) => {
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "Example styles" });
  await expect(group.getByRole("radio")).toHaveCount(6);
  await group.getByRole("radio", { name: /Teal dots/ }).click();
  await expect(page.getByRole("img", { name: "Teal dots style QR code example" })).toBeVisible();
  const q = page.getByText("Do my QR codes expire?");
  await q.click();
  await expect(page.getByText(/A static code stores its content directly/)).toBeVisible();
});

test("every internal link on the homepage resolves", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.$$eval("a[href^='/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  for (const href of hrefs) {
    const [path, hash] = href.split("#");
    const res = await request.get(path || "/");
    expect(res.status(), href).toBe(200);
    if (hash) await expect(page.locator(`#${hash}`), href).toBeAttached();
  }
});

for (const width of [360, 390, 768, 1024, 1280, 1440]) {
  test(`responsive at ${width}px: no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await noHorizontalOverflow(page);
    await page.goto("/templates");
    await noHorizontalOverflow(page);
    await page.goto("/create?type=vcard");
    await noHorizontalOverflow(page);
    const bar = page.getByTestId("mobile-bar");
    if (width < 1024) await expect(bar).toBeVisible();
    else await expect(bar).toBeHidden();
  });
}

test("mobile navigation menu opens, closes with Escape and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.click();
  const nav = page.getByRole("navigation", { name: "Mobile" });
  await expect(nav).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await nav.getByRole("link", { name: "Open the QR studio →" }).click();
  await expect(page).toHaveURL(/\/create$/);
});

test("mobile studio: bottom bar shows status and jumps to the preview", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/create?type=url&url=https%3A%2F%2Fexample.com");
  const bar = page.getByTestId("mobile-bar");
  await expect(bar.locator("[data-scan=pass]")).toBeVisible({ timeout: 20_000 });
  await bar.getByRole("link", { name: "Preview & download" }).click();
  await expect(page.getByTestId("qr-preview")).toBeInViewport();
});

test("keyboard: skip link and type selection", async ({ page }) => {
  await page.goto("/create");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  const wifi = page.locator('[data-type="wifi"]');
  await wifi.focus();
  await page.keyboard.press("Enter");
  await expect(wifi).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "2. Wi-Fi content" })).toBeVisible();
});

test("accessibility: homepage has no serious axe violations", async ({ page }) => {
  await page.goto("/");
  await axe(page);
});

test("accessibility: templates page has no serious axe violations", async ({ page }) => {
  await page.goto("/templates");
  await axe(page);
});

test("accessibility: studio (filled, all panes open) has no serious axe violations", async ({ page }) => {
  await page.goto("/create?type=url&url=https%3A%2F%2Fexample.com");
  await expectScans(page);
  for (const pane of ["pane-templates", "pane-shapes", "pane-logo", "pane-advanced"]) await page.getByTestId(pane).locator("summary").click();
  await axe(page);
});

test("404 page offers a way back", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
