/** Pure-JS image helpers shared by browser code, the PDF/EPS writers and tests. */

export interface RgbaImage {
  width: number;
  height: number;
  /** Straight (non-premultiplied) RGBA. */
  data: Uint8Array | Uint8ClampedArray;
}

/** Area-average downscale so that the longest edge is at most `maxEdge`. Returns the input if already small. */
export function downscale(img: RgbaImage, maxEdge: number): RgbaImage {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  if (scale >= 1) return img;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      // Alpha-weighted average so transparent pixels don't darken edges.
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.width + xx) * 4;
          const al = img.data[i + 3]!;
          r += img.data[i]! * al;
          g += img.data[i + 1]! * al;
          b += img.data[i + 2]! * al;
          a += al;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / n;
    }
  }
  return { width: w, height: h, data: out };
}

/** Splits RGBA into RGB (optionally composited over `matte`) and an 8-bit alpha channel. */
export function splitAlpha(
  img: RgbaImage,
  options: { opacity?: number; matte?: [number, number, number] } = {},
): { rgb: Uint8Array; alpha: Uint8Array; hasAlpha: boolean } {
  const opacity = options.opacity ?? 1;
  const n = img.width * img.height;
  const rgb = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  let hasAlpha = opacity < 1;
  for (let i = 0; i < n; i++) {
    const a = (img.data[i * 4 + 3]! / 255) * opacity;
    if (a < 1) hasAlpha = true;
    alpha[i] = Math.round(a * 255);
    for (let c = 0; c < 3; c++) {
      const v = img.data[i * 4 + c]!;
      rgb[i * 3 + c] = options.matte ? Math.round(v * a + options.matte[c]! * (1 - a)) : v;
    }
  }
  return { rgb, alpha, hasAlpha };
}
