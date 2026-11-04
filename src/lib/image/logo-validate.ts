/** Logo upload validation: allow-list by content (magic bytes), not just by name or MIME type. */

export type LogoKind = "png" | "jpeg" | "webp" | "svg";

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml";

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

/** Detects the real file format from its first bytes. */
export function sniffImage(bytes: Uint8Array): LogoKind | "gif" | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 1024)).replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  return null;
}

const EXT_KIND: Record<string, LogoKind> = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp", svg: "svg" };

export type LogoValidation = { ok: true; kind: LogoKind } | { ok: false; error: string };

export function validateLogoFile(file: { name: string; size: number }, bytes: Uint8Array): LogoValidation {
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Logos must be 5 MB or smaller.` };
  }
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const declared = EXT_KIND[ext];
  if (!declared) return { ok: false, error: "Unsupported file type. Use PNG, JPG, WebP or SVG." };
  const actual = sniffImage(bytes);
  if (actual === "gif") return { ok: false, error: "GIF logos aren't supported. Use PNG, JPG, WebP or SVG." };
  if (!actual) return { ok: false, error: "This file isn't a valid image (its contents don't match a PNG, JPG, WebP or SVG)." };
  if (actual !== declared) {
    return { ok: false, error: `The file is named .${ext} but contains ${actual.toUpperCase()} data. Rename or re-export it.` };
  }
  return { ok: true, kind: actual };
}
