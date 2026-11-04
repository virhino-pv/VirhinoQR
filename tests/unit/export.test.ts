import { describe, expect, it } from "vitest";
import { unzlibSync } from "fflate";
import { createCanvas } from "@napi-rs/canvas";
import { buildScene } from "@/lib/qr/engine/scene";
import { cloneDesign } from "@/lib/qr/engine/design";
import { sceneToSvg } from "@/lib/qr/export/svg";
import { sceneToPdf, MM_TO_PT } from "@/lib/qr/export/pdf";
import { ascii85, sceneToEps } from "@/lib/qr/export/eps";
import { readPngInfo, setPngDpi } from "@/lib/qr/export/png-meta";
import { exportFilename, slugify } from "@/lib/qr/export/filename";
import type { Design } from "@/lib/qr/engine/types";
import { decodePng, decodeRgba, makeLogo, rasterizeSvg, setupDecoder } from "../helpers/render";
import { encodePngRgba } from "../helpers/png";

const TEXT = "https://qr-studio.example/export?test=1";

function scene(mutate: (d: Design) => void = () => {}, logo = false) {
  const d = cloneDesign();
  mutate(d);
  return buildScene({ text: TEXT, design: d, logo: logo ? makeLogo(128) : null });
}

function fancy(d: Design): void {
  d.bodyShape = "rounded";
  d.eyeFrameShape = "extra-rounded";
  d.eyeBallShape = "circle";
  d.foreground = { mode: "linear", color1: "#1e1b4b", color2: "#4f46e5", angle: 45 };
  d.eyes = { mode: "custom", frame: "#7c2d12", ball: "#1e3a8a", perEye: null };
}

async function renderPdf(bytes: Uint8Array, scale = 3): Promise<{ width: number; height: number; data: Uint8ClampedArray; pageWidth: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pageWidth = page.getViewport({ scale: 1 }).width;
  await task.destroy();
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data), pageWidth };
}

describe("SVG export", () => {
  it("is valid, sized, uses a viewBox and decodes with an independent renderer", async () => {
    const svg = sceneToSvg(scene(fancy, true), { size: 1000, title: "Test <QR>" });
    expect(svg).toMatch(/^<\?xml version="1.0"/);
    expect(svg).toMatch(/width="1000" height="1000" viewBox="0 0 \d+ \d+"/);
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain('xlink:href="data:image/png;base64,');
    expect(svg).toContain("<title>Test &lt;QR&gt;</title>");
    expect(await decodePng(rasterizeSvg(svg, 600))).toEqual([TEXT]);
  });

  it("transparent background omits the background rect", () => {
    const svg = sceneToSvg(scene((d) => (d.background.transparent = true)), { size: 300 });
    expect(svg).not.toMatch(/<rect width="\d+" height="\d+" fill=/);
  });

  it("radial gradient is emitted", () => {
    const svg = sceneToSvg(scene((d) => (d.foreground = { mode: "radial", color1: "#000000", color2: "#4f46e5", angle: 0 })), { size: 300 });
    expect(svg).toContain("<radialGradient");
  });
});

describe("PNG metadata", () => {
  it("sets DPI (pHYs) and keeps dimensions", () => {
    const png = encodePngRgba(3, 2, new Uint8Array(24).fill(200));
    const out = setPngDpi(png, 300);
    const info = readPngInfo(out);
    expect(info).toMatchObject({ width: 3, height: 2 });
    expect(Math.round(info.ppm! * 0.0254)).toBe(300);
    // Replacing keeps a single pHYs chunk.
    const twice = setPngDpi(out, 600);
    expect(Math.round(readPngInfo(twice).ppm! * 0.0254)).toBe(600);
    expect(twice.length).toBe(out.length);
  });
});

describe("PDF export", () => {
  it("has correct page size and structure", () => {
    const bytes = sceneToPdf(scene(), { sizePt: 50 * MM_TO_PT, title: "Tamil தமிழ்" });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toMatch(/\/MediaBox \[0 0 141\.732 141\.732\]/);
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
  });

  const PDF_CASES: Array<[string, (d: Design) => void, boolean]> = [
    ["solid", () => {}, false],
    ["gradient + custom eyes", fancy, false],
    ["radial + logo", (d) => void (d.foreground = { mode: "radial", color1: "#4f46e5", color2: "#111827", angle: 0 }), true],
    ["transparent background", (d) => void (d.background.transparent = true), false],
  ];
  it.each(PDF_CASES)("renders with pdf.js and decodes: %s", async (_n, mutate, logo) => {
    const s = scene(mutate, logo);
    const bytes = sceneToPdf(s, { sizePt: 60 * MM_TO_PT });
    const img = await renderPdf(bytes);
    expect(img.pageWidth).toBeCloseTo(60 * MM_TO_PT, 1);
    setupDecoder();
    expect(await decodeRgba(img)).toEqual([TEXT]);
  });

  it("uses vector shadings for gradients and an SMask for logo alpha", () => {
    const text = new TextDecoder("latin1").decode(sceneToPdf(scene(fancy, true), { sizePt: 200 }));
    expect(text).toContain("/ShadingType 2");
    expect(text).toContain("/SMask");
    expect(text).toContain("/Subtype /Image");
  });
});

describe("EPS export", () => {
  it("has a valid DSC header, bounding box and balanced graphics state", () => {
    const eps = sceneToEps(scene(fancy, true), { sizePt: 144, title: "My (QR)" });
    expect(eps.startsWith("%!PS-Adobe-3.0 EPSF-3.0\n")).toBe(true);
    expect(eps).toContain("%%BoundingBox: 0 0 144 144");
    expect(eps).toContain("%%LanguageLevel: 3");
    expect(eps).toContain("%%Title: My QR");
    expect(eps).toContain("/ShadingType 2");
    expect(eps).toContain("shfill");
    expect(eps).toMatch(/\/ImageType 1 .*\/FlateDecode filter >> image/);
    expect(eps.trimEnd().endsWith("%%EOF")).toBe(true);
    const count = (re: RegExp) => (eps.match(re) ?? []).length;
    expect(count(/\bgsave\b/g)).toBe(count(/\bgrestore\b/g));
  });

  it("uses a mask image when the logo is not on a cleared backdrop", () => {
    const eps = sceneToEps(scene((d) => (d.logo.clearBehind = false), true), { sizePt: 144 });
    expect(eps).toContain("/ImageType 3 /InterleaveType 1");
  });

  it("embeds image data that decodes back to the logo pixels (ASCII85 + Flate)", () => {
    const s = scene(() => {}, true);
    const eps = sceneToEps(s, { sizePt: 144, logoMaxPx: 128 });
    const block = /filter >> image\n([\s\S]*?~>)/.exec(eps)![1]!;
    const bytes = unzlibSync(ascii85Decode(block));
    expect(bytes.length).toBe(128 * 128 * 3);
  });

  it("ascii85 matches the reference encoding", () => {
    expect(ascii85(new TextEncoder().encode("Man "))).toBe("9jqo^~>");
    expect(ascii85(new Uint8Array([0, 0, 0, 0]))).toBe("z~>");
    expect(ascii85(new TextEncoder().encode("Ma"))).toBe("9jn~>");
  });
});

describe("file names", () => {
  it("are meaningful and safe", () => {
    const d = new Date(2026, 10, 4, 9, 5);
    expect(exportFilename({ type: "url", hint: "www.Example.com", format: "png", size: "1024px", date: d })).toBe("qr-url-example-com-1024px-20261104-0905.png");
    expect(exportFilename({ type: "wifi", hint: "Café Guest!!", format: "pdf", size: "50mm", date: d })).toBe("qr-wifi-cafe-guest-50mm-20261104-0905.pdf");
    expect(slugify("தமிழ்")).toBe("");
    expect(exportFilename({ type: "text", hint: "தமிழ்", format: "svg", size: "512px", date: d })).toBe("qr-text-512px-20261104-0905.svg");
  });
});

function ascii85Decode(s: string): Uint8Array {
  const body = s.replace(/\s/g, "").replace(/~>$/, "");
  const out: number[] = [];
  let group: number[] = [];
  for (const ch of body) {
    if (ch === "z" && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    group.push(ch.charCodeAt(0) - 33);
    if (group.length === 5) {
      let v = 0;
      for (const g of group) v = v * 85 + g;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      group = [];
    }
  }
  if (group.length) {
    const n = group.length;
    while (group.length < 5) group.push(84);
    let v = 0;
    for (const g of group) v = v * 85 + g;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n - 1));
  }
  return Uint8Array.from(out);
}
