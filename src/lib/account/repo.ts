import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DESIGN } from "../qr/engine/design";
import type { Design } from "../qr/engine/types";
import type { ContentTypeId, FormValues } from "../payloads";
import {
  ConflictError,
  LOGO_BUCKET,
  cleanProjectName,
  historyLabel,
  historyMetadata,
  logoPath,
  parseProject,
  type HistoryRow,
  type Project,
  type ProjectRow,
  type TemplateRow,
} from "./model";

/**
 * Data access for saved projects, history, cloud templates and logos. Works with the browser or
 * the server client; every query is additionally restricted by RLS in the database.
 */

const PROJECT_COLUMNS = "id, name, content_type, form_values, design, logo_path, logo_name, revision, created_at, updated_at";
const TEMPLATE_COLUMNS = "id, name, design, logo_path, logo_name, revision, created_at, updated_at";
const HISTORY_COLUMNS = "id, project_id, content_type, label, action, format, design, metadata, created_at";

export async function currentUserId(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("You're not logged in.");
  return data.user.id;
}

// ---- logos (private bucket) ---------------------------------------------------------------

function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("Logo must be a PNG image.");
  const bin = atob(m[1]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

export async function uploadLogo(sb: SupabaseClient, path: string, dataUrl: string): Promise<void> {
  const { error } = await sb.storage.from(LOGO_BUCKET).upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/png" });
  if (error) throw new Error("The logo could not be uploaded.");
}

/** Returns a PNG data URL, or null when the file is missing or unreadable (handled gracefully). */
export async function downloadLogo(sb: SupabaseClient, path: string): Promise<string | null> {
  try {
    const { data, error } = await sb.storage.from(LOGO_BUCKET).download(path);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:image/png;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

async function removeLogo(sb: SupabaseClient, path: string | null) {
  if (!path) return;
  await sb.storage.from(LOGO_BUCKET).remove([path]);
}

// ---- projects ----------------------------------------------------------------------------

export interface ProjectInput {
  name: string;
  contentType: ContentTypeId;
  values: FormValues;
  design: Design;
  logo: { dataUrl: string; name: string } | null;
}

export async function listProjects(sb: SupabaseClient, opts: { search?: string; type?: string; limit?: number } = {}): Promise<Project[]> {
  let q = sb.from("qr_projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false }).limit(opts.limit ?? 200);
  if (opts.search?.trim()) q = q.ilike("name", `%${opts.search.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  if (opts.type) q = q.eq("content_type", opts.type);
  const { data, error } = await q;
  if (error) throw new Error("Your projects could not be loaded.");
  return (data as ProjectRow[]).map((r) => parseProject(r, DEFAULT_DESIGN)).filter((p): p is Project => p !== null);
}

export async function getProject(sb: SupabaseClient, id: string): Promise<Project | null> {
  const { data, error } = await sb.from("qr_projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("The project could not be loaded.");
  return data ? parseProject(data as ProjectRow, DEFAULT_DESIGN) : null;
}

export async function createProject(sb: SupabaseClient, input: ProjectInput): Promise<Project> {
  const uid = await currentUserId(sb);
  const id = crypto.randomUUID();
  let path: string | null = null;
  if (input.logo) {
    path = logoPath(uid, "projects", id);
    await uploadLogo(sb, path, input.logo.dataUrl);
  }
  const { data, error } = await sb
    .from("qr_projects")
    .insert({ id, name: cleanProjectName(input.name), content_type: input.contentType, form_values: input.values, design: input.design, logo_path: path, logo_name: input.logo?.name ?? null })
    .select(PROJECT_COLUMNS)
    .single();
  if (error || !data) {
    await removeLogo(sb, path);
    throw new Error("The project could not be saved.");
  }
  return parseProject(data as ProjectRow, DEFAULT_DESIGN)!;
}

/** Updates only if nobody changed the project since `revision` (optimistic concurrency). */
export async function updateProject(sb: SupabaseClient, id: string, revision: number, input: ProjectInput): Promise<Project> {
  const uid = await currentUserId(sb);
  let path: string | null = null;
  if (input.logo) {
    path = logoPath(uid, "projects", id);
    await uploadLogo(sb, path, input.logo.dataUrl);
  }
  const { data, error } = await sb
    .from("qr_projects")
    .update({ name: cleanProjectName(input.name), content_type: input.contentType, form_values: input.values, design: input.design, logo_path: path, logo_name: input.logo?.name ?? null })
    .eq("id", id)
    .eq("revision", revision)
    .select(PROJECT_COLUMNS);
  if (error) throw new Error("The project could not be updated.");
  if (!data || data.length === 0) throw new ConflictError("This project was changed elsewhere (or deleted). Reopen it to get the latest version, or save as a new project.");
  if (!input.logo) await removeLogo(sb, logoPath(uid, "projects", id)).catch(() => undefined);
  return parseProject(data[0] as ProjectRow, DEFAULT_DESIGN)!;
}

export async function duplicateProject(sb: SupabaseClient, p: Project): Promise<Project> {
  const logo = p.logoPath ? await downloadLogo(sb, p.logoPath) : null;
  return createProject(sb, {
    name: cleanProjectName(`${p.name} (copy)`),
    contentType: p.contentType,
    values: p.values,
    design: p.design,
    logo: logo ? { dataUrl: logo, name: p.logoName ?? "logo.png" } : null,
  });
}

export async function deleteProject(sb: SupabaseClient, p: Pick<Project, "id" | "logoPath">): Promise<void> {
  const { error, count } = await sb.from("qr_projects").delete({ count: "exact" }).eq("id", p.id);
  if (error) throw new Error("The project could not be deleted.");
  if (count === 0) throw new Error("The project no longer exists.");
  await removeLogo(sb, p.logoPath).catch(() => undefined);
}

// ---- history -----------------------------------------------------------------------------

export interface HistoryInput {
  contentType: ContentTypeId;
  label: string;
  action: "download" | "save" | "bulk";
  format?: "png" | "svg" | "pdf" | "eps" | "zip";
  projectId?: string | null;
  design?: Design | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

/** Records an explicit action. Never throws: history must not break a download. */
export async function recordHistory(sb: SupabaseClient, input: HistoryInput): Promise<boolean> {
  try {
    const { error } = await sb.from("qr_history").insert({
      content_type: input.contentType,
      label: historyLabel(input.label, input.contentType),
      action: input.action,
      format: input.format ?? null,
      project_id: input.projectId ?? null,
      design: input.design ?? null,
      metadata: historyMetadata(input.metadata ?? {}),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function listHistory(sb: SupabaseClient, opts: { type?: string; action?: string; page?: number; pageSize?: number } = {}) {
  const size = opts.pageSize ?? 20;
  const from = (opts.page ?? 0) * size;
  let q = sb.from("qr_history").select(HISTORY_COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
  if (opts.type) q = q.eq("content_type", opts.type);
  if (opts.action) q = q.eq("action", opts.action);
  const { data, error, count } = await q;
  if (error) throw new Error("Your history could not be loaded.");
  return { rows: (data ?? []) as HistoryRow[], total: count ?? 0 };
}

export async function getHistoryItem(sb: SupabaseClient, id: string): Promise<HistoryRow | null> {
  const { data } = await sb.from("qr_history").select(HISTORY_COLUMNS).eq("id", id).maybeSingle();
  return (data as HistoryRow | null) ?? null;
}

export async function deleteHistory(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("qr_history").delete().eq("id", id);
  if (error) throw new Error("The history entry could not be deleted.");
}

export async function clearHistory(sb: SupabaseClient): Promise<void> {
  const uid = await currentUserId(sb);
  const { error } = await sb.from("qr_history").delete().eq("user_id", uid);
  if (error) throw new Error("History could not be cleared.");
}

// ---- cloud templates ---------------------------------------------------------------------

export async function listCloudTemplates(sb: SupabaseClient): Promise<TemplateRow[]> {
  const { data, error } = await sb.from("user_templates").select(TEMPLATE_COLUMNS).order("updated_at", { ascending: false });
  if (error) throw new Error("Your cloud templates could not be loaded.");
  return (data ?? []) as TemplateRow[];
}

export async function createCloudTemplate(
  sb: SupabaseClient,
  input: { id?: string; name: string; design: Design; logo: { dataUrl: string; name: string } | null },
  opts: { ignoreExisting?: boolean } = {},
): Promise<TemplateRow | null> {
  const uid = await currentUserId(sb);
  const id = input.id ?? crypto.randomUUID();
  let path: string | null = null;
  if (input.logo) {
    path = logoPath(uid, "templates", id);
    await uploadLogo(sb, path, input.logo.dataUrl);
  }
  const row = { id, name: input.name, design: input.design, logo_path: path, logo_name: input.logo?.name ?? null };
  const q = opts.ignoreExisting
    ? sb.from("user_templates").upsert(row, { onConflict: "id", ignoreDuplicates: true }).select(TEMPLATE_COLUMNS)
    : sb.from("user_templates").insert(row).select(TEMPLATE_COLUMNS);
  const { data, error } = await q;
  if (error) throw new Error("The template could not be saved to your account.");
  return ((data ?? [])[0] as TemplateRow | undefined) ?? null;
}

export async function renameCloudTemplate(sb: SupabaseClient, id: string, revision: number, name: string): Promise<TemplateRow> {
  const { data, error } = await sb.from("user_templates").update({ name }).eq("id", id).eq("revision", revision).select(TEMPLATE_COLUMNS);
  if (error) throw new Error("The template could not be renamed.");
  if (!data || data.length === 0) throw new ConflictError();
  return data[0] as TemplateRow;
}

export async function deleteCloudTemplate(sb: SupabaseClient, t: Pick<TemplateRow, "id" | "logo_path">): Promise<void> {
  const { error } = await sb.from("user_templates").delete().eq("id", t.id);
  if (error) throw new Error("The template could not be deleted.");
  await removeLogo(sb, t.logo_path).catch(() => undefined);
}

export async function countRows(sb: SupabaseClient, table: "qr_projects" | "qr_history" | "user_templates", sinceDays?: number): Promise<number> {
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (sinceDays) q = q.gte("created_at", new Date(Date.now() - sinceDays * 86_400_000).toISOString());
  const { count } = await q;
  return count ?? 0;
}

export type { Project, HistoryRow, TemplateRow };
