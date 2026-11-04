import { z } from "zod";
import { designSchema } from "../qr/engine/design";
import type { Design } from "../qr/engine/types";

/** User-saved templates and the portable JSON file format. Pure — no browser APIs. */

export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATE_LIMIT = 200;
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const LOGO_DATA_URL_MAX = 3 * 1024 * 1024;
export const FILE_FORMAT = "qr-studio-templates";
export const FILE_VERSION = 1;

export interface TemplateLogo {
  /** PNG data URI of the processed logo. */
  dataUrl: string;
  name: string;
}

export interface UserTemplate {
  id: string;
  name: string;
  design: Design;
  logo: TemplateLogo | null;
  createdAt: string;
  updatedAt: string;
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export const templateLogoSchema = z.object({
  dataUrl: z
    .string()
    .max(LOGO_DATA_URL_MAX, "Logo image is too large.")
    .regex(PNG_DATA_URL, "Logo must be an embedded PNG image."),
  name: z.string().trim().min(1).max(120),
});

export function cleanTemplateName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, TEMPLATE_NAME_MAX);
}

export function validateTemplateName(name: string): string | null {
  const n = cleanTemplateName(name);
  if (!n) return "Give the template a name.";
  if (name.trim().length > TEMPLATE_NAME_MAX) return `Names are limited to ${TEMPLATE_NAME_MAX} characters.`;
  return null;
}

const importedTemplateSchema = z.object({
  name: z.string(),
  design: designSchema,
  logo: templateLogoSchema.nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const fileSchema = z.object({
  format: z.literal(FILE_FORMAT),
  version: z.literal(FILE_VERSION),
  exportedAt: z.string().optional(),
  templates: z.array(z.unknown()).max(TEMPLATE_LIMIT, `A file can contain at most ${TEMPLATE_LIMIT} templates.`),
});

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTemplate(name: string, design: Design, logo: TemplateLogo | null, now = new Date()): UserTemplate {
  const stamp = now.toISOString();
  return { id: newId(), name: cleanTemplateName(name), design: structuredClone(design), logo, createdAt: stamp, updatedAt: stamp };
}

export interface TemplateFile {
  format: typeof FILE_FORMAT;
  version: typeof FILE_VERSION;
  exportedAt: string;
  templates: Array<Omit<UserTemplate, "id">>;
}

export function exportTemplates(templates: readonly UserTemplate[], now = new Date()): string {
  const file: TemplateFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: now.toISOString(),
    templates: templates.map(({ id: _id, ...rest }) => rest),
  };
  return JSON.stringify(file, null, 2);
}

export interface ImportResult {
  templates: UserTemplate[];
  /** Per-entry problems; valid entries are still imported. */
  skipped: Array<{ index: number; name: string; reason: string }>;
}

export type ImportOutcome = { ok: true; result: ImportResult } | { ok: false; error: string };

/**
 * Parses an exported file. Every template is validated with the same schema the editor uses;
 * invalid entries are skipped with a reason. New ids are assigned so imports never overwrite.
 */
export function importTemplates(text: string, byteLength: number, now = new Date()): ImportOutcome {
  if (byteLength > IMPORT_MAX_BYTES) return { ok: false, error: `The file is larger than ${IMPORT_MAX_BYTES / 1024 / 1024} MB.` };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  const file = fileSchema.safeParse(json);
  if (!file.success) {
    const formatIssue = file.error.issues.find((i) => i.path[0] === "format" || i.path[0] === "version");
    return {
      ok: false,
      error: formatIssue ? "This is not a QR Studio templates file (or it is from an unsupported version)." : (file.error.issues[0]?.message ?? "Invalid templates file."),
    };
  }
  const result: ImportResult = { templates: [], skipped: [] };
  file.data.templates.forEach((entry, index) => {
    const parsed = importedTemplateSchema.safeParse(entry);
    const rawName = typeof (entry as { name?: unknown })?.name === "string" ? (entry as { name: string }).name : `#${index + 1}`;
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      result.skipped.push({ index, name: cleanTemplateName(rawName) || `#${index + 1}`, reason: issue ? `${issue.path.join(".") || "entry"}: ${issue.message}` : "invalid" });
      return;
    }
    const name = cleanTemplateName(parsed.data.name);
    if (!name) {
      result.skipped.push({ index, name: `#${index + 1}`, reason: "name: missing" });
      return;
    }
    const tpl = createTemplate(name, parsed.data.design, parsed.data.logo ?? null, now);
    if (parsed.data.createdAt && !Number.isNaN(Date.parse(parsed.data.createdAt))) tpl.createdAt = parsed.data.createdAt;
    result.templates.push(tpl);
  });
  return { ok: true, result };
}

/** Structural equality of designs (used to highlight the active template). */
export function sameDesign(a: Design, b: Design): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
