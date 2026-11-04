import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirect";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Lands email links: verification, password recovery and email change.
 * Supports both the recommended SSR template (?token_hash=…&type=…) and the PKCE redirect (?code=…).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const isRecovery = type === "recovery" || next === "/reset-password";
  const fail = (reason: string) => {
    const target = new URL(isRecovery ? "/forgot-password" : "/login", url.origin);
    target.searchParams.set("error", reason);
    return NextResponse.redirect(target);
  };

  if (url.searchParams.get("error")) return fail("link-invalid");
  const supabase = await createServerSupabase();
  if (!supabase) return fail("not-configured");

  try {
    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return fail("link-invalid");
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail("link-invalid");
    } else {
      return fail("link-invalid");
    }
  } catch {
    return fail("unreachable");
  }

  const target = new URL(type === "recovery" ? "/reset-password" : next, url.origin);
  if (type === "signup" || type === "email") target.searchParams.set("notice", "verified");
  return NextResponse.redirect(target);
}
