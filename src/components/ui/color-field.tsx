"use client";

import { useId, useState } from "react";
import { isHexColor, normalizeHex } from "@/lib/qr/engine/color";

/** Native colour picker + hex text input kept in sync. Invalid hex text is shown but not applied. */
export function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (hex: string) => void; disabled?: boolean }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    // External change (reset, preset): adopt it during render instead of in an effect.
    setSynced(value);
    setText(value);
  }
  const invalid = !isHexColor(text);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-hex`} className="text-sm font-medium text-ink-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isHexColor(value) ? normalizeHex(value) : "#000000"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-tile border border-line bg-white p-1 disabled:opacity-50"
        />
        <input
          id={`${id}-hex`}
          value={text}
          disabled={disabled}
          spellCheck={false}
          maxLength={7}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (isHexColor(v)) onChange(normalizeHex(v));
          }}
          className="h-11 w-full min-w-0 rounded-tile border border-line px-3 font-mono text-sm uppercase focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 aria-[invalid=true]:border-danger-600 disabled:bg-surface-2"
        />
      </div>
      {invalid && <p className="text-xs text-danger-700">Use a hex colour like #1E1B4B.</p>}
    </div>
  );
}
