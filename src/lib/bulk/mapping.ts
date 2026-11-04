import { CONTENT_TYPES, buildPayload, getContentType, isVisible, type ContentTypeDef, type ContentTypeId, type FieldDef, type FormValues } from "../payloads";
import { slugify } from "../qr/export/filename";
import type { Table } from "./parse";

/** Column mapping and row-level validation. Pure. */

export type ColumnRef = { kind: "column"; index: number } | { kind: "value"; value: string } | { kind: "none" };
export type TypeSource = { kind: "fixed"; type: ContentTypeId } | { kind: "column"; index: number };

export interface BulkMapping {
  typeSource: TypeSource;
  /** Per content type: field name → where its value comes from. */
  fields: Partial<Record<ContentTypeId, Record<string, ColumnRef>>>;
  /** Optional column used for file names. */
  nameColumn: number | null;
}

export type RowStatus = "valid" | "invalid" | "empty";

export interface BulkRow {
  /** 1-based data row number (header excluded). */
  row: number;
  type: ContentTypeId | null;
  status: RowStatus;
  payload: string | null;
  /** Unique, safe base file name without extension. */
  fileBase: string;
  errors: string[];
}

export const normalizeHeader = (h: string) => h.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Extra header spellings recognised for auto-mapping (normalised). */
const SYNONYMS: Record<string, string[]> = {
  url: ["url", "link", "website", "web", "weburl", "href", "destination", "pageurl", "videourl", "fileurl"],
  text: ["text", "content", "message", "body", "value"],
  to: ["to", "email", "emailaddress", "mail", "recipient"],
  phone: ["phone", "phonenumber", "tel", "telephone", "mobile", "number", "whatsapp"],
  message: ["message", "sms", "smstext", "msg"],
  firstName: ["firstname", "first", "givenname", "forename"],
  lastName: ["lastname", "last", "surname", "familyname"],
  org: ["org", "organisation", "organization", "company", "business"],
  title: ["title", "jobtitle", "position", "role", "eventtitle", "name"],
  mobile: ["mobile", "cell", "mobilephone", "cellphone"],
  phoneWork: ["phonework", "workphone", "officephone"],
  email: ["email", "emailaddress", "mail"],
  website: ["website", "url", "web", "homepage"],
  street: ["street", "address", "streetaddress"],
  zip: ["zip", "zipcode", "postcode", "postalcode"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon", "long"],
  ssid: ["ssid", "network", "networkname", "wifiname", "wifi"],
  password: ["password", "pass", "key", "wifipassword"],
  encryption: ["encryption", "security", "auth", "authentication"],
  address: ["address", "wallet", "walletaddress"],
  start: ["start", "starts", "startdate", "starttime", "begin", "from"],
  end: ["end", "ends", "enddate", "endtime", "until", "to"],
  username: ["username", "user", "handle", "profile", "account"],
  network: ["network", "platform", "socialnetwork"],
  app: ["app", "appid", "package", "packagename", "applink", "storelink"],
};

const TYPE_COLUMN_NAMES = ["type", "qrtype", "contenttype", "kind"];
const NAME_COLUMN_NAMES = ["filename", "file", "name", "label", "id", "sku", "code"];

const TYPE_ALIASES: Record<string, ContentTypeId> = {
  link: "url",
  website: "url",
  web: "url",
  mail: "email",
  tel: "phone",
  telephone: "phone",
  contact: "vcard",
  vcf: "vcard",
  map: "location",
  geo: "location",
  x: "twitter",
  tweet: "twitter",
  wlan: "wifi",
  calendar: "event",
  ical: "event",
  bitcoin: "crypto",
  btc: "crypto",
  ethereum: "crypto",
  audio: "mp3",
  music: "mp3",
  podcast: "mp3",
  document: "pdf",
  photos: "gallery",
  album: "gallery",
  socialmedia: "social",
  instagram: "social",
  app: "appstore",
  playstore: "appstore",
  googleplay: "appstore",
  review: "rating",
  reviews: "rating",
  survey: "feedback",
};

export function resolveType(raw: string): ContentTypeId | null {
  const n = normalizeHeader(raw);
  if (!n) return null;
  for (const t of CONTENT_TYPES) if (normalizeHeader(t.id) === n || normalizeHeader(t.label) === n) return t.id;
  return TYPE_ALIASES[n] ?? null;
}

function mappable(type: ContentTypeDef): FieldDef[] {
  return [...type.fields];
}

/** Guesses field → column assignments from header names. */
export function autoMapType(type: ContentTypeDef, headers: readonly string[]): Record<string, ColumnRef> {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const out: Record<string, ColumnRef> = {};
  // Exact field-name / label matches first, then synonyms, so "email" never steals "to" etc.
  const passes: Array<(f: FieldDef) => string[]> = [
    (f) => [normalizeHeader(f.name), normalizeHeader(f.label)],
    (f) => SYNONYMS[f.name] ?? [],
  ];
  for (const candidates of passes) {
    for (const f of mappable(type)) {
      if (out[f.name]) continue;
      const idx = norm.findIndex((h, i) => !used.has(i) && candidates(f).includes(h));
      if (idx >= 0) {
        out[f.name] = { kind: "column", index: idx };
        used.add(idx);
      }
    }
  }
  for (const f of mappable(type)) out[f.name] ??= { kind: "none" };
  return out;
}

export function autoMapping(table: Table, fixedType: ContentTypeId = "url"): BulkMapping {
  const norm = table.headers.map(normalizeHeader);
  const typeIdx = norm.findIndex((h) => TYPE_COLUMN_NAMES.includes(h));
  const typeSource: TypeSource = typeIdx >= 0 ? { kind: "column", index: typeIdx } : { kind: "fixed", type: fixedType };
  const types = typesInUse(table, typeSource);
  const fields: BulkMapping["fields"] = {};
  for (const id of types) fields[id] = autoMapType(getContentType(id)!, table.headers);
  // File-name column: an explicit "filename"/"file" header wins; otherwise the first
  // name-like header ("name", "label", "id", "sku", "code") that no QR field already uses.
  const usedByFields = new Set(
    Object.values(fields).flatMap((refs) => Object.values(refs ?? {}).flatMap((r) => (r.kind === "column" ? [r.index] : []))),
  );
  const pick = (names: readonly string[], skipUsed: boolean) =>
    NAME_COLUMN_NAMES.filter((n) => names.includes(n)).map((n) => norm.findIndex((h, i) => h === n && i !== typeIdx && !(skipUsed && usedByFields.has(i)))).find((i) => i >= 0) ?? -1;
  let nameIdx = pick(NAME_COLUMN_NAMES.slice(0, 2), false);
  if (nameIdx < 0) nameIdx = pick(NAME_COLUMN_NAMES.slice(2), true);
  return { typeSource, fields, nameColumn: nameIdx >= 0 ? nameIdx : null };
}

/** Content types referenced by the table under a given type source. */
export function typesInUse(table: Table, source: TypeSource): ContentTypeId[] {
  if (source.kind === "fixed") return [source.type];
  const set = new Set<ContentTypeId>();
  for (const r of table.rows) {
    const t = resolveType(r[source.index] ?? "");
    if (t) set.add(t);
  }
  return CONTENT_TYPES.map((t) => t.id).filter((id) => set.has(id));
}

/** Matches spreadsheet text to a select/segmented option by value, label or label fragment. */
export function matchOption(field: FieldDef, raw: string): string | null {
  const options = field.options ?? [];
  const n = normalizeHeader(raw);
  if (!n) return null;
  return (
    options.find((o) => normalizeHeader(o.value) === n)?.value ??
    options.find((o) => normalizeHeader(o.label) === n)?.value ??
    options.find((o) => normalizeHeader(o.label).includes(n))?.value ??
    options.find((o) => n.startsWith(normalizeHeader(o.value)))?.value ??
    null
  );
}

const TRUE_RE = /^(true|yes|y|1|x|on|✓|✔)$/i;

function cell(row: readonly string[], ref: ColumnRef | undefined): string | null {
  if (!ref || ref.kind === "none") return null;
  if (ref.kind === "value") return ref.value;
  return row[ref.index] ?? "";
}

/** Builds form values for one row; returns problems found while coercing select/checkbox cells. */
export function rowValues(type: ContentTypeDef, row: readonly string[], refs: Record<string, ColumnRef>): { values: FormValues; problems: string[] } {
  const values: FormValues = { ...type.defaults };
  const problems: string[] = [];
  for (const f of type.fields) {
    const raw = cell(row, refs[f.name]);
    if (raw === null) continue;
    if (f.kind === "checkbox") {
      values[f.name] = TRUE_RE.test(raw.trim());
    } else if (f.kind === "select" || f.kind === "segmented") {
      if (!raw.trim()) continue; // keep default
      const v = matchOption(f, raw);
      if (v === null) problems.push(`${f.label}: “${raw}” is not one of ${f.options!.map((o) => o.value).join(", ")}`);
      else values[f.name] = v;
    } else if (f.kind === "datetime" || f.kind === "date") {
      // Accept "2026-12-01 18:30" as well as ISO "2026-12-01T18:30".
      values[f.name] = raw.trim().replace(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/, "$1T$2");
    } else {
      values[f.name] = raw;
    }
  }
  if (type.id === "event" && values.allDay === true) {
    for (const k of ["start", "end"]) {
      const v = values[k];
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) values[k] = `${v}T00:00`;
    }
  }
  return { values, problems };
}

/** Validates every row and produces payloads + unique file names. */
export function buildRows(table: Table, mapping: BulkMapping): BulkRow[] {
  const used = new Map<string, number>();
  const width = String(table.rows.length).length;
  return table.rows.map((r, i) => {
    const rowNo = i + 1;
    const typeId = mapping.typeSource.kind === "fixed" ? mapping.typeSource.type : resolveType(r[mapping.typeSource.index] ?? "");
    const base = (hint: string) => {
      const label = mapping.nameColumn !== null ? (r[mapping.nameColumn] ?? "") : hint;
      let name = `${String(rowNo).padStart(Math.max(width, 3), "0")}${slugify(label) ? `-${slugify(label)}` : ""}`;
      const n = (used.get(name) ?? 0) + 1;
      used.set(name, n);
      if (n > 1) name = `${name}-${n}`;
      return name;
    };
    if (!typeId) {
      const raw = mapping.typeSource.kind === "column" ? (r[mapping.typeSource.index] ?? "") : "";
      return { row: rowNo, type: null, status: raw.trim() ? "invalid" : "empty", payload: null, fileBase: base(""), errors: [raw.trim() ? `Unknown QR type “${raw}”` : "No QR type given"] };
    }
    const type = getContentType(typeId)!;
    const refs = mapping.fields[typeId] ?? {};
    const { values, problems } = rowValues(type, r, refs);
    const result = buildPayload(type, values);
    if (result.status === "empty") {
      // A cell that could not be read (e.g. unknown option) makes the row invalid rather than empty.
      if (problems.length) return { row: rowNo, type: typeId, status: "invalid", payload: null, fileBase: base(""), errors: problems };
      return { row: rowNo, type: typeId, status: "empty", payload: null, fileBase: base(""), errors: ["Row has no content for this type"] };
    }
    const fieldErrors =
      result.status === "invalid"
        ? Object.entries(result.errors).map(([name, msg]) => {
            const f = type.fields.find((x) => x.name === name);
            const mapped = refs[name]?.kind === "column" || refs[name]?.kind === "value";
            return f && !mapped && isVisible(f, values) && f.required ? `${f.label}: not mapped to a column` : msg;
          })
        : [];
    const errors = [...problems, ...fieldErrors];
    if (errors.length || result.status !== "ok") return { row: rowNo, type: typeId, status: "invalid", payload: null, fileBase: base(""), errors };
    return { row: rowNo, type: typeId, status: "valid", payload: result.payload, fileBase: base(result.hint), errors: [] };
  });
}

export function summarize(rows: readonly BulkRow[]) {
  return {
    total: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    empty: rows.filter((r) => r.status === "empty").length,
  };
}
