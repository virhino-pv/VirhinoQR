import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import writeXlsxFile from "write-excel-file/universal";
import { BULK_LIMITS, detectFileKind, parseCsv, parseSpreadsheet } from "@/lib/bulk/parse";
import { autoMapping, buildRows, matchOption, resolveType, summarize, type BulkMapping } from "@/lib/bulk/mapping";
import { buildZip, csvCell, errorReport, generateBulk, generationReport, sampleCsv, type Renderers } from "@/lib/bulk/generate";
import { CONTENT_TYPES, getContentType } from "@/lib/payloads";
import { cloneDesign } from "@/lib/qr/engine/design";
import { sceneToSvg } from "@/lib/qr/export/svg";
import { getBuiltinTemplate } from "@/lib/templates/builtin";
import { decodePng, makeLogo, rasterizeSvg } from "../helpers/render";

const enc = (s: string) => new TextEncoder().encode(s);

/** Node renderers: resvg raster (independent of the browser) + ZXing decode. */
const nodeRenderers: Renderers = {
  async png(scene, sizePx, verify) {
    const bytes = rasterizeSvg(sceneToSvg(scene, { size: sizePx }), sizePx);
    return { bytes, decoded: verify ? await decodePng(bytes) : undefined };
  },
  async decodeSvg(svg) {
    return decodePng(rasterizeSvg(svg, 400));
  },
};

async function xlsx(rows: unknown[][]): Promise<Uint8Array> {
  const data = rows.map((r) => r.map((v) => (v === null ? null : v instanceof Date ? { value: v, type: Date, format: "yyyy-mm-dd hh:mm" } : { value: v })));
  const blob = await writeXlsxFile(data as never).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

function urlCsv(n: number): string {
  const lines = ["name,url"];
  for (let i = 1; i <= n; i++) lines.push(`Item ${i},https://qr-studio.example/p/${i}?ref=bulk`);
  return lines.join("\n");
}

describe("parsing", () => {
  it("CSV: BOM, quotes with commas/newlines, empty rows, duplicate headers", () => {
    const r = parseCsv('﻿name,url,url\n"Doe, Jane","https://a.io/x?q=1,2",x\n\n"multi\nline",b.io,\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.headers).toEqual(["name", "url", "url (2)"]);
    expect(r.table.rows).toEqual([
      ["Doe, Jane", "https://a.io/x?q=1,2", "x"],
      ["multi\nline", "b.io", ""],
    ]);
    expect(r.table.notes[0]).toMatch(/empty row/);
  });

  it("CSV: semicolon and tab delimiters are detected; no-header mode names columns", () => {
    const r = parseCsv("a;b\n1;2", true);
    expect(r.ok && r.table.headers).toEqual(["a", "b"]);
    const t = parseCsv("x\ty\n1\t2", false);
    expect(t.ok && t.table.headers).toEqual(["Column 1", "Column 2"]);
    expect(t.ok && t.table.rows.length).toBe(2);
  });

  it("CSV: rejects empty, header-only, too many rows and unclosed quotes", () => {
    expect(parseCsv("")).toMatchObject({ ok: false });
    expect(parseCsv("url\n")).toMatchObject({ ok: false, error: expect.stringMatching(/no data rows/) });
    expect(parseCsv(urlCsv(BULK_LIMITS.maxRows + 1))).toMatchObject({ ok: false, error: expect.stringMatching(/limit is 1,000/) });
    expect(parseCsv('url\n"https://a.io')).toMatchObject({ ok: false, error: expect.stringMatching(/quote/) });
  });

  it("detects file kinds by extension and content", () => {
    expect(detectFileKind("a.csv", enc("url\nx"))).toEqual({ ok: true, kind: "csv" });
    expect(detectFileKind("a.xls", enc("x"))).toMatchObject({ ok: false, error: expect.stringMatching(/\.xls/) });
    expect(detectFileKind("a.xlsx", enc("not zip"))).toMatchObject({ ok: false });
    expect(detectFileKind("a.pdf", enc("%PDF"))).toMatchObject({ ok: false });
    expect(detectFileKind("a.csv", new Uint8Array([0x50, 0x4b, 3, 4]))).toMatchObject({ ok: false });
  });

  it("XLSX: strings, numbers, booleans and dates become text", async () => {
    const bytes = await xlsx([
      ["type", "ssid", "password", "hidden", "start", "count"],
      ["wifi", "Cafe", "secret123", true, new Date(Date.UTC(2026, 11, 1, 18, 30)), 42],
      ["wifi", "Shop", "another-pass", false, new Date(Date.UTC(2026, 11, 2)), 3.5],
    ]);
    const r = await parseSpreadsheet("codes.xlsx", bytes);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.headers).toEqual(["type", "ssid", "password", "hidden", "start", "count"]);
    expect(r.table.rows[0]).toEqual(["wifi", "Cafe", "secret123", "TRUE", "2026-12-01T18:30", "42"]);
    expect(r.table.rows[1]).toEqual(["wifi", "Shop", "another-pass", "FALSE", "2026-12-02", "3.5"]);
    expect(r.table.sheets?.length).toBe(1);
  });

  it("XLSX: corrupt workbooks are reported", async () => {
    const r = await parseSpreadsheet("bad.xlsx", new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/could not be read/) });
  });
});

describe("mapping & validation", () => {
  it("resolves type names, labels and aliases", () => {
    expect(resolveType("Wi-Fi")).toBe("wifi");
    expect(resolveType("Website")).toBe("url");
    expect(resolveType("BTC")).toBe("crypto");
    expect(resolveType("tweet")).toBe("twitter");
    expect(resolveType("App Store")).toBe("appstore");
    expect(resolveType("banana")).toBeNull();
  });

  it("matches option cells loosely but safely", () => {
    const enc = getContentType("wifi")!.fields.find((f) => f.name === "encryption")!;
    expect(matchOption(enc, "WPA2")).toBe("WPA");
    expect(matchOption(enc, "wpa3")).toBe("SAE");
    expect(matchOption(enc, "none")).toBe("nopass");
    expect(matchOption(enc, "nopass")).toBe("nopass");
    expect(matchOption(enc, "rot13")).toBeNull();
  });

  it("auto-maps headers by field name, label and synonyms", () => {
    const r = parseCsv("File name,Network,Password,Security,Hidden\nlobby,Lobby,pass-12345,WPA2,yes");
    if (!r.ok) throw new Error(r.error);
    const m = autoMapping(r.table, "wifi");
    expect(m.typeSource).toEqual({ kind: "fixed", type: "wifi" });
    expect(m.nameColumn).toBe(0);
    expect(m.fields.wifi).toMatchObject({
      ssid: { kind: "column", index: 1 },
      password: { kind: "column", index: 2 },
      encryption: { kind: "column", index: 3 },
      hidden: { kind: "column", index: 4 },
    });
    const rows = buildRows(r.table, m);
    expect(rows[0]).toMatchObject({ status: "valid", payload: "WIFI:T:WPA;S:Lobby;P:pass-12345;H:true;;", fileBase: "001-lobby" });
  });

  it("supports a type column with mixed content types and reports row-level errors", () => {
    const csv = [
      "type,filename,url,ssid,password,phone,text",
      "url,home,example.com,,,,",
      "wifi,guest,,Guest,short,,",
      "phone,,,,,+44 20 7946 0958,",
      "unicorn,,x,,,,",
      ",,,,,,",
      "text,note,,,,,வணக்கம்",
      "url,home,javascript:alert(1),,,,",
    ].join("\n");
    const r = parseCsv(csv);
    if (!r.ok) throw new Error(r.error);
    const m = autoMapping(r.table);
    expect(m.typeSource).toEqual({ kind: "column", index: 0 });
    expect(Object.keys(m.fields).sort()).toEqual(["phone", "text", "url", "wifi"]);
    const rows = buildRows(r.table, m);
    expect(rows.map((x) => x.status)).toEqual(["valid", "invalid", "valid", "invalid", "valid", "invalid"]);
    expect(rows[1]!.errors[0]).toMatch(/8–63/);
    expect(rows[3]!.errors[0]).toMatch(/Unknown QR type “unicorn”/);
    expect(rows[4]!.payload).toBe("வணக்கம்");
    expect(rows[5]!.errors[0]).toMatch(/http/);
    expect(rows[0]!.fileBase).toBe("001-home");
    expect(rows[5]!.fileBase).toBe("006-home");
    expect(summarize(rows)).toEqual({ total: 6, valid: 3, invalid: 3, empty: 0 });
  });

  it("reports unmapped required fields and unknown options clearly", () => {
    const r = parseCsv("name,security\nA,rot13");
    if (!r.ok) throw new Error(r.error);
    const m: BulkMapping = { typeSource: { kind: "fixed", type: "wifi" }, nameColumn: null, fields: { wifi: { encryption: { kind: "column", index: 1 } } } };
    const [row] = buildRows(r.table, m);
    expect(row!.status).toBe("invalid");
    expect(row!.errors.join(" ")).toMatch(/“rot13” is not one of/);
    const m2: BulkMapping = { typeSource: { kind: "fixed", type: "url" }, nameColumn: null, fields: { url: { url: { kind: "none" } } } };
    expect(buildRows(r.table, m2)[0]!.status).toBe("empty");
    const m3: BulkMapping = { typeSource: { kind: "fixed", type: "email" }, nameColumn: null, fields: { email: { subject: { kind: "column", index: 0 } } } };
    expect(buildRows(r.table, m3)[0]!.errors[0]).toMatch(/Email address: not mapped/);
  });

  it("constant values and unique file names", () => {
    const r = parseCsv("label\nSame\nSame\nSame");
    if (!r.ok) throw new Error(r.error);
    const m: BulkMapping = { typeSource: { kind: "fixed", type: "url" }, nameColumn: 0, fields: { url: { url: { kind: "value", value: "https://example.com" } } } };
    const rows = buildRows(r.table, m);
    expect(rows.map((x) => x.fileBase)).toEqual(["001-same", "002-same", "003-same"]);
    expect(rows.every((x) => x.payload === "https://example.com")).toBe(true);
  });

  it("every type's sample CSV round-trips through auto-mapping to the exact payload", () => {
    for (const t of CONTENT_TYPES) {
      const r = parseCsv(sampleCsv(t));
      if (!r.ok) throw new Error(`${t.id}: ${r.error}`);
      const rows = buildRows(r.table, autoMapping(r.table, t.id));
      const expected = t.encode({ ...t.defaults, ...t.sample });
      expect(rows[0], t.id).toMatchObject({ status: "valid", payload: expected });
    }
  });

  it("the mixed-type sample covers all 22 types", () => {
    const r = parseCsv(sampleCsv(CONTENT_TYPES[0]!, CONTENT_TYPES));
    if (!r.ok) throw new Error(r.error);
    const rows = buildRows(r.table, autoMapping(r.table));
    expect(rows.filter((x) => x.status === "valid").map((x) => x.type)).toEqual(CONTENT_TYPES.map((t) => t.id));
  });
});

describe("reports & zip", () => {
  it("CSV cells are quoted and guarded against formula injection", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("+44", false)).toBe("+44");
  });

  it("generation report has one line per input row and an errors file", async () => {
    const r = parseCsv("url\nexample.com\njavascript:x\n=cmd|' /C calc'!A0");
    if (!r.ok) throw new Error(r.error);
    const rows = buildRows(r.table, autoMapping(r.table, "url"));
    const res = await generateBulk({ rows, design: cloneDesign(), logo: null, formats: ["png", "svg"], sizePx: 256, verify: true, renderers: nodeRenderers });
    const report = generationReport(rows, res.items);
    const lines = report.split("\r\n").filter(Boolean); // not trim(): it would strip the BOM
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(String.fromCharCode(0xfeff) + "row,status,type,files,qr_version,error_correction,scan_check,payload,errors");
    expect(lines[1]).toMatch(/^1,generated,url,001-example-com\.png 001-example-com\.svg,\d+,M,pass,https:\/\/example\.com,$/);
    expect(lines[2]).toMatch(/^2,invalid,url,/);
    expect(errorReport(rows, res.items)).toMatch(/2,url,Only web links/);

    const zip = unzipSync(buildZip(rows, res.items));
    expect(Object.keys(zip).sort()).toEqual(["errors.csv", "png/001-example-com.png", "report.csv", "svg/001-example-com.svg"]);
    expect(await decodePng(zip["png/001-example-com.png"]!)).toEqual(["https://example.com"]);
    expect([...zip["report.csv"]!.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM kept for Excel
    expect(strFromU8(zip["report.csv"]!)).toBe(report.slice(1)); // decoders drop the BOM
  });

  it("cancellation stops early and keeps finished items", async () => {
    const r = parseCsv(urlCsv(20));
    if (!r.ok) throw new Error(r.error);
    const rows = buildRows(r.table, autoMapping(r.table, "url"));
    const ctrl = new AbortController();
    const res = await generateBulk({
      rows, design: cloneDesign(), logo: null, formats: ["svg"], sizePx: 256, verify: false, renderers: nodeRenderers, signal: ctrl.signal,
      onProgress: (done) => done === 5 && ctrl.abort(),
    });
    expect(res.cancelled).toBe(true);
    expect(res.items).toHaveLength(5);
    expect(generationReport(rows, res.items)).toMatch(/\r\n6,not generated,url,/);
  });
});

describe("bulk generation at scale — every code decoded", () => {
  const design = getBuiltinTemplate("indigo-flow")!.design; // M7 template + M4 customisation
  it.each([10, 100, 500])("%i URL rows → PNG + SVG, all scan", async (n) => {
    const r = parseCsv(urlCsv(n));
    if (!r.ok) throw new Error(r.error);
    const rows = buildRows(r.table, autoMapping(r.table, "url"));
    expect(summarize(rows).valid).toBe(n);
    let progressCalls = 0;
    const res = await generateBulk({ rows, design, logo: null, formats: ["png", "svg"], sizePx: 240, verify: true, renderers: nodeRenderers, onProgress: () => progressCalls++ });
    expect(res.cancelled).toBe(false);
    expect(progressCalls).toBe(n);
    expect(res.items).toHaveLength(n);
    expect(res.items.filter((i) => i.scan !== "pass").map((i) => i.row.row)).toEqual([]);
    const zip = unzipSync(buildZip(rows, res.items));
    expect(Object.keys(zip).filter((k) => k.startsWith("png/"))).toHaveLength(n);
    expect(Object.keys(zip).filter((k) => k.startsWith("svg/"))).toHaveLength(n);
    // Independently decode a sample of the SVGs as stored in the ZIP.
    for (const k of Object.keys(zip).filter((x) => x.startsWith("svg/")).filter((_, i) => i % Math.ceil(n / 10) === 0)) {
      const row = Number(k.slice(4, k.indexOf("-")));
      expect(await decodePng(rasterizeSvg(strFromU8(zip[k]!), 300))).toEqual([`https://qr-studio.example/p/${row}?ref=bulk`]);
    }
  }, 600_000);

  it("mixed types with a logo and per-eye colours all scan", async () => {
    const r = parseCsv(sampleCsv(CONTENT_TYPES[0]!, CONTENT_TYPES));
    if (!r.ok) throw new Error(r.error);
    const rows = buildRows(r.table, autoMapping(r.table));
    const d = getBuiltinTemplate("ruby-eyes")!.design;
    const res = await generateBulk({ rows, design: d, logo: makeLogo(96), formats: ["png"], sizePx: 480, verify: true, renderers: nodeRenderers });
    expect(res.items).toHaveLength(22);
    expect(res.items.every((i) => i.ec === "H")).toBe(true);
    expect(res.items.filter((i) => i.scan !== "pass").map((i) => i.row.type)).toEqual([]);
  }, 300_000);
});
