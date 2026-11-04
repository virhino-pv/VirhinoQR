import { LOGO_BUDGET, resolveEc } from "./design";
import { createMatrix, type QrMatrix } from "./matrix";
import { PathBuilder, transformCommands } from "./path";
import { drawBodyModule, drawEyeBall, drawEyeFrame } from "./shapes";
import type { Design, LogoAsset, Paint, PathCommand, Scene, SceneLayer, SceneLogo } from "./types";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Finder zones including their separators, in symbol coordinates (no quiet zone). */
function finderZones(n: number): Rect[] {
  return [
    { x: 0, y: 0, w: 8, h: 8 },
    { x: n - 8, y: 0, w: 8, h: 8 },
    { x: 0, y: n - 8, w: 8, h: 8 },
  ];
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function isInFinder(n: number, x: number, y: number): boolean {
  return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
}

interface LogoLayout {
  image: Rect;
  clear: Rect & { shape: Design["logo"]["clearShape"] };
}

/** Places the logo (symbol coordinates), clamped inside the symbol and away from the finder patterns. */
export function layoutLogo(n: number, design: Design["logo"], asset: Pick<LogoAsset, "width" | "height">): LogoLayout {
  const box = design.size * n;
  const aspect = asset.width / asset.height;
  const w = aspect >= 1 ? box : box * aspect;
  const h = aspect >= 1 ? box / aspect : box;
  const pad = design.padding;
  const cw = design.clearShape === "circle" ? Math.hypot(w, h) + pad * 2 : w + pad * 2;
  const ch = design.clearShape === "circle" ? cw : h + pad * 2;

  let cx = n / 2 + design.offsetX;
  let cy = n / 2 + design.offsetY;
  cx = Math.min(Math.max(cx, cw / 2), n - cw / 2);
  cy = Math.min(Math.max(cy, ch / 2), n - ch / 2);
  // Push the cleared region out of any finder zone along the axis needing the smaller move.
  for (const z of finderZones(n)) {
    const region = { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch };
    if (!intersects(region, z)) continue;
    const moveX = z.x === 0 ? z.x + z.w - region.x : z.x - (region.x + region.w);
    const moveY = z.y === 0 ? z.y + z.h - region.y : z.y - (region.y + region.h);
    if (Math.abs(moveX) <= Math.abs(moveY)) cx += moveX;
    else cy += moveY;
  }
  return {
    image: { x: cx - w / 2, y: cy - h / 2, w, h },
    clear: { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch, shape: design.clearShape },
  };
}

/** True when the unit module at (mx, my) overlaps the cleared region. */
function moduleTouchesRegion(mx: number, my: number, region: LogoLayout["clear"]): boolean {
  if (region.shape === "square") return intersects({ x: mx, y: my, w: 1, h: 1 }, region);
  // A rounded rectangle (or circle) is a "core" rectangle grown by radius r: the module overlaps it
  // when the distance between the module square and the core is below r.
  const r = region.shape === "circle" ? region.w / 2 : Math.min(region.w, region.h) / 4;
  const cx0 = region.x + r;
  const cy0 = region.y + r;
  const cx1 = region.x + region.w - r;
  const cy1 = region.y + region.h - r;
  const dx = Math.max(0, cx0 - (mx + 1), mx - cx1);
  const dy = Math.max(0, cy0 - (my + 1), my - cy1);
  return Math.hypot(dx, dy) < r;
}

function translate(commands: PathCommand[], dx: number, dy: number): PathCommand[] {
  return transformCommands(commands, (x, y) => [x + dx, y + dy]);
}

/** Builds foreground paint spanning the whole symbol (quiet zone excluded). */
export function foregroundPaint(design: Design, margin: number, n: number): Paint {
  const fg = design.foreground;
  const c = margin + n / 2;
  if (fg.mode === "solid") return { kind: "solid", color: fg.color1 };
  const stops = [
    { offset: 0, color: fg.color1 },
    { offset: 1, color: fg.color2 },
  ];
  if (fg.mode === "radial") return { kind: "radial", cx: c, cy: c, r: n / Math.SQRT2, stops };
  const a = (fg.angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const half = (n / 2) * (Math.abs(cos) + Math.abs(sin));
  return { kind: "linear", x1: c - cos * half, y1: c - sin * half, x2: c + cos * half, y2: c + sin * half, stops };
}

/** Mirrors local 7×7 eye coordinates so asymmetric shapes face the same way on every corner. */
const EYE_MIRRORS: ReadonlyArray<(u: number, v: number) => readonly [number, number]> = [
  (u, v) => [u, v],
  (u, v) => [7 - u, v],
  (u, v) => [u, 7 - v],
];

export interface BuildSceneInput {
  text: string;
  design: Design;
  logo?: LogoAsset | null;
}

/** Turns content + design into a resolution-independent vector scene (module units). */
export function buildScene({ text, design, logo = null }: BuildSceneInput): Scene {
  const ec = resolveEc(design.ec, Boolean(logo));
  const matrix = createMatrix(text, { ec, version: design.version === "auto" ? undefined : design.version });
  return buildSceneFromMatrix(matrix, design, logo);
}

export function buildSceneFromMatrix(matrix: QrMatrix, design: Design, logo: LogoAsset | null = null): Scene {
  const n = matrix.size;
  const m = design.margin;
  const layout = logo ? layoutLogo(n, design.logo, logo) : null;

  // Which modules are hidden by the logo (cleared, or covered by the overlay image).
  const obscured = new Uint8Array(n * n);
  let obscuredCount = 0;
  if (layout) {
    const region = design.logo.clearBehind
      ? layout.clear
      : { x: layout.image.x, y: layout.image.y, w: layout.image.w, h: layout.image.h, shape: "square" as const };
    const x0 = Math.max(0, Math.floor(region.x));
    const y0 = Math.max(0, Math.floor(region.y));
    const x1 = Math.min(n - 1, Math.ceil(region.x + region.w));
    const y1 = Math.min(n - 1, Math.ceil(region.y + region.h));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (isInFinder(n, x, y)) continue;
        if (moduleTouchesRegion(x, y, region)) {
          obscured[y * n + x] = 1;
          obscuredCount++;
        }
      }
    }
  }
  const cleared = design.logo.clearBehind && layout ? obscured : null;

  const isBody = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < n && y < n && matrix.isDark(x, y) && !isInFinder(n, x, y) && !(cleared && cleared[y * n + x]);

  const body = new PathBuilder();
  if (design.bodyShape === "square") {
    // Merge horizontal runs: fewer path segments and no hairline seams between modules.
    for (let y = 0; y < n; y++) {
      let x = 0;
      while (x < n) {
        if (!isBody(x, y)) {
          x++;
          continue;
        }
        const start = x;
        while (x < n && isBody(x, y)) x++;
        body.rect(start + m, y + m, x - start, 1);
      }
    }
  } else {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!isBody(x, y)) continue;
        drawBodyModule(body, design.bodyShape, x + m, y + m, {
          n: isBody(x, y - 1),
          e: isBody(x + 1, y),
          s: isBody(x, y + 1),
          w: isBody(x - 1, y),
        });
      }
    }
  }

  const fgPaint = foregroundPaint(design, m, n);
  const layers: SceneLayer[] = [{ id: "body", commands: body.commands, paint: fgPaint }];

  const origins: Array<[number, number]> = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  origins.forEach(([ox, oy], i) => {
    const mirror = EYE_MIRRORS[i]!;
    const frame = new PathBuilder();
    drawEyeFrame(frame, design.eyeFrameShape);
    const ball = new PathBuilder();
    drawEyeBall(ball, design.eyeBallShape);
    const frameCmds = translate(transformCommands(frame.commands, mirror), ox + m, oy + m);
    const ballCmds = translate(
      transformCommands(ball.commands, (u, v) => mirror(u + 2, v + 2)),
      ox + m,
      oy + m,
    );
    let framePaint: Paint = fgPaint;
    let ballPaint: Paint = fgPaint;
    if (design.eyes.mode === "custom") {
      const own = design.eyes.perEye?.[i];
      framePaint = { kind: "solid", color: own?.frame ?? design.eyes.frame };
      ballPaint = { kind: "solid", color: own?.ball ?? design.eyes.ball };
    }
    layers.push({ id: `eye-frame-${i}`, commands: frameCmds, paint: framePaint });
    layers.push({ id: `eye-ball-${i}`, commands: ballCmds, paint: ballPaint });
  });

  let sceneLogo: SceneLogo | null = null;
  if (logo && layout) {
    sceneLogo = {
      asset: logo,
      x: layout.image.x + m,
      y: layout.image.y + m,
      width: layout.image.w,
      height: layout.image.h,
      opacity: design.logo.opacity,
      clearedBackdrop: design.logo.clearBehind,
    };
  }

  return {
    size: n + 2 * m,
    margin: m,
    moduleCount: n,
    version: matrix.version,
    ec: matrix.ec,
    mask: matrix.mask,
    background: design.background.transparent ? null : design.background.color,
    layers,
    logo: sceneLogo,
    stats: {
      obscuredModules: obscuredCount,
      obscuredRatio: obscuredCount / (n * n),
      logoBudget: LOGO_BUDGET[matrix.ec],
    },
  };
}
