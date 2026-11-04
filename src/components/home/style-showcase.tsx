"use client";

import { useState } from "react";
import { QrImage } from "@/components/qr/qr-image";
import { ButtonLink } from "@/components/ui/button";
import { SHOWCASE_STYLES } from "@/lib/qr/presets";
import { cn } from "@/lib/cn";

const DEMO_TEXT = "https://qr-studio.example/welcome";

/** Every image here is rendered live by the engine. */
export function StyleShowcase() {
  const [active, setActive] = useState(1);
  const current = SHOWCASE_STYLES[active]!;
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div role="radiogroup" aria-label="Example styles" className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3">
          {SHOWCASE_STYLES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="radio"
              aria-checked={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-card border bg-white p-2.5 text-xs font-medium transition-all",
                i === active ? "border-brand-600 ring-3 ring-brand-100" : "border-line hover:border-brand-200",
              )}
            >
              <QrImage text={DEMO_TEXT} design={s.design} alt="" size={160} className="w-full" />
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <figure className="flex flex-col items-center gap-4 rounded-modal bg-white p-6 shadow-e2">
        <QrImage text={DEMO_TEXT} design={current.design} alt={`${current.name} style QR code example`} className="w-full max-w-64" />
        <figcaption className="text-center text-sm text-ink-2">
          <span className="font-semibold text-ink-1">{current.name}</span> — colours, gradients, body and eye shapes are all adjustable.
        </figcaption>
        <ButtonLink href="/create" variant="outline" size="sm">
          Design your own
        </ButtonLink>
      </figure>
    </div>
  );
}
