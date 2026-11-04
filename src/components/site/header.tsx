"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Brand } from "./brand";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/#types", label: "QR types" },
  { href: "/templates", label: "Templates" },
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean | ((v: boolean) => boolean)) =>
    setOpenOn((typeof value === "function" ? value(open) : value) ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-tile px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink-1">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/create" size="sm" className={cn(pathname === "/create" && "hidden sm:inline-flex")}>
            Create QR code
          </ButtonLink>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-tile text-ink-1 hover:bg-surface-2 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="mobile-nav" aria-label="Mobile" hidden={!open} className="border-t border-line bg-white lg:hidden">
        <ul className="mx-auto flex max-w-[1200px] flex-col px-4 py-2 sm:px-6">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)} className="block rounded-tile px-3 py-3 text-base font-medium text-ink-1 hover:bg-surface-2">
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/create" onClick={() => setOpen(false)} className="block rounded-tile px-3 py-3 text-base font-semibold text-brand-700 hover:bg-surface-2">
              Open the QR studio →
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
