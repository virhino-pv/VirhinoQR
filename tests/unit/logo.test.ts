// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import DOMPurify from "dompurify";
import { LOGO_MAX_BYTES, sniffImage, validateLogoFile } from "@/lib/image/logo-validate";
import { removeBackground } from "@/lib/image/background";
import { sanitizeSvg } from "@/lib/image/svg-sanitize";
import { downscale, splitAlpha } from "@/lib/image/resample";
import { GALLERY_LOGOS } from "@/lib/image/gallery";
import { encodePngRgba } from "../helpers/png";

const PNG = encodePngRgba(2, 2, new Uint8Array(16).fill(255));
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const enc = (s: string) => new TextEncoder().encode(s);

describe("logo file validation", () => {
  it("detects formats by content", () => {
    expect(sniffImage(PNG)).toBe("png");
    expect(sniffImage(JPEG)).toBe("jpeg");
    expect(sniffImage(enc('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(sniffImage(enc("GIF89a...."))).toBe("gif");
    expect(sniffImage(enc("hello world"))).toBeNull();
  });

  it("accepts PNG, JPG/JPEG and SVG", () => {
    expect(validateLogoFile({ name: "logo.png", size: PNG.length }, PNG)).toEqual({ ok: true, kind: "png" });
    expect(validateLogoFile({ name: "LOGO.JPG", size: 6 }, JPEG)).toEqual({ ok: true, kind: "jpeg" });
    expect(validateLogoFile({ name: "photo.jpeg", size: 6 }, JPEG)).toEqual({ ok: true, kind: "jpeg" });
    expect(validateLogoFile({ name: "mark.svg", size: 40 }, enc("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toEqual({ ok: true, kind: "svg" });
  });

  it.each([
    ["too large", { name: "big.png", size: LOGO_MAX_BYTES + 1 }, PNG, /5 MB/],
    ["empty", { name: "a.png", size: 0 }, PNG, /empty/],
    ["wrong extension", { name: "doc.pdf", size: 10 }, enc("%PDF-1.4"), /Unsupported/],
    ["text renamed to png", { name: "fake.png", size: 11 }, enc("hello world"), /isn't a valid image/],
    ["jpeg named png", { name: "x.png", size: 6 }, JPEG, /contains JPEG/],
    ["gif", { name: "a.gif", size: 10 }, enc("GIF89a...."), /Unsupported|GIF/],
  ])("rejects %s", (_n, file, bytes, msg) => {
    const r = validateLogoFile(file, bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });
});

describe("background removal", () => {
  function logoOnWhite(size = 40) {
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 10; y < 30; y++)
      for (let x = 10; x < 30; x++) {
        const i = (y * size + x) * 4;
        data[i] = 79;
        data[i + 1] = 70;
        data[i + 2] = 229;
      }
    return { width: size, height: size, data };
  }

  it("makes a white background transparent and keeps the artwork", () => {
    const r = removeBackground(logoOnWhite(), 12);
    const a = (x: number, y: number) => r.image.data[(y * 40 + x) * 4 + 3];
    expect(a(0, 0)).toBe(0);
    expect(a(39, 39)).toBe(0);
    expect(a(20, 20)).toBe(255);
    expect(r.removedRatio).toBeCloseTo(0.75, 1);
    expect(r.backgroundColor).toEqual([255, 255, 255]);
  });

  it("does not remove enclosed white areas (only border-connected background)", () => {
    const img = logoOnWhite();
    for (let y = 18; y < 22; y++) for (let x = 18; x < 22; x++) img.data.fill(255, (y * 40 + x) * 4, (y * 40 + x) * 4 + 4);
    const r = removeBackground(img, 12);
    expect(r.image.data[(20 * 40 + 20) * 4 + 3]).toBe(255);
  });

  it("tolerance 0 removes only exact matches", () => {
    const img = logoOnWhite();
    img.data[0] = 250; // near-white corner pixel
    const r = removeBackground(img, 0);
    expect(r.image.data[3]).toBe(255);
  });
});

describe("SVG sanitising", () => {
  const purify = DOMPurify(window as unknown as Window & typeof globalThis);

  it("strips scripts, handlers, foreignObject and external references", () => {
    const evil = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">
      <script>alert(1)</script>
      <foreignObject><iframe src="https://evil.example"></iframe></foreignObject>
      <image href="https://evil.example/track.png" width="10" height="10"/>
      <use xlink:href="https://evil.example/s.svg#x"/>
      <rect width="10" height="10" fill="red" onclick="steal()" style="fill:url(https://evil.example/x)"/>
      <a href="javascript:alert(1)"><circle r="2"/></a>
    </svg>`;
    const r = sanitizeSvg(evil, purify);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.svg).not.toMatch(/script|onload|onclick|foreignObject|iframe|evil\.example|javascript:/i);
    expect(r.svg).toMatch(/<rect/);
    expect(r).toMatchObject({ width: 10, height: 10 });
  });

  it("derives a size from viewBox and rejects size-less SVGs", () => {
    const ok = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="1" height="1"/></svg>`, purify);
    expect(ok).toMatchObject({ ok: true, width: 200, height: 100 });
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`, purify).ok).toBe(false);
    expect(sanitizeSvg(`<html><body>hi</body></html>`, purify).ok).toBe(false);
  });

  it("all gallery logos survive sanitising unchanged in size", () => {
    for (const g of GALLERY_LOGOS) expect(sanitizeSvg(g.svg, purify)).toMatchObject({ ok: true, width: 96, height: 96 });
  });
});

describe("image helpers", () => {
  it("downscale keeps aspect and alpha-weights colours", () => {
    const img = { width: 4, height: 2, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0]) };
    const out = downscale(img, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect(out.data[0]).toBe(255); // red not darkened by transparent black
    expect(out.data[3]).toBeCloseTo(128, -1);
  });
  it("splitAlpha applies opacity and matte", () => {
    const img = { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) };
    const r = splitAlpha(img, { opacity: 0.5, matte: [255, 255, 255] });
    expect(r.alpha[0]).toBe(128);
    expect(r.rgb[0]).toBe(128);
    expect(r.hasAlpha).toBe(true);
  });
});
