import { prepareZXingModule, readBarcodes, type ReaderOptions } from "zxing-wasm/reader";

/**
 * Real decode check with ZXing-C++ (WebAssembly). Works in the browser (wasm served from
 * /wasm/zxing_reader.wasm, same origin) and in Node tests (wasm binary passed in).
 */

let prepared = false;

export function configureDecoder(options: { wasmUrl?: string; wasmBinary?: ArrayBuffer }) {
  prepareZXingModule({
    overrides: options.wasmBinary
      ? { wasmBinary: options.wasmBinary }
      : { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? (options.wasmUrl ?? `/wasm/${path}`) : prefix + path) },
    fireImmediately: false,
  });
  prepared = true;
}

const READER_OPTIONS: ReaderOptions = {
  formats: ["QRCode"],
  tryHarder: true,
  tryRotate: false,
  tryInvert: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

export interface DecodeImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Decodes QR codes from RGBA pixels; returns the decoded texts (empty when nothing scans). */
export async function decodeRgba(image: DecodeImage): Promise<string[]> {
  if (!prepared) configureDecoder({});
  const results = await readBarcodes(image as unknown as ImageData, READER_OPTIONS);
  return results.filter((r) => r.isValid).map((r) => r.text);
}

/** Decodes an encoded image file (PNG/JPEG bytes). */
export async function decodeImageFile(bytes: Uint8Array): Promise<string[]> {
  if (!prepared) configureDecoder({});
  const results = await readBarcodes(bytes, READER_OPTIONS);
  return results.filter((r) => r.isValid).map((r) => r.text);
}

/** Composites RGBA over white in place (scanners see transparent pixels as white paper). */
export function flattenOnWhite(data: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    if (a === 1) continue;
    data[i] = data[i]! * a + 255 * (1 - a);
    data[i + 1] = data[i + 1]! * a + 255 * (1 - a);
    data[i + 2] = data[i + 2]! * a + 255 * (1 - a);
    data[i + 3] = 255;
  }
  return data;
}
