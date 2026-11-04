"use client";

import Link from "next/link";
import { LayoutDashboard, LogIn } from "lucide-react";
import { useAccount } from "@/lib/account/use-account";
import { cn } from "@/lib/cn";

/** Header entry: "Log in" or "Dashboard". Renders nothing when accounts are not configured. */
export function AccountLink({ className, onNavigate, testId = "account-link" }: { className?: string; onNavigate?: () => void; testId?: string }) {
  const account = useAccount();
  if (account.status === "disabled" || account.status === "loading") return null;
  const signedIn = account.status === "signed-in";
  return (
    <Link
      href={signedIn ? "/dashboard" : "/login"}
      onClick={onNavigate}
      data-testid={testId}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-tile px-3 text-sm font-semibold text-ink-1 hover:bg-surface-2", className)}
    >
      {signedIn ? <LayoutDashboard className="size-4" aria-hidden="true" /> : <LogIn className="size-4" aria-hidden="true" />}
      {signedIn ? "Dashboard" : "Log in"}
    </Link>
  );
}
