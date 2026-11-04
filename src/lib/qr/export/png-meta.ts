/** PNG chunk helpers: read dimensions and set the physical pixel density (pHYs). */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

export function crc32(bytes: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((b, i) => bytes[i] === b);
}

export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  /** Pixels per metre from pHYs, if present. */
  ppm: number | null;
}

export function readPngInfo(bytes: Uint8Array): PngInfo {
  if (!isPng(bytes)) throw new Error("Not a PNG file.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let ppm: number | null = null;
  let info: Omit<PngInfo, "ppm"> | null = null;
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    if (type === "IHDR") {
      info = {
        width: view.getUint32(p + 8),
        height: view.getUint32(p + 12),
        bitDepth: bytes[p + 16]!,
        colorType: bytes[p + 17]!,
      };
    } else if (type === "pHYs" && bytes[p + 16] === 1) {
      ppm = view.getUint32(p + 8);
    } else if (type === "IEND") break;
    p += 12 + len;
  }
  if (!info) throw new Error("PNG has no IHDR chunk.");
  return { ...info, ppm };
}

/** Inserts (or replaces) a pHYs chunk so print software sees the intended DPI. */
export function setPngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (!isPng(bytes)) throw new Error("Not a PNG file.");
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let p = 8;
  let inserted = false;
  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const whole = bytes.subarray(p, p + 12 + len);
    if (type === "pHYs") {
      p += 12 + len;
      continue; // drop the old one
    }
    parts.push(whole);
    if (type === "IHDR" && !inserted) {
      parts.push(chunk);
      inserted = true;
    }
    p += 12 + len;
    if (type === "IEND") break;
  }
  const total = parts.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of parts) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
