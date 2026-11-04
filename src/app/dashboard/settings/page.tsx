import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/auth/auth-forms";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Profile & settings" };

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/dashboard/settings");
  // Missing profile rows (e.g. accounts created before the migration) are repaired for the caller only.
  await session.supabase.rpc("ensure_profile");
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("full_name, company_name, avatar_url, created_at")
    .eq("id", session.user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile &amp; settings</h1>
      <section aria-labelledby="profile-title" className="rounded-modal border border-line bg-white p-5">
        <h2 id="profile-title" className="mb-4 font-semibold">
          Profile
        </h2>
        <ProfileForm
          initial={{
            fullName: (profile?.full_name as string) || session.user.fullName,
            companyName: (profile?.company_name as string) ?? "",
            avatarUrl: (profile?.avatar_url as string) ?? "",
          }}
        />
      </section>
      <section aria-labelledby="account-title" className="rounded-modal border border-line bg-white p-5">
        <h2 id="account-title" className="mb-3 font-semibold">
          Account
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-ink-2">Email</dt>
          <dd data-testid="account-email">{session.user.email}</dd>
          <dt className="text-ink-2">Email verified</dt>
          <dd>{session.user.emailVerified ? "Yes" : "No"}</dd>
          <dt className="text-ink-2">Member since</dt>
          <dd>{profile?.created_at ? new Date(profile.created_at as string).toLocaleDateString() : "—"}</dd>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/forgot-password" className="inline-flex h-9 items-center rounded-card border border-line px-3 text-sm font-semibold hover:border-[#5E17EB]">
            Change password
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
