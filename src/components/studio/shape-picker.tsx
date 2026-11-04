"use client";

import { useId, useMemo, useRef, type KeyboardEvent } from "react";
import { svgDataUrl } from "@/lib/qr/engine/preview";
import { cn } from "@/lib/cn";

/** Radio group of shape tiles whose artwork is drawn by the engine's own geometry. */
export function ShapePicker<T extends string>({
  label,
  value,
  options,
  render,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  render: (id: T) => string;
  onChange: (id: T) => void;
  testId?: string;
}) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const images = useMemo(() => options.map((o) => svgDataUrl(render(o.id))), [options, render]);
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!.id);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <p id={id} className="mb-2 text-sm font-medium text-ink-1">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} data-testid={testId} className="grid grid-cols-4 gap-2 sm:grid-cols-5" onKeyDown={onKey}>
        {options.map((o, i) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              title={o.label}
              tabIndex={active ? 0 : -1}
              data-value={o.id}
              onClick={() => onChange(o.id)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-tile border bg-white p-2 transition-all",
                active ? "border-brand-600 ring-3 ring-brand-100" : "border-line hover:border-brand-200",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- engine-drawn SVG tile */}
              <img src={images[i]} alt="" className="size-full" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
