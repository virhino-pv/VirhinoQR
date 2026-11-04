"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Native range input (fully keyboard/screen-reader accessible) with a live value readout. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  help,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  help?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink-1">
          {label}
        </label>
        <output htmlFor={id} className="text-sm tabular-nums text-ink-2">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-brand-600"
      />
      {help && (
        <p id={`${id}-help`} className="text-xs text-ink-2">
          {help}
        </p>
      )}
    </div>
  );
}
