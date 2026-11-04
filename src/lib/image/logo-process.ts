"use client";

import DOMPurify from "dompurify";
import type { LogoAsset } from "../qr/engine/types";
import { removeBackground } from "./background";
import { validateLogoFile } from "./logo-validate";
import type { RgbaImage } from "./resample";
import { sanitizeSvg } from "./svg-sanitize";

/** Longest edge of the processed logo raster. */
export const LOGO_RASTER_MAX = 1024;

export interface LogoSource {
  name: string;
  image: RgbaImage;
  origin: "upload" | "gallery";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be decoded. It may be corrupt."));
    img.src = url;
  });
}

async function rasterize(url: string, width: number, height: number): Promise<RgbaImage> {
  const img = await loadImage(url);
  const w0 = width || img.naturalWidth;
  const h0 = height || img.naturalHeight;
  if (!w0 || !h0) throw new Error("The image has no dimensions.");
  const scale = Math.min(1, LOGO_RASTER_MAX / Math.max(w0, h0));
  // Vector sources are drawn at the full raster size for crisp edges.
  const s = width ? LOGO_RASTER_MAX / Math.max(w0, h0) : scale;
  const w = Math.max(1, Math.round(w0 * s));
  const h = Math.max(1, Math.round(h0 * s));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { width: w, height: h, data };
}

/** Vector logos are rasterised from a sanitised copy, so no user markup reaches the output. */
export async function svgToLogoSource(svgText: string, name: string, origin: LogoSource["origin"]): Promise<LogoSource> {
  const clean = sanitizeSvg(svgText, DOMPurify);
  if (!clean.ok) throw new Error(clean.error);
  const url = URL.createObjectURL(new Blob([clean.svg], { type: "image/svg+xml" }));
  try {
    return { name, origin, image: await rasterize(url, clean.width, clean.height) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fileToLogoSource(file: File): Promise<LogoSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateLogoFile(file, bytes);
  if (!check.ok) throw new Error(check.error);
  if (check.kind === "svg") return svgToLogoSource(new TextDecoder().decode(bytes), file.name, "upload");
  const url = URL.createObjectURL(new Blob([bytes], { type: `image/${check.kind}` }));
  try {
    return { name: file.name, origin: "upload", image: await rasterize(url, 0, 0) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toDataUrl(img: RgbaImage): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas.toDataURL("image/png");
}

/** Trims fully transparent borders so size controls act on the visible artwork. */
export function trimTransparent(img: RgbaImage): RgbaImage {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return img;
  if (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1) return img;
  const nw = x1 - x0 + 1;
  const nh = y1 - y0 + 1;
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) out.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + nw) * 4), y * nw * 4);
  return { width: nw, height: nh, data: out };
}

export interface ProcessOptions {
  removeBg: boolean;
  tolerance: number;
}

export function processLogo(source: LogoSource, options: ProcessOptions): { asset: LogoAsset; removedRatio: number | null } {
  let img = source.image;
  let removedRatio: number | null = null;
  if (options.removeBg) {
    const r = removeBackground(img, options.tolerance);
    img = r.image;
    removedRatio = r.removedRatio;
  }
  img = trimTransparent(img);
  if (img.data.every((_, i) => i % 4 !== 3 || img.data[i] === 0)) throw new Error("Nothing visible is left in this logo.");
  return { asset: { dataUrl: toDataUrl(img), width: img.width, height: img.height, rgba: img.data, name: source.name }, removedRatio };
}
