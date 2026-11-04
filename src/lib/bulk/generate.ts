import { zipSync, type Zippable } from "fflate";
import { buildScene } from "../qr/engine/scene";
import { sceneToSvg } from "../qr/export/svg";
import type { Design, LogoAsset, Scene } from "../qr/engine/types";
import type { BulkRow } from "./mapping";

/**
 * Bulk generation. Rendering and decoding are injected so the same loop runs in the browser
 * (canvas + ZXing) and in Node tests (resvg + ZXing).
 */

export type BulkFormat = "png" | "svg";
export type ScanResult = "pass" | "fail" | "skipped" | "error";

export interface GeneratedFile {
  format: BulkFormat;
  name: string;
  bytes: Uint8Array;
}

export interface GeneratedItem {
  row: BulkRow;
  files: GeneratedFile[];
  scan: ScanResult;
  version: number | null;
  ec: string | null;
  error: string | null;
}

export interface Renderers {
  /** PNG bytes at sizePx × sizePx; may also return decoded texts of that exact image. */
  png(scene: Scene, sizePx: number, verify: boolean): Promise<{ bytes: Uint8Array; decoded?: string[] }>;
  /** Decode an SVG export (used when PNG is not produced). */
  decodeSvg?(svg: string): Promise<string[]>;
}

export interface GenerateOptions {
  rows: readonly BulkRow[];
  design: Design;
  logo: LogoAsset | null;
  formats: readonly BulkFormat[];
  sizePx: number;
  verify: boolean;
  renderers: Renderers;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, item: GeneratedItem) => void;
}

export interface GenerateResult {
  items: GeneratedItem[];
  cancelled: boolean;
  elapsedMs: number;
}

const enc = new TextEncoder();
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function generateBulk(opts: GenerateOptions): Promise<GenerateResult> {
  const started = performance.now();
  const todo = opts.rows.filter((r) => r.status === "valid" && r.payload);
  const items: GeneratedItem[] = [];
  for (const row of todo) {
    if (opts.signal?.aborted) return { items, cancelled: true, elapsedMs: performance.now() - started };
    const item: GeneratedItem = { row, files: [], scan: opts.verify ? "error" : "skipped", version: null, ec: null, error: null };
    try {
      const scene = buildScene({ text: row.payload!, design: opts.design, logo: opts.logo });
      item.version = scene.version;
      item.ec = scene.ec;
      let decoded: string[] | undefined;
      if (opts.formats.includes("png")) {
        const png = await opts.renderers.png(scene, opts.sizePx, opts.verify);
        item.files.push({ format: "png", name: `${row.fileBase}.png`, bytes: png.bytes });
        decoded = png.decoded;
      }
      if (opts.formats.includes("svg")) {
        const svg = sceneToSvg(scene, { size: opts.sizePx, title: `QR code ${row.row}` });
        item.files.push({ format: "svg", name: `${row.fileBase}.svg`, bytes: enc.encode(svg) });
        if (opts.verify && !decoded && opts.renderers.decodeSvg) decoded = await opts.renderers.decodeSvg(svg);
      }
      if (opts.verify) item.scan = decoded === undefined ? "skipped" : decoded.includes(row.payload!) ? "pass" : "fail";
    } catch (e) {
      item.error = e instanceof Error ? e.message : "Generation failed";
      item.scan = opts.verify ? "error" : "skipped";
    }
    items.push(item);
    opts.onProgress?.(items.length, todo.length, item);
    await tick(); // keep the UI responsive and let cancellation through
  }
  return { items, cancelled: false, elapsedMs: performance.now() - started };
}

// ---------------------------------------------------------------------------------------------
// Reports

/** Neutralises spreadsheet formula injection (OWASP) and quotes per RFC 4180. */
export function csvCell(value: string | number | null | undefined, guard = true): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (guard && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 byte-order mark so Excel opens the report as UTF-8 (Tamil etc. stay readable). */
const BOM = String.fromCharCode(0xfeff);

/** `guard` = formula-injection protection; off only for our own sample files meant for re-import. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>, guard = true): string {
  return `${BOM}${rows.map((r) => r.map((c) => csvCell(c, guard)).join(",")).join("\r\n")}\r\n`;
}

export const REPORT_HEADERS = ["row", "status", "type", "files", "qr_version", "error_correction", "scan_check", "payload", "errors"] as const;

/** One line per input row: generated / invalid / empty / failed / not generated (cancelled). */
export function generationReport(rows: readonly BulkRow[], items: readonly GeneratedItem[]): string {
  const byRow = new Map(items.map((i) => [i.row.row, i]));
  const lines: Array<Array<string | number | null>> = [[...REPORT_HEADERS]];
  for (const r of rows) {
    const it = byRow.get(r.row);
    const status =
      r.status === "invalid" ? "invalid" : r.status === "empty" ? "empty" : !it ? "not generated" : it.error ? "failed" : it.scan === "fail" ? "generated (scan failed)" : "generated";
    lines.push([
      r.row,
      status,
      r.type ?? "",
      it ? it.files.map((f) => f.name).join(" ") : "",
      it?.version ?? "",
      it?.ec ?? "",
      it ? it.scan : "",
      r.payload ?? "",
      [...r.errors, ...(it?.error ? [it.error] : [])].join("; "),
    ]);
  }
  return toCsv(lines);
}

export function errorReport(rows: readonly BulkRow[], items: readonly GeneratedItem[] = []): string {
  const failed = new Map(items.filter((i) => i.error || i.scan === "fail").map((i) => [i.row.row, i]));
  const lines: Array<Array<string | number>> = [["row", "type", "problem"]];
  for (const r of rows) {
    if (r.status !== "valid") lines.push([r.row, r.type ?? "", r.errors.join("; ")]);
    const f = failed.get(r.row);
    if (f) lines.push([r.row, r.type ?? "", f.error ?? "Generated code did not pass the scan check"]);
  }
  return toCsv(lines);
}

/** ZIP with png/ and svg/ folders, report.csv and (when needed) errors.csv. PNGs are stored, not recompressed. */
export function buildZip(rows: readonly BulkRow[], items: readonly GeneratedItem[]): Uint8Array {
  const files: Zippable = {};
  for (const it of items) {
    for (const f of it.files) files[`${f.format}/${f.name}`] = [f.bytes, { level: f.format === "png" ? 0 : 6 }];
  }
  files["report.csv"] = [enc.encode(generationReport(rows, items)), { level: 6 }];
  if (rows.some((r) => r.status !== "valid") || items.some((i) => i.error || i.scan === "fail")) {
    files["errors.csv"] = [enc.encode(errorReport(rows, items)), { level: 6 }];
  }
  return zipSync(files);
}

/** Sample CSV for a content type: headers are the field names (auto-mapped on upload). */
export function sampleCsv(type: { id: string; fields: ReadonlyArray<{ name: string }>; sample: Record<string, string | boolean> }, mixed?: ReadonlyArray<{ id: string; fields: ReadonlyArray<{ name: string }>; sample: Record<string, string | boolean> }>): string {
  if (!mixed) {
    const header = ["filename", ...type.fields.map((f) => f.name)];
    const row = [`${type.id}-example`, ...type.fields.map((f) => String(type.sample[f.name] ?? ""))];
    return toCsv([header, row], false);
  }
  const names = [...new Set(mixed.flatMap((t) => t.fields.map((f) => f.name)))];
  const header = ["type", "filename", ...names];
  return toCsv([header, ...mixed.map((t) => [t.id, `${t.id}-example`, ...names.map((n) => (t.fields.some((f) => f.name === n) ? String(t.sample[n] ?? "") : ""))])], false);
}
