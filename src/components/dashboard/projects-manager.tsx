"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, FolderKanban, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { CONTENT_TYPES, getContentType } from "@/lib/payloads";
import { useAccount } from "@/lib/account/use-account";
import { deleteProject, duplicateProject, listProjects } from "@/lib/account/repo";
import type { Project } from "@/lib/account/model";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ProjectThumb } from "./project-thumb";

type Msg = { tone: "success" | "error" | "info"; text: string } | null;

export function ProjectsManager() {
  const account = useAccount();
  const sb = account.status === "signed-in" ? account.supabase : null;
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    try {
      setProjects(await listProjects(sb, { search, type: type || undefined }));
    } catch (e) {
      setProjects([]);
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Projects could not be loaded." });
    }
  }, [sb, search, type]);

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    const t = setTimeout(() => {
      listProjects(sb, { search, type: type || undefined })
        .then((p) => !cancelled && setProjects(p))
        .catch(() => {
          if (cancelled) return;
          setProjects([]);
          setMsg({ tone: "error", text: "Projects could not be loaded." });
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [sb, search, type]);

  const duplicate = async (p: Project) => {
    if (!sb) return;
    setBusy(p.id);
    try {
      const copy = await duplicateProject(sb, p);
      setMsg({ tone: "success", text: `Duplicated as “${copy.name}”.` });
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Duplicate failed." });
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    const p = pendingDelete;
    dialogRef.current?.close();
    if (!sb || !p) return;
    try {
      await deleteProject(sb, p);
      setMsg({ tone: "success", text: `Deleted “${p.name}”.` });
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Delete failed." });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">My QR projects</h1>
        <ButtonLink href="/create" icon={<Plus className="size-4" aria-hidden="true" />} className="bg-[#5E17EB] hover:bg-[#4A10C4]">
          New QR code
        </ButtonLink>
      </div>
      <div className="flex flex-col gap-2 rounded-modal border border-line bg-white p-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="pl-9" data-testid="project-search" />
        </label>
        <label className="sm:w-56">
          <span className="sr-only">Filter by type</span>
          <Select value={type} onChange={(e) => setType(e.target.value)} data-testid="project-type-filter">
            <option value="">All types</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div aria-live="polite">{msg && <Notice tone={msg.tone}><span data-testid="projects-status">{msg.text}</span></Notice>}</div>

      {projects === null ? (
        <p className="text-sm text-ink-2">Loading your projects…</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-modal border border-dashed border-line bg-white p-10 text-center" data-testid="projects-empty">
          <FolderKanban className="size-10 text-[#5E17EB]" aria-hidden="true" />
          <p className="font-semibold">{search || type ? "No projects match your search." : "No saved projects yet"}</p>
          <p className="max-w-sm text-sm text-ink-2">Design a QR code in the studio, then use “Save project” to keep it here and open it again later.</p>
          <ButtonLink href="/create">Open the studio</ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="projects-list">
          {projects.map((p) => (
            <li key={p.id} data-project={p.name} className="flex gap-3 rounded-modal border border-line bg-white p-3">
              <div className="w-24 shrink-0">
                <ProjectThumb project={p} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-ink-3">
                  {getContentType(p.contentType)!.label} · updated {new Date(p.updatedAt).toLocaleDateString()}
                  {p.logoPath ? " · logo" : ""}
                </p>
                <div className="mt-auto flex flex-wrap gap-1 pt-2">
                  <Link href={`/create?project=${p.id}`} className={buttonClasses("primary", "sm")} aria-label={`Open ${p.name}`}>
                    <Pencil className="size-3.5" aria-hidden="true" /> Open
                  </Link>
                  <Button size="sm" variant="outline" loading={busy === p.id} onClick={() => void duplicate(p)} aria-label={`Duplicate ${p.name}`} icon={<Copy className="size-3.5" aria-hidden="true" />}>
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      setPendingDelete(p);
                      dialogRef.current?.showModal();
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dialog ref={dialogRef} aria-labelledby="delete-project-title" className="m-auto w-[min(92vw,26rem)] rounded-modal p-0 shadow-e3 backdrop:bg-ink-1/50" onClose={() => setPendingDelete(null)}>
        <div className="space-y-4 p-6">
          <h2 id="delete-project-title" className="text-lg font-semibold">
            Delete project?
          </h2>
          <p className="text-sm text-ink-2">“{pendingDelete?.name}” and its logo will be deleted permanently. History entries stay, without the link.</p>
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
    </div>
  );
}
