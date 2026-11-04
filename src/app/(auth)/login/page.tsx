import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, QueryMessage } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Log in" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNext(sp.next) : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <AuthCard
      title="Log in"
      intro="Access your saved QR projects, history and templates."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <QueryMessage code={error ?? (next ? "session-expired" : undefined)} />
      <LoginForm next={next} />
    </AuthCard>
  );
}
