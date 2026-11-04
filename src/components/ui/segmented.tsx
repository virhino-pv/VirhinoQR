"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Radio group styled as a segmented control; arrow keys move the selection (WAI-ARIA radio pattern). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  name,
}: {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  name?: string;
}) {
  const groupId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span id={`${groupId}-label`} className="text-sm font-medium text-ink-1">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        data-name={name}
        className="flex flex-wrap gap-1 rounded-card bg-surface-2 p-1"
        onKeyDown={onKey}
      >
        {options.map((o, i) => {
          const active = i === index;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                "min-h-9 flex-1 rounded-tile px-3 text-sm font-medium transition-colors",
                active ? "bg-white text-brand-700 shadow-e1" : "text-ink-2 hover:text-ink-1",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
