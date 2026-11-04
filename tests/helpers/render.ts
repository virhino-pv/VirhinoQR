import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { configureDecoder, decodeImageFile, decodeRgba } from "@/lib/qr/verify/decode";
import { sceneToSvg } from "@/lib/qr/export/svg";
import type { LogoAsset, Scene } from "@/lib/qr/engine/types";
import { encodePngRgba } from "./png";

const require = createRequire(import.meta.url);
let ready = false;

/** Loads the ZXing reader wasm from node_modules (no network). */
export function setupDecoder() {
  if (ready) return;
  const root = join(dirname(require.resolve("zxing-wasm")), "..", "..", "..");
  const bin = readFileSync(join(root, "dist", "reader", "zxing_reader.wasm"));
  configureDecoder({ wasmBinary: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer });
  ready = true;
}

/** Rasterises an SVG string to PNG bytes with resvg (independent renderer from the browser). */
export function rasterizeSvg(svg: string, width: number, background = "#ffffff"): Uint8Array {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: width }, background });
  return new Uint8Array(r.render().asPng());
}

/** Renders the scene to SVG → PNG → decode. */
export async function decodeScene(scene: Scene, px = 400): Promise<string[]> {
  setupDecoder();
  const png = rasterizeSvg(sceneToSvg(scene, { size: px }), px);
  return decodeImageFile(png);
}

export async function decodePng(png: Uint8Array): Promise<string[]> {
  setupDecoder();
  return decodeImageFile(png);
}

export { decodeRgba };

/** A synthetic logo: coloured rounded square with a white glyph and transparent corners. */
export function makeLogo(size = 128, color: [number, number, number] = [79, 70, 229]): LogoAsset {
  const rgba = new Uint8Array(size * size * 4);
  const r = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = Math.min(Math.max(x, r), size - r);
      const cy = Math.min(Math.max(y, r), size - r);
      const inside = Math.hypot(x - cx, y - cy) <= r;
      const glyph = Math.hypot(x - size / 2, y - size / 2) < size * 0.22;
      if (!inside) continue;
      const [cr, cg, cb] = glyph ? [255, 255, 255] : color;
      rgba[i] = cr;
      rgba[i + 1] = cg;
      rgba[i + 2] = cb;
      rgba[i + 3] = 255;
    }
  }
  const png = encodePngRgba(size, size, rgba);
  return {
    dataUrl: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
    width: size,
    height: size,
    rgba,
    name: "test-logo",
  };
}
