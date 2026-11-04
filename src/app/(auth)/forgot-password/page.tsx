import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, QueryMessage } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <AuthCard
      title="Forgot your password?"
      intro="Enter your account email and we'll send you a link to choose a new password."
      footer={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      <QueryMessage code={typeof sp.error === "string" ? sp.error : undefined} />
      <ForgotPasswordForm />
    </AuthCard>
  );
}
