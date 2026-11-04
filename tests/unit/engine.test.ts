import { describe, expect, it } from "vitest";
import { createMatrix, MatrixError, BYTE_CAPACITY } from "@/lib/qr/engine/matrix";
import { buildScene, layoutLogo } from "@/lib/qr/engine/scene";
import { cloneDesign, designSchema, DEFAULT_DESIGN, resolveEc } from "@/lib/qr/engine/design";
import { contrastRatio, normalizeHex } from "@/lib/qr/engine/color";
import { analyzeDesign } from "@/lib/qr/verify/heuristics";
import { makeLogo } from "../helpers/render";

describe("matrix", () => {
  it("size follows version (17 + 4v)", () => {
    for (const v of [1, 5, 10, 25, 40]) {
      const m = createMatrix("A", { ec: "M", version: v });
      expect(m.version).toBe(v);
      expect(m.size).toBe(17 + 4 * v);
    }
  });

  it("auto version grows with data and EC", () => {
    const text = "x".repeat(100);
    const l = createMatrix(text, { ec: "L" }).version;
    const h = createMatrix(text, { ec: "H" }).version;
    expect(h).toBeGreaterThan(l);
  });

  it("encodes the exact byte capacity limit and rejects one byte more", () => {
    const max = BYTE_CAPACITY.H[40]!;
    expect(createMatrix("é".repeat(max / 2).slice(0, Math.floor(max / 2)), { ec: "H" }).version).toBeLessThanOrEqual(40);
    expect(() => createMatrix("ÿ".repeat(max), { ec: "H" })).toThrow(MatrixError);
  });

  it("reports empty, too-long and version-too-small errors", () => {
    expect(() => createMatrix("", { ec: "M" })).toThrow(/no content/);
    try {
      createMatrix("x".repeat(100), { ec: "M", version: 1 });
      throw new Error("should fail");
    } catch (e) {
      expect(e).toBeInstanceOf(MatrixError);
      expect((e as MatrixError).code).toBe("version-too-small");
    }
  });
});

describe("design", () => {
  it("default design satisfies the schema", () => {
    expect(designSchema.safeParse(DEFAULT_DESIGN).success).toBe(true);
  });
  it("auto EC = H with a logo, M without", () => {
    expect(resolveEc("auto", true)).toBe("H");
    expect(resolveEc("auto", false)).toBe("M");
    expect(resolveEc("Q", true)).toBe("Q");
  });
  it("colour helpers", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});

describe("scene", () => {
  it("quiet zone is applied around the symbol", () => {
    const d = cloneDesign();
    d.margin = 0;
    const s0 = buildScene({ text: "hi", design: d });
    d.margin = 7;
    const s7 = buildScene({ text: "hi", design: d });
    expect(s0.size).toBe(s0.moduleCount);
    expect(s7.size).toBe(s7.moduleCount + 14);
  });

  it("has a body layer plus frame and ball layers for 3 eyes", () => {
    const s = buildScene({ text: "hello", design: DEFAULT_DESIGN });
    expect(s.layers.map((l) => l.id)).toEqual(["body", "eye-frame-0", "eye-ball-0", "eye-frame-1", "eye-ball-1", "eye-frame-2", "eye-ball-2"]);
  });

  it("gradient paints span the symbol and eye colours override", () => {
    const d = cloneDesign();
    d.foreground = { mode: "linear", color1: "#111111", color2: "#333399", angle: 0 };
    d.eyes = { mode: "custom", frame: "#aa0000", ball: "#00aa00", perEye: null };
    const s = buildScene({ text: "hello", design: d });
    const body = s.layers[0]!.paint;
    expect(body.kind).toBe("linear");
    if (body.kind === "linear") {
      expect(body.x1).toBeCloseTo(s.margin);
      expect(body.x2).toBeCloseTo(s.margin + s.moduleCount);
    }
    expect(s.layers[1]!.paint).toEqual({ kind: "solid", color: "#aa0000" });
    expect(s.layers[2]!.paint).toEqual({ kind: "solid", color: "#00aa00" });
  });

  it("transparent background yields null background", () => {
    const d = cloneDesign();
    d.background.transparent = true;
    expect(buildScene({ text: "x", design: d }).background).toBeNull();
  });

  it("logo is clamped away from finder patterns", () => {
    const n = 33;
    const layout = layoutLogo(n, { ...DEFAULT_DESIGN.logo, size: 0.2, offsetX: -40, offsetY: -40 }, { width: 1, height: 1 });
    const r = layout.clear;
    const overlapsTopLeft = r.x < 8 && r.y < 8;
    expect(overlapsTopLeft).toBe(false);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it("clear-behind removes body modules and records the obscured share", () => {
    const logo = makeLogo(64);
    const d = cloneDesign();
    d.logo.size = 0.25;
    const without = buildScene({ text: "https://example.com/abc", design: d });
    const withLogo = buildScene({ text: "https://example.com/abc", design: d, logo });
    expect(withLogo.ec).toBe("H");
    expect(withLogo.stats.obscuredModules).toBeGreaterThan(0);
    expect(withLogo.layers[0]!.commands.length).toBeLessThan(without.layers[0]!.commands.length + 1000);
    expect(withLogo.logo?.clearedBackdrop).toBe(true);
  });
});

describe("heuristics", () => {
  it("flags inverted and low-contrast designs", () => {
    const d = cloneDesign();
    d.foreground.color1 = "#ffffff";
    d.background.color = "#000000";
    expect(analyzeDesign(d, null, false).map((i) => i.code)).toContain("inverted");
    const e = cloneDesign();
    e.foreground.color1 = "#bbbbbb";
    expect(analyzeDesign(e, null, false).find((i) => i.code === "low-contrast")?.level).toBe("error");
  });
  it("flags light eye colours and tiny quiet zones", () => {
    const d = cloneDesign();
    d.eyes = { mode: "custom", frame: "#eeeeee", ball: "#000000", perEye: null };
    d.margin = 1;
    const codes = analyzeDesign(d, null, false).map((i) => i.code);
    expect(codes).toContain("eye-contrast");
    expect(codes).toContain("small-margin");
  });
  it("default design has no issues", () => {
    expect(analyzeDesign(DEFAULT_DESIGN, null, false)).toEqual([]);
  });
  it("logo over budget is an error", () => {
    const d = cloneDesign();
    d.ec = "L";
    d.logo.size = 0.3;
    const logo = makeLogo(64);
    const scene = buildScene({ text: "https://example.com", design: d, logo });
    expect(analyzeDesign(d, scene, true).map((i) => i.code)).toContain("logo-over-budget");
  });
});
