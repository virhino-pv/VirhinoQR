import { z } from "zod";
import { designSchema } from "../qr/engine/design";
import type { Design } from "../qr/engine/types";
import { buildPayload, getContentType, isContentTypeId, type ContentTypeId, type FormValues } from "../payloads";

/** Row shapes of the M9 tables and safe parsing of data loaded from the database. Pure. */

export interface ProjectRow {
  id: string;
  name: string;
  content_type: string;
  form_values: unknown;
  design: unknown;
  logo_path: string | null;
  logo_name: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  contentType: ContentTypeId;
  values: FormValues;
  design: Design;
  logoPath: string | null;
  logoName: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  /** Problems found while reading the row (shown to the user, row still usable). */
  warnings: string[];
}

export interface HistoryRow {
  id: string;
  project_id: string | null;
  content_type: string;
  label: string;
  action: "download" | "save" | "bulk";
  format: string | null;
  design: unknown;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  design: unknown;
  logo_path: string | null;
  logo_name: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export const PROJECT_NAME_MAX = 80;
export const HISTORY_LABEL_MAX = 120;

const formValuesSchema = z.record(z.string().max(64), z.union([z.string().max(8000), z.boolean()]));

export function parseDesign(raw: unknown): { design: Design | null; error: string | null } {
  const r = designSchema.safeParse(raw);
  return r.success ? { design: r.data, error: null } : { design: null, error: "The saved design is not compatible with this version and was reset." };
}

export function parseProject(row: ProjectRow, fallbackDesign: Design): Project | null {
  if (!isContentTypeId(row.content_type)) return null;
  const warnings: string[] = [];
  const d = parseDesign(row.design);
  if (d.error) warnings.push(d.error);
  const v = formValuesSchema.safeParse(row.form_values);
  if (!v.success) warnings.push("Some saved content could not be read.");
  return {
    id: row.id,
    name: row.name,
    contentType: row.content_type,
    values: v.success ? v.data : {},
    design: d.design ?? structuredClone(fallbackDesign),
    logoPath: row.logo_path,
    logoName: row.logo_name,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    warnings,
  };
}

export function cleanProjectName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, PROJECT_NAME_MAX);
}

/**
 * Field kinds that may hold secrets. They are kept in saved projects (the user asked to save them,
 * protected by RLS) but are NEVER written to history.
 */
export const HISTORY_FORBIDDEN_KEYS = ["password", "payload", "values", "form_values", "token", "email", "phone"] as const;

/** Builds the metadata object for a history row; drops anything that could be sensitive. */
export function historyMetadata(input: Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    if ((HISTORY_FORBIDDEN_KEYS as readonly string[]).includes(k.toLowerCase())) continue;
    if (typeof v === "string" && v.length > 200) continue;
    out[k] = v;
  }
  return out;
}

export function historyLabel(label: string, fallback: string): string {
  const clean = label.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, HISTORY_LABEL_MAX);
  return clean || fallback;
}

export class ConflictError extends Error {
  constructor(message = "This item was changed on another device. Reload to see the latest version.") {
    super(message);
    this.name = "ConflictError";
  }
}

/** Storage path inside the private bucket: <user id>/<kind>/<id>.png */
export function logoPath(userId: string, kind: "projects" | "templates", id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid id for logo path");
  return `${userId}/${kind}/${id}.png`;
}

export const LOGO_BUCKET = "user-logos";

/** Types whose file-name hint is a public domain/handle rather than personal data. */
const PUBLIC_HINT_TYPES = new Set(["url", "youtube", "video", "pdf", "mp3", "gallery", "facebook", "appstore", "rating"]);

/** History label for a download: type label, plus the hint only when it can't be personal data. */
export function downloadHistoryLabel(typeId: string, typeLabel: string, hint: string, projectName?: string | null): string {
  if (projectName) return historyLabel(projectName, typeLabel);
  return historyLabel(PUBLIC_HINT_TYPES.has(typeId) && hint ? `${typeLabel} · ${hint}` : typeLabel, typeLabel);
}

/** The real payload of a saved project (for thumbnails), or null when its content is incomplete. */
export function projectPayload(p: Pick<Project, "contentType" | "values">): string | null {
  const type = getContentType(p.contentType);
  if (!type) return null;
  const r = buildPayload(type, p.values);
  return r.status === "ok" ? r.payload : null;
}
