import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getSessionUser } from "@/lib/supabase/server";
import { accountsEnabled } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Choose a new password" };
// Always per-request: the page depends on the recovery session cookie.
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  // The recovery link signs the user in (auth/callback); without that session the link was invalid or expired.
  const session = accountsEnabled ? await getSessionUser() : null;
  return (
    <AuthCard title="Choose a new password" intro={session ? <>For <strong className="text-ink-1">{session.user.email}</strong></> : undefined}>
      {session ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-4">
          <Notice tone="error">
            <span data-testid="reset-invalid">This password reset link is invalid or has expired.</span>
          </Notice>
          <ButtonLink href="/forgot-password" className="w-full">
            Request a new link
          </ButtonLink>
        </div>
      )}
    </AuthCard>
  );
}
