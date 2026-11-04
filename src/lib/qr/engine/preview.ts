import { PathBuilder } from "./path";
import { drawBodyModule, drawEyeBall, drawEyeFrame } from "./shapes";
import { commandsToSvgPath } from "../export/svg";
import type { BodyShape, EyeBallShape, EyeFrameShape } from "./types";

/** Small SVGs for shape picker tiles, drawn with the same geometry the engine uses. */

const SAMPLE = [
  "11011",
  "10111",
  "11100",
  "01101",
  "11011",
];

function svg(d: string, size: number, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 ${size + 1} ${size + 1}"><path fill="${color}" d="${d}"/></svg>`;
}

export function bodyShapePreview(shape: BodyShape, color = "#0f172a"): string {
  const dark = (x: number, y: number) => SAMPLE[y]?.[x] === "1";
  const p = new PathBuilder();
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (!dark(x, y)) continue;
      drawBodyModule(p, shape, x, y, { n: dark(x, y - 1), e: dark(x + 1, y), s: dark(x, y + 1), w: dark(x - 1, y) });
    }
  }
  return svg(commandsToSvgPath(p.commands), 5, color);
}

export function eyeFramePreview(shape: EyeFrameShape, color = "#0f172a"): string {
  const p = new PathBuilder();
  drawEyeFrame(p, shape);
  return svg(commandsToSvgPath(p.commands), 7, color);
}

export function eyeBallPreview(shape: EyeBallShape, color = "#0f172a"): string {
  const p = new PathBuilder();
  drawEyeBall(p, shape);
  // Show the ball inside a faint square frame so its scale is clear.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 8 8"><path fill="none" stroke="#cbd5e1" stroke-width="1" d="M0.5 0.5h6v6h-6z"/><path fill="${color}" transform="translate(2 2)" d="${commandsToSvgPath(p.commands)}"/></svg>`;
}

export function svgDataUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}
