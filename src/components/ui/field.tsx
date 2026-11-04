import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Label + control + help/error with correct aria wiring. The control receives ids via render prop. */
export function Field({
  id,
  label,
  help,
  error,
  required,
  counter,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  required?: boolean;
  counter?: ReactNode;
  className?: string;
  children: (a11y: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-1">
          {label}
          {required && (
            <span className="ml-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {counter && <span className="text-xs tabular-nums text-ink-3">{counter}</span>}
      </div>
      {children({ id, ...(error ? { "aria-invalid": true as const } : {}), ...(describedBy ? { "aria-describedby": describedBy } : {}) })}
      {error && (
        <p id={errorId} className="text-sm text-danger-700" role="alert">
          {error}
        </p>
      )}
      {help && (
        <p id={helpId} className="text-xs leading-relaxed text-ink-2">
          {help}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full rounded-tile border border-line bg-white px-3 text-[15px] text-ink-1 placeholder:text-ink-3 transition-colors focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 aria-[invalid=true]:border-danger-600 aria-[invalid=true]:focus:ring-danger-50 disabled:bg-surface-2";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ id, label, help, className, ...rest }: { label: ReactNode; help?: ReactNode } & ComponentProps<"input">) {
  const helpId = help ? `${id}-help` : undefined;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input id={id} type="checkbox" aria-describedby={helpId} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-brand-600" {...rest} />
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink-1">
          {label}
        </label>
        {help && (
          <p id={helpId} className="text-xs text-ink-2">
            {help}
          </p>
        )}
      </div>
    </div>
  );
}
