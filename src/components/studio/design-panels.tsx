"use client";

import type { ReactNode } from "react";
import { ArrowLeftRight, ChevronDown, RotateCcw } from "lucide-react";
import { useStudio } from "@/lib/store/studio";
import { BODY_SHAPES, EYE_BALL_SHAPES, EYE_FRAME_SHAPES } from "@/lib/qr/engine/shapes";
import { bodyShapePreview, eyeBallPreview, eyeFramePreview } from "@/lib/qr/engine/preview";
import { MARGIN_MAX } from "@/lib/qr/engine/design";
import type { EcSetting, FillMode } from "@/lib/qr/engine/types";
import { ColorField } from "@/components/ui/color-field";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ShapePicker } from "./shape-picker";

export function Pane({ title, icon, children, defaultOpen = false, testId }: { title: string; icon?: ReactNode; children: ReactNode; defaultOpen?: boolean; testId?: string }) {
  return (
    <details open={defaultOpen} data-testid={testId} className="group rounded-modal border border-line bg-white [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5">
        {icon && <span className="flex size-9 items-center justify-center rounded-card bg-brand-50 text-brand-700">{icon}</span>}
        <span className="flex-1 text-base font-semibold">{title}</span>
        <ChevronDown className="size-5 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-5 border-t border-line px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}

const FILL_OPTIONS: ReadonlyArray<{ value: FillMode; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "linear", label: "Linear gradient" },
  { value: "radial", label: "Radial gradient" },
];
const EYE_NAMES = ["Top-left eye", "Top-right eye", "Bottom-left eye"] as const;

export function ColorsPanel() {
  const design = useStudio((s) => s.design);
  const update = useStudio((s) => s.updateDesign);
  const fg = design.foreground;
  const eyes = design.eyes;
  return (
    <>
      <div className="space-y-4">
        <Segmented label="Code colour" name="fill-mode" value={fg.mode} options={FILL_OPTIONS} onChange={(mode) => update((d) => (d.foreground.mode = mode))} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField label={fg.mode === "solid" ? "Colour" : fg.mode === "radial" ? "Centre colour" : "Start colour"} value={fg.color1} onChange={(c) => update((d) => (d.foreground.color1 = c))} />
          {fg.mode !== "solid" && <ColorField label={fg.mode === "radial" ? "Edge colour" : "End colour"} value={fg.color2} onChange={(c) => update((d) => (d.foreground.color2 = c))} />}
        </div>
        {fg.mode === "linear" && <Slider label="Gradient angle" min={0} max={360} step={5} value={fg.angle} format={(v) => `${v}°`} onChange={(v) => update((d) => (d.foreground.angle = v))} />}
        {fg.mode !== "solid" && (
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeftRight className="size-4" aria-hidden="true" />}
            onClick={() =>
              update((d) => {
                [d.foreground.color1, d.foreground.color2] = [d.foreground.color2, d.foreground.color1];
              })
            }
          >
            Swap colours
          </Button>
        )}
      </div>

      <div className="space-y-4 border-t border-line pt-4">
        <Segmented
          label="Eye colours"
          name="eye-mode"
          value={eyes.mode}
          options={[
            { value: "inherit", label: "Same as code" },
            { value: "custom", label: "Custom" },
          ]}
          onChange={(mode) =>
            update((d) => {
              d.eyes.mode = mode;
              if (mode === "custom" && d.eyes.frame === d.eyes.ball && d.eyes.frame === "#111827") {
                d.eyes.frame = d.foreground.color1;
                d.eyes.ball = d.foreground.mode === "solid" ? d.foreground.color1 : d.foreground.color2;
              }
            })
          }
        />
        {eyes.mode === "custom" && (
          <>
            <Checkbox
              id="per-eye"
              label="Colour each eye separately"
              checked={eyes.perEye !== null}
              onChange={(e) =>
                update((d) => {
                  d.eyes.perEye = e.target.checked
                    ? [0, 1, 2].map(() => ({ frame: d.eyes.frame, ball: d.eyes.ball })) as typeof d.eyes.perEye
                    : null;
                })
              }
            />
            {eyes.perEye === null ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ColorField label="Eye frame" value={eyes.frame} onChange={(c) => update((d) => (d.eyes.frame = c))} />
                <ColorField label="Eye ball" value={eyes.ball} onChange={(c) => update((d) => (d.eyes.ball = c))} />
              </div>
            ) : (
              eyes.perEye.map((eye, i) => (
                <fieldset key={EYE_NAMES[i]} className="grid grid-cols-1 gap-3 rounded-card border border-line p-3 sm:grid-cols-2">
                  <legend className="px-1 text-sm font-semibold">{EYE_NAMES[i]}</legend>
                  <ColorField label="Frame" value={eye.frame} onChange={(c) => update((d) => (d.eyes.perEye![i]!.frame = c))} />
                  <ColorField label="Ball" value={eye.ball} onChange={(c) => update((d) => (d.eyes.perEye![i]!.ball = c))} />
                </fieldset>
              ))
            )}
          </>
        )}
      </div>

      <div className="space-y-4 border-t border-line pt-4">
        <Checkbox
          id="transparent-bg"
          label="Transparent background"
          help="Supported in PNG, SVG, PDF and EPS. The preview shows a checkerboard."
          checked={design.background.transparent}
          onChange={(e) => update((d) => (d.background.transparent = e.target.checked))}
        />
        {!design.background.transparent && <ColorField label="Background colour" value={design.background.color} onChange={(c) => update((d) => (d.background.color = c))} />}
      </div>
    </>
  );
}

export function ShapesPanel() {
  const design = useStudio((s) => s.design);
  const update = useStudio((s) => s.updateDesign);
  return (
    <>
      <ShapePicker testId="body-shapes" label="Body shape" value={design.bodyShape} options={BODY_SHAPES} render={bodyShapePreview} onChange={(v) => update((d) => (d.bodyShape = v))} />
      <ShapePicker testId="frame-shapes" label="Eye frame" value={design.eyeFrameShape} options={EYE_FRAME_SHAPES} render={eyeFramePreview} onChange={(v) => update((d) => (d.eyeFrameShape = v))} />
      <ShapePicker testId="ball-shapes" label="Eye ball" value={design.eyeBallShape} options={EYE_BALL_SHAPES} render={eyeBallPreview} onChange={(v) => update((d) => (d.eyeBallShape = v))} />
    </>
  );
}

const EC_OPTIONS: ReadonlyArray<{ value: EcSetting; label: string }> = [
  { value: "auto", label: "Auto — M, or H with a logo (recommended)" },
  { value: "L", label: "L — 7% recovery, smallest code" },
  { value: "M", label: "M — 15% recovery" },
  { value: "Q", label: "Q — 25% recovery" },
  { value: "H", label: "H — 30% recovery, best for logos and print" },
];

export function AdvancedPanel() {
  const design = useStudio((s) => s.design);
  const update = useStudio((s) => s.updateDesign);
  return (
    <>
      <Field id="ec-level" label="Error correction" help="Higher levels survive damage, dirt and logos but make the code denser.">
        {(a11y) => (
          <Select {...a11y} value={design.ec} onChange={(e) => update((d) => (d.ec = e.target.value as EcSetting))}>
            {EC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="qr-version" label="QR version (size)" help="Auto picks the smallest version that fits. A fixed version keeps codes the same density across a print run.">
        {(a11y) => (
          <Select {...a11y} value={String(design.version)} onChange={(e) => update((d) => (d.version = e.target.value === "auto" ? "auto" : Number(e.target.value)))}>
            <option value="auto">Auto</option>
            {Array.from({ length: 40 }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                Version {v} ({17 + 4 * v}×{17 + 4 * v} modules)
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Slider
        label="Quiet zone (margin)"
        min={0}
        max={MARGIN_MAX}
        value={design.margin}
        format={(v) => `${v} module${v === 1 ? "" : "s"}`}
        help="The blank border scanners need. The standard is 4 modules."
        onChange={(v) => update((d) => (d.margin = v))}
      />
    </>
  );
}

export function ResetDesignButton() {
  const reset = useStudio((s) => s.resetDesign);
  return (
    <Button variant="outline" size="sm" icon={<RotateCcw className="size-4" aria-hidden="true" />} onClick={reset}>
      Reset design
    </Button>
  );
}
