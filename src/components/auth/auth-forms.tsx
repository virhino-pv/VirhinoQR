"use client";

import { useActionState, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { z } from "zod";
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resendVerificationAction,
  updatePasswordAction,
  updateProfileAction,
  type FormState,
} from "@/app/(auth)/actions";
import { emailOnlySchema, fieldErrors, loginSchema, newPasswordSchema, passwordStrength, profileSchema, registerSchema, PASSWORD_MIN, type FieldErrors } from "@/lib/auth/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

const IDLE: FormState = { status: "idle" };

/** useActionState + instant client-side validation with the same Zod schema the server uses. */
function useAuthForm(action: (s: FormState, fd: FormData) => Promise<FormState>, schema: z.ZodType) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [submitted, setSubmitted] = useState(state);
  if (submitted !== state) {
    // A new server response replaces client-side errors.
    setSubmitted(state);
    setClientErrors(null);
  }
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const r = schema.safeParse(data);
    if (!r.success) {
      e.preventDefault();
      setClientErrors(fieldErrors(r.error));
    } else setClientErrors(null);
  };
  const errors = clientErrors ?? state.fields ?? {};
  return { state, formAction, pending, onSubmit, errors };
}

function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <Notice tone={state.status === "success" ? "success" : "error"}>
      <span role={state.status === "error" ? "alert" : "status"} data-testid="form-message">
        {state.message}
      </span>
    </Notice>
  );
}

function TextField({ name, label, type = "text", error, defaultValue, autoComplete, help, required = true }: { name: string; label: string; type?: string; error?: string; defaultValue?: string; autoComplete?: string; help?: ReactNode; required?: boolean }) {
  return (
    <Field id={`auth-${name}`} label={label} error={error} help={help} required={required}>
      {(a11y) => <Input {...a11y} name={name} type={type} defaultValue={defaultValue} autoComplete={autoComplete} required={required} />}
    </Field>
  );
}

function PasswordField({ name, label, error, autoComplete, withMeter }: { name: string; label: string; error?: string; autoComplete: string; withMeter?: boolean }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const strength = passwordStrength(value);
  return (
    <Field
      id={`auth-${name}`}
      label={label}
      error={error}
      required
      help={withMeter ? `At least ${PASSWORD_MIN} characters with a letter and a number.` : undefined}
    >
      {(a11y) => (
        <div className="space-y-1.5">
          <div className="relative">
            <Input {...a11y} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => setValue(e.target.value)} required className="pr-20" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-2 my-auto h-8 rounded-tile px-2 text-xs font-semibold text-brand-700 hover:bg-surface-2" aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {withMeter && value && (
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full", i < strength ? (strength >= 3 ? "bg-success-600" : "bg-warning-600") : "bg-surface-2")} />
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const f = useAuthForm(loginAction, loginSchema);
  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="space-y-4" data-testid="login-form">
      <FormMessage state={f.state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField name="email" label="Email" type="email" autoComplete="email" error={f.errors.email} defaultValue={f.state.values?.email} />
      <PasswordField name="password" label="Password" autoComplete="current-password" error={f.errors.password} />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={f.pending}>
        Log in
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const f = useAuthForm(registerAction, registerSchema);
  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="space-y-4" data-testid="register-form">
      <FormMessage state={f.state} />
      <TextField name="fullName" label="Full name" autoComplete="name" error={f.errors.fullName} defaultValue={f.state.values?.fullName} />
      <TextField name="email" label="Email" type="email" autoComplete="email" error={f.errors.email} defaultValue={f.state.values?.email} />
      <PasswordField name="password" label="Password" autoComplete="new-password" error={f.errors.password} withMeter />
      <PasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" error={f.errors.confirmPassword} />
      <Button type="submit" size="lg" className="w-full" loading={f.pending}>
        Create account
      </Button>
      <p className="text-xs text-ink-2">We&apos;ll email you a link to verify your address before you can use the dashboard.</p>
    </form>
  );
}

export function ResendVerificationForm({ email }: { email?: string }) {
  const f = useAuthForm(resendVerificationAction, emailOnlySchema);
  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="space-y-3" data-testid="resend-form">
      <FormMessage state={f.state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" error={f.errors.email} defaultValue={f.state.values?.email ?? email} />
      <Button type="submit" variant="outline" className="w-full" loading={f.pending}>
        Resend verification email
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const f = useAuthForm(requestPasswordResetAction, emailOnlySchema);
  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="space-y-4" data-testid="forgot-form">
      <FormMessage state={f.state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" error={f.errors.email} defaultValue={f.state.values?.email} />
      <Button type="submit" size="lg" className="w-full" loading={f.pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const f = useAuthForm(updatePasswordAction, newPasswordSchema);
  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="space-y-4" data-testid="reset-form">
      <FormMessage state={f.state} />
      <PasswordField name="password" label="New password" autoComplete="new-password" error={f.errors.password} withMeter />
      <PasswordField name="confirmPassword" label="Confirm new password" autoComplete="new-password" error={f.errors.confirmPassword} />
      <Button type="submit" size="lg" className="w-full" loading={f.pending}>
        Update password
      </Button>
    </form>
  );
}

export function ProfileForm({ initial }: { initial: { fullName: string; companyName: string; avatarUrl: string } }) {
  const f = useAuthForm(updateProfileAction, profileSchema);
  const v = f.state.values ?? initial;
  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="space-y-4" data-testid="profile-form">
      <FormMessage state={f.state} />
      <TextField name="fullName" label="Full name" autoComplete="name" error={f.errors.fullName} defaultValue={v.fullName} />
      <TextField name="companyName" label="Company" autoComplete="organization" error={f.errors.companyName} defaultValue={v.companyName} required={false} />
      <TextField name="avatarUrl" label="Avatar image link" type="url" error={f.errors.avatarUrl} defaultValue={v.avatarUrl} required={false} help="Optional https:// link to a square image." />
      <Button type="submit" loading={f.pending}>
        Save profile
      </Button>
    </form>
  );
}
