import Link from "next/link";
import { useId } from "react";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";

/** VirhinoQR mark: violet→blue tile with three corner "eyes" and a cyan spark in the free corner. */
export function BrandMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5E17EB" />
          <stop offset="1" stopColor="#005DFB" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-g)`} />
      <rect x="6" y="6" width="8" height="8" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="18" y="6" width="8" height="8" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="6" y="18" width="8" height="8" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M22 17.5l1.3 2.7 2.7 1.3-2.7 1.3L22 25.5l-1.3-2.7-2.7-1.3 2.7-1.3z" fill="#22D3EE" />
    </svg>
  );
}

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-tile" aria-label={`${SITE_NAME} home`}>
      <BrandMark />
      <span className={cn("text-lg font-bold tracking-tight", inverted ? "text-white" : "text-ink-1")}>
        Virhino<span className={inverted ? "text-cyan-300" : "text-[#5E17EB]"}>QR</span>
      </span>
    </Link>
  );
}
