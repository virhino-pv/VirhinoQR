"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Check, Download, Pencil, Save, Trash2, Upload, X } from "lucide-react";
import { useStudio } from "@/lib/store/studio";
import { BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/templates/builtin";
import {
  TEMPLATE_NAME_MAX,
  cleanTemplateName,
  createTemplate,
  exportTemplates,
  importTemplates,
  sameDesign,
  validateTemplateName,
  type UserTemplate,
} from "@/lib/templates/model";
import { deleteTemplate, listTemplates, saveTemplates } from "@/lib/templates/storage";
import { logoAssetFromDataUrl } from "@/lib/image/logo-process";
import { triggerDownload } from "@/lib/qr/export/browser";
import { QrImage } from "@/components/qr/qr-image";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

const FALLBACK_TEXT = "https://qr-studio.example";

type Message = { tone: "success" | "error" | "info"; text: string } | null;

export function TemplatesPanel({ previewText }: { previewText: string | null }) {
  const design = useStudio((s) => s.design);
  const logo = useStudio((s) => s.logo);
  const applyDesign = useStudio((s) => s.applyDesign);
  // Thumbnails follow the typed content without blocking typing.
  const text = useDeferredValue(previewText ?? FALLBACK_TEXT);

  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [mine, setMine] = useState<UserTemplate[] | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [message, setMessage] = useState<Message>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserTemplate | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      setMine(await listTemplates());
    } catch (e) {
      setMine([]);
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Saved templates could not be loaded." });
    }
  };
  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((list) => !cancelled && setMine(list))
      .catch((e) => {
        if (cancelled) return;
        setMine([]);
        setMessage({ tone: "error", text: e instanceof Error ? e.message : "Saved templates could not be loaded." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyUser = async (t: UserTemplate) => {
    try {
      const asset = t.logo ? await logoAssetFromDataUrl(t.logo.dataUrl, t.logo.name) : undefined;
      applyDesign(t.design, asset);
      setMessage({ tone: "success", text: `Applied “${t.name}”.` });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "The template could not be applied." });
    }
  };

  const save = async () => {
    const err = validateTemplateName(name);
    setNameError(err);
    if (err) return;
    const tpl = createTemplate(name, design, logo && includeLogo ? { dataUrl: logo.dataUrl, name: logo.name } : null);
    try {
      await saveTemplates([tpl]);
      setName("");
      setMessage({ tone: "success", text: `Saved “${tpl.name}” on this device.` });
      await refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "The template could not be saved." });
    }
  };

  const rename = async () => {
    if (!editing || !mine) return;
    const err = validateTemplateName(editing.name);
    if (err) return setMessage({ tone: "error", text: err });
    const tpl = mine.find((t) => t.id === editing.id);
    if (!tpl) return;
    await saveTemplates([{ ...tpl, name: cleanTemplateName(editing.name), updatedAt: new Date().toISOString() }]);
    setEditing(null);
    setMessage({ tone: "success", text: "Template renamed." });
    await refresh();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const t = pendingDelete;
    dialogRef.current?.close();
    setPendingDelete(null);
    await deleteTemplate(t.id);
    setMessage({ tone: "success", text: `Deleted “${t.name}”.` });
    await refresh();
  };

  const exportAll = () => {
    if (!mine?.length) return;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    triggerDownload(new Blob([exportTemplates(mine)], { type: "application/json" }), `qr-studio-templates-${stamp}.json`);
    setMessage({ tone: "success", text: `Exported ${mine.length} template${mine.length === 1 ? "" : "s"}.` });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (importRef.current) importRef.current.value = "";
    const outcome = importTemplates(await file.text(), file.size);
    if (!outcome.ok) return setMessage({ tone: "error", text: outcome.error });
    const { templates, skipped } = outcome.result;
    try {
      if (templates.length) await saveTemplates(templates);
    } catch (e) {
      return setMessage({ tone: "error", text: e instanceof Error ? e.message : "Import failed while saving." });
    }
    const skippedText = skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).map((s) => `${s.name} (${s.reason})`).join("; ")}${skipped.length > 3 ? "…" : ""}` : "";
    setMessage({ tone: templates.length ? (skipped.length ? "info" : "success") : "error", text: `Imported ${templates.length} template${templates.length === 1 ? "" : "s"}.${skippedText}` });
    await refresh();
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
                    setMessage({ tone: "success", text: `Applied “${t.name}”.${logo ? " Your logo was kept." : ""}` });
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
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <h3 className="text-sm font-semibold">My templates</h3>
        <p className="text-xs text-ink-2">Saved in this browser only. Export them to back up or move to another device.</p>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field id="template-name" label="Template name" error={nameError ?? undefined} className="flex-1">
            {(a11y) => <Input {...a11y} value={name} maxLength={TEMPLATE_NAME_MAX + 10} placeholder="e.g. Spring campaign" onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Button type="submit" variant="secondary" icon={<Save className="size-4" aria-hidden="true" />} className={nameError ? "sm:mb-7" : ""}>
            Save current design
          </Button>
        </form>
        {logo && <Checkbox id="template-include-logo" label="Include the current logo" checked={includeLogo} onChange={(e) => setIncludeLogo(e.target.checked)} />}

        {mine === null ? (
          <p className="text-sm text-ink-2">Loading saved templates…</p>
        ) : mine.length === 0 ? (
          <p className="text-sm text-ink-2" data-testid="no-user-templates">
            No saved templates yet.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="user-templates">
            {mine.map((t) => (
              <li key={t.id} data-user-template={t.name} className="flex items-center gap-3 rounded-card border border-line p-2">
                <QrImage text={text} design={t.design} alt="" size={96} className="size-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  {editing?.id === t.id ? (
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void rename();
                      }}
                    >
                      <Input aria-label={`New name for ${t.name}`} value={editing.name} autoFocus className="h-9" onChange={(e) => setEditing({ id: t.id, name: e.target.value })} />
                      <Button type="submit" size="sm" variant="secondary" aria-label="Save name">
                        <Check className="size-4" aria-hidden="true" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Cancel rename" onClick={() => setEditing(null)}>
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-ink-3">{t.logo ? "With logo · " : ""}Saved {new Date(t.updatedAt).toLocaleDateString()}</p>
                    </>
                  )}
                </div>
                {editing?.id !== t.id && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant={sameDesign(t.design, design) ? "secondary" : "outline"} onClick={() => void applyUser(t)} aria-label={`Apply ${t.name}`}>
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => {
                        setPendingDelete(t);
                        dialogRef.current?.showModal();
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {mine && mine.length > 0 && (
            <Button size="sm" variant="outline" icon={<Download className="size-4" aria-hidden="true" />} onClick={exportAll}>
              Export templates
            </Button>
          )}
          <Button size="sm" variant="outline" icon={<Upload className="size-4" aria-hidden="true" />} onClick={() => importRef.current?.click()}>
            Import templates
          </Button>
          <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Import templates file" data-testid="template-import" onChange={(e) => void onImport(e.target.files?.[0])} />
        </div>
      </div>

      <div aria-live="polite" data-testid="template-status">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>

      <dialog ref={dialogRef} aria-labelledby="delete-template-title" className="m-auto w-[min(92vw,26rem)] rounded-modal p-0 shadow-e3 backdrop:bg-ink-1/50" onClose={() => setPendingDelete(null)}>
        <div className="space-y-4 p-6">
          <h3 id="delete-template-title" className="text-lg font-semibold">
            Delete template?
          </h3>
          <p className="text-sm text-ink-2">“{pendingDelete?.name}” will be removed from this browser. This cannot be undone unless you exported it.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" autoFocus onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
