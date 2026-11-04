import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Verify your email" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function VerifyEmailPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.slice(0, 320) : undefined;
  const unverified = sp.reason === "unverified";
  return (
    <AuthCard
      title="Check your inbox"
      intro={
        <>
          {email ? (
            <>
              We sent a verification link to <strong className="text-ink-1">{email}</strong>.
            </>
          ) : (
            "We sent you a verification link."
          )}{" "}
          Open it on this device to activate your account. The link expires after 24 hours.
        </>
      }
      footer={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex justify-center" aria-hidden="true">
          <MailCheck className="size-12 text-[#5E17EB]" />
        </div>
        {unverified && (
          <Notice tone="info">
            <span data-testid="unverified-notice">Your email address isn&apos;t verified yet, so you can&apos;t log in. Use the link in the email, or send a new one.</span>
          </Notice>
        )}
        <p className="text-sm text-ink-2">Didn&apos;t get it? Check your spam folder, then resend:</p>
        <ResendVerificationForm email={email} />
      </div>
    </AuthCard>
  );
}
