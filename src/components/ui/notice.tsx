import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

const STYLES: Record<Tone, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  success: "border-success-600/30 bg-success-50 text-success-700",
  warning: "border-warning-600/30 bg-warning-50 text-warning-700",
  error: "border-danger-600/30 bg-danger-50 text-danger-700",
};
const ICONS: Record<Tone, typeof Info> = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

export function Notice({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = ICONS[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-card border px-3.5 py-3 text-sm", STYLES[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "accent"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone === "brand" && "bg-brand-100 text-brand-800",
        tone === "accent" && "bg-amber-100 text-amber-800",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
