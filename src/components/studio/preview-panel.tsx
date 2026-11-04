"use client";

import { CircleCheck, CircleX, Loader2, ScanLine, TriangleAlert } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { utf8Length } from "@/lib/qr/engine/matrix";
import { cn } from "@/lib/cn";
import type { Pipeline, ScanStatus } from "./use-qr-pipeline";

const SCAN_COPY: Record<Exclude<ScanStatus, "idle">, { label: string; tone: string; icon: typeof CircleCheck }> = {
  checking: { label: "Checking scan…", tone: "bg-surface-2 text-ink-2", icon: Loader2 },
  pass: { label: "Scans correctly", tone: "bg-success-50 text-success-700", icon: CircleCheck },
  fail: { label: "Does not scan", tone: "bg-danger-50 text-danger-700", icon: CircleX },
  error: { label: "Scan check unavailable", tone: "bg-warning-50 text-warning-700", icon: TriangleAlert },
};

export function ScanBadge({ status, className }: { status: ScanStatus; className?: string }) {
  if (status === "idle") return null;
  const c = SCAN_COPY[status];
  const Icon = c.icon;
  return (
    <span data-scan={status} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", c.tone, className)}>
      <Icon className={cn("size-4", status === "checking" && "animate-spin")} aria-hidden="true" />
      {c.label}
    </span>
  );
}

export function PreviewPanel({ pipeline, transparent }: { pipeline: Pipeline; transparent: boolean }) {
  const { result, scene, error, previewUrl, issues, scan } = pipeline;
  const payload = result.status === "ok" ? result.payload : "";

  return (
    <section aria-labelledby="preview-title" className="rounded-modal border border-line bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="preview-title" className="text-base font-semibold">
          Live preview
        </h2>
        <div aria-live="polite">
          <ScanBadge status={scan} />
        </div>
      </div>

      <div className={cn("relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-card border border-line", transparent ? "bg-checker" : "bg-surface-1")}>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- live generated SVG data URI
          <img src={previewUrl} alt={`QR code preview encoding: ${payload.slice(0, 120)}`} data-testid="qr-preview" className="size-full" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center text-ink-2">
            <ScanLine className="size-12 text-ink-3" aria-hidden="true" />
            <p className="text-sm" data-testid="preview-empty">
              {error
                ? "This content can't be encoded with the current settings."
                : result.status === "invalid"
                  ? "Fix the highlighted fields to see your QR code."
                  : "Fill in the form to generate your QR code."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {error && <Notice tone="error">{error}</Notice>}
        {result.status === "invalid" && (
          <Notice tone="warning" title="Content needs attention">
            <ul className="list-inside list-disc">
              {Object.values(result.errors).slice(0, 4).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Notice>
        )}
        {scan === "fail" && (
          <Notice tone="error" title="Our scanner could not read this design">
            Increase contrast, simplify shapes, reduce the logo or raise error correction. Downloads will ask for confirmation.
          </Notice>
        )}
        {scene &&
          issues.map((i) => (
            <Notice key={i.code} tone={i.level === "error" ? "error" : i.level === "warning" ? "warning" : "info"}>
              {i.message}
            </Notice>
          ))}
      </div>

      {scene && (
        <details className="mt-4 rounded-card border border-line bg-surface-1 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-ink-1">Encoded data &amp; technical details</summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-ink-2">
            <dt>Version</dt>
            <dd data-testid="qr-version">
              {scene.version} ({scene.moduleCount}×{scene.moduleCount})
            </dd>
            <dt>Error correction</dt>
            <dd data-testid="qr-ec">{scene.ec}</dd>
            <dt>Data size</dt>
            <dd>{utf8Length(payload)} bytes</dd>
            <dt>Mask</dt>
            <dd>{scene.mask}</dd>
          </dl>
          <pre data-testid="qr-payload" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-tile bg-white p-2 font-mono text-xs text-ink-1">
            {payload}
          </pre>
        </details>
      )}
    </section>
  );
}
