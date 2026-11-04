"use client";

import type { Scene } from "../engine/types";
import { sceneToSvg } from "./svg";
import { sceneToPdf, MM_TO_PT } from "./pdf";
import { sceneToEps } from "./eps";
import { EXPORT_MIME, type ExportFormat } from "./filename";
import { readPngInfo, setPngDpi } from "./png-meta";

/** Browser-only rendering: SVG → canvas → PNG, plus a single entry point for every export format. */

export function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The browser could not render the QR code image."));
    };
    img.src = url;
  });
}

export async function sceneToCanvas(scene: Scene, sizePx: number): Promise<HTMLCanvasElement> {
  const img = await svgToImage(sceneToSvg(scene, { size: sizePx }));
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, sizePx, sizePx);
  return canvas;
}

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("PNG encoding failed."));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png"),
  );
}

export interface ExportRequest {
  scene: Scene;
  format: ExportFormat;
  sizePx: number;
  printMm: number;
  dpi: number;
  title: string;
}

export interface ExportResult {
  blob: Blob;
  bytes: number;
  /** For PNG: the canvas actually encoded (used for decode validation). */
  canvas?: HTMLCanvasElement;
  /** Human-readable dimension summary, e.g. "1024 × 1024 px" or "50 × 50 mm". */
  dimensions: string;
}

/** Produces the file and validates its structure (size, signature, dimensions). */
export async function exportScene(req: ExportRequest): Promise<ExportResult> {
  const { scene, format } = req;
  if (format === "png") {
    const canvas = await sceneToCanvas(scene, req.sizePx);
    const bytes = setPngDpi(await canvasToPngBytes(canvas), req.dpi);
    const info = readPngInfo(bytes);
    if (info.width !== req.sizePx || info.height !== req.sizePx) {
      throw new Error(`PNG came out ${info.width}×${info.height}, expected ${req.sizePx}×${req.sizePx}.`);
    }
    return { blob: new Blob([bytes as BlobPart], { type: EXPORT_MIME.png }), bytes: bytes.length, canvas, dimensions: `${req.sizePx} × ${req.sizePx} px · ${req.dpi} dpi` };
  }
  if (format === "svg") {
    const svg = sceneToSvg(scene, { size: req.sizePx, title: req.title });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("Generated SVG failed XML validation.");
    return { blob: new Blob([svg], { type: EXPORT_MIME.svg }), bytes: svg.length, dimensions: `${req.sizePx} × ${req.sizePx} px (vector)` };
  }
  const pt = req.printMm * MM_TO_PT;
  if (format === "pdf") {
    const bytes = sceneToPdf(scene, { sizePt: pt, title: req.title });
    const head = new TextDecoder().decode(bytes.subarray(0, 5));
    const tail = new TextDecoder().decode(bytes.subarray(bytes.length - 7));
    if (head !== "%PDF-" || !tail.includes("%%EOF")) throw new Error("Generated PDF is incomplete.");
    return { blob: new Blob([bytes as BlobPart], { type: EXPORT_MIME.pdf }), bytes: bytes.length, dimensions: `${req.printMm} × ${req.printMm} mm (vector)` };
  }
  const eps = sceneToEps(scene, { sizePt: pt, title: req.title });
  if (!eps.startsWith("%!PS-Adobe-3.0 EPSF-3.0") || !eps.includes("%%EOF")) throw new Error("Generated EPS is incomplete.");
  return { blob: new Blob([eps], { type: EXPORT_MIME.eps }), bytes: eps.length, dimensions: `${req.printMm} × ${req.printMm} mm (vector)` };
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
