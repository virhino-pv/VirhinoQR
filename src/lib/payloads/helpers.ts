import type { FieldDef, FieldErrors, FormValues } from "./types";

export function str(values: FormValues, name: string): string {
  const v = values[name];
  return typeof v === "string" ? v.trim() : "";
}

/** Raw (untrimmed) string, for fields where whitespace is meaningful (passwords, SSIDs, free text). */
export function raw(values: FormValues, name: string): string {
  const v = values[name];
  return typeof v === "string" ? v : "";
}

export function bool(values: FormValues, name: string): boolean {
  return values[name] === true;
}

export function isVisible(field: FieldDef, values: FormValues): boolean {
  return field.visible ? field.visible(values) : true;
}

/** Required + maxLength checks for every visible field. Type-specific rules are added by each type. */
export function baseValidate(fields: readonly FieldDef[], values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of fields) {
    if (!isVisible(f, values)) continue;
    const v = values[f.name];
    if (f.kind === "checkbox") continue;
    const s = typeof v === "string" ? v : "";
    if (f.required && s.trim() === "") errors[f.name] = `${f.label} is required.`;
    else if (f.maxLength && s.length > f.maxLength) errors[f.name] = `${f.label} must be ${f.maxLength} characters or fewer.`;
  }
  return errors;
}

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

/** True when no visible text field differs from its default (the form has not been started). */
export function isBlank(fields: readonly FieldDef[], values: FormValues, defaults: FormValues = {}): boolean {
  return fields.every((f) => {
    if (!isVisible(f, values)) return true;
    if (f.kind === "checkbox" || f.kind === "select" || f.kind === "segmented" || f.kind === "timezone") return true;
    const v = values[f.name];
    const s = typeof v === "string" ? v.trim() : "";
    const d = defaults[f.name];
    return s === "" || (typeof d === "string" && s === d.trim());
  });
}
