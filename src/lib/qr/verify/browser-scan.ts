"use client";

import type { Scene } from "../engine/types";
import { sceneToCanvas } from "../export/browser";
import { decodeRgba, flattenOnWhite } from "./decode";

/** Pixels per module used for the live check: enough for every version without huge canvases. */
function checkSize(scene: Scene): number {
  return Math.min(1600, Math.max(400, Math.ceil(scene.size * 5)));
}

export async function decodeCanvas(canvas: HTMLCanvasElement): Promise<string[]> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeRgba({ width: img.width, height: img.height, data: flattenOnWhite(img.data) });
}

/** Renders the scene exactly as exported (SVG in the browser) and decodes it with ZXing. */
export async function scanScene(scene: Scene, expected: string): Promise<boolean> {
  const canvas = await sceneToCanvas(scene, checkSize(scene));
  const texts = await decodeCanvas(canvas);
  return texts.includes(expected);
}
