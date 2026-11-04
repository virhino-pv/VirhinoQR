"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { getContentType, isVisible } from "@/lib/payloads";
import { EXPORT_LIMITS, initialValues, useStudio } from "@/lib/store/studio";
import { exportFilename, type ExportFormat } from "@/lib/qr/export/filename";
import { exportScene, triggerDownload } from "@/lib/qr/export/browser";
import { decodeCanvas } from "@/lib/qr/verify/browser-scan";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import type { Pipeline } from "./use-qr-pipeline";
import { useAccount } from "@/lib/account/use-account";
import { recordHistory } from "@/lib/account/repo";
import { downloadHistoryLabel } from "@/lib/account/model";

const FORMATS: ReadonlyArray<{ value: ExportFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
  { value: "pdf", label: "PDF" },
  { value: "eps", label: "EPS" },
];

const FORMAT_HELP: Record<ExportFormat, string> = {
  png: "Raster image for screens, documents and quick printing. Transparent background supported.",
  svg: "Vector for websites and design tools (Figma, Illustrator, Inkscape). Logo embedded.",
  pdf: "Vector PDF for print, with gradients and logo. Page size equals the print size.",
  eps: "Vector EPS (PostScript Level 3) for professional print. Soft logo transparency is reduced to a hard edge unless the logo sits on a cleared area.",
};

type Status = { tone: "success" | "error" | "info"; text: string } | null;

function formatBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function ExportPanel({ pipeline }: { pipeline: Pipeline }) {
  const settings = useStudio((s) => s.exportSettings);
  const setExport = useStudio((s) => s.setExport);
  const typeId = useStudio((s) => s.typeId);
  const touchAll = useStudio((s) => s.touchAll);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sizeText, setSizeText] = useState(String(settings.sizePx));
  const account = useAccount();

  const { scene, result, scan, issues } = pipeline;
  const ready = Boolean(scene) && result.status === "ok";
  const risky = scan === "fail" || issues.some((i) => i.level === "error");
  const isVector = settings.format === "pdf" || settings.format === "eps";

  const doExport = async () => {
    if (!scene || result.status !== "ok") return;
    setBusy(true);
    setStatus({ tone: "info", text: "Preparing your file…" });
    try {
      const filename = exportFilename({
        type: typeId,
        hint: result.hint,
        format: settings.format,
        size: isVector ? `${settings.printMm}mm` : `${settings.sizePx}px`,
      });
      const out = await exportScene({ scene, format: settings.format, sizePx: settings.sizePx, printMm: settings.printMm, dpi: settings.dpi, title: `QR code — ${result.hint || typeId}` });
      let verified = "";
      if (out.canvas) {
        // Decode the exact PNG pixels we are about to save (large exports are checked downscaled by ZXing).
        const texts = await decodeCanvas(out.canvas);
        verified = texts.includes(result.payload) ? " Verified: the file scans." : " Warning: our scanner could not read the exported image.";
      } else if (scan === "pass") verified = " Same design as the scan-checked preview.";
      triggerDownload(out.blob, filename);
      if (account.status === "signed-in") {
        // One history entry per explicit download (never per render). No content is stored.
        const s = useStudio.getState();
        void recordHistory(account.supabase, {
          contentType: typeId,
          label: downloadHistoryLabel(typeId, getContentType(typeId)!.label, result.hint, s.project?.name),
          action: "download",
          format: settings.format,
          projectId: s.project?.id ?? null,
          design: s.design,
          metadata: { version: scene.version, ec: scene.ec, size: isVector ? `${settings.printMm}mm` : `${settings.sizePx}px` },
        });
      }
      setStatus({ tone: verified.startsWith(" Warning") ? "error" : "success", text: `Downloaded ${filename} — ${out.dimensions}, ${formatBytes(out.bytes)}.${verified}` });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "The export failed." });
    } finally {
      setBusy(false);
    }
  };

  const onDownload = () => {
    if (!ready) {
      const type = getContentType(typeId)!;
      const values = useStudio.getState().drafts[typeId] ?? initialValues(typeId);
      touchAll(type.fields.filter((f) => isVisible(f, values)).map((f) => f.name));
      setStatus({ tone: "error", text: pipeline.error ?? "Complete the content form first — the highlighted fields need attention." });
      document.getElementById("content-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (risky) {
      dialogRef.current?.showModal();
      return;
    }
    void doExport();
  };

  const commitSize = (text: string) => {
    const n = Math.round(Number(text));
    const clamped = Number.isFinite(n) ? Math.min(EXPORT_LIMITS.maxPx, Math.max(EXPORT_LIMITS.minPx, n)) : settings.sizePx;
    setExport({ sizePx: clamped });
    setSizeText(String(clamped));
  };

  return (
    <section aria-labelledby="export-title" className="rounded-modal border border-line bg-white p-4 sm:p-5">
      <h2 id="export-title" className="mb-3 text-base font-semibold">
        Download
      </h2>
      <div className="space-y-4">
        <Segmented label="Format" name="format" value={settings.format} options={FORMATS} onChange={(format) => setExport({ format })} />
        <p className="text-xs leading-relaxed text-ink-2">{FORMAT_HELP[settings.format]}</p>

        {isVector ? (
          <Field id="print-mm" label="Print size (mm)" help={`${EXPORT_LIMITS.minMm}–${EXPORT_LIMITS.maxMm} mm. At least 20 mm is recommended for reliable scanning.`}>
            {(a11y) => (
              <Input
                {...a11y}
                type="number"
                min={EXPORT_LIMITS.minMm}
                max={EXPORT_LIMITS.maxMm}
                value={settings.printMm}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setExport({ printMm: Math.min(EXPORT_LIMITS.maxMm, Math.max(EXPORT_LIMITS.minMm, v)) });
                }}
              />
            )}
          </Field>
        ) : (
          <>
            <Slider
              label={settings.format === "svg" ? "Size (width × height)" : "Resolution"}
              min={EXPORT_LIMITS.minPx}
              max={EXPORT_LIMITS.maxPx}
              step={64}
              value={settings.sizePx}
              format={(v) => `${v} × ${v} px`}
              onChange={(v) => {
                setExport({ sizePx: v });
                setSizeText(String(v));
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field id="size-px" label="Exact size (px)">
                {(a11y) => <Input {...a11y} type="number" min={EXPORT_LIMITS.minPx} max={EXPORT_LIMITS.maxPx} value={sizeText} onChange={(e) => setSizeText(e.target.value)} onBlur={(e) => commitSize(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commitSize((e.target as HTMLInputElement).value)} />}
              </Field>
              {settings.format === "png" && (
                <Field id="png-dpi" label="Print density">
                  {(a11y) => (
                    <Select {...a11y} value={settings.dpi} onChange={(e) => setExport({ dpi: Number(e.target.value) })}>
                      {[72, 150, 300, 600].map((d) => (
                        <option key={d} value={d}>
                          {d} dpi
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
            </div>
            {settings.format === "png" && (
              <p className="text-xs text-ink-2">
                Prints at {((settings.sizePx / settings.dpi) * 25.4).toFixed(0)} mm wide at {settings.dpi} dpi.
                {scene && settings.sizePx / scene.size < 3 && <span className="text-warning-700"> Fewer than 3 px per module — choose a larger size.</span>}
              </p>
            )}
          </>
        )}

        <Button size="lg" className="w-full" loading={busy} onClick={onDownload} data-testid="download" icon={<Download className="size-5" aria-hidden="true" />}>
          Download {settings.format.toUpperCase()}
        </Button>
        {!ready && <p className="text-center text-xs text-ink-2">Your QR code appears once the content is complete.</p>}
        <div aria-live="polite" data-testid="export-status">
          {status && <Notice tone={status.tone === "info" ? "info" : status.tone}>{status.text}</Notice>}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="risk-title"
        className="m-auto w-[min(92vw,28rem)] rounded-modal p-0 shadow-e3 backdrop:bg-ink-1/50"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      >
        <div className="space-y-4 p-6">
          <h3 id="risk-title" className="text-lg font-semibold">
            This code may not scan
          </h3>
          <p className="text-sm text-ink-2">
            {scan === "fail" ? "Our scanner could not read the current design." : "The design has readability problems."} You can still download it, but test it carefully before printing.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => dialogRef.current?.close()} autoFocus>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                dialogRef.current?.close();
                void doExport();
              }}
            >
              Download anyway
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
