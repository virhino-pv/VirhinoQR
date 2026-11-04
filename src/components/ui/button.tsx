import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-e1",
  secondary: "bg-surface-2 text-ink-1 hover:bg-brand-100",
  outline: "border border-line bg-white text-ink-1 hover:border-brand-600 hover:text-brand-700",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink-1",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  light: "bg-white text-brand-900 hover:bg-brand-50 shadow-e2",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-card font-semibold transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  loading,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, className, children, ...rest }: Omit<CommonProps, "loading"> & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
