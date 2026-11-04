/** Shared types of the QR engine. The engine has no DOM or React dependency. */

export type EcLevel = "L" | "M" | "Q" | "H";
export type EcSetting = EcLevel | "auto";

export const EC_LEVELS: readonly EcLevel[] = ["L", "M", "Q", "H"] as const;

/** Approximate share of codewords each level can restore (ISO/IEC 18004). */
export const EC_RECOVERY: Record<EcLevel, number> = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

export type BodyShape =
  | "square"
  | "rounded"
  | "dots"
  | "soft"
  | "small-squares"
  | "diamond"
  | "classy"
  | "vertical"
  | "horizontal"
  | "cross";

export type EyeFrameShape = "square" | "rounded" | "extra-rounded" | "circle" | "leaf" | "dotted" | "cut";
export type EyeBallShape = "square" | "rounded" | "circle" | "leaf" | "diamond" | "dots" | "cut";

export type FillMode = "solid" | "linear" | "radial";

export interface ForegroundDesign {
  mode: FillMode;
  /** Primary colour (#rrggbb). Used alone for solid fills, as the first stop for gradients. */
  color1: string;
  /** Second gradient stop (#rrggbb). */
  color2: string;
  /** Linear gradient angle in degrees (0 = left→right, 90 = top→bottom). */
  angle: number;
}

export interface EyeColor {
  frame: string;
  ball: string;
}

export interface EyeDesign {
  /** "inherit" = eyes use the foreground fill (including its gradient). */
  mode: "inherit" | "custom";
  frame: string;
  ball: string;
  /** Optional per-eye overrides, order: top-left, top-right, bottom-left. */
  perEye: [EyeColor, EyeColor, EyeColor] | null;
}

export interface BackgroundDesign {
  transparent: boolean;
  color: string;
}

export type LogoClearShape = "square" | "rounded" | "circle";

export interface LogoDesign {
  /** Logo width as a fraction of the symbol width (excluding quiet zone). */
  size: number;
  /** Centre offset in modules, relative to the symbol centre. Clamped away from finder patterns. */
  offsetX: number;
  offsetY: number;
  /** Remove modules behind the logo instead of drawing the logo on top of them. */
  clearBehind: boolean;
  /** Extra space around the logo, in modules, when clearing modules. */
  padding: number;
  clearShape: LogoClearShape;
  /** 0..1 */
  opacity: number;
}

export interface Design {
  ec: EcSetting;
  /** "auto" picks the smallest version that fits; a number forces a minimum version. */
  version: "auto" | number;
  /** Quiet zone in modules (0–10, spec recommends 4). */
  margin: number;
  bodyShape: BodyShape;
  eyeFrameShape: EyeFrameShape;
  eyeBallShape: EyeBallShape;
  foreground: ForegroundDesign;
  eyes: EyeDesign;
  background: BackgroundDesign;
  logo: LogoDesign;
}

/** A processed raster logo, ready for every serialiser. */
export interface LogoAsset {
  /** PNG data URI (used by SVG/PNG output). */
  dataUrl: string;
  /** Pixel size of `rgba`. */
  width: number;
  height: number;
  /** Straight (non-premultiplied) RGBA pixels, used by the PDF/EPS writers. */
  rgba: Uint8Array | Uint8ClampedArray;
  /** Human-readable origin, e.g. a file name or gallery id. */
  name: string;
}

export interface Stop {
  offset: number;
  color: string;
}

export type Paint =
  | { kind: "solid"; color: string }
  | { kind: "linear"; x1: number; y1: number; x2: number; y2: number; stops: Stop[] }
  | { kind: "radial"; cx: number; cy: number; r: number; stops: Stop[] };

export type PathCommand =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Z" };

export interface SceneLayer {
  id: string;
  commands: PathCommand[];
  paint: Paint;
}

export interface SceneLogo {
  asset: LogoAsset;
  /** Box in module units (quiet zone included); the image is fitted inside, aspect preserved. */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  /** True when the modules behind the logo were removed (logo sits on the background). */
  clearedBackdrop: boolean;
}

export interface SceneStats {
  /** Symbol modules hidden by the logo or cleared for it. */
  obscuredModules: number;
  /** obscuredModules / all symbol modules. */
  obscuredRatio: number;
  /** Conservative budget for the EC level, same unit as obscuredRatio. */
  logoBudget: number;
}

export interface Scene {
  /** Total width/height in module units including the quiet zone. */
  size: number;
  margin: number;
  moduleCount: number;
  version: number;
  ec: EcLevel;
  mask: number;
  /** Solid background colour, or null for transparent. */
  background: string | null;
  layers: SceneLayer[];
  logo: SceneLogo | null;
  stats: SceneStats;
}
