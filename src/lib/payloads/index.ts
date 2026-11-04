import { isBlank } from "./helpers";
import { LINKED_TYPES } from "./linked-types";
import { STATIC_TYPES } from "./static-types";
import type { ContentTypeDef, ContentTypeId, FormValues, PayloadResult } from "./types";

export * from "./types";
export { isVisible } from "./helpers";

/** All 22 content types, in display order. */
export const CONTENT_TYPES: readonly ContentTypeDef[] = [...STATIC_TYPES, ...LINKED_TYPES];

const BY_ID = new Map(CONTENT_TYPES.map((t) => [t.id, t]));

export function getContentType(id: string): ContentTypeDef | undefined {
  return BY_ID.get(id as ContentTypeId);
}

export function isContentTypeId(id: string): id is ContentTypeId {
  return BY_ID.has(id as ContentTypeId);
}

/** Validates the form and, when valid, returns the exact payload to encode. */
export function buildPayload(type: ContentTypeDef, values: FormValues): PayloadResult {
  const merged = { ...type.defaults, ...values };
  if (isBlank(type.fields, merged, type.defaults)) return { status: "empty" };
  const errors = type.validate(merged);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  return { status: "ok", payload: type.encode(merged), hint: type.hint?.(merged) ?? type.id };
}
