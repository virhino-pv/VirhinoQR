import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/nav";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Authorization gate for every dashboard route (the proxy check is only optimistic). */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/dashboard");
  if (!session.user.emailVerified) redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}&reason=unverified`);

  const { data: profile } = await session.supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle();
  const name = (profile?.full_name as string | undefined) || session.user.fullName || session.user.email;

  return (
    <div className="min-h-[70vh] bg-surface-1">
      <div className="bg-gradient-to-r from-[#5E17EB] via-[#3A2BEF] to-[#005DFB] text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
          <div>
            <p className="text-sm text-white/80">Signed in as {session.user.email}</p>
            <p className="text-xl font-bold" data-testid="dashboard-greeting">
              Hello, {name}
            </p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="light" size="sm" data-testid="sign-out">
              Log out
            </Button>
          </form>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <DashboardNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
