import { zlibSync } from "fflate";
import { downscale, splitAlpha } from "../../image/resample";
import { hexToRgb } from "../engine/color";
import type { Paint, PathCommand, Scene, Stop } from "../engine/types";
import { num } from "./svg";

/**
 * Minimal, dependency-light PDF 1.4 writer for QR scenes. Everything stays vector: paths,
 * axial/radial shadings for gradients, and the logo as a Flate-compressed image with a soft mask.
 */

export interface PdfOptions {
  /** Page width/height in PDF points (1 pt = 1/72 inch). */
  sizePt: number;
  title?: string;
  /** Longest edge (px) the logo is resampled to before embedding. */
  logoMaxPx?: number;
}

export const MM_TO_PT = 72 / 25.4;

const enc = new TextEncoder();

function rgb01(hex: string): string {
  return hexToRgb(hex)
    .map((v) => num(v / 255))
    .join(" ");
}

export function commandsToPdfPath(commands: readonly PathCommand[]): string {
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

function functionFor(stops: Stop[]): string {
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

function shadingFor(paint: Exclude<Paint, { kind: "solid" }>): string {
  const coords =
    paint.kind === "linear"
      ? `${num(paint.x1)} ${num(paint.y1)} ${num(paint.x2)} ${num(paint.y2)}`
      : `${num(paint.cx)} ${num(paint.cy)} 0 ${num(paint.cx)} ${num(paint.cy)} ${num(paint.r)}`;
  return `<< /ShadingType ${paint.kind === "linear" ? 2 : 3} /ColorSpace /DeviceRGB /Coords [${coords}] /Function ${functionFor(paint.stops)} /Extend [true true] >>`;
}

function pdfString(text: string): string {
  // UTF-16BE with BOM, hex-encoded: safe for any Unicode title.
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

export function sceneToPdf(scene: Scene, options: PdfOptions): Uint8Array {
  const objects: Array<Uint8Array | string> = []; // index i => object number i+1
  const reserve = () => {
    objects.push("");
    return objects.length;
  };
  const set = (id: number, body: Uint8Array | string) => {
    objects[id - 1] = body;
  };
  const stream = (dict: string, data: Uint8Array): Uint8Array => {
    const head = enc.encode(`${dict.replace(/>>\s*$/, "")} /Length ${data.length} >>\nstream\n`);
    const tail = enc.encode("\nendstream");
    const out = new Uint8Array(head.length + data.length + tail.length);
    out.set(head, 0);
    out.set(data, head.length);
    out.set(tail, head.length + data.length);
    return out;
  };

  const catalogId = reserve();
  const pagesId = reserve();
  const pageId = reserve();
  const contentId = reserve();

  const P = options.sizePt;
  const s = P / scene.size;
  const ops: string[] = ["q", `${num(s)} 0 0 ${num(-s)} 0 ${num(P)} cm`];
  if (scene.background) {
    ops.push(`${rgb01(scene.background)} rg`, `0 0 ${num(scene.size)} ${num(scene.size)} re f`);
  }

  const shadings: string[] = [];
  const groups = new Map<string, { paint: Paint; commands: PathCommand[] }>();
  for (const layer of scene.layers) {
    if (!layer.commands.length) continue;
    const key = JSON.stringify(layer.paint);
    const g = groups.get(key);
    if (g) g.commands.push(...layer.commands);
    else groups.set(key, { paint: layer.paint, commands: [...layer.commands] });
  }
  for (const { paint, commands } of groups.values()) {
    const path = commandsToPdfPath(commands);
    if (paint.kind === "solid") {
      ops.push(`${rgb01(paint.color)} rg`, path, "f");
    } else {
      const shId = reserve();
      set(shId, shadingFor(paint));
      const name = `Sh${shadings.length}`;
      shadings.push(`/${name} ${shId} 0 R`);
      ops.push("q", path, "W n", `/${name} sh`, "Q");
    }
  }

  const xobjects: string[] = [];
  if (scene.logo) {
    const l = scene.logo;
    const img = downscale({ width: l.asset.width, height: l.asset.height, data: l.asset.rgba }, options.logoMaxPx ?? 768);
    const { rgb, alpha, hasAlpha } = splitAlpha(img, { opacity: l.opacity });
    let smask = "";
    if (hasAlpha) {
      const maskId = reserve();
      set(
        maskId,
        stream(
          `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode >>`,
          zlibSync(alpha, { level: 9 }),
        ),
      );
      smask = ` /SMask ${maskId} 0 R`;
    }
    const imId = reserve();
    set(
      imId,
      stream(
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask} >>`,
        zlibSync(rgb, { level: 9 }),
      ),
    );
    xobjects.push(`/Im0 ${imId} 0 R`);
    // Image space puts row 0 at the top of the unit square, so flip it back inside our y-down space.
    ops.push("q", `${num(l.width)} 0 0 ${num(-l.height)} ${num(l.x)} ${num(l.y + l.height)} cm`, "/Im0 Do", "Q");
  }
  ops.push("Q");

  set(contentId, stream("<< /Filter /FlateDecode >>", zlibSync(enc.encode(ops.join("\n")), { level: 9 })));
  const resources = [
    shadings.length ? `/Shading << ${shadings.join(" ")} >>` : "",
    xobjects.length ? `/XObject << ${xobjects.join(" ")} >>` : "",
  ]
    .filter(Boolean)
    .join(" ");
  set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  set(pagesId, `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  set(
    pageId,
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(P)} ${num(P)}] /Resources << ${resources} >> /Contents ${contentId} 0 R >>`,
  );
  const infoId = reserve();
  set(
    infoId,
    `<< /Producer ${pdfString("QR Studio")} /Creator ${pdfString("QR Studio")}${options.title ? ` /Title ${pdfString(options.title)}` : ""} >>`,
  );

  // Assemble with byte offsets for the xref table.
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    push(`${i + 1} 0 obj\n`);
    push(body);
    push("\nendobj\n");
  });
  const xref = offset;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const o of offsets) push(`${String(o).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(offset);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
