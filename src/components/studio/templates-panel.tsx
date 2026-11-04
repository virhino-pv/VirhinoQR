"use client";

import { useDeferredValue, useState } from "react";
import { Check } from "lucide-react";
import { useStudio } from "@/lib/store/studio";
import { BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/templates/builtin";
import { sameDesign } from "@/lib/templates/model";
import { useTemplateLibrary, type LibraryItem } from "@/lib/templates/use-library";
import { QrImage } from "@/components/qr/qr-image";
import { MyTemplates } from "@/components/templates/my-templates";
import { cn } from "@/lib/cn";

const FALLBACK_TEXT = "https://qr-studio.example";

export function TemplatesPanel({ previewText }: { previewText: string | null }) {
  const design = useStudio((s) => s.design);
  const logo = useStudio((s) => s.logo);
  const applyDesign = useStudio((s) => s.applyDesign);
  // Thumbnails follow the typed content without blocking typing.
  const text = useDeferredValue(previewText ?? FALLBACK_TEXT);
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const library = useTemplateLibrary();

  const applyUser = async (t: LibraryItem) => {
    try {
      const { asset, missing } = await library.logoOf(t);
      applyDesign(t.design, asset);
      library.setMessage({ tone: missing ? "info" : "success", text: `Applied “${t.name}”.${missing ? " Its logo is no longer available, so it was left out." : ""}` });
    } catch (e) {
      library.setMessage({ tone: "error", text: e instanceof Error ? e.message : "The template could not be applied." });
    }
  };

  const builtins = BUILTIN_TEMPLATES.filter((t) => category === "all" || t.category === category);

  return (
    <>
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter templates">
          {[{ id: "all" as const, label: "All" }, ...TEMPLATE_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn("h-8 rounded-full border px-3 text-xs font-semibold", category === c.id ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink-2 hover:border-brand-600")}
            >
              {c.label}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="builtin-templates">
          {builtins.map((t) => {
            const active = sameDesign(t.design, design);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  data-template={t.id}
                  title={t.description}
                  onClick={() => {
                    applyDesign(t.design);
                    library.setMessage({ tone: "success", text: `Applied “${t.name}”.${logo ? " Your logo was kept." : ""}` });
                  }}
                  className={cn("flex w-full flex-col items-center gap-1.5 rounded-card border bg-white p-2 text-xs font-medium transition-all", active ? "border-brand-600 ring-3 ring-brand-100" : "border-line hover:border-brand-200")}
                >
                  <QrImage text={text} design={t.design} alt="" size={140} className={cn("w-full", t.design.background.transparent && "bg-checker")} />
                  <span className="flex items-center gap-1">
                    {active && <Check className="size-3 text-brand-600" aria-hidden="true" />}
                    {t.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-3">Built-in templates are always available, with or without an account.</p>
      </div>

      <div className="border-t border-line pt-4">
        <MyTemplates library={library} previewText={text} design={design} logo={logo} onApply={applyUser} />
      </div>
    </>
  );
}
