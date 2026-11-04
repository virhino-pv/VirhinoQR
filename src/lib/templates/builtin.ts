import { cloneDesign } from "../qr/engine/design";
import type { Design } from "../qr/engine/types";

/**
 * Built-in design templates. Original QR Studio designs, rendered live by the engine (no images).
 * Every template is decode-tested in tests/unit/templates.test.ts.
 */

export type TemplateCategory = "classic" | "brand" | "playful" | "print";

export interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  design: Design;
}

function t(id: string, name: string, category: TemplateCategory, description: string, mutate: (d: Design) => void): BuiltinTemplate {
  const design = cloneDesign();
  mutate(design);
  return { id, name, description, category, design };
}

export const TEMPLATE_CATEGORIES: ReadonlyArray<{ id: TemplateCategory; label: string }> = [
  { id: "classic", label: "Classic" },
  { id: "brand", label: "Brand" },
  { id: "playful", label: "Playful" },
  { id: "print", label: "Print" },
];

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  t("classic", "Classic", "classic", "Square modules, black on white. Maximum compatibility.", () => {}),
  t("indigo-flow", "Indigo flow", "brand", "Rounded modules with an indigo diagonal gradient.", (d) => {
    d.bodyShape = "rounded";
    d.eyeFrameShape = "extra-rounded";
    d.eyeBallShape = "rounded";
    d.foreground = { mode: "linear", color1: "#1e1b4b", color2: "#4f46e5", angle: 45 };
  }),
  t("teal-dots", "Teal dots", "playful", "Dotted body with circular eyes in deep teal.", (d) => {
    d.bodyShape = "dots";
    d.eyeFrameShape = "circle";
    d.eyeBallShape = "circle";
    d.foreground = { mode: "solid", color1: "#0f766e", color2: "#0f766e", angle: 0 };
  }),
  t("sunset", "Sunset", "brand", "Soft tiles, leaf eyes and a warm radial gradient on cream.", (d) => {
    d.bodyShape = "soft";
    d.eyeFrameShape = "leaf";
    d.eyeBallShape = "leaf";
    d.foreground = { mode: "radial", color1: "#9a3412", color2: "#4c1d95", angle: 0 };
    d.background.color = "#fff7ed";
  }),
  t("ink-bars", "Ink bars", "playful", "Vertical bars with indigo frames and amber eye balls.", (d) => {
    d.bodyShape = "vertical";
    d.eyeFrameShape = "rounded";
    d.eyeBallShape = "square";
    d.foreground = { mode: "solid", color1: "#111827", color2: "#111827", angle: 0 };
    d.eyes = { mode: "custom", frame: "#4f46e5", ball: "#b45309", perEye: null };
  }),
  t("evergreen", "Evergreen", "brand", "Classy modules, cut-corner eyes and a forest gradient.", (d) => {
    d.bodyShape = "classy";
    d.eyeFrameShape = "cut";
    d.eyeBallShape = "diamond";
    d.foreground = { mode: "linear", color1: "#14532d", color2: "#166534", angle: 90 };
  }),
  t("ocean", "Ocean", "brand", "Rounded modules fading from navy to ocean blue.", (d) => {
    d.bodyShape = "rounded";
    d.eyeFrameShape = "rounded";
    d.eyeBallShape = "circle";
    d.foreground = { mode: "linear", color1: "#0c4a6e", color2: "#1d4ed8", angle: 135 };
    d.background.color = "#f0f9ff";
  }),
  t("berry", "Berry", "playful", "Horizontal bars in berry tones with dotted eye frames.", (d) => {
    d.bodyShape = "horizontal";
    d.eyeFrameShape = "dotted";
    d.eyeBallShape = "rounded";
    d.foreground = { mode: "linear", color1: "#831843", color2: "#6b21a8", angle: 0 };
  }),
  t("mono-mint", "Mono mint", "classic", "Small square modules on a pale mint background.", (d) => {
    d.bodyShape = "small-squares";
    d.eyeFrameShape = "square";
    d.eyeBallShape = "square";
    d.foreground = { mode: "solid", color1: "#064e3b", color2: "#064e3b", angle: 0 };
    d.background.color = "#ecfdf5";
  }),
  t("ruby-eyes", "Ruby eyes", "brand", "Black body with each eye in a different jewel tone.", (d) => {
    d.bodyShape = "soft";
    d.eyeFrameShape = "extra-rounded";
    d.eyeBallShape = "circle";
    d.foreground = { mode: "solid", color1: "#0f172a", color2: "#0f172a", angle: 0 };
    d.eyes = {
      mode: "custom",
      frame: "#9f1239",
      ball: "#0f172a",
      perEye: [
        { frame: "#9f1239", ball: "#0f172a" },
        { frame: "#1e3a8a", ball: "#0f172a" },
        { frame: "#065f46", ball: "#0f172a" },
      ],
    };
  }),
  t("diamond-gold", "Diamond", "playful", "Diamond modules in dark bronze with matching eyes.", (d) => {
    d.bodyShape = "diamond";
    d.eyeFrameShape = "cut";
    d.eyeBallShape = "diamond";
    d.foreground = { mode: "solid", color1: "#713f12", color2: "#713f12", angle: 0 };
    d.background.color = "#fefce8";
  }),
  t("cross-stitch", "Cross stitch", "playful", "Cross-shaped modules with rounded eyes in plum.", (d) => {
    d.bodyShape = "cross";
    d.eyeFrameShape = "rounded";
    d.eyeBallShape = "rounded";
    d.foreground = { mode: "solid", color1: "#3b0764", color2: "#3b0764", angle: 0 };
  }),
  t("print-safe", "Print safe", "print", "High error correction and a wide quiet zone for packaging and signage.", (d) => {
    d.ec = "H";
    d.margin = 6;
  }),
  t("transparent-overlay", "Transparent overlay", "print", "Transparent background for placing on light artwork.", (d) => {
    d.bodyShape = "rounded";
    d.eyeFrameShape = "rounded";
    d.eyeBallShape = "rounded";
    d.ec = "Q";
    d.foreground = { mode: "solid", color1: "#111827", color2: "#111827", angle: 0 };
    d.background.transparent = true;
  }),
];

export function getBuiltinTemplate(id: string): BuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((tpl) => tpl.id === id);
}
