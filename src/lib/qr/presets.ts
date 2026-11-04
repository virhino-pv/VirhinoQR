import { cloneDesign } from "./engine/design";
import type { Design } from "./engine/types";

/**
 * Showcase styles used on the homepage to demonstrate the engine. These are rendered live by the
 * engine (not images). User-saved templates are a later milestone (M7) and are not part of this.
 */
function style(name: string, mutate: (d: Design) => void): { name: string; design: Design } {
  const d = cloneDesign();
  mutate(d);
  return { name, design: d };
}

export const SHOWCASE_STYLES = [
  style("Classic", () => {}),
  style("Indigo flow", (d) => {
    d.bodyShape = "rounded";
    d.eyeFrameShape = "extra-rounded";
    d.eyeBallShape = "rounded";
    d.foreground = { mode: "linear", color1: "#1e1b4b", color2: "#4f46e5", angle: 45 };
  }),
  style("Dots", (d) => {
    d.bodyShape = "dots";
    d.eyeFrameShape = "circle";
    d.eyeBallShape = "circle";
    d.foreground = { mode: "solid", color1: "#0f766e", color2: "#0f766e", angle: 0 };
  }),
  style("Sunset", (d) => {
    d.bodyShape = "soft";
    d.eyeFrameShape = "leaf";
    d.eyeBallShape = "leaf";
    d.foreground = { mode: "radial", color1: "#9a3412", color2: "#4c1d95", angle: 0 };
    d.background.color = "#fff7ed";
  }),
  style("Bars", (d) => {
    d.bodyShape = "vertical";
    d.eyeFrameShape = "rounded";
    d.eyeBallShape = "square";
    d.foreground = { mode: "solid", color1: "#111827", color2: "#111827", angle: 0 };
    d.eyes = { mode: "custom", frame: "#4f46e5", ball: "#b45309", perEye: null };
  }),
  style("Classy", (d) => {
    d.bodyShape = "classy";
    d.eyeFrameShape = "cut";
    d.eyeBallShape = "diamond";
    d.foreground = { mode: "linear", color1: "#14532d", color2: "#166534", angle: 90 };
  }),
] as const;

export const HERO_DESIGN: Design = SHOWCASE_STYLES[1].design;
