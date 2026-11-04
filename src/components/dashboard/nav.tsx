"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, History, LayoutDashboard, LayoutTemplate, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "My QR projects", icon: FolderKanban },
  { href: "/dashboard/history", label: "QR history", icon: History },
  { href: "/dashboard/templates", label: "My templates", icon: LayoutTemplate },
  { href: "/dashboard/settings", label: "Profile & settings", icon: UserRound },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="lg:sticky lg:top-20 lg:self-start">
      <ul className="flex gap-1 overflow-x-auto rounded-modal border border-line bg-white p-1.5 lg:flex-col">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-card px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-[#5E17EB]/10 text-[#4A10C4]" : "text-ink-2 hover:bg-surface-2 hover:text-ink-1",
                )}
              >
                <Icon className={cn("size-4", active ? "text-[#5E17EB]" : "text-ink-3")} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
