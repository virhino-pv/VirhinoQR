"use client";

import { useDeferredValue, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { QrImage } from "@/components/qr/qr-image";
import { buttonClasses } from "@/components/ui/button";
import { normalizeWebUrl } from "@/lib/payloads/escape";
import { HERO_DESIGN } from "@/lib/qr/presets";

const FALLBACK = "https://example.com";

/** Hero entry point: type a link, see a real QR update live, continue in the studio. */
export function QuickGenerator() {
  const id = useId();
  const router = useRouter();
  const [value, setValue] = useState("");
  const deferred = useDeferredValue(value);
  const check = deferred.trim() ? normalizeWebUrl(deferred) : null;
  const text = check?.ok ? check.url : FALLBACK;
  const studioHref = `/create?type=url${check?.ok ? `&url=${encodeURIComponent(check.url)}` : ""}`;

  return (
    <div className="grid items-center gap-6 rounded-modal bg-white p-5 text-ink-1 shadow-e3 sm:grid-cols-[1fr_auto] sm:p-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(studioHref);
        }}
      >
        <label htmlFor={id} className="text-sm font-semibold">
          Paste a link to try it
        </label>
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourwebsite.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={check && !check.ok ? true : undefined}
          aria-describedby={`${id}-status`}
          className="h-12 w-full rounded-card border border-line px-4 text-base focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 aria-[invalid=true]:border-danger-600"
        />
        <p id={`${id}-status`} className="min-h-5 text-sm text-ink-2" aria-live="polite">
          {check === null && "The preview shows a sample link until you type."}
          {check?.ok && <span className="text-success-700">Live preview of {check.url}</span>}
          {check && !check.ok && <span className="text-danger-700">{check.error}</span>}
        </p>
        <Link href={studioHref} className={buttonClasses("primary", "lg", "w-full sm:w-auto sm:self-start")}>
          Customise &amp; download <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </form>
      <div className="mx-auto w-44 sm:w-48">
        <QrImage text={text} design={HERO_DESIGN} alt={`QR code preview for ${text}`} className="w-full rounded-card" />
      </div>
    </div>
  );
}
