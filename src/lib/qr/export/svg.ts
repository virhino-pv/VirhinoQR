import type { Paint, PathCommand, Scene } from "../engine/types";

/** Compact number formatting (max 3 decimals, no trailing zeros). */
export function num(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

export function commandsToSvgPath(commands: readonly PathCommand[]): string {
  let d = "";
  for (const c of commands) {
    switch (c.op) {
      case "M":
        d += `M${num(c.x)} ${num(c.y)}`;
        break;
      case "L":
        d += `L${num(c.x)} ${num(c.y)}`;
        break;
      case "C":
        d += `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`;
        break;
      case "Z":
        d += "Z";
        break;
    }
  }
  return d;
}

function paintKey(p: Paint): string {
  return JSON.stringify(p);
}

export interface SvgOptions {
  /** Output width/height in px written to the root element. */
  size: number;
  /** Optional <title> for accessibility. */
  title?: string;
}

/**
 * Serialises a scene to a standalone SVG 1.1 document. Coordinates stay in module units
 * (viewBox) so the file is resolution independent; width/height carry the requested size.
 */
export function sceneToSvg(scene: Scene, options: SvgOptions): string {
  const defs: string[] = [];
  const ids = new Map<string, string>();
  const fillFor = (paint: Paint): string => {
    if (paint.kind === "solid") return paint.color;
    const key = paintKey(paint);
    let id = ids.get(key);
    if (!id) {
      id = `g${ids.size}`;
      ids.set(key, id);
      const stops = paint.stops.map((s) => `<stop offset="${num(s.offset)}" stop-color="${s.color}"/>`).join("");
      defs.push(
        paint.kind === "linear"
          ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(paint.x1)}" y1="${num(paint.y1)}" x2="${num(paint.x2)}" y2="${num(paint.y2)}">${stops}</linearGradient>`
          : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(paint.cx)}" cy="${num(paint.cy)}" r="${num(paint.r)}">${stops}</radialGradient>`,
      );
    }
    return `url(#${id})`;
  };

  // Merge layers sharing an identical paint into one <path>.
  const groups = new Map<string, { paint: Paint; d: string }>();
  for (const layer of scene.layers) {
    if (layer.commands.length === 0) continue;
    const key = paintKey(layer.paint);
    const g = groups.get(key);
    const d = commandsToSvgPath(layer.commands);
    if (g) g.d += d;
    else groups.set(key, { paint: layer.paint, d });
  }
  const paths = [...groups.values()].map((g) => `<path fill="${fillFor(g.paint)}" d="${g.d}"/>`);

  const s = num(scene.size);
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${Math.round(options.size)}" height="${Math.round(options.size)}" viewBox="0 0 ${s} ${s}" shape-rendering="geometricPrecision">`,
  ];
  if (options.title) parts.push(`<title>${escapeXml(options.title)}</title>`);
  if (defs.length) parts.push(`<defs>${defs.join("")}</defs>`);
  if (scene.background) parts.push(`<rect width="${s}" height="${s}" fill="${scene.background}"/>`);
  parts.push(...paths);
  if (scene.logo) {
    const l = scene.logo;
    const opacity = l.opacity < 1 ? ` opacity="${num(l.opacity)}"` : "";
    parts.push(
      `<image x="${num(l.x)}" y="${num(l.y)}" width="${num(l.width)}" height="${num(l.height)}" preserveAspectRatio="xMidYMid meet"${opacity} xlink:href="${l.asset.dataUrl}"/>`,
    );
  }
  parts.push(`</svg>`);
  return parts.join("\n");
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
