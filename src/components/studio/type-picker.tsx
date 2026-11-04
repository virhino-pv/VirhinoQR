"use client";

import { CONTENT_TYPES, type ContentTypeId } from "@/lib/payloads";
import { TYPE_ICONS } from "@/components/qr/type-icons";
import { useStudio } from "@/lib/store/studio";
import { cn } from "@/lib/cn";

const GROUPS = [
  { tier: "static" as const, title: "Encoded in the code" },
  { tier: "linked" as const, title: "Links to content you host" },
];

export function TypePicker() {
  const typeId = useStudio((s) => s.typeId);
  const setType = useStudio((s) => s.setType);
  const select = (id: ContentTypeId) => {
    setType(id);
    const url = new URL(window.location.href);
    url.searchParams.set("type", id);
    url.searchParams.delete("url");
    window.history.replaceState(null, "", url);
  };
  return (
    <section aria-labelledby="type-picker-title" className="rounded-modal border border-line bg-white p-4 sm:p-5">
      <h2 id="type-picker-title" className="mb-3 text-base font-semibold">
        1. Choose a content type
      </h2>
      <div className="space-y-4">
        {GROUPS.map((g) => (
          <div key={g.tier}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{g.title}</p>
            <ul className="flex flex-wrap gap-2">
              {CONTENT_TYPES.filter((t) => t.tier === g.tier).map((t) => {
                const Icon = TYPE_ICONS[t.id];
                const active = t.id === typeId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      data-type={t.id}
                      onClick={() => select(t.id)}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                        active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink-1 hover:border-brand-600 hover:text-brand-700",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
