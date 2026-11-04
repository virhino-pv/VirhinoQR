import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { encodePngRgba } from "../helpers/png";
import { decodePng, rasterizeSvg } from "../helpers/render";
import { expectScans } from "./helpers";

const URL_TEXT = "https://qr-studio.example/design-test";

async function start(page: Page) {
  await page.goto(`/create?type=url&url=${encodeURIComponent(URL_TEXT)}`);
  await expect(page.getByTestId("qr-payload")).toHaveText(URL_TEXT);
  await expectScans(page);
}

const previewSrc = (page: Page) => page.getByTestId("qr-preview").getAttribute("src");

test.describe("M4 customisation updates the real output", () => {
  test("colours, gradients, eye colours, background and reset", async ({ page }) => {
    await start(page);
    const original = await previewSrc(page);

    const colours = page.getByTestId("pane-colours");
    await colours.getByRole("radio", { name: "Linear gradient" }).click();
    await expect.poll(() => previewSrc(page)).not.toBe(original);
    expect(decodeURIComponent((await previewSrc(page))!)).toContain("<linearGradient");
    await expectScans(page);

    await colours.getByRole("radio", { name: "Radial gradient" }).click();
    await expect.poll(async () => decodeURIComponent((await previewSrc(page))!)).toContain("<radialGradient");

    await colours.getByRole("radio", { name: "Custom" }).click();
    await colours.getByLabel("Eye frame", { exact: true }).fill("#B91C1C");
    await expect.poll(async () => decodeURIComponent((await previewSrc(page))!)).toContain('fill="#b91c1c"');
    await expectScans(page);

    await colours.getByLabel("Background colour", { exact: true }).fill("#FEF3C7");
    await expect.poll(async () => decodeURIComponent((await previewSrc(page))!)).toContain('fill="#fef3c7"');

    // Low contrast is flagged and the scanner result is shown.
    await colours.getByRole("radio", { name: "Solid" }).click();
    await colours.getByLabel("Colour", { exact: true }).fill("#F5F5F5");
    await expect(page.getByText(/lighter than its background|Contrast between code and background/)).toBeVisible();

    await page.getByRole("button", { name: "Reset design" }).click();
    await expect.poll(() => previewSrc(page)).toBe(original);
  });

  test("shapes and advanced settings", async ({ page }) => {
    await start(page);
    await page.getByTestId("pane-shapes").locator("summary").click();
    const before = await previewSrc(page);
    await page.getByTestId("body-shapes").getByRole("radio", { name: "Dots" }).click();
    await page.getByTestId("frame-shapes").getByRole("radio", { name: "Circle" }).click();
    await page.getByTestId("ball-shapes").getByRole("radio", { name: "Leaf" }).click();
    await expect.poll(() => previewSrc(page)).not.toBe(before);
    await expect(page.getByTestId("body-shapes").getByRole("radio", { name: "Dots" })).toHaveAttribute("aria-checked", "true");
    await expectScans(page);

    // Keyboard navigation in a shape group.
    await page.getByTestId("body-shapes").getByRole("radio", { name: "Dots" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("body-shapes").getByRole("radio", { name: "Soft tiles" })).toHaveAttribute("aria-checked", "true");

    await page.getByTestId("pane-advanced").locator("summary").click();
    for (const ec of ["L", "M", "Q", "H"]) {
      await page.locator("#ec-level").selectOption(ec);
      await expect(page.getByTestId("qr-ec")).toHaveText(ec);
      await expectScans(page);
    }
    await page.locator("#qr-version").selectOption("10");
    await expect(page.getByTestId("qr-version")).toContainText("10 (57×57)");
    await expectScans(page);
  });
});

test.describe("M5 logo", () => {
  function logoPng(): Buffer {
    const s = 64;
    const rgba = new Uint8Array(s * s * 4).fill(255);
    for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) rgba.set([79, 70, 229, 255], (y * s + x) * 4);
    return Buffer.from(encodePngRgba(s, s, rgba));
  }

  test("upload, background removal, size/position, budget, remove", async ({ page }) => {
    await start(page);
    await page.getByTestId("pane-logo").locator("summary").click();
    await page.getByTestId("logo-input").setInputFiles({ name: "brand.png", mimeType: "image/png", buffer: logoPng() });
    await expect(page.getByTestId("logo-thumb")).toBeVisible();
    await expect(page.getByTestId("qr-ec")).toHaveText("H"); // auto EC raised for logos
    expect(decodeURIComponent((await previewSrc(page))!)).toContain("data:image/png;base64,");
    await expectScans(page);

    await page.getByLabel("Remove logo background").check();
    await expect(page.getByTestId("logo-budget")).toBeVisible();

    const logoPane = page.getByTestId("pane-logo");
    await logoPane.getByLabel("Logo size").fill("30");
    await expect(page.getByTestId("logo-budget")).toContainText("% of 15% safe limit (EC H)");
    await expectScans(page);
    await logoPane.getByLabel("Horizontal position").fill("4");
    await expect.poll(async () => decodeURIComponent((await previewSrc(page))!)).toContain("<image");
    await expectScans(page);

    // Lower EC with a big logo is flagged and can be fixed with one click.
    await page.getByTestId("pane-advanced").locator("summary").click();
    await page.locator("#ec-level").selectOption("L");
    await expect(page.getByText(/The logo hides/)).toBeVisible();
    await page.getByRole("button", { name: "Use error correction H" }).click();
    await expect(page.getByTestId("qr-ec")).toHaveText("H");

    await page.getByRole("button", { name: "Remove logo" }).click();
    await expect(page.getByTestId("logo-thumb")).toHaveCount(0);
    expect(decodeURIComponent((await previewSrc(page))!)).not.toContain("<image");
  });

  test("gallery icon and replacement", async ({ page }) => {
    await start(page);
    await page.getByTestId("pane-logo").locator("summary").click();
    await page.locator('[data-gallery="wifi"]').click();
    await expect(page.getByTestId("logo-thumb")).toHaveAttribute("alt", /Wi-Fi icon/);
    await expectScans(page);
    await page.locator('[data-gallery="star"]').click();
    await expect(page.getByTestId("logo-thumb")).toHaveAttribute("alt", /Star icon/);
  });

  test("invalid uploads are rejected with a message", async ({ page }) => {
    await start(page);
    await page.getByTestId("pane-logo").locator("summary").click();
    const input = page.getByTestId("logo-input");
    await input.setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("this is not an image") });
    await expect(page.getByTestId("logo-error")).toContainText("isn't a valid image");
    await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 10, 1) });
    await expect(page.getByTestId("logo-error")).toContainText("5 MB");
    await input.setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByTestId("logo-error")).toContainText("Unsupported file type");
    await expect(page.getByTestId("logo-thumb")).toHaveCount(0);
  });

  test("malicious SVG is sanitised and never executes", async ({ page }) => {
    let dialog = false;
    page.on("dialog", async (d) => {
      dialog = true;
      await d.dismiss();
    });
    await start(page);
    await page.getByTestId("pane-logo").locator("summary").click();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10" fill="#4f46e5"/><image href="https://example.invalid/x.png" width="5" height="5"/></svg>`;
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.getByTestId("logo-input").setInputFiles({ name: "evil.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
    await expect(page.getByTestId("logo-thumb")).toBeVisible();
    await expectScans(page);
    expect(dialog).toBe(false);
    expect(requests.some((u) => u.includes("example.invalid"))).toBe(false);
  });
});

test.describe("M6 downloads", () => {
  test("PNG, SVG, PDF and EPS download real files with meaningful names", async ({ page }) => {
    await start(page);
    const panel = page.getByRole("region", { name: "Download" }).or(page.locator("section[aria-labelledby=export-title]"));

    // PNG at a custom size with DPI.
    await panel.getByLabel("Exact size (px)").fill("768");
    await panel.getByLabel("Exact size (px)").press("Enter");
    const [png] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
    expect(png.suggestedFilename()).toMatch(/^qr-url-qr-studio-example-768px-\d{8}-\d{4}\.png$/);
    const pngBytes = readFileSync((await png.path())!);
    expect(pngBytes.readUInt32BE(16)).toBe(768);
    expect(pngBytes.readUInt32BE(20)).toBe(768);
    await expect(page.getByTestId("export-status")).toContainText("Verified: the file scans");
    // Independent check outside the browser: ZXing in Node decodes the saved file.
    expect(await decodePng(new Uint8Array(pngBytes))).toEqual([URL_TEXT]);

    for (const [format, check] of [
      ["SVG", async (b: Buffer) => {
        expect(b.toString("utf8")).toMatch(/<svg[^>]+width="768" height="768"/);
        expect(await decodePng(rasterizeSvg(b.toString("utf8"), 600))).toEqual([URL_TEXT]);
      }],
      ["PDF", (b: Buffer) => expect(b.subarray(0, 5).toString("latin1")).toBe("%PDF-")],
      ["EPS", (b: Buffer) => expect(b.toString("latin1")).toMatch(/^%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 142 142/)],
    ] as const) {
      await panel.getByRole("radio", { name: format, exact: true }).click();
      const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
      expect(dl.suggestedFilename()).toMatch(new RegExp(`^qr-url-qr-studio-example-(768px|50mm)-\\d{8}-\\d{4}\\.${format.toLowerCase()}$`));
      await check(readFileSync((await dl.path())!));
    }
  });

  test("transparent PNG keeps alpha", async ({ page }) => {
    await start(page);
    await page.getByLabel("Transparent background").check();
    const [png] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
    const bytes = readFileSync((await png.path())!);
    expect(bytes[25]).toBe(6); // colour type RGBA
    await expect(page.getByTestId("export-status")).toContainText("Verified");
  });

  test("an unscannable design asks for confirmation before downloading", async ({ page }) => {
    await start(page);
    await page.getByTestId("pane-colours").getByLabel("Colour", { exact: true }).fill("#FAFAFA");
    await page.getByTestId("download").click();
    const dialog = page.getByRole("dialog", { name: "This code may not scan" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog).toBeHidden();
  });
});
