import { z } from "zod";

/** Form validation shared by the client forms and the server actions (server re-validates). */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // bcrypt input limit used by Supabase Auth

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(320, "Email address is too long.")
  .email("Enter a valid email address, e.g. name@example.com.")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX, `Use at most ${PASSWORD_MAX} bytes.`)
  .refine((v) => /[a-z]/i.test(v) || /[^\x00-\x7f]/.test(v), "Include at least one letter.")
  .refine((v) => /\d/.test(v), "Include at least one number.")
  .refine((v) => !/^\s|\s$/.test(v), "Passwords can't start or end with a space.");

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name.").max(100, "Names are limited to 100 characters."),
    email,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." })
  .refine((v) => v.password.toLowerCase() !== v.email.toLowerCase(), { path: ["password"], message: "Don't use your email address as your password." });

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });
export const emailOnlySchema = z.object({ email });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." });

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(100, "Names are limited to 100 characters."),
  companyName: z.string().trim().max(120, "Company names are limited to 120 characters."),
  avatarUrl: z
    .string()
    .trim()
    .max(2048, "That link is too long.")
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use an https:// image link, or leave it empty."),
});

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Password strength hint for the UI (0–4). Not a security control — the schema is. */
export function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= PASSWORD_MIN) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^a-z0-9]/i.test(pw)) s++;
  return s;
}

/**
 * Maps Supabase Auth errors to user-facing messages. Uses error codes where available; never echoes
 * raw server text that could leak internals.
 */
export function authErrorMessage(err: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!err) return "Something went wrong. Please try again.";
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return "Please verify your email address first — check your inbox for the link.";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return "An account with this email already exists. Log in or reset your password.";
  if (code === "weak_password" || msg.includes("weak password") || msg.includes("password should")) return "That password is too weak or has appeared in a data breach. Choose a different one.";
  if (code === "same_password") return "The new password must be different from the old one.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || err.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (code === "otp_expired" || code === "flow_state_expired" || code === "bad_code_verifier" || msg.includes("expired") || msg.includes("invalid")) {
    return "This link is invalid or has expired. Request a new one.";
  }
  if (code === "signup_disabled") return "New sign-ups are currently disabled.";
  if (code === "session_not_found" || code === "session_expired") return "Your session has ended. Please log in again.";
  if (err.status === 0 || msg.includes("fetch failed") || msg.includes("failed to fetch") || msg.includes("network") || msg.includes("econnrefused")) {
    return "We couldn't reach the account service. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
