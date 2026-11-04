"use client";

import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, ImagePlus, LayoutTemplate, Palette, Settings2, Shapes, Upload, X } from "lucide-react";
import { CONTENT_TYPES, getContentType, type ContentTypeId } from "@/lib/payloads";
import { BULK_LIMITS, parseSpreadsheet, type Table } from "@/lib/bulk/parse";
import { autoMapping, buildRows, summarize, type BulkMapping } from "@/lib/bulk/mapping";
import { buildZip, errorReport, generateBulk, generationReport, sampleCsv, type BulkFormat, type GenerateResult, type Renderers } from "@/lib/bulk/generate";
import { buildScene } from "@/lib/qr/engine/scene";
import { canvasToPngBytes, sceneToCanvas, triggerDownload } from "@/lib/qr/export/browser";
import { setPngDpi } from "@/lib/qr/export/png-meta";
import { decodeCanvas } from "@/lib/qr/verify/browser-scan";
import { useStudio } from "@/lib/store/studio";
import { AdvancedPanel, ColorsPanel, Pane, ResetDesignButton, ShapesPanel } from "@/components/studio/design-panels";
import { LogoPanel } from "@/components/studio/logo-panel";
import { TemplatesPanel } from "@/components/studio/templates-panel";
import { QrImage } from "@/components/qr/qr-image";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Slider } from "@/components/ui/slider";
import { MappingEditor } from "./mapping-editor";
import { RowsTable } from "./rows-table";

const browserRenderers: Renderers = {
  async png(scene, sizePx, verify) {
    const canvas = await sceneToCanvas(scene, sizePx);
    const bytes = setPngDpi(await canvasToPngBytes(canvas), 300);
    return { bytes, decoded: verify ? await decodeCanvas(canvas) : undefined };
  },
  async decodeSvg(svg) {
    // Decode the SVG the same way the browser displays it.
    const { svgToImage } = await import("@/lib/qr/export/browser");
    const img = await svgToImage(svg);
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    c.getContext("2d")!.drawImage(img, 0, 0, 512, 512);
    return decodeCanvas(c);
  },
};

type Run =
  | { state: "idle" }
  | { state: "running"; done: number; total: number; current: string }
  | { state: "finished"; result: GenerateResult; key: string };

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const csvBlob = (text: string) => new Blob([text], { type: "text/csv;charset=utf-8" });

export function BulkStudio() {
  const design = useStudio((s) => s.design);
  const logo = useStudio((s) => s.logo);

  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<BulkMapping | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleType, setSampleType] = useState<ContentTypeId>("url");

  const [formats, setFormats] = useState<Record<BulkFormat, boolean>>({ png: true, svg: false });
  const [sizePx, setSizePx] = useState(1024);
  const [verify, setVerify] = useState(true);
  const [run, setRun] = useState<Run>({ state: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (name: string, bytes: Uint8Array, header: boolean, sheet?: string) => {
    setLoading(true);
    setParseError(null);
    const out = await parseSpreadsheet(name, bytes, header, sheet);
    setLoading(false);
    setRun({ state: "idle" });
    if (!out.ok) {
      setTable(null);
      setMapping(null);
      setParseError(out.error);
      return;
    }
    setTable(out.table);
    setMapping(autoMapping(out.table, sampleType));
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (inputRef.current) inputRef.current.value = "";
    if (f.size > BULK_LIMITS.maxBytes) {
      setParseError(`The file is larger than ${BULK_LIMITS.maxBytes / 1024 / 1024} MB.`);
      return;
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    setFile({ name: f.name, bytes });
    await load(f.name, bytes, hasHeader);
  };

  const rows = useMemo(() => (table && mapping ? buildRows(table, mapping) : []), [table, mapping]);
  const stats = summarize(rows);
  const firstValid = rows.find((r) => r.status === "valid");
  const previewScene = useMemo(() => {
    if (!firstValid?.payload) return null;
    try {
      return buildScene({ text: firstValid.payload, design, logo });
    } catch {
      return null;
    }
  }, [firstValid, design, logo]);

  const chosenFormats = (Object.keys(formats) as BulkFormat[]).filter((f) => formats[f]);
  const settingsKey = JSON.stringify({ rows: rows.map((r) => [r.row, r.payload, r.fileBase]), design, logo: logo?.dataUrl.length ?? 0, logoName: logo?.name, chosenFormats, sizePx, verify });
  const result = run.state === "finished" ? run.result : null;
  const stale = run.state === "finished" && run.key !== settingsKey;
  const itemsByRow = useMemo(() => new Map((result?.items ?? []).map((i) => [i.row.row, i])), [result]);

  const start = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const key = settingsKey;
    setRun({ state: "running", done: 0, total: stats.valid, current: "" });
    const res = await generateBulk({
      rows,
      design,
      logo,
      formats: chosenFormats,
      sizePx,
      verify,
      renderers: browserRenderers,
      signal: ctrl.signal,
      onProgress: (done, total, item) => setRun({ state: "running", done, total, current: item.row.fileBase }),
    });
    abortRef.current = null;
    setRun({ state: "finished", result: res, key });
  };

  const scanCounts = result
    ? { pass: result.items.filter((i) => i.scan === "pass").length, fail: result.items.filter((i) => i.scan === "fail" || i.scan === "error").length, failed: result.items.filter((i) => i.error).length }
    : null;

  return (
    <div className="bg-surface-1 pb-16">
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 pt-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bulk QR codes</h1>
          <p className="mt-1 max-w-3xl text-ink-2">
            Create up to {BULK_LIMITS.maxRows.toLocaleString("en")} QR codes from a CSV or Excel file. Everything — parsing, generation, scan checks and the ZIP — happens in your browser; the file is never uploaded.
          </p>
        </div>

        {/* 1. Upload */}
        <section aria-labelledby="bulk-upload-title" className="rounded-modal border border-line bg-white p-5">
          <h2 id="bulk-upload-title" className="mb-3 text-base font-semibold">
            1. Upload a spreadsheet
          </h2>
          <div
            className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-line p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files[0]);
            }}
          >
            <FileSpreadsheet className="size-8 text-ink-3" aria-hidden="true" />
            <p className="text-sm text-ink-2">{file ? <span data-testid="bulk-file-name">{file.name}</span> : "Drop a .csv or .xlsx file here, or choose one. First sheet with data is used."}</p>
            <Button variant="outline" size="sm" loading={loading} icon={<Upload className="size-4" aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
              {file ? "Choose another file" : "Choose file"}
            </Button>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" tabIndex={-1} aria-label="Spreadsheet file" data-testid="bulk-input" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <Checkbox
              id="bulk-header"
              label="First row contains column names"
              checked={hasHeader}
              onChange={(e) => {
                setHasHeader(e.target.checked);
                if (file) void load(file.name, file.bytes, e.target.checked, table?.sheet);
              }}
            />
            {table?.sheets && table.sheets.length > 1 && (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Sheet
                <Select value={table.sheet} onChange={(e) => file && void load(file.name, file.bytes, hasHeader, e.target.value)}>
                  {table.sheets.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </label>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Sample file for
              <Select value={sampleType} onChange={(e) => setSampleType(e.target.value as ContentTypeId)} className="w-56">
                {CONTENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button size="sm" variant="ghost" onClick={() => triggerDownload(csvBlob(sampleCsv(getContentType(sampleType)!)), `qr-studio-sample-${sampleType}.csv`)}>
              Download sample CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => triggerDownload(csvBlob(sampleCsv(CONTENT_TYPES[0]!, CONTENT_TYPES)), "qr-studio-sample-all-types.csv")}>
              Sample with all 22 types
            </Button>
          </div>
          {parseError && (
            <Notice tone="error" className="mt-4">
              <span data-testid="bulk-parse-error">{parseError}</span>
            </Notice>
          )}
          {table && (
            <p className="mt-3 text-sm text-ink-2" data-testid="bulk-table-info">
              {table.rows.length} data row{table.rows.length === 1 ? "" : "s"}, {table.headers.length} column{table.headers.length === 1 ? "" : "s"}
              {table.sheet ? ` · sheet “${table.sheet}”` : ""}. {table.notes.join(" ")}
            </p>
          )}
        </section>

        {table && mapping && (
          <>
            {/* 2. Mapping */}
            <section aria-labelledby="bulk-map-title" className="rounded-modal border border-line bg-white p-5">
              <h2 id="bulk-map-title" className="mb-1 text-base font-semibold">
                2. Match columns to QR fields
              </h2>
              <p className="mb-4 text-sm text-ink-2">Columns were matched automatically by name — check and adjust.</p>
              <MappingEditor table={table} mapping={mapping} onChange={setMapping} />
            </section>

            {/* 3. Design */}
            <section aria-labelledby="bulk-design-title" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="bulk-design-title" className="text-base font-semibold">
                  3. Design (applies to every code)
                </h2>
                <ResetDesignButton />
              </div>
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3">
                  <Pane title="Templates" icon={<LayoutTemplate className="size-5" aria-hidden="true" />} testId="pane-templates">
                    <TemplatesPanel previewText={firstValid?.payload ?? null} />
                  </Pane>
                  <Pane title="Colours" icon={<Palette className="size-5" aria-hidden="true" />} testId="pane-colours">
                    <ColorsPanel />
                  </Pane>
                  <Pane title="Shapes" icon={<Shapes className="size-5" aria-hidden="true" />} testId="pane-shapes">
                    <ShapesPanel />
                  </Pane>
                  <Pane title="Logo" icon={<ImagePlus className="size-5" aria-hidden="true" />} testId="pane-logo">
                    <LogoPanel obscuredRatio={logo && previewScene ? previewScene.stats.obscuredRatio : null} budget={logo && previewScene ? previewScene.stats.logoBudget : null} ec={previewScene?.ec ?? null} />
                  </Pane>
                  <Pane title="Error correction & margin" icon={<Settings2 className="size-5" aria-hidden="true" />} testId="pane-advanced">
                    <AdvancedPanel />
                  </Pane>
                </div>
                <figure className="rounded-modal border border-line bg-white p-4 lg:sticky lg:top-20">
                  {firstValid?.payload ? (
                    <QrImage text={firstValid.payload} design={design} logo={logo} alt={`Design preview using row ${firstValid.row}`} className="w-full" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-sm text-ink-2">No valid rows yet</div>
                  )}
                  <figcaption className="mt-2 text-center text-xs text-ink-2">{firstValid ? `Preview with row ${firstValid.row}` : ""}</figcaption>
                </figure>
              </div>
            </section>

            {/* 4. Preview & validation */}
            <section aria-labelledby="bulk-preview-title" className="rounded-modal border border-line bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="bulk-preview-title" className="text-base font-semibold">
                  4. Check the rows
                </h2>
                <p className="text-sm" data-testid="bulk-summary">
                  <span className="font-semibold text-success-700">{stats.valid} valid</span> · <span className="font-semibold text-danger-700">{stats.invalid} with problems</span> · <span className="text-ink-2">{stats.empty} empty</span>
                </p>
              </div>
              {stats.invalid + stats.empty > 0 && (
                <Button size="sm" variant="outline" className="mb-3" onClick={() => triggerDownload(csvBlob(errorReport(rows)), `qr-studio-row-problems-${stamp()}.csv`)}>
                  Download row problems (CSV)
                </Button>
              )}
              <RowsTable rows={rows} design={design} logo={logo} testId="bulk-preview-table" />
            </section>

            {/* 5. Generate */}
            <section aria-labelledby="bulk-generate-title" className="rounded-modal border border-line bg-white p-5">
              <h2 id="bulk-generate-title" className="mb-3 text-base font-semibold">
                5. Generate &amp; download
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-sm font-medium">Formats</legend>
                  <Checkbox id="bulk-png" label="PNG" checked={formats.png} onChange={(e) => setFormats({ ...formats, png: e.target.checked })} />
                  <Checkbox id="bulk-svg" label="SVG (vector)" checked={formats.svg} onChange={(e) => setFormats({ ...formats, svg: e.target.checked })} />
                </fieldset>
                <div className="space-y-4">
                  <Slider label="Size" min={128} max={2048} step={64} value={sizePx} format={(v) => `${v} × ${v} px`} onChange={setSizePx} />
                  <Checkbox id="bulk-verify" label="Scan-check every code" help="Decodes each generated image with the built-in scanner. Slower, but proves every code works." checked={verify} onChange={(e) => setVerify(e.target.checked)} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button size="lg" data-testid="bulk-generate" disabled={run.state === "running" || stats.valid === 0 || chosenFormats.length === 0} onClick={() => void start()}>
                  Generate {stats.valid} QR code{stats.valid === 1 ? "" : "s"}
                </Button>
                {run.state === "running" && (
                  <Button variant="danger" icon={<X className="size-4" aria-hidden="true" />} onClick={() => abortRef.current?.abort()} data-testid="bulk-cancel">
                    Cancel
                  </Button>
                )}
                {chosenFormats.length === 0 && <span className="text-sm text-danger-700">Choose at least one format.</span>}
                {stats.valid === 0 && <span className="text-sm text-danger-700">There are no valid rows to generate.</span>}
              </div>

              {run.state === "running" && (
                <div className="mt-4 space-y-1" aria-live="polite">
                  <div
                    role="progressbar"
                    aria-label="Generation progress"
                    aria-valuemin={0}
                    aria-valuemax={run.total}
                    aria-valuenow={run.done}
                    data-testid="bulk-progress"
                    className="h-3 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-sm text-ink-2">
                    {run.done} of {run.total} · {run.current}
                  </p>
                </div>
              )}

              {result && scanCounts && (
                <div className="mt-5 space-y-4" data-testid="bulk-result">
                  <Notice tone={result.cancelled ? "warning" : scanCounts.fail || scanCounts.failed ? "warning" : "success"} title={result.cancelled ? "Generation cancelled" : "Generation complete"}>
                    <span data-testid="bulk-result-text">
                      {result.items.length} of {stats.valid} code{stats.valid === 1 ? "" : "s"} generated in {(result.elapsedMs / 1000).toFixed(1)} s
                      {verify ? ` · ${scanCounts.pass} passed the scan check${scanCounts.fail ? `, ${scanCounts.fail} failed` : ""}` : ""}
                      {stats.invalid + stats.empty ? ` · ${stats.invalid + stats.empty} row(s) skipped (see report)` : ""}.
                    </span>
                  </Notice>
                  {stale && <Notice tone="info">Settings changed since this run. Generate again to apply them.</Notice>}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="bulk-zip"
                      disabled={result.items.length === 0}
                      onClick={() => triggerDownload(new Blob([buildZip(rows, result.items) as BlobPart], { type: "application/zip" }), `qr-studio-bulk-${stamp()}.zip`)}
                    >
                      Download all as ZIP
                    </Button>
                    <Button variant="outline" data-testid="bulk-report" onClick={() => triggerDownload(csvBlob(generationReport(rows, result.items)), `qr-studio-bulk-report-${stamp()}.csv`)}>
                      Download report (CSV)
                    </Button>
                    {(stats.invalid + stats.empty > 0 || scanCounts.fail > 0 || scanCounts.failed > 0) && (
                      <Button variant="outline" data-testid="bulk-errors" onClick={() => triggerDownload(csvBlob(errorReport(rows, result.items)), `qr-studio-bulk-errors-${stamp()}.csv`)}>
                        Download error report (CSV)
                      </Button>
                    )}
                  </div>
                  <RowsTable rows={rows} items={itemsByRow} design={design} logo={logo} testId="bulk-results-table" />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
