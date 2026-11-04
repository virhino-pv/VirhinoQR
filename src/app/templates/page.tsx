import type { Metadata } from "next";
import Link from "next/link";
import { QrImage } from "@/components/qr/qr-image";
import { ButtonLink } from "@/components/ui/button";
import { BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates/builtin";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "QR code templates",
  description: "Ready-made QR code designs — gradients, rounded and dotted styles, print-safe settings. Every template is scan-tested.",
};

const SAMPLE = "https://qr-studio.example/templates";

export default function TemplatesPage() {
  return (
    <div className="bg-surface-1 pb-16">
      <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">QR code templates</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Start from a scan-tested design, then change anything in the studio. You can also save your own designs as templates there.
        </p>
        <nav aria-label="Template categories" className="mt-6 flex flex-wrap gap-2">
          {TEMPLATE_CATEGORIES.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink-2 hover:border-brand-600 hover:text-brand-700">
              {c.label}
            </a>
          ))}
        </nav>

        {TEMPLATE_CATEGORIES.map((c) => {
          const list = BUILTIN_TEMPLATES.filter((t) => t.category === c.id);
          return (
            <section key={c.id} id={c.id} aria-labelledby={`${c.id}-title`} className="mt-10">
              <h2 id={`${c.id}-title`} className="mb-4 text-xl font-semibold">
                {c.label}
              </h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((t) => (
                  <li key={t.id} className="flex flex-col rounded-modal border border-line bg-white p-4" data-template-card={t.id}>
                    <div className={cn("mb-3 overflow-hidden rounded-card border border-line", t.design.background.transparent && "bg-checker")}>
                      <QrImage text={SAMPLE} design={t.design} alt={`${t.name} template example`} size={320} className="w-full" />
                    </div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="mb-4 flex-1 text-sm text-ink-2">{t.description}</p>
                    <ButtonLink href={`/create?template=${t.id}`} size="sm" aria-label={`Use template: ${t.name}`}>
                      Use template
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <p className="mt-12 text-sm text-ink-2">
          Want your own? Design a code in the <Link href="/create" className="font-semibold text-brand-700 hover:underline">studio</Link> and use
          “Save current design” under Templates. Saved templates stay in this browser and can be exported as a file.
        </p>
      </div>
    </div>
  );
}
