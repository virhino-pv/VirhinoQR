"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, Copy, Save } from "lucide-react";
import { getContentType } from "@/lib/payloads";
import { useAccount } from "@/lib/account/use-account";
import { ConflictError, PROJECT_NAME_MAX, cleanProjectName } from "@/lib/account/model";
import { createProject, getProject, getHistoryItem, downloadLogo, listCloudTemplates, recordHistory, updateProject } from "@/lib/account/repo";
import { parseDesign } from "@/lib/account/model";
import { logoAssetFromDataUrl } from "@/lib/image/logo-process";
import { initialValues, useStudio } from "@/lib/store/studio";
import { isContentTypeId } from "@/lib/payloads";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { Pipeline } from "./use-qr-pipeline";

type Msg = { tone: "success" | "error" | "info"; text: string } | null;

/** Loads ?project= / ?history= into the studio once the session is known. */
export function useOpenFromAccount(projectId?: string, historyId?: string, userTemplateId?: string) {
  const account = useAccount();
  const openProject = useStudio((s) => s.openProject);
  const updateDesign = useStudio((s) => s.updateDesign);
  const setType = useStudio((s) => s.setType);
  const [status, setStatus] = useState<Msg>(null);
  const [done, setDone] = useState(false);
  const signedIn = account.status === "signed-in";
  const sb = account.status === "signed-in" ? account.supabase : null;

  useEffect(() => {
    if (done || (!projectId && !historyId && !userTemplateId) || account.status === "loading" || account.status === "disabled") return;
    let cancelled = false;
    const run = async () => {
      if (!sb) {
        setStatus({ tone: "info", text: "Log in to open your saved QR code." });
        setDone(true);
        return;
      }
      try {
        if (projectId) {
          const p = await getProject(sb, projectId);
          if (cancelled) return;
          if (!p) {
            setStatus({ tone: "error", text: "This project doesn't exist or isn't yours." });
          } else {
            let logo = null;
            let logoWarning = "";
            if (p.logoPath) {
              const dataUrl = await downloadLogo(sb, p.logoPath);
              if (dataUrl) logo = await logoAssetFromDataUrl(dataUrl, p.logoName ?? "logo.png");
              else logoWarning = " The saved logo is no longer available, so it was left out.";
            }
            if (cancelled) return;
            openProject({ typeId: p.contentType, values: p.values, design: p.design, logo, project: { id: p.id, name: p.name, revision: p.revision } });
            setStatus({ tone: p.warnings.length || logoWarning ? "info" : "success", text: `Opened “${p.name}”.${p.warnings.length ? ` ${p.warnings.join(" ")}` : ""}${logoWarning}` });
          }
        } else if (userTemplateId) {
          const rows = await listCloudTemplates(sb);
          const row = rows.find((r) => r.id === userTemplateId);
          const d = row ? parseDesign(row.design) : null;
          if (cancelled) return;
          if (!row || !d?.design) {
            setStatus({ tone: "error", text: "This template doesn't exist or isn't yours." });
          } else {
            const dataUrl = row.logo_path ? await downloadLogo(sb, row.logo_path) : null;
            const asset = dataUrl ? await logoAssetFromDataUrl(dataUrl, row.logo_name ?? "logo.png") : undefined;
            if (cancelled) return;
            useStudio.getState().applyDesign(d.design, asset);
            setStatus({ tone: "success", text: `Applied your template “${row.name}”.${row.logo_path && !asset ? " Its logo is no longer available." : ""}` });
          }
        } else if (historyId) {
          const h = await getHistoryItem(sb, historyId);
          if (cancelled) return;
          if (!h || !isContentTypeId(h.content_type)) {
            setStatus({ tone: "error", text: "This history entry no longer exists." });
          } else {
            setType(h.content_type);
            const d = parseDesign(h.design);
            if (d.design) updateDesign((x) => Object.assign(x, d.design));
            setStatus({ tone: "info", text: `Reopened the design of “${h.label}”. Content isn't stored in history — fill in the form again.` });
          }
        }
      } catch (e) {
        if (!cancelled) setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not open the saved item." });
      }
      if (!cancelled) setDone(true);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [account.status, sb, projectId, historyId, userTemplateId, done, openProject, updateDesign, setType]);

  return { status, signedIn };
}

export function SaveProjectPanel({ pipeline, openStatus }: { pipeline: Pipeline; openStatus: Msg }) {
  const account = useAccount();
  const project = useStudio((s) => s.project);
  const setProject = useStudio((s) => s.setProject);
  const typeId = useStudio((s) => s.typeId);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [nameFor, setNameFor] = useState<string | null>(null);
  if (project && nameFor !== project.id) {
    setNameFor(project.id);
    setName(project.name);
  }

  if (account.status === "disabled") return null;

  const here = typeof window === "undefined" ? "/create" : `${window.location.pathname}${window.location.search}`;

  const save = async (mode: "create" | "update") => {
    if (account.status !== "signed-in") return;
    const s = useStudio.getState();
    const values = s.drafts[s.typeId] ?? initialValues(s.typeId);
    const clean = cleanProjectName(name);
    if (!clean) {
      setMsg({ tone: "error", text: "Give the project a name." });
      return;
    }
    if (pipeline.result.status !== "ok") {
      setMsg({ tone: "error", text: "Complete the content first — only valid QR codes can be saved." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const input = { name: clean, contentType: s.typeId, values, design: s.design, logo: s.logo ? { dataUrl: s.logo.dataUrl, name: s.logo.name } : null };
    try {
      const saved = mode === "update" && s.project ? await updateProject(account.supabase, s.project.id, s.project.revision, input) : await createProject(account.supabase, input);
      setProject({ id: saved.id, name: saved.name, revision: saved.revision });
      void recordHistory(account.supabase, {
        contentType: saved.contentType,
        label: saved.name,
        action: "save",
        projectId: saved.id,
        design: saved.design,
        metadata: { version: pipeline.scene?.version, ec: pipeline.scene?.ec },
      });
      setMsg({ tone: "success", text: mode === "update" ? `Updated “${saved.name}”.` : `Saved “${saved.name}” to your projects.` });
      const url = new URL(window.location.href);
      url.searchParams.set("project", saved.id);
      url.searchParams.delete("history");
      window.history.replaceState(null, "", url);
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ConflictError || e instanceof Error ? e.message : "Saving failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="save-title" className="rounded-modal border border-line bg-white p-4 sm:p-5" data-testid="save-panel">
      <h2 id="save-title" className="mb-2 flex items-center gap-2 text-base font-semibold">
        <Cloud className="size-4 text-[#5E17EB]" aria-hidden="true" /> Save to my account
      </h2>
      {openStatus && (
        <Notice tone={openStatus.tone} className="mb-3">
          <span data-testid="open-status">{openStatus.text}</span>
        </Notice>
      )}
      {account.status === "loading" ? (
        <p className="text-sm text-ink-2">Checking your session…</p>
      ) : account.status === "signed-out" ? (
        <div className="space-y-2 text-sm text-ink-2">
          <p>Saving projects needs a free account. You can still download without one.</p>
          <div className="flex gap-2">
            <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonClasses("primary", "sm")}>
              Log in
            </Link>
            <Link href="/register" className={buttonClasses("outline", "sm")}>
              Create account
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(project ? "update" : "create");
          }}
        >
          <Field id="project-name" label="Project name">
            {(a11y) => <Input {...a11y} value={name} maxLength={PROJECT_NAME_MAX + 20} placeholder={`My ${getContentType(typeId)!.label} QR code`} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy} icon={<Save className="size-4" aria-hidden="true" />} data-testid="save-project">
              {project ? "Update project" : "Save project"}
            </Button>
            {project && (
              <Button size="sm" variant="outline" disabled={busy} icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => void save("create")}>
                Save as new
              </Button>
            )}
          </div>
          {project && <p className="text-xs text-ink-2">Editing saved project “{project.name}”.</p>}
          <div aria-live="polite">{msg && <Notice tone={msg.tone}><span data-testid="save-status">{msg.text}</span></Notice>}</div>
        </form>
      )}
    </section>
  );
}
