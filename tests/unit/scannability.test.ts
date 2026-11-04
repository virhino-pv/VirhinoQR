import { describe, expect, it } from "vitest";
import { buildScene } from "@/lib/qr/engine/scene";
import { cloneDesign, LOGO_BUDGET } from "@/lib/qr/engine/design";
import { BODY_SHAPES, EYE_BALL_SHAPES, EYE_FRAME_SHAPES } from "@/lib/qr/engine/shapes";
import { EC_LEVELS, type Design } from "@/lib/qr/engine/types";
import { CONTENT_TYPES, buildPayload } from "@/lib/payloads";
import { decodeScene, makeLogo } from "../helpers/render";
import { SHOWCASE_STYLES } from "@/lib/qr/presets";

/**
 * Real decode tests: scene → SVG → resvg raster → ZXing-C++ decode → byte-identical text.
 * The full shape cross-product (10 × 7 × 7) was run during calibration; CI runs each shape against
 * defaults plus a diagonal sample to keep the suite fast.
 */

const TEXT = "https://qr-studio.example/p/12345?ref=scan";

async function expectScans(text: string, mutate: (d: Design) => void, px = 400, logo = false) {
  const d = cloneDesign();
  mutate(d);
  const scene = buildScene({ text, design: d, logo: logo ? makeLogo(128) : null });
  expect(await decodeScene(scene, px)).toEqual([text]);
}

describe("every shape scans", () => {
  // Several payloads per shape: finder detection depends on the surrounding modules.
  const SAMPLES = ["hi", TEXT, "x".repeat(120), "WIFI:T:WPA;S:Cafe;P:12345678;;"];
  const each = async (mutate: (d: Design) => void) => {
    for (const t of SAMPLES) await expectScans(t, mutate);
  };
  it.each(BODY_SHAPES.map((s) => s.id))("body %s", (id) => each((d) => (d.bodyShape = id)));
  it.each(EYE_FRAME_SHAPES.map((s) => s.id))("eye frame %s", (id) => each((d) => (d.eyeFrameShape = id)));
  it.each(EYE_BALL_SHAPES.map((s) => s.id))("eye ball %s", (id) => each((d) => (d.eyeBallShape = id)));
  it("diagonal combinations", async () => {
    for (let i = 0; i < BODY_SHAPES.length; i++) {
      await expectScans(TEXT, (d) => {
        d.bodyShape = BODY_SHAPES[i]!.id;
        d.eyeFrameShape = EYE_FRAME_SHAPES[i % EYE_FRAME_SHAPES.length]!.id;
        d.eyeBallShape = EYE_BALL_SHAPES[(i * 3) % EYE_BALL_SHAPES.length]!.id;
      });
    }
  });
});

describe("error correction × version", () => {
  it.each(EC_LEVELS)("EC %s at versions 1, 5, 10, 25, 40", async (ec) => {
    for (const version of [1, 5, 10, 25, 40]) {
      await expectScans("QR", (d) => {
        d.ec = ec;
        d.version = version;
      }, Math.max(400, (17 + 4 * version + 8) * 4));
    }
  });
});

describe("Unicode payloads decode byte-identically", () => {
  it.each([
    ["Tamil", "தமிழ் மொழி — வணக்கம்!"],
    ["Japanese", "日本語のテキスト"],
    ["Emoji", "Pizza 🍕 & coffee ☕"],
    ["Hindi", "नमस्ते दुनिया"],
  ])("%s", (_name, text) => expectScans(text, () => {}));
});

describe("colours, gradients, background", () => {
  it.each([
    ["linear 45°", (d: Design) => (d.foreground = { mode: "linear", color1: "#1e1b4b", color2: "#4f46e5", angle: 45 })],
    ["linear 0°", (d: Design) => (d.foreground = { mode: "linear", color1: "#000000", color2: "#7c2d12", angle: 0 })],
    ["radial", (d: Design) => (d.foreground = { mode: "radial", color1: "#4f46e5", color2: "#111827", angle: 0 })],
    ["custom eyes", (d: Design) => (d.eyes = { mode: "custom", frame: "#b91c1c", ball: "#1d4ed8", perEye: null })],
    [
      "per-eye colours",
      (d: Design) =>
        (d.eyes = {
          mode: "custom",
          frame: "#000000",
          ball: "#000000",
          perEye: [
            { frame: "#7c2d12", ball: "#1e3a8a" },
            { frame: "#14532d", ball: "#581c87" },
            { frame: "#831843", ball: "#0f172a" },
          ],
        }),
    ],
    ["coloured background", (d: Design) => (d.background.color = "#fef3c7")],
    ["transparent background", (d: Design) => (d.background.transparent = true)],
  ])("%s", (_n, mutate) => expectScans(TEXT, mutate));

  it("margins 0, 2 and 10 decode", async () => {
    for (const margin of [0, 2, 10]) await expectScans(TEXT, (d) => (d.margin = margin));
  });
});

describe("logos within the budget decode at every EC level", () => {
  it.each(EC_LEVELS)("EC %s", async (ec) => {
    const logo = makeLogo(128);
    for (const clearBehind of [true, false]) {
      for (const size of [0.1, 0.15, 0.2, 0.25, 0.3]) {
        const d = cloneDesign();
        d.ec = ec;
        d.logo.size = size;
        d.logo.clearBehind = clearBehind;
        const scene = buildScene({ text: TEXT, design: d, logo });
        if (scene.stats.obscuredRatio > LOGO_BUDGET[ec]) continue; // the UI blocks/warns for these
        expect(await decodeScene(scene, 500), `EC ${ec} size ${size} clear ${clearBehind}`).toEqual([TEXT]);
      }
    }
  });

  it("logo offset and circle cut-out still decode", () =>
    expectScans(TEXT, (d) => {
      d.ec = "H";
      d.logo.size = 0.2;
      d.logo.offsetX = 4;
      d.logo.offsetY = -3;
      d.logo.clearShape = "circle";
    }, 500, true));
});

describe("all 22 content-type samples render to scannable codes", () => {
  it.each(CONTENT_TYPES.map((t) => [t.id, t] as const))("%s", async (_id, type) => {
    const r = buildPayload(type, type.sample);
    if (r.status !== "ok") throw new Error("sample invalid");
    await expectScans(r.payload, () => {}, 500);
  });
});

describe("homepage showcase styles scan", () => {
  it.each(SHOWCASE_STYLES.map((s) => [s.name, s.design] as const))("%s", async (_name, design) => {
    const scene = buildScene({ text: "https://qr-studio.example/welcome", design });
    expect(await decodeScene(scene, 400)).toEqual(["https://qr-studio.example/welcome"]);
  });
});
