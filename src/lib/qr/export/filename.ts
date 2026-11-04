export type ExportFormat = "png" | "svg" | "pdf" | "eps";

export const EXPORT_MIME: Record<ExportFormat, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  eps: "application/postscript",
};

/** Lowercase, ASCII, dash-separated slug (max 40 chars). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * `qr-<type>[-<hint>]-<size>-<yyyymmdd-hhmm>.<ext>`, e.g. `qr-url-example-com-1000px-20261104-0930.png`.
 */
export function exportFilename(opts: {
  type: string;
  hint?: string;
  format: ExportFormat;
  size: string;
  date?: Date;
}): string {
  const hint = opts.hint ? slugify(opts.hint) : "";
  const parts = ["qr", slugify(opts.type) || "code", hint, opts.size, stamp(opts.date ?? new Date())].filter(Boolean);
  return `${parts.join("-")}.${opts.format}`;
}
