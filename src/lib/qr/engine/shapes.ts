import { PathBuilder } from "./path";
import type { BodyShape, EyeBallShape, EyeFrameShape } from "./types";

/** Neighbour flags of a dark module (true = neighbouring module is also a dark body module). */
export interface Neighbours {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

export interface ShapeOption<T extends string> {
  id: T;
  label: string;
}

export const BODY_SHAPES: readonly ShapeOption<BodyShape>[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
  { id: "soft", label: "Soft tiles" },
  { id: "small-squares", label: "Small squares" },
  { id: "diamond", label: "Diamond" },
  { id: "classy", label: "Classy" },
  { id: "vertical", label: "Vertical bars" },
  { id: "horizontal", label: "Horizontal bars" },
  { id: "cross", label: "Cross" },
];

export const EYE_FRAME_SHAPES: readonly ShapeOption<EyeFrameShape>[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "extra-rounded", label: "Extra rounded" },
  { id: "circle", label: "Circle" },
  { id: "leaf", label: "Leaf" },
  { id: "dotted", label: "Dotted" },
  { id: "cut", label: "Cut corners" },
];

export const EYE_BALL_SHAPES: readonly ShapeOption<EyeBallShape>[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
  { id: "leaf", label: "Leaf" },
  { id: "diamond", label: "Diamond" },
  { id: "dots", label: "Dots" },
  { id: "cut", label: "Cut corners" },
];

/**
 * Draws one dark body module at (x, y) in module units. Shapes never overlap neighbouring
 * modules, so the whole body can be filled as a single nonzero path.
 */
export function drawBodyModule(p: PathBuilder, shape: BodyShape, x: number, y: number, nb: Neighbours) {
  switch (shape) {
    case "square":
      p.rect(x, y, 1, 1);
      return;
    case "dots":
      p.circle(x + 0.5, y + 0.5, 0.46);
      return;
    case "soft":
      p.roundedRect(x + 0.04, y + 0.04, 0.92, 0.92, 0.28);
      return;
    case "small-squares":
      p.rect(x + 0.12, y + 0.12, 0.76, 0.76);
      return;
    case "diamond":
      p.polygon([
        [x + 0.5, y - 0.02],
        [x + 1.02, y + 0.5],
        [x + 0.5, y + 1.02],
        [x - 0.02, y + 0.5],
      ]);
      return;
    case "rounded": {
      // Corners are rounded only where both touching sides are free, so runs stay joined.
      const r = 0.5;
      p.roundedRect(x, y, 1, 1, [
        !nb.n && !nb.w ? r : 0,
        !nb.n && !nb.e ? r : 0,
        !nb.s && !nb.e ? r : 0,
        !nb.s && !nb.w ? r : 0,
      ]);
      return;
    }
    case "classy": {
      const r = 0.5;
      p.roundedRect(x, y, 1, 1, [!nb.n && !nb.w ? r : 0, 0, !nb.s && !nb.e ? r : 0, 0]);
      return;
    }
    case "vertical": {
      const r = 0.38;
      p.roundedRect(x + 0.12, y, 0.76, 1, [nb.n ? 0 : r, nb.n ? 0 : r, nb.s ? 0 : r, nb.s ? 0 : r]);
      return;
    }
    case "horizontal": {
      const r = 0.38;
      p.roundedRect(x, y + 0.12, 1, 0.76, [nb.w ? 0 : r, nb.e ? 0 : r, nb.e ? 0 : r, nb.w ? 0 : r]);
      return;
    }
    case "cross": {
      const a = 0.27;
      const b = 0.73;
      p.polygon([
        [x + a, y],
        [x + b, y],
        [x + b, y + a],
        [x + 1, y + a],
        [x + 1, y + b],
        [x + b, y + b],
        [x + b, y + 1],
        [x + a, y + 1],
        [x + a, y + b],
        [x, y + b],
        [x, y + a],
        [x + a, y + a],
      ]);
      return;
    }
  }
}

/**
 * Eye frame (7×7 ring) in local unit space, origin at the eye's top-left corner, drawn as the
 * canonical top-left eye. The caller mirrors it for the other corners.
 */
export function drawEyeFrame(p: PathBuilder, shape: EyeFrameShape) {
  switch (shape) {
    case "square":
      p.rect(0, 0, 7, 7);
      p.rect(1, 1, 5, 5, true);
      return;
    case "rounded":
      p.roundedRect(0, 0, 7, 7, 1.9);
      p.roundedRect(1, 1, 5, 5, 1.1, true);
      return;
    case "extra-rounded":
      p.roundedRect(0, 0, 7, 7, 3);
      p.roundedRect(1, 1, 5, 5, 2.2, true);
      return;
    case "circle":
      // Ring slightly thinner than one module: calibrated so the 1:1:3:1:1 finder ratio survives on all sample payloads.
      p.circle(3.5, 3.5, 3.5);
      p.circle(3.5, 3.5, 2.62, true);
      return;
    case "leaf":
      p.roundedRect(0, 0, 7, 7, [2.4, 0.5, 2.4, 0.5]);
      p.roundedRect(1, 1, 5, 5, [1.4, 0.15, 1.4, 0.15], true);
      return;
    case "cut": {
      const c = 1.8;
      p.polygon([
        [c, 0],
        [7 - c, 0],
        [7, c],
        [7, 7 - c],
        [7 - c, 7],
        [c, 7],
        [0, 7 - c],
        [0, c],
      ]);
      const i = 1.1;
      p.polygon(
        [
          [1 + i, 1],
          [6 - i, 1],
          [6, 1 + i],
          [6, 6 - i],
          [6 - i, 6],
          [1 + i, 6],
          [1, 6 - i],
          [1, 1 + i],
        ],
        true,
      );
      return;
    }
    case "dotted":
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          if (i === 0 || j === 0 || i === 6 || j === 6) p.circle(i + 0.5, j + 0.5, 0.5);
        }
      }
      return;
  }
}

/** Eye ball (3×3) in local unit space, origin at the ball's top-left corner (canonical top-left eye). */
export function drawEyeBall(p: PathBuilder, shape: EyeBallShape) {
  switch (shape) {
    case "square":
      p.rect(0, 0, 3, 3);
      return;
    case "rounded":
      p.roundedRect(0, 0, 3, 3, 0.85);
      return;
    case "circle":
      p.circle(1.5, 1.5, 1.5);
      return;
    case "leaf":
      p.roundedRect(0, 0, 3, 3, [1.5, 0.3, 1.5, 0.3]);
      return;
    case "diamond":
      p.polygon([
        [1.5, -0.45],
        [3.45, 1.5],
        [1.5, 3.45],
        [-0.45, 1.5],
      ]);
      return;
    case "dots":
      // Dots around a solid core: scanners need the 3×3 centre to read as one solid block.
      p.roundedRect(0.35, 0.35, 2.3, 2.3, 0.3);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) p.circle(i + 0.5, j + 0.5, 0.58);
      return;
    case "cut": {
      const c = 0.8;
      p.polygon([
        [c, 0],
        [3 - c, 0],
        [3, c],
        [3, 3 - c],
        [3 - c, 3],
        [c, 3],
        [0, 3 - c],
        [0, c],
      ]);
      return;
    }
  }
}
