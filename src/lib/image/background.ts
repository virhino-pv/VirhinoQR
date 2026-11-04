import type { RgbaImage } from "./resample";

/**
 * Removes a plain background by flood-filling from the image border: pixels connected to the edge
 * whose colour is close to the dominant border colour become transparent, with a soft edge.
 * Works for logos on white or other solid backgrounds; photos with busy backgrounds are not
 * "technically feasible" this way and the result reports how much was removed.
 */
export interface BackgroundRemoval {
  image: RgbaImage;
  removedRatio: number;
  backgroundColor: [number, number, number];
}

function dominantBorderColor(img: RgbaImage): [number, number, number] | null {
  const { width: w, height: h, data } = img;
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3]! < 128) return;
    const key = ((data[i]! >> 4) << 8) | ((data[i + 1]! >> 4) << 4) | (data[i + 2]! >> 4);
    const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++;
    c.r += data[i]!;
    c.g += data[i + 1]!;
    c.b += data[i + 2]!;
    counts.set(key, c);
  };
  for (let x = 0; x < w; x++) {
    visit(x, 0);
    visit(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    visit(0, y);
    visit(w - 1, y);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best ? [best.r / best.n, best.g / best.n, best.b / best.n] : null;
}

/** tolerance: 0–100 (colour distance as % of the RGB cube diagonal). */
export function removeBackground(img: RgbaImage, tolerance = 12): BackgroundRemoval {
  const { width: w, height: h } = img;
  const out = new Uint8ClampedArray(img.data);
  const bg = dominantBorderColor(img);
  if (!bg) return { image: { width: w, height: h, data: out }, removedRatio: 0, backgroundColor: [255, 255, 255] };
  const maxDist = 441.67; // sqrt(3 * 255^2)
  const hard = (tolerance / 100) * maxDist;
  const soft = hard * 1.6 + 4;
  const dist = (i: number) => Math.hypot(out[i]! - bg[0], out[i + 1]! - bg[1], out[i + 2]! - bg[2]);

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  let removed = 0;
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    if (out[i + 3] === 0) {
      // Already transparent: keep flooding through it.
    } else {
      const d = dist(i);
      if (d > soft) continue; // foreground: stop here
      if (d <= hard) {
        out[i + 3] = 0;
        removed++;
      } else {
        // Anti-aliased edge: fade proportionally, don't flood further.
        out[i + 3] = Math.round(out[i + 3]! * ((d - hard) / (soft - hard)));
        continue;
      }
    }
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return { image: { width: w, height: h, data: out }, removedRatio: removed / (w * h), backgroundColor: [Math.round(bg[0]), Math.round(bg[1]), Math.round(bg[2])] };
}
