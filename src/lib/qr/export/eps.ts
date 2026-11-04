import { zlibSync } from "fflate";
import { downscale, splitAlpha } from "../../image/resample";
import { hexToRgb } from "../engine/color";
import type { Paint, PathCommand, Scene, Stop } from "../engine/types";
import { num } from "./svg";

/**
 * Encapsulated PostScript (EPSF-3.0, LanguageLevel 3) writer. Paths and colours are vector;
 * gradients use `shfill` (ShadingType 2/3); the logo is embedded as a Flate+ASCII85 image.
 *
 * Limitation: PostScript has no soft transparency. A logo with partial alpha is flattened onto the
 * background colour when it sits on a cleared area; otherwise a 1-bit mask (alpha ≥ 50 %) is used.
 */

export interface EpsOptions {
  /** Bounding box width/height in points. */
  sizePt: number;
  title?: string;
  logoMaxPx?: number;
}

function rgb01(hex: string): string {
  return hexToRgb(hex)
    .map((v) => num(v / 255))
    .join(" ");
}

export function commandsToPsPath(commands: readonly PathCommand[]): string {
  const out: string[] = [];
  for (const c of commands) {
    switch (c.op) {
      case "M":
        out.push(`${num(c.x)} ${num(c.y)} m`);
        break;
      case "L":
        out.push(`${num(c.x)} ${num(c.y)} l`);
        break;
      case "C":
        out.push(`${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)} c`);
        break;
      case "Z":
        out.push("h");
        break;
    }
  }
  return out.join("\n");
}

/** ASCII85 (Adobe) encoding with the `~>` terminator. */
export function ascii85(data: Uint8Array): string {
  let out = "";
  let line = 0;
  const emit = (s: string) => {
    out += s;
    line += s.length;
    if (line >= 72) {
      out += "\n";
      line = 0;
    }
  };
  let i = 0;
  for (; i + 4 <= data.length; i += 4) {
    const v = ((data[i]! << 24) | (data[i + 1]! << 16) | (data[i + 2]! << 8) | data[i + 3]!) >>> 0;
    if (v === 0) {
      emit("z");
      continue;
    }
    let n = v;
    const c = new Array<string>(5);
    for (let k = 4; k >= 0; k--) {
      c[k] = String.fromCharCode((n % 85) + 33);
      n = Math.floor(n / 85);
    }
    emit(c.join(""));
  }
  const rest = data.length - i;
  if (rest > 0) {
    let v = 0;
    for (let k = 0; k < 4; k++) v = v * 256 + (k < rest ? data[i + k]! : 0);
    const c = new Array<string>(5);
    for (let k = 4; k >= 0; k--) {
      c[k] = String.fromCharCode((v % 85) + 33);
      v = Math.floor(v / 85);
    }
    emit(c.slice(0, rest + 1).join(""));
  }
  return `${out}~>`;
}

function psFunction(stops: Stop[]): string {
  const pair = (a: Stop, b: Stop) =>
    `<< /FunctionType 2 /Domain [0 1] /C0 [${rgb01(a.color)}] /C1 [${rgb01(b.color)}] /N 1 >>`;
  if (stops.length === 2) return pair(stops[0]!, stops[1]!);
  const fns: string[] = [];
  const bounds: string[] = [];
  const encode: string[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    fns.push(pair(stops[i]!, stops[i + 1]!));
    if (i > 0) bounds.push(num(stops[i]!.offset));
    encode.push("0 1");
  }
  return `<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(" ")}] /Bounds [${bounds.join(" ")}] /Encode [${encode.join(" ")}] >>`;
}

function psShading(paint: Exclude<Paint, { kind: "solid" }>): string {
  const coords =
    paint.kind === "linear"
      ? `${num(paint.x1)} ${num(paint.y1)} ${num(paint.x2)} ${num(paint.y2)}`
      : `${num(paint.cx)} ${num(paint.cy)} 0 ${num(paint.cx)} ${num(paint.cy)} ${num(paint.r)}`;
  return `<< /ShadingType ${paint.kind === "linear" ? 2 : 3} /ColorSpace /DeviceRGB /Coords [${coords}] /Function ${psFunction(paint.stops)} /Extend [true true] >>`;
}

function psText(text: string): string {
  // DSC comments are ASCII; replace anything else.
  return text.replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "");
}

export function sceneToEps(scene: Scene, options: EpsOptions): string {
  const P = options.sizePt;
  const s = P / scene.size;
  const bb = Math.ceil(P);
  const lines: string[] = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${bb} ${bb}`,
    `%%HiResBoundingBox: 0 0 ${num(P)} ${num(P)}`,
    "%%Creator: QR Studio",
    ...(options.title ? [`%%Title: ${psText(options.title)}`] : []),
    `%%CreationDate: ${new Date().toISOString()}`,
    "%%LanguageLevel: 3",
    "%%Pages: 1",
    "%%EndComments",
    "%%BeginProlog",
    "/m { moveto } bind def /l { lineto } bind def /c { curveto } bind def /h { closepath } bind def",
    "%%EndProlog",
    "%%Page: 1 1",
    "gsave",
    `0 ${num(P)} translate ${num(s)} ${num(-s)} scale`,
  ];
  if (scene.background) {
    lines.push(`${rgb01(scene.background)} setrgbcolor`, `0 0 ${num(scene.size)} ${num(scene.size)} rectfill`);
  }

  const groups = new Map<string, { paint: Paint; commands: PathCommand[] }>();
  for (const layer of scene.layers) {
    if (!layer.commands.length) continue;
    const key = JSON.stringify(layer.paint);
    const g = groups.get(key);
    if (g) g.commands.push(...layer.commands);
    else groups.set(key, { paint: layer.paint, commands: [...layer.commands] });
  }
  for (const { paint, commands } of groups.values()) {
    lines.push("newpath", commandsToPsPath(commands));
    if (paint.kind === "solid") lines.push(`${rgb01(paint.color)} setrgbcolor fill`);
    else lines.push("gsave clip newpath", `${psShading(paint)} shfill`, "grestore newpath");
  }

  if (scene.logo) {
    const l = scene.logo;
    const img = downscale({ width: l.asset.width, height: l.asset.height, data: l.asset.rgba }, options.logoMaxPx ?? 512);
    // Flatten onto the background when the logo sits on a cleared, opaque backdrop.
    const matte = scene.background ? hexToRgb(scene.background) : undefined;
    const flatten = Boolean(matte) && l.clearedBackdrop;
    const { rgb, alpha, hasAlpha } = splitAlpha(img, { opacity: l.opacity, matte: flatten ? matte : undefined });
    const w = img.width;
    const h = img.height;
    lines.push("gsave", `${num(l.x)} ${num(l.y)} translate ${num(l.width)} ${num(l.height)} scale`, "/DeviceRGB setcolorspace");
    if (!hasAlpha || flatten) {
      lines.push(
        `<< /ImageType 1 /Width ${w} /Height ${h} /BitsPerComponent 8 /Decode [0 1 0 1 0 1] /ImageMatrix [${w} 0 0 ${h} 0 0] /DataSource currentfile /ASCII85Decode filter /FlateDecode filter >> image`,
        ascii85(zlibSync(rgb, { level: 9 })),
      );
    } else {
      // InterleaveType 1: each sample = mask byte (high bit significant; Decode [1 0] => 255 paints) then RGB.
      const inter = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        inter[i * 4] = alpha[i]! >= 128 ? 255 : 0;
        inter[i * 4 + 1] = rgb[i * 3]!;
        inter[i * 4 + 2] = rgb[i * 3 + 1]!;
        inter[i * 4 + 3] = rgb[i * 3 + 2]!;
      }
      lines.push(
        `<< /ImageType 3 /InterleaveType 1`,
        `/MaskDict << /ImageType 1 /Width ${w} /Height ${h} /BitsPerComponent 8 /Decode [1 0] /ImageMatrix [${w} 0 0 ${h} 0 0] >>`,
        `/DataDict << /ImageType 1 /Width ${w} /Height ${h} /BitsPerComponent 8 /Decode [0 1 0 1 0 1] /ImageMatrix [${w} 0 0 ${h} 0 0] /DataSource currentfile /ASCII85Decode filter /FlateDecode filter >>`,
        `>> image`,
        ascii85(zlibSync(inter, { level: 9 })),
      );
    }
    lines.push("grestore");
  }

  lines.push("grestore", "showpage", "%%Trailer", "%%EOF", "");
  return lines.join("\n");
}
