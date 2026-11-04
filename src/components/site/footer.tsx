import Link from "next/link";
import { Brand } from "./brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/create", label: "QR studio" },
      { href: "/#types", label: "QR code types" },
      { href: "/#features", label: "Features" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#use-cases", label: "Use cases" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Popular",
    links: [
      { href: "/create?type=url", label: "Website QR code" },
      { href: "/create?type=wifi", label: "Wi-Fi QR code" },
      { href: "/create?type=vcard", label: "vCard QR code" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-brand-900 text-brand-100">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Brand inverted />
          <p className="max-w-xs text-sm leading-relaxed text-brand-200">
            Design QR codes that scan. Everything is generated in your browser — your content never leaves your device.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-3 text-sm font-semibold text-white">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-brand-200 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-5 text-xs text-brand-200 sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} QR Studio.</p>
          <p>QR Code is a registered trademark of DENSO WAVE INCORPORATED.</p>
        </div>
      </div>
    </footer>
  );
}
