"use client";

import { useState } from "react";
import { getContentType } from "@/lib/payloads";
import type { BulkRow } from "@/lib/bulk/mapping";
import type { GeneratedItem } from "@/lib/bulk/generate";
import type { Design, LogoAsset } from "@/lib/qr/engine/types";
import { QrImage } from "@/components/qr/qr-image";
import { Button } from "@/components/ui/button";
import { triggerDownload } from "@/lib/qr/export/browser";
import { cn } from "@/lib/cn";

const PAGE = 20;
type Filter = "all" | "valid" | "invalid";

const STATUS_STYLE: Record<string, string> = {
  valid: "bg-success-50 text-success-700",
  invalid: "bg-danger-50 text-danger-700",
  empty: "bg-surface-2 text-ink-2",
  pass: "bg-success-50 text-success-700",
  fail: "bg-danger-50 text-danger-700",
  error: "bg-danger-50 text-danger-700",
  skipped: "bg-surface-2 text-ink-2",
};

function Pill({ children, tone }: { children: string; tone: string }) {
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[tone])}>{children}</span>;
}

/** Validation preview (before generation) or results with per-file downloads (after). */
export function RowsTable({
  rows,
  items,
  design,
  logo,
  testId,
}: {
  rows: readonly BulkRow[];
  items?: ReadonlyMap<number, GeneratedItem>;
  design: Design;
  logo: LogoAsset | null;
  testId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const filtered = rows.filter((r) => filter === "all" || (filter === "valid" ? r.status === "valid" : r.status !== "valid"));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div data-testid={testId}>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter rows">
        {(["all", "valid", "invalid"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
            className={cn("h-8 rounded-full border px-3 text-xs font-semibold capitalize", filter === f ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink-2")}
          >
            {f === "invalid" ? "Problems" : f} ({rows.filter((r) => f === "all" || (f === "valid" ? r.status === "valid" : r.status !== "valid")).length})
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-1 text-xs uppercase tracking-wide text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-2">Row</th>
              <th scope="col" className="px-3 py-2">QR</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Type</th>
              <th scope="col" className="px-3 py-2">Content / problem</th>
              {items && <th scope="col" className="px-3 py-2">Files</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => {
              const it = items?.get(r.row);
              return (
                <tr key={r.row} data-row={r.row} data-status={r.status}>
                  <td className="px-3 py-2 tabular-nums text-ink-2">{r.row}</td>
                  <td className="px-3 py-2">
                    {r.status === "valid" && r.payload ? <QrImage text={r.payload} design={design} logo={logo} alt={`QR code for row ${r.row}`} size={96} className="size-12" /> : <span className="text-ink-3">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Pill tone={r.status}>{r.status}</Pill>
                    {it && it.scan !== "skipped" && (
                      <span className="ml-1">
                        <Pill tone={it.scan}>{it.scan === "pass" ? "scans" : it.scan === "fail" ? "scan failed" : "error"}</Pill>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.type ? getContentType(r.type)!.label : "—"}</td>
                  <td className="max-w-[320px] px-3 py-2">
                    {r.status === "valid" ? (
                      <span className="block truncate font-mono text-xs" title={r.payload ?? ""}>
                        {r.payload}
                      </span>
                    ) : (
                      <span className="text-xs text-danger-700">{r.errors.join(" · ")}</span>
                    )}
                    {it?.error && <span className="block text-xs text-danger-700">{it.error}</span>}
                  </td>
                  {items && (
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {it?.files.map((f) => (
                          <Button
                            key={f.name}
                            size="sm"
                            variant="outline"
                            aria-label={`Download ${f.name}`}
                            onClick={() => triggerDownload(new Blob([f.bytes as BlobPart], { type: f.format === "png" ? "image/png" : "image/svg+xml" }), f.name)}
                          >
                            {f.format.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={items ? 6 : 5} className="px-3 py-6 text-center text-ink-2">
                  No rows in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Rows pages" className="mt-3 flex items-center justify-between text-sm">
          <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span className="text-ink-2">
            Page {current + 1} of {pages}
          </span>
          <Button size="sm" variant="outline" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
