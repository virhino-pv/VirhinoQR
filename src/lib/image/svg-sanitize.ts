import type { DOMPurify as Purifier } from "dompurify";

/**
 * Sanitises an uploaded SVG before it is ever rendered: strips scripts, event handlers,
 * foreignObject, external references and CSS imports. The result is then rasterised, so the
 * exported QR never embeds user SVG markup.
 */
export type SvgSanitizeResult = { ok: true; svg: string; width: number; height: number } | { ok: false; error: string };

const SAFE_REF = /^(#|data:image\/(png|jpe?g|webp|gif);base64,)/i;

export function sanitizeSvg(source: string, purify: Purifier): SvgSanitizeResult {
  purify.removeAllHooks();
  purify.addHook("uponSanitizeAttribute", (_node, data) => {
    const name = data.attrName.toLowerCase();
    if ((name === "href" || name === "xlink:href") && !SAFE_REF.test(data.attrValue.trim())) data.keepAttr = false;
    if (name === "style" && /url\s*\(\s*['"]?(?!#)|@import|expression\s*\(/i.test(data.attrValue)) data.keepAttr = false;
  });
  purify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "style" && /@import|url\s*\(\s*['"]?(?!#)/i.test(node.textContent ?? "")) node.textContent = "";
  });
  const clean = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "iframe", "embed", "object", "audio", "video", "animate", "set", "animateMotion", "animateTransform"],
    FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onbegin", "onend"],
    RETURN_TRUSTED_TYPE: false,
  }) as string;
  purify.removeAllHooks();

  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) {
    return { ok: false, error: "The SVG could not be read after removing unsafe content." };
  }
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Determine intrinsic size so browsers can rasterise it.
  const vb = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const num = (v: string | null) => {
    const n = v ? parseFloat(v) : NaN;
    return v && /%$/.test(v) ? NaN : n;
  };
  let width = num(root.getAttribute("width"));
  let height = num(root.getAttribute("height"));
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0) {
    if (!Number.isFinite(width) && !Number.isFinite(height)) {
      width = vb[2]!;
      height = vb[3]!;
    } else if (!Number.isFinite(width)) width = (height * vb[2]!) / vb[3]!;
    else if (!Number.isFinite(height)) height = (width * vb[3]!) / vb[2]!;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ok: false, error: "The SVG has no usable size (add a viewBox or width/height)." };
  }
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  return { ok: true, svg: new XMLSerializer().serializeToString(root), width, height };
}
