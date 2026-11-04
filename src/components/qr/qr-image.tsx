"use client";

import { useMemo } from "react";
import { buildScene } from "@/lib/qr/engine/scene";
import { sceneToSvg } from "@/lib/qr/export/svg";
import type { Design, LogoAsset } from "@/lib/qr/engine/types";
import { cn } from "@/lib/cn";

/** Renders a real QR code (our engine → SVG) as an <img>. No pre-made images. */
export function QrImage({
  text,
  design,
  logo = null,
  alt,
  className,
  size = 512,
}: {
  text: string;
  design: Design;
  logo?: LogoAsset | null;
  alt: string;
  className?: string;
  size?: number;
}) {
  const src = useMemo(() => {
    try {
      const svg = sceneToSvg(buildScene({ text, design, logo }), { size });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch {
      return null;
    }
  }, [text, design, logo, size]);
  if (!src) return <div className={cn("bg-surface-2", className)} role="img" aria-label="QR code unavailable" />;
  // eslint-disable-next-line @next/next/no-img-element -- generated data URI, not a static asset
  return <img src={src} alt={alt} className={cn("block select-none", className)} draggable={false} />;
}
