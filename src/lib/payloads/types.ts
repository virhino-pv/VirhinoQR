/** Content-type registry model. Pure data + functions; the UI renders forms from `fields`. */

export type ContentTypeId =
  | "url"
  | "text"
  | "email"
  | "phone"
  | "sms"
  | "vcard"
  | "mecard"
  | "location"
  | "facebook"
  | "twitter"
  | "youtube"
  | "wifi"
  | "event"
  | "crypto"
  | "mp3"
  | "video"
  | "pdf"
  | "social"
  | "appstore"
  | "gallery"
  | "rating"
  | "feedback";

export type FieldValue = string | boolean;
export type FormValues = Record<string, FieldValue>;

export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "email"
  | "tel"
  | "number"
  | "password"
  | "select"
  | "segmented"
  | "checkbox"
  | "date"
  | "datetime"
  | "timezone";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  required?: boolean;
  maxLength?: number;
  options?: readonly FieldOption[];
  /** Field is shown (and validated) only when this returns true. */
  visible?: (values: FormValues) => boolean;
  /** Layout hint for the form grid. */
  width?: "full" | "half";
  autoComplete?: string;
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "email" | "url";
  /** Accessible group heading rendered before this field. */
  section?: string;
}

/**
 * static  — content is encoded directly; no server involved.
 * linked  — a "hosted content" type: our static code links to content the user already hosts.
 *           Uploading/hosting that content needs the future backend (dynamic tier, roadmap M10–M11).
 */
export type ContentTier = "static" | "linked";

export type FieldErrors = Record<string, string>;

export interface ContentTypeDef {
  id: ContentTypeId;
  label: string;
  description: string;
  tier: ContentTier;
  /** Shown in the form for `linked` types: what needs a backend and what this code does instead. */
  hostingNote?: string;
  fields: readonly FieldDef[];
  defaults: FormValues;
  /** Returns field errors for visible fields (empty object = valid). */
  validate: (values: FormValues) => FieldErrors;
  /** Builds the exact QR payload. Only called with values that passed `validate`. */
  encode: (values: FormValues) => string;
  /** Short, human hint used in file names (e.g. the domain or the SSID). */
  hint?: (values: FormValues) => string;
  /** A valid sample used by tests and the homepage demo. */
  sample: FormValues;
}

export type PayloadResult =
  | { status: "empty" }
  | { status: "invalid"; errors: FieldErrors }
  | { status: "ok"; payload: string; hint: string };
