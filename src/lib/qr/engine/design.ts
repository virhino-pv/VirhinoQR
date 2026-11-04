import { z } from "zod";
import { isHexColor } from "./color";
import type { Design, EcLevel, EcSetting } from "./types";

const hex = z.string().refine(isHexColor, "Use a hex colour such as #1e1b4b.");

export const LOGO_SIZE_MIN = 0.05;
export const LOGO_SIZE_MAX = 0.3;
export const MARGIN_MAX = 10;

export const designSchema = z.object({
  ec: z.enum(["auto", "L", "M", "Q", "H"]),
  version: z.union([z.literal("auto"), z.number().int().min(1).max(40)]),
  margin: z.number().int().min(0).max(MARGIN_MAX),
  bodyShape: z.enum([
    "square",
    "rounded",
    "dots",
    "soft",
    "small-squares",
    "diamond",
    "classy",
    "vertical",
    "horizontal",
    "cross",
  ]),
  eyeFrameShape: z.enum(["square", "rounded", "extra-rounded", "circle", "leaf", "dotted", "cut"]),
  eyeBallShape: z.enum(["square", "rounded", "circle", "leaf", "diamond", "dots", "cut"]),
  foreground: z.object({
    mode: z.enum(["solid", "linear", "radial"]),
    color1: hex,
    color2: hex,
    angle: z.number().min(0).max(360),
  }),
  eyes: z.object({
    mode: z.enum(["inherit", "custom"]),
    frame: hex,
    ball: hex,
    perEye: z
      .tuple([
        z.object({ frame: hex, ball: hex }),
        z.object({ frame: hex, ball: hex }),
        z.object({ frame: hex, ball: hex }),
      ])
      .nullable(),
  }),
  background: z.object({ transparent: z.boolean(), color: hex }),
  logo: z.object({
    size: z.number().min(LOGO_SIZE_MIN).max(LOGO_SIZE_MAX),
    offsetX: z.number().min(-40).max(40),
    offsetY: z.number().min(-40).max(40),
    clearBehind: z.boolean(),
    padding: z.number().min(0).max(4),
    clearShape: z.enum(["square", "rounded", "circle"]),
    opacity: z.number().min(0.1).max(1),
  }),
}) satisfies z.ZodType<Design>;

export const DEFAULT_DESIGN: Design = {
  ec: "auto",
  version: "auto",
  margin: 4,
  bodyShape: "square",
  eyeFrameShape: "square",
  eyeBallShape: "square",
  foreground: { mode: "solid", color1: "#111827", color2: "#4f46e5", angle: 45 },
  eyes: { mode: "inherit", frame: "#111827", ball: "#111827", perEye: null },
  background: { transparent: false, color: "#ffffff" },
  logo: { size: 0.2, offsetX: 0, offsetY: 0, clearBehind: true, padding: 0.5, clearShape: "rounded", opacity: 1 },
};

export function cloneDesign(design: Design = DEFAULT_DESIGN): Design {
  return structuredClone(design);
}

/** Auto picks H when a logo is present (maximum redundancy), otherwise M. */
export function resolveEc(ec: EcSetting, hasLogo: boolean): EcLevel {
  if (ec !== "auto") return ec;
  return hasLogo ? "H" : "M";
}

/**
 * Share of the symbol area a logo may obscure per EC level. Deliberately below the theoretical
 * recovery (7/15/25/30 %) because a covered area damages more codewords than its module count
 * suggests; calibrated by the decode matrix in tests/unit/scannability.test.ts.
 */
export const LOGO_BUDGET: Record<EcLevel, number> = { L: 0.03, M: 0.07, Q: 0.11, H: 0.15 };
