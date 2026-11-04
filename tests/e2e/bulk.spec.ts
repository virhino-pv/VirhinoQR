import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import writeXlsxFile from "write-excel-file/universal";
import { decodePng } from "../helpers/render";
import { encodePngRgba } from "../helpers/png";

function urlCsv(n: number): Buffer {
  const lines = ["name,url"];
  for (let i = 1; i <= n; i++) lines.push(`Product ${i},https://qr-studio.example/p/${i}?ref=bulk`);
  return Buffer.from(lines.join("\n"));
}

async function upload(page: Page, name: string, buffer: Buffer, mimeType = "text/csv") {
  await page.goto("/bulk");
  await page.getByTestId("bulk-input").setInputFiles({ name, mimeType, buffer });
  await expect(page.getByTestId("bulk-file-name")).toHaveText(name);
}

async function downloadZip(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("bulk-zip").click()]);
  expect(dl.suggestedFilename()).toMatch(/^qr-studio-bulk-\d{8}-\d{4}\.zip$/);
  return unzipSync(new Uint8Array(readFileSync((await dl.path())!)));
}

for (const n of [10, 100, 500]) {
  test(`${n} rows: upload → validate → generate with scan check → ZIP where every PNG decodes`, async ({ page }) => {
    test.setTimeout(240_000);
    await upload(page, `products-${n}.csv`, urlCsv(n));
    await expect(page.getByTestId("bulk-table-info")).toContainText(`${n} data rows, 2 columns`);
    await expect(page.getByTestId("bulk-summary")).toContainText(`${n} valid · 0 with problems`);
    await expect(page.locator('[data-field="url.url"]')).toHaveValue("col:1"); // auto-mapped
    await expect(page.getByTestId("bulk-name-column")).toHaveValue("0");

    if (n === 10) await page.getByLabel("SVG (vector)").check();
    await page.getByLabel("Size", { exact: true }).fill("256");
    await page.getByTestId("bulk-generate").click();
    await expect(page.getByTestId("bulk-result-text")).toContainText(`${n} of ${n} codes generated`, { timeout: 200_000 });
    await expect(page.getByTestId("bulk-result-text")).toContainText(`${n} passed the scan check`);

    const zip = await downloadZip(page);
    const pngs = Object.keys(zip).filter((k) => k.startsWith("png/"));
    expect(pngs).toHaveLength(n);
    expect(Object.keys(zip).filter((k) => k.startsWith("svg/"))).toHaveLength(n === 10 ? n : 0);
    expect(zip["errors.csv"]).toBeUndefined();
    expect(pngs[0]).toMatch(/^png\/\d{3}-product-1\.png$/);

    // Independent verification outside the browser: decode every PNG in the ZIP.
    for (const k of pngs) {
      const num = Number(/product-(\d+)\.png$/.exec(k)![1]);
      const bytes = zip[k]!;
      expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(16)).toBe(256); // IHDR width
      expect(await decodePng(bytes), k).toEqual([`https://qr-studio.example/p/${num}?ref=bulk`]);
    }
    const report = strFromU8(zip["report.csv"]!).trim().split("\r\n");
    expect(report).toHaveLength(n + 1);
    expect(report.slice(1).every((l) => /^\d+,generated,url,.*,pass,https:/.test(l))).toBe(true);
  });
}

test("XLSX with mixed types, invalid rows, template + logo, individual downloads and reports", async ({ page }) => {
  test.setTimeout(120_000);
  const rows = [
    ["type", "filename", "url", "ssid", "password", "security", "first name", "last name", "mobile"],
    ["url", "home", "example.com", "", "", "", "", "", ""],
    ["wifi", "lobby", "", "Lobby", "welcome-2026", "WPA2", "", "", ""],
    ["vcard", "ada", "", "", "", "", "Ada", "Lovelace", "+44 7700 900123"],
    ["wifi", "bad-wifi", "", "Short", "123", "WPA2", "", "", ""],
    ["teleport", "x", "", "", "", "", "", "", ""],
  ].map((r) => r.map((v) => ({ value: v })));
  const blob = await writeXlsxFile(rows as never).toBlob();
  await upload(page, "mixed.xlsx", Buffer.from(await blob.arrayBuffer()), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  await expect(page.getByTestId("bulk-type-column")).toHaveValue("0");
  await expect(page.locator("[data-mapping-type]")).toHaveCount(3);
  await expect(page.locator('[data-field="wifi.encryption"]')).toHaveValue("col:5");
  await expect(page.getByTestId("bulk-summary")).toContainText("3 valid · 2 with problems");
  const preview = page.getByTestId("bulk-preview-table");
  await expect(preview.locator('[data-row="4"]')).toContainText("WPA passwords are 8–63 characters");
  await expect(preview.locator('[data-row="5"]')).toContainText("Unknown QR type “teleport”");

  const [problems] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download row problems (CSV)" }).click()]);
  expect(readFileSync((await problems.path())!, "utf8")).toContain("4,wifi,WPA passwords are 8–63 characters.");

  // M7 template + M5 logo apply to every code.
  await page.getByTestId("pane-templates").locator("summary").click();
  await page.getByTestId("builtin-templates").locator('[data-template="ocean"]').click();
  await page.getByTestId("pane-logo").locator("summary").click();
  const s = 48;
  const rgba = new Uint8Array(s * s * 4);
  for (let i = 0; i < s * s; i++) rgba.set([15, 118, 110, 255], i * 4);
  await page.getByTestId("logo-input").setInputFiles({ name: "teal.png", mimeType: "image/png", buffer: Buffer.from(encodePngRgba(s, s, rgba)) });
  await expect(page.getByTestId("logo-thumb")).toBeVisible();

  await page.getByLabel("SVG (vector)").check();
  await page.getByLabel("Size", { exact: true }).fill("512");
  await page.getByTestId("bulk-generate").click();
  await expect(page.getByTestId("bulk-result-text")).toContainText("3 of 3 codes generated");
  await expect(page.getByTestId("bulk-result-text")).toContainText("3 passed the scan check");
  await expect(page.getByTestId("bulk-result-text")).toContainText("2 row(s) skipped");

  // Individual downloads from the results table.
  const results = page.getByTestId("bulk-results-table");
  const [png] = await Promise.all([page.waitForEvent("download"), results.getByRole("button", { name: "Download 002-lobby.png" }).click()]);
  expect(png.suggestedFilename()).toBe("002-lobby.png");
  expect(await decodePng(new Uint8Array(readFileSync((await png.path())!)))).toEqual(["WIFI:T:WPA;S:Lobby;P:welcome-2026;;"]);
  const [svg] = await Promise.all([page.waitForEvent("download"), results.getByRole("button", { name: "Download 003-ada.svg" }).click()]);
  const svgText = readFileSync((await svg.path())!, "utf8");
  expect(svgText).toContain("<linearGradient");
  expect(svgText).toContain("data:image/png;base64,");

  const zip = await downloadZip(page);
  expect(Object.keys(zip).sort()).toEqual(["errors.csv", "png/001-home.png", "png/002-lobby.png", "png/003-ada.png", "report.csv", "svg/001-home.svg", "svg/002-lobby.svg", "svg/003-ada.svg"]);
  expect(await decodePng(zip["png/003-ada.png"]!)).toEqual([expect.stringContaining("FN:Ada Lovelace")]);
  const report = strFromU8(zip["report.csv"]!);
  expect(report).toMatch(/1,generated,url,001-home\.png 001-home\.svg,\d+,H,pass,https:\/\/example\.com,/);
  expect(report).toMatch(/4,invalid,wifi,/);
  expect(report).toMatch(/5,invalid,,/);
  expect(strFromU8(zip["errors.csv"]!)).toContain("5,,Unknown QR type");

  const [rep] = await Promise.all([page.waitForEvent("download"), page.getByTestId("bulk-report").click()]);
  expect(rep.suggestedFilename()).toMatch(/^qr-studio-bulk-report-\d{8}-\d{4}\.csv$/);
});

test("manual mapping: fixed type, column choice and a constant value", async ({ page }) => {
  await upload(page, "contacts.csv", Buffer.from("Col A,Col B\nhello@example.com,Order 1\nsales@example.com,Order 2\n"));
  await page.getByTestId("bulk-fixed-type").selectOption("email");
  await expect(page.getByTestId("bulk-summary")).toContainText("0 valid");
  await page.locator('[data-field="email.to"]').selectOption("col:0");
  await page.locator('[data-field="email.subject"]').selectOption("col:1");
  await page.locator('[data-field="email.body"]').selectOption("value");
  await page.getByLabel("Message value for every row").fill("Thanks for your order");
  await expect(page.getByTestId("bulk-summary")).toContainText("2 valid · 0 with problems");
  await expect(page.getByTestId("bulk-preview-table").locator('[data-row="2"]')).toContainText("mailto:sales@example.com?subject=Order%202&body=Thanks%20for%20your%20order");
});

test("cancelling a 500-row run keeps finished codes and reports the rest", async ({ page }) => {
  test.setTimeout(180_000);
  await upload(page, "big.csv", urlCsv(500));
  await page.getByLabel("Size", { exact: true }).fill("256");
  await page.getByTestId("bulk-generate").click();
  await expect.poll(async () => Number(await page.getByTestId("bulk-progress").getAttribute("aria-valuenow")), { timeout: 60_000 }).toBeGreaterThanOrEqual(5);
  await page.getByTestId("bulk-cancel").click();
  await expect(page.getByText("Generation cancelled")).toBeVisible();
  const text = await page.getByTestId("bulk-result-text").textContent();
  const done = Number(/^(\d+) of 500/.exec(text!)![1]);
  expect(done).toBeGreaterThanOrEqual(5);
  expect(done).toBeLessThan(500);
  const zip = await downloadZip(page);
  expect(Object.keys(zip).filter((k) => k.startsWith("png/"))).toHaveLength(done);
  expect(strFromU8(zip["report.csv"]!)).toContain(`${done + 1},not generated,url`);
});

test("unsupported and broken files are rejected", async ({ page }) => {
  await page.goto("/bulk");
  const input = page.getByTestId("bulk-input");
  await input.setInputFiles({ name: "old.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("xx") });
  await expect(page.getByTestId("bulk-parse-error")).toContainText(".xls workbooks aren't supported");
  await input.setInputFiles({ name: "broken.xlsx", mimeType: "application/zip", buffer: Buffer.from([0x50, 0x4b, 3, 4, 9, 9, 9]) });
  await expect(page.getByTestId("bulk-parse-error")).toContainText("could not be read");
  await input.setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from("url\n") });
  await expect(page.getByTestId("bulk-parse-error")).toContainText("no data rows");
  await input.setInputFiles({ name: "image.png", mimeType: "image/png", buffer: Buffer.from(encodePngRgba(1, 1, new Uint8Array(4))) });
  await expect(page.getByTestId("bulk-parse-error")).toContainText("Upload a CSV");
});

test("sample CSVs download and round-trip through the uploader", async ({ page }) => {
  await page.goto("/bulk");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Sample with all 22 types" }).click()]);
  const buffer = readFileSync((await dl.path())!);
  await page.getByTestId("bulk-input").setInputFiles({ name: "all.csv", mimeType: "text/csv", buffer });
  await expect(page.getByTestId("bulk-summary")).toContainText("22 valid · 0 with problems");
});
