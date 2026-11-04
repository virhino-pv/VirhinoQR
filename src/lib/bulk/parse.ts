import Papa from "papaparse";
import readXlsxFile from "read-excel-file/universal";

/** Spreadsheet input → a plain string table. Runs in the browser and in Node (tests). */

export const BULK_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 100,
  maxCellLength: 4000,
} as const;

export interface Table {
  headers: string[];
  rows: string[][];
  /** Sheet names when the source is a workbook. */
  sheets?: string[];
  sheet?: string;
  /** Non-fatal notes (e.g. trimmed empty rows). */
  notes: string[];
}

export type ParseOutcome = { ok: true; table: Table } | { ok: false; error: string };
export type FileKind = "csv" | "xlsx";

export function detectFileKind(name: string, bytes: Uint8Array): { ok: true; kind: FileKind } | { ok: false; error: string } {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (ext === "xlsx") {
    return isZip ? { ok: true, kind: "xlsx" } : { ok: false, error: "This .xlsx file is not a valid Excel workbook." };
  }
  if (ext === "xls") return { ok: false, error: "Old .xls workbooks aren't supported — save as .xlsx or CSV." };
  if (ext === "csv" || ext === "txt" || ext === "tsv") {
    if (isZip || bytes.subarray(0, 512).includes(0)) return { ok: false, error: "This file is not plain-text CSV." };
    return { ok: true, kind: "csv" };
  }
  return { ok: false, error: "Upload a CSV (.csv) or Excel (.xlsx) file." };
}

/** Builds the table from raw rows: header row, blank-row removal, padding and limits. */
export function toTable(raw: string[][], hasHeader: boolean, extra: Partial<Table> = {}): ParseOutcome {
  const notes: string[] = [];
  const nonEmpty = raw.filter((r) => r.some((c) => c.trim() !== ""));
  if (raw.length !== nonEmpty.length) notes.push(`${raw.length - nonEmpty.length} empty row(s) ignored.`);
  if (nonEmpty.length === 0) return { ok: false, error: "The file has no data." };
  const width = Math.max(...nonEmpty.map((r) => r.length));
  if (width > BULK_LIMITS.maxColumns) return { ok: false, error: `The file has ${width} columns; at most ${BULK_LIMITS.maxColumns} are supported.` };
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => (r[i] ?? "").slice(0, BULK_LIMITS.maxCellLength));
  const headerRow = hasHeader ? pad(nonEmpty[0]!) : [];
  const seen = new Map<string, number>();
  const headers = Array.from({ length: width }, (_, i) => {
    let h = (headerRow[i] ?? "").trim() || `Column ${i + 1}`;
    const n = (seen.get(h.toLowerCase()) ?? 0) + 1;
    seen.set(h.toLowerCase(), n);
    if (n > 1) h = `${h} (${n})`;
    return h;
  });
  const rows = (hasHeader ? nonEmpty.slice(1) : nonEmpty).map(pad);
  if (rows.length === 0) return { ok: false, error: "The file has a header row but no data rows." };
  if (rows.length > BULK_LIMITS.maxRows) {
    return { ok: false, error: `The file has ${rows.length.toLocaleString("en")} rows; the browser limit is ${BULK_LIMITS.maxRows.toLocaleString("en")}. Split it into smaller files.` };
  }
  return { ok: true, table: { headers, rows, notes, ...extra } };
}

export function parseCsv(text: string, hasHeader = true): ParseOutcome {
  const clean = text.replace(/^﻿/, "");
  if (!clean.trim()) return { ok: false, error: "The file is empty." };
  const res = Papa.parse<string[]>(clean, { skipEmptyLines: false, delimitersToGuess: [",", ";", "\t", "|"] });
  const fatal = res.errors.find((e) => e.type === "Quotes");
  if (fatal) return { ok: false, error: `CSV problem on row ${(fatal.row ?? 0) + 1}: ${fatal.message}. Check for an unclosed quote.` };
  return toTable(res.data.map((r) => r.map((c) => (c ?? "").toString())), hasHeader);
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** Excel cell → string: dates as YYYY-MM-DD or YYYY-MM-DDTHH:mm (wall time), booleans as TRUE/FALSE. */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    // Excel stores times as fractional days; 18:30 can arrive as 18:29:59.999 — round to the second.
    return formatDate(new Date(Math.round(value.getTime() / 1000) * 1000));
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(15)));
  return String(value);
}

function formatDate(value: Date): string {
  const date = `${value.getUTCFullYear()}-${p2(value.getUTCMonth() + 1)}-${p2(value.getUTCDate())}`;
  const hasTime = value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds();
  return hasTime ? `${date}T${p2(value.getUTCHours())}:${p2(value.getUTCMinutes())}` : date;
}

export async function parseXlsx(data: ArrayBuffer, hasHeader = true, sheet?: string): Promise<ParseOutcome> {
  let sheets: Awaited<ReturnType<typeof readXlsxFile>>;
  try {
    sheets = await readXlsxFile(data);
  } catch (e) {
    return { ok: false, error: `The workbook could not be read${e instanceof Error && e.message ? ` (${e.message})` : ""}.` };
  }
  if (!sheets.length) return { ok: false, error: "The workbook has no sheets." };
  const chosen = (sheet ? sheets.find((s) => s.sheet === sheet) : undefined) ?? sheets.find((s) => s.data.length > 0) ?? sheets[0]!;
  const raw = chosen.data.map((row) => row.map(cellToString));
  return toTable(raw, hasHeader, { sheets: sheets.map((s) => s.sheet), sheet: chosen.sheet });
}

export async function parseSpreadsheet(name: string, bytes: Uint8Array, hasHeader = true, sheet?: string): Promise<ParseOutcome> {
  if (bytes.length > BULK_LIMITS.maxBytes) return { ok: false, error: `The file is larger than ${BULK_LIMITS.maxBytes / 1024 / 1024} MB.` };
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  const kind = detectFileKind(name, bytes);
  if (!kind.ok) return kind;
  if (kind.kind === "xlsx") return parseXlsx(bytes.slice().buffer as ArrayBuffer, hasHeader, sheet);
  return parseCsv(new TextDecoder("utf-8").decode(bytes), hasHeader);
}
