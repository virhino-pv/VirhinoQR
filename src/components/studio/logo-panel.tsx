"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useStudio } from "@/lib/store/studio";
import { GALLERY_LOGOS } from "@/lib/image/gallery";
import { LOGO_ACCEPT } from "@/lib/image/logo-validate";
import { fileToLogoSource, processLogo, svgToLogoSource, type LogoSource } from "@/lib/image/logo-process";
import { svgDataUrl } from "@/lib/qr/engine/preview";
import { LOGO_SIZE_MAX, LOGO_SIZE_MIN } from "@/lib/qr/engine/design";
import type { LogoClearShape } from "@/lib/qr/engine/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/cn";

export function LogoPanel({ obscuredRatio, budget, ec }: { obscuredRatio: number | null; budget: number | null; ec: string | null }) {
  const logo = useStudio((s) => s.logo);
  const setLogo = useStudio((s) => s.setLogo);
  const settings = useStudio((s) => s.design.logo);
  const designEc = useStudio((s) => s.design.ec);
  const update = useStudio((s) => s.updateDesign);
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<LogoSource | null>(null);
  const [removeBg, setRemoveBg] = useState(false);
  const [tolerance, setTolerance] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // A cleared logo (e.g. "Reset design") also clears the local source.
  const [lastLogo, setLastLogo] = useState(logo);
  if (lastLogo !== logo) {
    setLastLogo(logo);
    if (!logo && source) setSource(null);
  }

  const apply = (src: LogoSource, rb: boolean, tol: number) => {
    try {
      const r = processLogo(src, { removeBg: rb, tolerance: tol });
      setLogo(r.asset);
      setRemoved(r.removedRatio);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The logo could not be processed.");
    }
  };

  const load = async (task: () => Promise<LogoSource>) => {
    setBusy(true);
    setError(null);
    try {
      const s = await task();
      setRemoveBg(false);
      setSource(s);
      apply(s, false, tolerance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The logo could not be loaded.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void load(() => fileToLogoSource(f));
  };
  const remove = () => {
    setSource(null);
    setLogo(null);
    setRemoved(null);
    setError(null);
  };

  const over = obscuredRatio !== null && budget !== null && obscuredRatio > budget;
  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn("flex flex-col items-center gap-3 rounded-card border-2 border-dashed p-5 text-center transition-colors", dragging ? "border-brand-600 bg-brand-50" : "border-line")}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- processed logo data URI
          <img src={logo.dataUrl} alt={`Current logo: ${logo.name}`} data-testid="logo-thumb" className="bg-checker max-h-24 max-w-40 rounded-tile object-contain p-1" />
        ) : (
          <ImagePlus className="size-8 text-ink-3" aria-hidden="true" />
        )}
        <p className="text-sm text-ink-2">{logo ? logo.name : "Drop a logo here, or choose a file. PNG, JPG, WebP or SVG up to 5 MB."}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" loading={busy} icon={<Upload className="size-4" aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
            {logo ? "Replace logo" : "Upload logo"}
          </Button>
          {logo && (
            <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={remove}>
              Remove logo
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={LOGO_ACCEPT} className="sr-only" data-testid="logo-input" aria-label="Upload logo file" onChange={(e) => onFiles(e.target.files)} tabIndex={-1} />
      </div>
      {error && (
        <Notice tone="error" className="mt-1">
          <span role="alert" data-testid="logo-error">
            {error}
          </span>
        </Notice>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Or pick an icon</p>
        <ul className="grid grid-cols-6 gap-2">
          {GALLERY_LOGOS.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                title={g.label}
                aria-label={`Use ${g.label} icon`}
                aria-pressed={logo?.name === `${g.label} icon`}
                data-gallery={g.id}
                onClick={() => void load(() => svgToLogoSource(g.svg, `${g.label} icon`, "gallery"))}
                className={cn("aspect-square w-full rounded-tile border p-1.5 transition-all", logo?.name === `${g.label} icon` ? "border-brand-600 ring-3 ring-brand-100" : "border-line hover:border-brand-200")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- bundled original icon */}
                <img src={svgDataUrl(g.svg)} alt="" className="size-full" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {logo && (
        <div className="space-y-5 border-t border-line pt-4">
          {source?.origin === "upload" && (
            <div className="space-y-3">
              <Checkbox
                id="remove-bg"
                label="Remove logo background"
                help="Makes a plain background around the logo (e.g. white) transparent. Works best on simple logos, not photos."
                checked={removeBg}
                onChange={(e) => {
                  setRemoveBg(e.target.checked);
                  if (source) apply(source, e.target.checked, tolerance);
                }}
              />
              {removeBg && (
                <>
                  <Slider label="Background tolerance" min={0} max={40} value={tolerance} format={(v) => `${v}%`} onChange={(v) => {
                    setTolerance(v);
                    if (source) apply(source, removeBg, v);
                  }} />
                  {removed !== null && removed < 0.01 && <p className="text-xs text-warning-700">No plain background was found at the edges of this image.</p>}
                </>
              )}
            </div>
          )}
          <Slider
            label="Logo size"
            min={LOGO_SIZE_MIN * 100}
            max={LOGO_SIZE_MAX * 100}
            value={Math.round(settings.size * 100)}
            format={(v) => `${v}% of code width`}
            onChange={(v) => update((d) => (d.logo.size = v / 100))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider label="Horizontal position" min={-12} max={12} step={0.5} value={settings.offsetX} format={(v) => (v === 0 ? "Centre" : `${v > 0 ? "+" : ""}${v} modules`)} onChange={(v) => update((d) => (d.logo.offsetX = v))} />
            <Slider label="Vertical position" min={-12} max={12} step={0.5} value={settings.offsetY} format={(v) => (v === 0 ? "Centre" : `${v > 0 ? "+" : ""}${v} modules`)} onChange={(v) => update((d) => (d.logo.offsetY = v))} />
          </div>
          {(settings.offsetX !== 0 || settings.offsetY !== 0) && (
            <Button variant="ghost" size="sm" onClick={() => update((d) => ((d.logo.offsetX = 0), (d.logo.offsetY = 0)))}>
              Centre logo
            </Button>
          )}
          <Slider label="Logo transparency" min={10} max={100} step={5} value={Math.round(settings.opacity * 100)} format={(v) => `${v}% opaque`} onChange={(v) => update((d) => (d.logo.opacity = v / 100))} />
          <Checkbox
            id="clear-behind"
            label="Clear the code behind the logo"
            help="Recommended: removes modules under the logo so it sits on a clean background."
            checked={settings.clearBehind}
            onChange={(e) => update((d) => (d.logo.clearBehind = e.target.checked))}
          />
          {settings.clearBehind && (
            <>
              <Segmented<LogoClearShape>
                label="Cut-out shape"
                name="clear-shape"
                value={settings.clearShape}
                options={[
                  { value: "square", label: "Square" },
                  { value: "rounded", label: "Rounded" },
                  { value: "circle", label: "Circle" },
                ]}
                onChange={(v) => update((d) => (d.logo.clearShape = v))}
              />
              <Slider label="Space around logo" min={0} max={3} step={0.5} value={settings.padding} format={(v) => `${v} modules`} onChange={(v) => update((d) => (d.logo.padding = v))} />
            </>
          )}
          {obscuredRatio !== null && budget !== null && (
            <div data-testid="logo-budget">
              <div className="mb-1 flex justify-between text-xs text-ink-2">
                <span>Code hidden by logo</span>
                <span className={over ? "font-semibold text-danger-700" : ""}>
                  {(obscuredRatio * 100).toFixed(1)}% of {(budget * 100).toFixed(0)}% safe limit (EC {ec})
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className={cn("h-full rounded-full", over ? "bg-danger-600" : obscuredRatio > budget * 0.8 ? "bg-warning-600" : "bg-success-600")} style={{ width: `${Math.min(100, (obscuredRatio / budget) * 100)}%` }} />
              </div>
              {over && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ec !== "H" && (
                    <Button size="sm" variant="secondary" onClick={() => update((d) => (d.ec = "H"))}>
                      Use error correction H
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => update((d) => (d.logo.size = Math.max(LOGO_SIZE_MIN, d.logo.size - 0.05)))}>
                    Make logo smaller
                  </Button>
                </div>
              )}
              {designEc === "auto" && <p className="mt-1 text-xs text-ink-2">Error correction is on Auto, so H is used while a logo is present.</p>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
