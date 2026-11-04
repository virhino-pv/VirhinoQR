import Link from "next/link";
import { cn } from "@/lib/cn";

/** Original QR Studio mark: a rounded tile with three corner "eyes" and a spark in the free corner. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#4F46E5" />
      <rect x="6" y="6" width="8" height="8" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="18" y="6" width="8" height="8" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="6" y="18" width="8" height="8" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M22 17.5l1.3 2.7 2.7 1.3-2.7 1.3L22 25.5l-1.3-2.7-2.7-1.3 2.7-1.3z" fill="#FBBF24" />
    </svg>
  );
}

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-tile" aria-label="QR Studio home">
      <BrandMark />
      <span className={cn("text-lg font-bold tracking-tight", inverted ? "text-white" : "text-ink-1")}>
        QR<span className={inverted ? "text-brand-200" : "text-brand-600"}> Studio</span>
      </span>
    </Link>
  );
}
