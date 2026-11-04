"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth/redirect";
import {
  authErrorMessage,
  emailOnlySchema,
  fieldErrors,
  loginSchema,
  newPasswordSchema,
  profileSchema,
  registerSchema,
  type FieldErrors,
} from "@/lib/auth/validation";

export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fields?: FieldErrors;
  /** Echo of non-secret inputs so the form keeps them after a failed submit. */
  values?: Record<string, string>;
}

const NOT_CONFIGURED: FormState = { status: "error", message: "Accounts are not available on this installation yet." };
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

const callbackUrl = (next: string) => `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { fullName: str(fd, "fullName"), email: str(fd, "email") };
  const parsed = registerSchema.safeParse({ ...values, password: str(fd, "password"), confirmPassword: str(fd, "confirmPassword") });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values };
  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;
  let data, error;
  try {
    ({ data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: callbackUrl("/dashboard") },
    }));
  } catch (e) {
    return { status: "error", message: authErrorMessage({ message: e instanceof Error ? e.message : "network", status: 0 }), values };
  }
  if (error) return { status: "error", message: authErrorMessage(error), values };
  // With email confirmation enabled, Supabase answers an existing address with a user that has no identities.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { status: "error", fields: { email: authErrorMessage({ code: "user_already_exists" }) }, values };
  }
  if (data.session) {
    // Project has email confirmation disabled: the app still requires verification for the dashboard.
    await supabase.auth.signOut();
  }
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { email: str(fd, "email") };
  const parsed = loginSchema.safeParse({ email: values.email, password: str(fd, "password") });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values };
  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;
  let error;
  try {
    ({ error } = await supabase.auth.signInWithPassword(parsed.data));
  } catch (e) {
    return { status: "error", message: authErrorMessage({ message: e instanceof Error ? e.message : "network", status: 0 }), values };
  }
  if (error) {
    if (error.code === "email_not_confirmed") redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}&reason=unverified`);
    return { status: "error", message: authErrorMessage(error), values };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(str(fd, "next")));
}

export async function resendVerificationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse({ email: str(fd, "email") });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values: { email: str(fd, "email") } };
  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: callbackUrl("/dashboard") } });
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { status: "error", message: authErrorMessage(error) };
  } catch (e) {
    return { status: "error", message: authErrorMessage({ message: e instanceof Error ? e.message : "network", status: 0 }) };
  }
  // Same answer whether or not the address exists (no account enumeration).
  return { status: "success", message: "If that address has an unverified account, a new verification email is on its way.", values: { email: parsed.data.email } };
}

export async function requestPasswordResetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse({ email: str(fd, "email") });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values: { email: str(fd, "email") } };
  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callbackUrl("/reset-password") });
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) return { status: "error", message: authErrorMessage(error) };
  } catch (e) {
    return { status: "error", message: authErrorMessage({ message: e instanceof Error ? e.message : "network", status: 0 }) };
  }
  return { status: "success", message: "If an account exists for that address, we've sent a password reset link. It expires after one hour.", values: { email: parsed.data.email } };
}

export async function updatePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: str(fd, "password"), confirmPassword: str(fd, "confirmPassword") });
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };
  const session = await getSessionUser();
  if (!session) return { status: "error", message: "This reset link is invalid or has expired. Request a new one." };
  const { error } = await session.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: authErrorMessage(error) };
  // Sign out other sessions so a leaked old password can't keep a session alive.
  await session.supabase.auth.signOut({ scope: "others" });
  redirect("/dashboard?notice=password-updated");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?notice=signed-out");
}

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { fullName: str(fd, "fullName"), companyName: str(fd, "companyName"), avatarUrl: str(fd, "avatarUrl") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error), values };
  const session = await getSessionUser();
  if (!session) return { status: "error", message: "Your session has ended. Please log in again." };
  // The row is chosen by the verified session user id — never by a client-supplied id. RLS enforces it again.
  await session.supabase.rpc("ensure_profile");
  const { error } = await session.supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, company_name: parsed.data.companyName || null, avatar_url: parsed.data.avatarUrl || null })
    .eq("id", session.user.id);
  if (error) return { status: "error", message: "Your profile could not be saved. Please try again.", values };
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Profile saved.", values };
}
