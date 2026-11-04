"use client";

import { useCallback, useEffect, useState } from "react";
import type { Design, LogoAsset } from "../qr/engine/types";
import { useAccount } from "../account/use-account";
import { ConflictError, parseDesign, type TemplateRow } from "../account/model";
import { createCloudTemplate, deleteCloudTemplate, downloadLogo, listCloudTemplates, renameCloudTemplate } from "../account/repo";
import { logoAssetFromDataUrl } from "../image/logo-process";
import { cleanTemplateName, createTemplate, exportTemplates, importTemplates, type UserTemplate } from "./model";
import { deleteTemplate, listTemplates, saveTemplates } from "./storage";

/** One entry of "My templates", whichever store it lives in. */
export interface LibraryItem {
  key: string;
  id: string;
  name: string;
  design: Design;
  hasLogo: boolean;
  updatedAt: string;
  source: "cloud" | "local";
  /** Local item that also exists in the account (same id). */
  alsoInCloud?: boolean;
  revision?: number;
}

export type LibraryMessage = { tone: "success" | "error" | "info"; text: string } | null;

function fromCloud(r: TemplateRow): LibraryItem | null {
  const d = parseDesign(r.design);
  if (!d.design) return null;
  return { key: `cloud:${r.id}`, id: r.id, name: r.name, design: d.design, hasLogo: Boolean(r.logo_path), updatedAt: r.updated_at, source: "cloud", revision: r.revision };
}

export function useTemplateLibrary() {
  const account = useAccount();
  const sb = account.status === "signed-in" ? account.supabase : null;
  const [local, setLocal] = useState<UserTemplate[] | null>(null);
  const [cloudRows, setCloudRows] = useState<TemplateRow[] | null>(null);
  const [message, setMessage] = useState<LibraryMessage>(null);

  const loadLocal = useCallback(async () => {
    try {
      setLocal(await listTemplates());
    } catch (e) {
      setLocal([]);
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Templates on this device could not be loaded." });
    }
  }, []);
  const loadCloud = useCallback(async () => {
    if (!sb) {
      setCloudRows(null);
      return;
    }
    try {
      setCloudRows(await listCloudTemplates(sb));
    } catch (e) {
      setCloudRows([]);
      setMessage({ tone: "error", text: `${e instanceof Error ? e.message : "Cloud templates could not be loaded."} Templates on this device are still available.` });
    }
  }, [sb]);

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((l) => !cancelled && setLocal(l))
      .catch(() => !cancelled && setLocal([]));
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    listCloudTemplates(sb)
      .then((rows) => !cancelled && setCloudRows(rows))
      .catch(() => {
        if (cancelled) return;
        setCloudRows([]);
        setMessage({ tone: "error", text: "Cloud templates could not be loaded. Templates on this device are still available." });
      });
    return () => {
      cancelled = true;
    };
  }, [sb]);

  const cloud = sb ? cloudRows : null;
  const cloudIds = new Set((cloud ?? []).map((r) => r.id));
  const items: LibraryItem[] = [
    ...(cloud ?? []).map(fromCloud).filter((x): x is LibraryItem => x !== null),
    ...(local ?? []).map((t) => ({ key: `local:${t.id}`, id: t.id, name: t.name, design: t.design, hasLogo: Boolean(t.logo), updatedAt: t.updatedAt, source: "local" as const, alsoInCloud: cloudIds.has(t.id) })),
  ];
  const loading = local === null || (sb !== null && cloudRows === null);
  const pendingUpload = (local ?? []).filter((t) => !cloudIds.has(t.id));

  /** Saves to the account when signed in; if that fails the template is kept on this device. */
  const save = async (name: string, design: Design, logo: LogoAsset | null) => {
    const tpl = createTemplate(name, design, logo ? { dataUrl: logo.dataUrl, name: logo.name } : null);
    if (sb) {
      try {
        await createCloudTemplate(sb, { id: tpl.id, name: tpl.name, design: tpl.design, logo: tpl.logo });
        setMessage({ tone: "success", text: `Saved “${tpl.name}” to your account.` });
        await loadCloud();
        return;
      } catch {
        await saveTemplates([tpl]);
        setMessage({ tone: "error", text: `Couldn't reach your account, so “${tpl.name}” was saved on this device only. Upload it later from My templates.` });
        await loadLocal();
        return;
      }
    }
    await saveTemplates([tpl]);
    setMessage({ tone: "success", text: `Saved “${tpl.name}” on this device.` });
    await loadLocal();
  };

  const rename = async (item: LibraryItem, newName: string) => {
    const name = cleanTemplateName(newName);
    try {
      if (item.source === "cloud" && sb) {
        await renameCloudTemplate(sb, item.id, item.revision ?? 1, name);
        await loadCloud();
      } else {
        const t = (local ?? []).find((x) => x.id === item.id);
        if (!t) return;
        await saveTemplates([{ ...t, name, updatedAt: new Date().toISOString() }]);
        await loadLocal();
      }
      setMessage({ tone: "success", text: "Template renamed." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ConflictError ? e.message : "The template could not be renamed." });
      if (e instanceof ConflictError) await loadCloud();
    }
  };

  const remove = async (item: LibraryItem) => {
    try {
      if (item.source === "cloud" && sb) {
        const row = (cloud ?? []).find((r) => r.id === item.id);
        await deleteCloudTemplate(sb, { id: item.id, logo_path: row?.logo_path ?? null });
        await loadCloud();
      } else {
        await deleteTemplate(item.id);
        await loadLocal();
      }
      setMessage({ tone: "success", text: `Deleted “${item.name}”.` });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "The template could not be deleted." });
    }
  };

  /** Resolves the logo of an item (cloud: private storage download; local: stored data URL). */
  const logoOf = async (item: LibraryItem): Promise<{ asset: LogoAsset | undefined; missing: boolean }> => {
    if (!item.hasLogo) return { asset: undefined, missing: false };
    if (item.source === "local") {
      const t = (local ?? []).find((x) => x.id === item.id);
      return t?.logo ? { asset: await logoAssetFromDataUrl(t.logo.dataUrl, t.logo.name), missing: false } : { asset: undefined, missing: true };
    }
    const row = (cloud ?? []).find((r) => r.id === item.id);
    const dataUrl = sb && row?.logo_path ? await downloadLogo(sb, row.logo_path) : null;
    return dataUrl ? { asset: await logoAssetFromDataUrl(dataUrl, row?.logo_name ?? "logo.png"), missing: false } : { asset: undefined, missing: true };
  };

  /** Copies device templates into the account (same ids → idempotent). Never deletes local copies. */
  const uploadLocal = async (only?: UserTemplate[]) => {
    if (!sb) return;
    const todo = only ?? pendingUpload;
    let ok = 0;
    let failed = 0;
    for (const t of todo) {
      try {
        await createCloudTemplate(sb, { id: t.id, name: t.name, design: t.design, logo: t.logo }, { ignoreExisting: true });
        ok++;
      } catch {
        failed++;
      }
    }
    await loadCloud();
    setMessage(
      failed
        ? { tone: "error", text: `Uploaded ${ok} template${ok === 1 ? "" : "s"}; ${failed} failed and stay on this device.` }
        : { tone: "success", text: `Uploaded ${ok} template${ok === 1 ? "" : "s"} to your account. The copies on this device were kept.` },
    );
  };

  const exportAll = async (): Promise<{ json: string; count: number }> => {
    const all: UserTemplate[] = [];
    for (const r of cloud ?? []) {
      const d = parseDesign(r.design);
      if (!d.design) continue;
      const logo = sb && r.logo_path ? await downloadLogo(sb, r.logo_path) : null;
      all.push({ id: r.id, name: r.name, design: d.design, logo: logo ? { dataUrl: logo, name: r.logo_name ?? "logo.png" } : null, createdAt: r.created_at, updatedAt: r.updated_at });
    }
    for (const t of local ?? []) if (!cloudIds.has(t.id)) all.push(t);
    return { json: exportTemplates(all), count: all.length };
  };

  const importFile = async (file: File) => {
    const outcome = importTemplates(await file.text(), file.size);
    if (!outcome.ok) {
      setMessage({ tone: "error", text: outcome.error });
      return;
    }
    const { templates, skipped } = outcome.result;
    let toCloud = 0;
    let toLocal = 0;
    for (const t of templates) {
      if (sb) {
        try {
          await createCloudTemplate(sb, { id: t.id, name: t.name, design: t.design, logo: t.logo });
          toCloud++;
          continue;
        } catch {
          /* fall back to this device */
        }
      }
      await saveTemplates([t]);
      toLocal++;
    }
    await Promise.all([loadLocal(), loadCloud()]);
    const where = sb ? (toLocal ? ` (${toCloud} to your account, ${toLocal} on this device)` : " to your account") : "";
    const skippedText = skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).map((s) => `${s.name} (${s.reason})`).join("; ")}${skipped.length > 3 ? "…" : ""}` : "";
    setMessage({ tone: templates.length ? (skipped.length || (sb && toLocal) ? "info" : "success") : "error", text: `Imported ${templates.length} template${templates.length === 1 ? "" : "s"}${where}.${skippedText}` });
  };

  return { account, items, loading, pendingUpload, message, setMessage, save, rename, remove, logoOf, uploadLocal, exportAll, importFile, signedIn: Boolean(sb) };
}
