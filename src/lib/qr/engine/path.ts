import type { PathCommand } from "./types";

/** Bézier constant for approximating a quarter circle. */
export const KAPPA = 0.5522847498307936;

/**
 * Accumulates path commands. Primitives are emitted clockwise (in y-down space) unless
 * `reverse` is set, so outer/inner contours combine correctly under the nonzero fill rule.
 */
export class PathBuilder {
  readonly commands: PathCommand[] = [];

  moveTo(x: number, y: number) {
    this.commands.push({ op: "M", x, y });
  }
  lineTo(x: number, y: number) {
    this.commands.push({ op: "L", x, y });
  }
  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.commands.push({ op: "C", x1, y1, x2, y2, x, y });
  }
  close() {
    this.commands.push({ op: "Z" });
  }

  rect(x: number, y: number, w: number, h: number, reverse = false) {
    this.moveTo(x, y);
    if (!reverse) {
      this.lineTo(x + w, y);
      this.lineTo(x + w, y + h);
      this.lineTo(x, y + h);
    } else {
      this.lineTo(x, y + h);
      this.lineTo(x + w, y + h);
      this.lineTo(x + w, y);
    }
    this.close();
  }

  /** Rectangle with independent corner radii: [topLeft, topRight, bottomRight, bottomLeft]. */
  roundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radii: readonly [number, number, number, number] | number,
    reverse = false,
  ) {
    const max = Math.min(w, h) / 2;
    const list = typeof radii === "number" ? [radii, radii, radii, radii] : [...radii];
    const [tl, tr, br, bl] = list.map((v) => Math.max(0, Math.min(v, max))) as [number, number, number, number];
    if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
      this.rect(x, y, w, h, reverse);
      return;
    }
    const k = KAPPA;
    if (!reverse) {
      this.moveTo(x + tl, y);
      this.lineTo(x + w - tr, y);
      if (tr) this.curveTo(x + w - tr + tr * k, y, x + w, y + tr - tr * k, x + w, y + tr);
      this.lineTo(x + w, y + h - br);
      if (br) this.curveTo(x + w, y + h - br + br * k, x + w - br + br * k, y + h, x + w - br, y + h);
      this.lineTo(x + bl, y + h);
      if (bl) this.curveTo(x + bl - bl * k, y + h, x, y + h - bl + bl * k, x, y + h - bl);
      this.lineTo(x, y + tl);
      if (tl) this.curveTo(x, y + tl - tl * k, x + tl - tl * k, y, x + tl, y);
    } else {
      this.moveTo(x + tl, y);
      if (tl) this.curveTo(x + tl - tl * k, y, x, y + tl - tl * k, x, y + tl);
      this.lineTo(x, y + h - bl);
      if (bl) this.curveTo(x, y + h - bl + bl * k, x + bl - bl * k, y + h, x + bl, y + h);
      this.lineTo(x + w - br, y + h);
      if (br) this.curveTo(x + w - br + br * k, y + h, x + w, y + h - br + br * k, x + w, y + h - br);
      this.lineTo(x + w, y + tr);
      if (tr) this.curveTo(x + w, y + tr - tr * k, x + w - tr + tr * k, y, x + w - tr, y);
    }
    this.close();
  }

  circle(cx: number, cy: number, r: number, reverse = false) {
    const k = r * KAPPA;
    this.moveTo(cx, cy - r);
    if (!reverse) {
      this.curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
      this.curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
      this.curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
      this.curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
    } else {
      this.curveTo(cx - k, cy - r, cx - r, cy - k, cx - r, cy);
      this.curveTo(cx - r, cy + k, cx - k, cy + r, cx, cy + r);
      this.curveTo(cx + k, cy + r, cx + r, cy + k, cx + r, cy);
      this.curveTo(cx + r, cy - k, cx + k, cy - r, cx, cy - r);
    }
    this.close();
  }

  /** Closed polygon; points must be listed clockwise. */
  polygon(points: ReadonlyArray<readonly [number, number]>, reverse = false) {
    const pts = reverse ? [...points].reverse() : points;
    pts.forEach(([x, y], i) => (i === 0 ? this.moveTo(x, y) : this.lineTo(x, y)));
    this.close();
  }
}

/** Applies a point map to every point of a command list. */
export function transformCommands(
  commands: PathCommand[],
  map: (x: number, y: number) => readonly [number, number],
): PathCommand[] {
  return commands.map((c): PathCommand => {
    switch (c.op) {
      case "M":
      case "L": {
        const [x, y] = map(c.x, c.y);
        return { op: c.op, x, y };
      }
      case "C": {
        const [x1, y1] = map(c.x1, c.y1);
        const [x2, y2] = map(c.x2, c.y2);
        const [x, y] = map(c.x, c.y);
        return { op: "C", x1, y1, x2, y2, x, y };
      }
      case "Z":
        return c;
    }
  });
}
