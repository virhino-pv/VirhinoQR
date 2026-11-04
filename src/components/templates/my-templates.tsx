"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Cloud, Download, HardDrive, Pencil, Save, Trash2, Upload, UploadCloud, X } from "lucide-react";
import { TEMPLATE_NAME_MAX, sameDesign, validateTemplateName } from "@/lib/templates/model";
import type { LibraryItem, useTemplateLibrary } from "@/lib/templates/use-library";
import type { Design, LogoAsset } from "@/lib/qr/engine/types";
import { triggerDownload } from "@/lib/qr/export/browser";
import { QrImage } from "@/components/qr/qr-image";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

type Library = ReturnType<typeof useTemplateLibrary>;

function SourceBadge({ item }: { item: LibraryItem }) {
  const cloud = item.source === "cloud";
  return (
    <span
      data-source={item.source}
      className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cloud ? "bg-[#5E17EB]/10 text-[#5E17EB]" : "bg-surface-2 text-ink-2")}
    >
      {cloud ? <Cloud className="size-3" aria-hidden="true" /> : <HardDrive className="size-3" aria-hidden="true" />}
      {cloud ? "Synced" : item.alsoInCloud ? "This device · also in account" : "This device"}
    </span>
  );
}

/**
 * "My templates": device (IndexedDB) and account (Supabase) templates with save, rename, delete,
 * upload, JSON export/import. Used in the studio panel and the dashboard.
 */
export function MyTemplates({
  library,
  previewText,
  design,
  logo,
  onApply,
  showSave = true,
}: {
  library: Library;
  previewText: string;
  design?: Design;
  logo?: LogoAsset | null;
  onApply?: (item: LibraryItem) => void | Promise<void>;
  showSave?: boolean;
}) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [editing, setEditing] = useState<{ key: string; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { items, loading, message, signedIn, account, pendingUpload } = library;

  const save = async () => {
    const err = validateTemplateName(name);
    setNameError(err);
    if (err || !design) return;
    await library.save(name, design, logo && includeLogo ? logo : null);
    setName("");
  };

  const exportAll = async () => {
    const { json, count } = await library.exportAll();
    if (!count) return;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    triggerDownload(new Blob([json], { type: "application/json" }), `qr-studio-templates-${stamp}.json`);
    library.setMessage({ tone: "success", text: `Exported ${count} template${count === 1 ? "" : "s"}.` });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">My templates</h3>
        {account.status !== "disabled" && (
          <span className="text-xs text-ink-2" data-testid="sync-state">
            {signedIn ? "Signed in — new templates sync to your account." : account.status === "signed-out" ? (
              <>
                Saved on this device. <Link href="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link> to sync across devices.
              </>
            ) : null}
          </span>
        )}
      </div>
      {account.status === "disabled" && <p className="text-xs text-ink-2">Saved in this browser only. Export them to back up or move to another device.</p>}

      {showSave && design && (
        <>
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
        </>
      )}

      {signedIn && pendingUpload.length > 0 && (
        <Notice tone="info" title={`${pendingUpload.length} template${pendingUpload.length === 1 ? "" : "s"} only on this device`}>
          <div className="flex flex-wrap items-center gap-2">
            <span>Upload them to your account to use them on other devices. The copies here are kept.</span>
            <Button size="sm" variant="secondary" icon={<UploadCloud className="size-4" aria-hidden="true" />} onClick={() => void library.uploadLocal()} data-testid="upload-local">
              Upload to my account
            </Button>
          </div>
        </Notice>
      )}

      {loading ? (
        <p className="text-sm text-ink-2">Loading saved templates…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-2" data-testid="no-user-templates">
          No saved templates yet.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="user-templates">
          {items.map((t) => (
            <li key={t.key} data-user-template={t.name} data-source={t.source} className="flex items-center gap-3 rounded-card border border-line p-2">
              <QrImage text={previewText} design={t.design} alt="" size={96} className="size-14 shrink-0" />
              <div className="min-w-0 flex-1">
                {editing?.key === t.key ? (
                  <form
                    className="flex gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const err = validateTemplateName(editing.name);
                      if (err) return library.setMessage({ tone: "error", text: err });
                      void library.rename(t, editing.name).then(() => setEditing(null));
                    }}
                  >
                    <Input aria-label={`New name for ${t.name}`} value={editing.name} autoFocus className="h-9" onChange={(e) => setEditing({ key: t.key, name: e.target.value })} />
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
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                      <SourceBadge item={t} />
                      {t.hasLogo ? "With logo · " : ""}Saved {new Date(t.updatedAt).toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>
              {editing?.key !== t.key && (
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {onApply && (
                    <Button size="sm" variant={design && sameDesign(t.design, design) ? "secondary" : "outline"} onClick={() => void onApply(t)} aria-label={`Apply ${t.name}`}>
                      Apply
                    </Button>
                  )}
                  {!onApply && t.source === "cloud" && (
                    <Link href={`/create?usertemplate=${t.id}`} className={buttonClasses("outline", "sm")} aria-label={`Open ${t.name} in the studio`}>
                      Use
                    </Link>
                  )}
                  {signedIn && t.source === "local" && !t.alsoInCloud && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Upload ${t.name} to my account`}
                      onClick={() => void library.uploadLocal(library.pendingUpload.filter((x) => x.id === t.id))}
                    >
                      <UploadCloud className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" aria-label={`Rename ${t.name}`} onClick={() => setEditing({ key: t.key, name: t.name })}>
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
        {items.length > 0 && (
          <Button size="sm" variant="outline" icon={<Download className="size-4" aria-hidden="true" />} onClick={() => void exportAll()}>
            Export templates
          </Button>
        )}
        <Button size="sm" variant="outline" icon={<Upload className="size-4" aria-hidden="true" />} onClick={() => importRef.current?.click()}>
          Import templates
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Import templates file"
          data-testid="template-import"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (importRef.current) importRef.current.value = "";
            if (f) void library.importFile(f);
          }}
        />
      </div>

      <div aria-live="polite" data-testid="template-status">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>

      <dialog ref={dialogRef} aria-labelledby="delete-template-title" className="m-auto w-[min(92vw,26rem)] rounded-modal p-0 shadow-e3 backdrop:bg-ink-1/50" onClose={() => setPendingDelete(null)}>
        <div className="space-y-4 p-6">
          <h3 id="delete-template-title" className="text-lg font-semibold">
            Delete template?
          </h3>
          <p className="text-sm text-ink-2">
            “{pendingDelete?.name}” will be removed {pendingDelete?.source === "cloud" ? "from your account on all devices" : "from this browser"}. This cannot be undone unless you exported it.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" autoFocus onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const t = pendingDelete;
                dialogRef.current?.close();
                if (t) void library.remove(t);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
