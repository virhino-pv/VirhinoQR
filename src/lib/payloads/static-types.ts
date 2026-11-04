import { ethToWei, isValidAddress, type Coin } from "./crypto-address";
import {
  encodeQueryValue,
  escapeICal,
  escapeMeCard,
  escapeVCard,
  escapeVCard21,
  escapeWifi,
  hostMatches,
  hostOf,
  isAscii,
  isValidPhone,
  normalizePhone,
  normalizeWebUrl,
} from "./escape";
import { EMAIL_RE, baseValidate, bool, raw, str } from "./helpers";
import { icalDate, icalUtc, isValidTimeZone, zonedWallTimeToUtc } from "./time";
import type { ContentTypeDef, FieldDef, FieldErrors, FormValues } from "./types";

const half = "half" as const;

function urlRule(errors: FieldErrors, values: FormValues, name: string) {
  if (errors[name] || !str(values, name)) return;
  const r = normalizeWebUrl(str(values, name));
  if (!r.ok) errors[name] = r.error;
}

function emailRule(errors: FieldErrors, values: FormValues, name: string) {
  const v = str(values, name);
  if (!errors[name] && v && !EMAIL_RE.test(v)) errors[name] = "Enter a valid email address, e.g. name@example.com.";
}

function phoneRule(errors: FieldErrors, values: FormValues, name: string) {
  const v = str(values, name);
  if (!errors[name] && v && !isValidPhone(v)) {
    errors[name] = "Enter a phone number with 3–15 digits; you may start with + and a country code.";
  }
}

function webUrl(values: FormValues, name: string): string {
  const r = normalizeWebUrl(str(values, name));
  return r.ok ? r.url : str(values, name);
}

// ---------------------------------------------------------------------------------------------
// 1. URL
const urlFields: FieldDef[] = [
  {
    name: "url",
    label: "Website link",
    kind: "url",
    required: true,
    placeholder: "https://example.com",
    help: "https:// is added automatically if you leave it out.",
    autoComplete: "url",
    inputMode: "url",
  },
];
export const urlType: ContentTypeDef = {
  id: "url",
  label: "Website",
  description: "Open any web page.",
  tier: "static",
  fields: urlFields,
  defaults: { url: "" },
  validate(values) {
    const e = baseValidate(urlFields, values);
    urlRule(e, values, "url");
    return e;
  },
  encode: (v) => webUrl(v, "url"),
  hint: (v) => hostOf(webUrl(v, "url")),
  sample: { url: "https://example.com/menu" },
};

// 2. Text
const textFields: FieldDef[] = [
  {
    name: "text",
    label: "Text",
    kind: "textarea",
    required: true,
    maxLength: 2000,
    placeholder: "Any text — notes, a coupon code, instructions…",
    help: "Unicode is supported (e.g. தமிழ், 日本語, emoji). Long text makes a denser code.",
  },
];
export const textType: ContentTypeDef = {
  id: "text",
  label: "Text",
  description: "Show plain text, in any language.",
  tier: "static",
  fields: textFields,
  defaults: { text: "" },
  validate: (v) => baseValidate(textFields, v),
  encode: (v) => raw(v, "text").replace(/\r\n/g, "\n"),
  hint: () => "text",
  sample: { text: "வணக்கம் — Welcome to QR Studio!" },
};

// 3. Email
const emailFields: FieldDef[] = [
  { name: "to", label: "Email address", kind: "email", required: true, placeholder: "name@example.com", autoComplete: "email", inputMode: "email" },
  { name: "subject", label: "Subject", kind: "text", maxLength: 200, placeholder: "Optional" },
  { name: "body", label: "Message", kind: "textarea", maxLength: 1000, placeholder: "Optional" },
  {
    name: "format",
    label: "Format",
    kind: "segmented",
    options: [
      { value: "mailto", label: "mailto: (recommended)" },
      { value: "matmsg", label: "MATMSG" },
    ],
    help: "mailto: links work with every phone. MATMSG is an older format some scanners prefer.",
  },
];
export const emailType: ContentTypeDef = {
  id: "email",
  label: "Email",
  description: "Start an email with a prefilled subject and message.",
  tier: "static",
  fields: emailFields,
  defaults: { to: "", subject: "", body: "", format: "mailto" },
  validate(values) {
    const e = baseValidate(emailFields, values);
    emailRule(e, values, "to");
    return e;
  },
  encode(v) {
    const to = str(v, "to");
    const subject = str(v, "subject");
    const body = raw(v, "body").trim();
    if (str(v, "format") === "matmsg") {
      return `MATMSG:TO:${escapeMeCard(to)};SUB:${escapeMeCard(subject)};BODY:${escapeMeCard(body)};;`;
    }
    const q = [subject && `subject=${encodeQueryValue(subject)}`, body && `body=${encodeQueryValue(body)}`].filter(Boolean);
    return `mailto:${to}${q.length ? `?${q.join("&")}` : ""}`;
  },
  hint: (v) => str(v, "to").split("@")[0] ?? "email",
  sample: { to: "hello@example.com", subject: "Table booking", body: "Hi, I'd like to book a table for 2.", format: "mailto" },
};

// 4. Phone
const phoneFields: FieldDef[] = [
  { name: "phone", label: "Phone number", kind: "tel", required: true, placeholder: "+44 20 7946 0958", autoComplete: "tel", inputMode: "tel", help: "Include the country code so it works abroad." },
];
export const phoneType: ContentTypeDef = {
  id: "phone",
  label: "Phone",
  description: "Call a number with one tap.",
  tier: "static",
  fields: phoneFields,
  defaults: { phone: "" },
  validate(values) {
    const e = baseValidate(phoneFields, values);
    phoneRule(e, values, "phone");
    return e;
  },
  encode: (v) => `tel:${normalizePhone(str(v, "phone"))}`,
  hint: (v) => normalizePhone(str(v, "phone")),
  sample: { phone: "+44 20 7946 0958" },
};

// 5. SMS
const smsFields: FieldDef[] = [
  { name: "phone", label: "Phone number", kind: "tel", required: true, placeholder: "+1 555 0100", autoComplete: "tel", inputMode: "tel" },
  { name: "message", label: "Message", kind: "textarea", maxLength: 300, placeholder: "Optional prefilled text" },
  {
    name: "format",
    label: "Format",
    kind: "segmented",
    options: [
      { value: "smsto", label: "SMSTO (widest support)" },
      { value: "sms", label: "sms: URI" },
    ],
  },
];
export const smsType: ContentTypeDef = {
  id: "sms",
  label: "SMS",
  description: "Open a text message with prefilled content.",
  tier: "static",
  fields: smsFields,
  defaults: { phone: "", message: "", format: "smsto" },
  validate(values) {
    const e = baseValidate(smsFields, values);
    phoneRule(e, values, "phone");
    return e;
  },
  encode(v) {
    const phone = normalizePhone(str(v, "phone"));
    const msg = raw(v, "message").trim();
    if (str(v, "format") === "sms") return `sms:${phone}${msg ? `?body=${encodeQueryValue(msg)}` : ""}`;
    return `SMSTO:${phone}:${msg}`;
  },
  hint: (v) => normalizePhone(str(v, "phone")),
  sample: { phone: "+15550100", message: "JOIN", format: "smsto" },
};

// 6. vCard
const vcardFields: FieldDef[] = [
  {
    name: "version",
    label: "vCard version",
    kind: "segmented",
    options: [
      { value: "3.0", label: "3.0 (recommended)" },
      { value: "4.0", label: "4.0" },
      { value: "2.1", label: "2.1" },
    ],
  },
  { name: "firstName", label: "First name", kind: "text", width: half, autoComplete: "given-name", section: "Name" },
  { name: "lastName", label: "Last name", kind: "text", width: half, autoComplete: "family-name" },
  { name: "org", label: "Organisation", kind: "text", width: half, autoComplete: "organization" },
  { name: "title", label: "Job title", kind: "text", width: half, autoComplete: "organization-title" },
  { name: "mobile", label: "Mobile", kind: "tel", width: half, inputMode: "tel", section: "Contact" },
  { name: "phoneWork", label: "Work phone", kind: "tel", width: half, inputMode: "tel" },
  { name: "phoneHome", label: "Home phone", kind: "tel", width: half, inputMode: "tel" },
  { name: "fax", label: "Fax", kind: "tel", width: half, inputMode: "tel" },
  { name: "email", label: "Email", kind: "email", width: half, inputMode: "email" },
  { name: "website", label: "Website", kind: "url", width: half, inputMode: "url" },
  { name: "street", label: "Street", kind: "text", section: "Address", autoComplete: "street-address" },
  { name: "city", label: "City", kind: "text", width: half, autoComplete: "address-level2" },
  { name: "zip", label: "Postcode / ZIP", kind: "text", width: half, autoComplete: "postal-code" },
  { name: "state", label: "State / region", kind: "text", width: half, autoComplete: "address-level1" },
  { name: "country", label: "Country", kind: "text", width: half, autoComplete: "country-name" },
  { name: "note", label: "Note", kind: "textarea", maxLength: 300 },
];
export const vcardType: ContentTypeDef = {
  id: "vcard",
  label: "vCard",
  description: "Share a full contact card.",
  tier: "static",
  fields: vcardFields,
  defaults: Object.fromEntries(vcardFields.map((f) => [f.name, f.name === "version" ? "3.0" : ""])),
  validate(values) {
    const e = baseValidate(vcardFields, values);
    if (!["firstName", "lastName", "org", "mobile", "phoneWork", "phoneHome", "email"].some((n) => str(values, n))) {
      e.firstName = "Add at least a name, organisation, phone number or email.";
    }
    for (const n of ["mobile", "phoneWork", "phoneHome", "fax"]) phoneRule(e, values, n);
    emailRule(e, values, "email");
    urlRule(e, values, "website");
    return e;
  },
  encode(v) {
    const version = str(v, "version") || "3.0";
    const first = str(v, "firstName");
    const last = str(v, "lastName");
    const org = str(v, "org");
    const fn = [first, last].filter(Boolean).join(" ") || org;
    const lines: string[] = ["BEGIN:VCARD", `VERSION:${version}`];
    const v21 = version === "2.1";
    const esc = v21 ? escapeVCard21 : escapeVCard;
    // 2.1 needs an explicit charset for non-ASCII values.
    const prop = (name: string, value: string) => (v21 && !isAscii(value) ? `${name};CHARSET=UTF-8` : name);
    const addr = ["", "", str(v, "street"), str(v, "city"), str(v, "state"), str(v, "zip"), str(v, "country")];
    const add = (name: string, value: string) => {
      if (value) lines.push(`${prop(name, value)}:${esc(value)}`);
    };
    const nameValue = `${esc(last)};${esc(first)};;;`;
    if (first || last || version !== "2.1") lines.push(`${prop("N", first + last)}:${nameValue}`);
    if (fn) lines.push(`${prop("FN", fn)}:${esc(fn)}`);
    add("ORG", org);
    add("TITLE", str(v, "title"));
    const tel = (type21: string, type3: string, type4: string, value: string) => {
      if (!value) return;
      const n = normalizePhone(value);
      if (version === "2.1") lines.push(`TEL;${type21}:${n}`);
      else if (version === "4.0") lines.push(`TEL;TYPE=${type4}:${n}`);
      else lines.push(`TEL;TYPE=${type3}:${n}`);
    };
    tel("CELL", "CELL", "cell", str(v, "mobile"));
    tel("WORK;VOICE", "WORK,VOICE", "work,voice", str(v, "phoneWork"));
    tel("HOME;VOICE", "HOME,VOICE", "home,voice", str(v, "phoneHome"));
    tel("WORK;FAX", "WORK,FAX", "work,fax", str(v, "fax"));
    const email = str(v, "email");
    if (email) lines.push(version === "2.1" ? `EMAIL;INTERNET:${email}` : version === "4.0" ? `EMAIL:${email}` : `EMAIL;TYPE=INTERNET:${email}`);
    if (str(v, "website")) lines.push(`URL:${webUrl(v, "website")}`);
    if (addr.some(Boolean)) {
      const value = addr.map(esc).join(";");
      lines.push(`${prop(version === "2.1" ? "ADR;WORK" : version === "4.0" ? "ADR;TYPE=work" : "ADR;TYPE=WORK", addr.join(""))}:${value}`);
    }
    add("NOTE", raw(v, "note").trim());
    lines.push("END:VCARD");
    return lines.join("\r\n");
  },
  hint: (v) => [str(v, "firstName"), str(v, "lastName")].filter(Boolean).join(" ") || str(v, "org"),
  sample: {
    version: "3.0",
    firstName: "Ada",
    lastName: "Lovelace",
    org: "Analytical Engines Ltd",
    title: "Lead Engineer",
    mobile: "+44 7700 900123",
    phoneWork: "",
    phoneHome: "",
    fax: "",
    email: "ada@example.com",
    website: "example.com",
    street: "12 Example Street",
    city: "London",
    zip: "N1 9GU",
    state: "",
    country: "United Kingdom",
    note: "",
  },
};

// 7. MeCard
const mecardFields: FieldDef[] = [
  { name: "firstName", label: "First name", kind: "text", width: half, autoComplete: "given-name" },
  { name: "lastName", label: "Last name", kind: "text", width: half, autoComplete: "family-name" },
  { name: "nickname", label: "Nickname", kind: "text", width: half },
  { name: "birthday", label: "Birthday", kind: "date", width: half },
  { name: "phone1", label: "Phone", kind: "tel", width: half, inputMode: "tel" },
  { name: "phone2", label: "Second phone", kind: "tel", width: half, inputMode: "tel" },
  { name: "email", label: "Email", kind: "email", width: half, inputMode: "email" },
  { name: "website", label: "Website", kind: "url", width: half, inputMode: "url" },
  { name: "street", label: "Street", kind: "text", section: "Address" },
  { name: "city", label: "City", kind: "text", width: half },
  { name: "zip", label: "Postcode / ZIP", kind: "text", width: half },
  { name: "state", label: "State / region", kind: "text", width: half },
  { name: "country", label: "Country", kind: "text", width: half },
  { name: "note", label: "Note", kind: "textarea", maxLength: 300 },
];
export const mecardType: ContentTypeDef = {
  id: "mecard",
  label: "MeCard",
  description: "Compact contact card (smaller code than vCard).",
  tier: "static",
  fields: mecardFields,
  defaults: Object.fromEntries(mecardFields.map((f) => [f.name, ""])),
  validate(values) {
    const e = baseValidate(mecardFields, values);
    if (!str(values, "firstName") && !str(values, "lastName")) e.firstName = "Add a first or last name.";
    phoneRule(e, values, "phone1");
    phoneRule(e, values, "phone2");
    emailRule(e, values, "email");
    urlRule(e, values, "website");
    const b = str(values, "birthday");
    if (b && (!/^\d{4}-\d{2}-\d{2}$/.test(b) || Number.isNaN(Date.parse(b)))) e.birthday = "Use a valid date.";
    return e;
  },
  encode(v) {
    const parts: string[] = [];
    const add = (key: string, value: string) => {
      if (value) parts.push(`${key}:${value}`);
    };
    const last = escapeMeCard(str(v, "lastName"));
    const first = escapeMeCard(str(v, "firstName"));
    add("N", first && last ? `${last},${first}` : last || first);
    add("NICKNAME", escapeMeCard(str(v, "nickname")));
    if (str(v, "phone1")) add("TEL", escapeMeCard(normalizePhone(str(v, "phone1"))));
    if (str(v, "phone2")) add("TEL", escapeMeCard(normalizePhone(str(v, "phone2"))));
    add("EMAIL", escapeMeCard(str(v, "email")));
    if (str(v, "website")) add("URL", escapeMeCard(webUrl(v, "website")));
    add("BDAY", str(v, "birthday").replace(/-/g, ""));
    const adr = ["", "", str(v, "street"), str(v, "city"), str(v, "state"), str(v, "zip"), str(v, "country")];
    if (adr.some(Boolean)) add("ADR", adr.map(escapeMeCard).join(","));
    add("NOTE", escapeMeCard(raw(v, "note").trim().replace(/\r?\n/g, " ")));
    return `MECARD:${parts.join(";")};;`;
  },
  hint: (v) => [str(v, "firstName"), str(v, "lastName")].filter(Boolean).join(" "),
  sample: {
    firstName: "Grace",
    lastName: "Hopper",
    nickname: "",
    birthday: "1906-12-09",
    phone1: "+1 555 0100",
    phone2: "",
    email: "grace@example.com",
    website: "https://example.com",
    street: "",
    city: "Arlington",
    zip: "",
    state: "VA",
    country: "USA",
    note: "",
  },
};

// 8. Location
const locationFields: FieldDef[] = [
  { name: "latitude", label: "Latitude", kind: "number", required: true, width: half, placeholder: "51.507351", inputMode: "decimal", help: "−90 to 90" },
  { name: "longitude", label: "Longitude", kind: "number", required: true, width: half, placeholder: "-0.127758", inputMode: "decimal", help: "−180 to 180" },
  { name: "label", label: "Place name", kind: "text", maxLength: 80, placeholder: "Optional, used by Apple Maps links" },
  {
    name: "format",
    label: "Opens in",
    kind: "select",
    options: [
      { value: "geo", label: "Default maps app (geo: link)" },
      { value: "google", label: "Google Maps link" },
      { value: "apple", label: "Apple Maps link" },
    ],
  },
];
function coord(values: FormValues, name: string): number | null {
  const s = str(values, name).replace(",", ".");
  if (!/^-?\d{1,3}(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
const fmtCoord = (n: number) => String(Math.round(n * 1e6) / 1e6);
export const locationType: ContentTypeDef = {
  id: "location",
  label: "Location",
  description: "Pin a place on the map.",
  tier: "static",
  fields: locationFields,
  defaults: { latitude: "", longitude: "", label: "", format: "geo" },
  validate(values) {
    const e = baseValidate(locationFields, values);
    const lat = coord(values, "latitude");
    const lng = coord(values, "longitude");
    if (!e.latitude && (lat === null || lat < -90 || lat > 90)) e.latitude = "Latitude must be a number between −90 and 90.";
    if (!e.longitude && (lng === null || lng < -180 || lng > 180)) e.longitude = "Longitude must be a number between −180 and 180.";
    return e;
  },
  encode(v) {
    const lat = fmtCoord(coord(v, "latitude")!);
    const lng = fmtCoord(coord(v, "longitude")!);
    const label = str(v, "label");
    switch (str(v, "format")) {
      case "google":
        return `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;
      case "apple":
        return `https://maps.apple.com/?ll=${lat},${lng}${label ? `&q=${encodeURIComponent(label)}` : ""}`;
      default:
        return `geo:${lat},${lng}`;
    }
  },
  hint: (v) => str(v, "label") || "location",
  sample: { latitude: "51.507351", longitude: "-0.127758", label: "Trafalgar Square", format: "geo" },
};

// 9. Facebook
const facebookFields: FieldDef[] = [
  {
    name: "mode",
    label: "What should it do?",
    kind: "segmented",
    options: [
      { value: "page", label: "Open a Facebook page" },
      { value: "share", label: "Share a link on Facebook" },
    ],
  },
  { name: "pageUrl", label: "Facebook page link", kind: "url", required: true, placeholder: "https://www.facebook.com/yourpage", visible: (v) => v.mode !== "share", inputMode: "url" },
  { name: "shareUrl", label: "Link to share", kind: "url", required: true, placeholder: "https://example.com/article", visible: (v) => v.mode === "share", inputMode: "url" },
];
const FB_HOSTS = ["facebook.com", "fb.com", "fb.me", "fb.watch"];
export const facebookType: ContentTypeDef = {
  id: "facebook",
  label: "Facebook",
  description: "Open a page or share a link on Facebook.",
  tier: "static",
  fields: facebookFields,
  defaults: { mode: "page", pageUrl: "", shareUrl: "" },
  validate(values) {
    const e = baseValidate(facebookFields, values);
    if (values.mode === "share") urlRule(e, values, "shareUrl");
    else {
      urlRule(e, values, "pageUrl");
      if (!e.pageUrl && str(values, "pageUrl") && !hostMatches(webUrl(values, "pageUrl"), FB_HOSTS)) {
        e.pageUrl = "Use a facebook.com (or fb.com / fb.me) link.";
      }
    }
    return e;
  },
  encode(v) {
    if (v.mode === "share") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(webUrl(v, "shareUrl"))}`;
    return webUrl(v, "pageUrl");
  },
  hint: () => "facebook",
  sample: { mode: "page", pageUrl: "https://www.facebook.com/example", shareUrl: "" },
};

// 10. X / Twitter
const twitterFields: FieldDef[] = [
  {
    name: "mode",
    label: "What should it do?",
    kind: "segmented",
    options: [
      { value: "profile", label: "Open a profile" },
      { value: "post", label: "Write a post" },
    ],
  },
  { name: "handle", label: "Username or profile link", kind: "text", required: true, placeholder: "@username", visible: (v) => v.mode !== "post" },
  { name: "text", label: "Post text", kind: "textarea", required: true, maxLength: 280, visible: (v) => v.mode === "post" },
  { name: "link", label: "Link to include", kind: "url", placeholder: "Optional", visible: (v) => v.mode === "post", inputMode: "url" },
];
function xHandle(input: string): string | null {
  const s = input.trim();
  const fromUrl = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})\/?(?:[?#].*)?$/i.exec(s);
  if (fromUrl) return fromUrl[1]!;
  const h = s.replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(h) ? h : null;
}
export const twitterType: ContentTypeDef = {
  id: "twitter",
  label: "X (Twitter)",
  description: "Open a profile or draft a post on X.",
  tier: "static",
  fields: twitterFields,
  defaults: { mode: "profile", handle: "", text: "", link: "" },
  validate(values) {
    const e = baseValidate(twitterFields, values);
    if (values.mode !== "post" && !e.handle && !xHandle(str(values, "handle"))) {
      e.handle = "Usernames have 1–15 letters, numbers or underscores (e.g. @qrstudio).";
    }
    if (values.mode === "post") urlRule(e, values, "link");
    return e;
  },
  encode(v) {
    if (v.mode === "post") {
      const link = str(v, "link");
      return `https://x.com/intent/tweet?text=${encodeURIComponent(raw(v, "text").trim())}${link ? `&url=${encodeURIComponent(webUrl(v, "link"))}` : ""}`;
    }
    return `https://x.com/${xHandle(str(v, "handle"))}`;
  },
  hint: (v) => (v.mode === "post" ? "x-post" : (xHandle(str(v, "handle")) ?? "x")),
  sample: { mode: "profile", handle: "@example", text: "", link: "" },
};

// 11. YouTube
const youtubeFields: FieldDef[] = [
  { name: "video", label: "YouTube link or video ID", kind: "text", required: true, placeholder: "https://www.youtube.com/watch?v=…", help: "Video, Shorts, channel (@handle) and playlist links are accepted." },
  { name: "start", label: "Start at (seconds)", kind: "number", placeholder: "Optional", inputMode: "numeric", width: half },
];
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export function parseYouTube(input: string): { kind: "video"; id: string } | { kind: "page"; url: string } | null {
  const s = input.trim();
  if (YT_ID.test(s)) return { kind: "video", id: s };
  const r = normalizeWebUrl(s);
  if (!r.ok) return null;
  const u = new URL(r.url);
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0] ?? "";
    return YT_ID.test(id) ? { kind: "video", id } : null;
  }
  if (host !== "youtube.com") return null;
  const v = u.searchParams.get("v");
  if (u.pathname === "/watch" && v && YT_ID.test(v)) return { kind: "video", id: v };
  const short = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
  if (short) return { kind: "video", id: short[1]! };
  if (/^\/(@[\w.-]+|channel\/[\w-]+|c\/[\w.-]+|user\/[\w.-]+|playlist)/.test(u.pathname)) return { kind: "page", url: r.url };
  return null;
}
export const youtubeType: ContentTypeDef = {
  id: "youtube",
  label: "YouTube",
  description: "Play a video or open a channel.",
  tier: "static",
  fields: youtubeFields,
  defaults: { video: "", start: "" },
  validate(values) {
    const e = baseValidate(youtubeFields, values);
    if (!e.video && str(values, "video") && !parseYouTube(str(values, "video"))) {
      e.video = "Paste a youtube.com / youtu.be link or an 11-character video ID.";
    }
    const start = str(values, "start");
    if (start && !/^\d{1,6}$/.test(start)) e.start = "Use whole seconds, e.g. 90.";
    return e;
  },
  encode(v) {
    const p = parseYouTube(str(v, "video"))!;
    if (p.kind === "page") return p.url;
    const start = str(v, "start");
    return `https://youtu.be/${p.id}${start && start !== "0" ? `?t=${start}` : ""}`;
  },
  hint: () => "youtube",
  sample: { video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", start: "" },
};

// 12. Wi-Fi
const wifiFields: FieldDef[] = [
  { name: "ssid", label: "Network name (SSID)", kind: "text", required: true, maxLength: 32, autoComplete: "off" },
  {
    name: "encryption",
    label: "Security",
    kind: "select",
    options: [
      { value: "WPA", label: "WPA/WPA2 (most networks)" },
      { value: "SAE", label: "WPA3 only" },
      { value: "WEP", label: "WEP (legacy)" },
      { value: "nopass", label: "None (open network)" },
    ],
  },
  { name: "password", label: "Password", kind: "password", required: true, maxLength: 63, visible: (v) => v.encryption !== "nopass", autoComplete: "off" },
  { name: "hidden", label: "Hidden network", kind: "checkbox", help: "Tick if the network does not broadcast its name." },
];
export const wifiType: ContentTypeDef = {
  id: "wifi",
  label: "Wi-Fi",
  description: "Join a wireless network without typing the password.",
  tier: "static",
  fields: wifiFields,
  defaults: { ssid: "", encryption: "WPA", password: "", hidden: false },
  validate(values) {
    const e = baseValidate(wifiFields, values);
    const pw = raw(values, "password");
    if (!e.ssid && new TextEncoder().encode(raw(values, "ssid")).length > 32) e.ssid = "Network names are limited to 32 bytes.";
    if (!e.password && values.encryption !== "nopass" && pw) {
      if ((values.encryption === "WPA" || values.encryption === "SAE") && (pw.length < 8 || pw.length > 63)) {
        e.password = "WPA passwords are 8–63 characters.";
      }
      if (values.encryption === "WEP" && !/^(.{5}|.{13}|[0-9a-fA-F]{10}|[0-9a-fA-F]{26})$/.test(pw)) {
        e.password = "WEP keys are 5 or 13 characters, or 10 or 26 hex digits.";
      }
    }
    return e;
  },
  encode(v) {
    const enc = str(v, "encryption") || "WPA";
    const parts = [`T:${enc}`, `S:${escapeWifi(raw(v, "ssid"))}`];
    if (enc !== "nopass") parts.push(`P:${escapeWifi(raw(v, "password"))}`);
    if (bool(v, "hidden")) parts.push("H:true");
    return `WIFI:${parts.join(";")};;`;
  },
  hint: (v) => raw(v, "ssid"),
  sample: { ssid: "Cafe Guest", encryption: "WPA", password: "coffee;time:2026", hidden: false },
};

// 13. Event
const eventFields: FieldDef[] = [
  { name: "title", label: "Event title", kind: "text", required: true, maxLength: 120 },
  { name: "location", label: "Location", kind: "text", maxLength: 200, placeholder: "Optional" },
  { name: "allDay", label: "All-day event", kind: "checkbox" },
  { name: "start", label: "Starts", kind: "datetime", required: true, width: half },
  { name: "end", label: "Ends", kind: "datetime", required: true, width: half },
  { name: "timezone", label: "Time zone", kind: "timezone", visible: (v) => v.allDay !== true, help: "Times are converted to UTC so every calendar shows them correctly." },
  { name: "description", label: "Description", kind: "textarea", maxLength: 500, placeholder: "Optional" },
  { name: "url", label: "Event link", kind: "url", placeholder: "Optional", inputMode: "url" },
];
export const eventType: ContentTypeDef = {
  id: "event",
  label: "Event",
  description: "Add an event to the scanner's calendar.",
  tier: "static",
  fields: eventFields,
  defaults: { title: "", location: "", allDay: false, start: "", end: "", timezone: "UTC", description: "", url: "" },
  validate(values) {
    const e = baseValidate(eventFields, values);
    urlRule(e, values, "url");
    const tz = str(values, "timezone") || "UTC";
    if (!bool(values, "allDay") && !isValidTimeZone(tz)) e.timezone = "Choose a valid time zone.";
    const allDay = bool(values, "allDay");
    const parse = (s: string) => (allDay ? (icalDate(s) ? Date.parse(s.slice(0, 10)) : null) : zonedWallTimeToUtc(s, tz));
    const start = str(values, "start") ? parse(str(values, "start")) : null;
    const end = str(values, "end") ? parse(str(values, "end")) : null;
    if (!e.start && str(values, "start") && start === null) e.start = "Enter a valid date and time.";
    if (!e.end && str(values, "end") && end === null) e.end = "Enter a valid date and time.";
    if (!e.start && !e.end && start !== null && end !== null && end < start) e.end = "The event must end after it starts.";
    return e;
  },
  encode(v) {
    const allDay = bool(v, "allDay");
    const tz = str(v, "timezone") || "UTC";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//QR Studio//EN", "BEGIN:VEVENT", `SUMMARY:${escapeICal(str(v, "title"))}`];
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icalDate(str(v, "start"))}`, `DTEND;VALUE=DATE:${icalDate(str(v, "end"), 1)}`);
    } else {
      lines.push(
        `DTSTART:${icalUtc(zonedWallTimeToUtc(str(v, "start"), tz)!)}`,
        `DTEND:${icalUtc(zonedWallTimeToUtc(str(v, "end"), tz)!)}`,
      );
    }
    if (str(v, "location")) lines.push(`LOCATION:${escapeICal(str(v, "location"))}`);
    if (raw(v, "description").trim()) lines.push(`DESCRIPTION:${escapeICal(raw(v, "description").trim())}`);
    if (str(v, "url")) lines.push(`URL:${webUrl(v, "url")}`);
    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.join("\r\n");
  },
  hint: (v) => str(v, "title"),
  sample: {
    title: "Launch party",
    location: "Main Hall, 1 Example Road",
    allDay: false,
    start: "2026-12-01T18:30",
    end: "2026-12-01T21:00",
    timezone: "Europe/London",
    description: "Drinks, demos; music",
    url: "",
  },
};

// 14. Bitcoin & crypto
const COINS: Array<{ value: Coin; label: string }> = [
  { value: "bitcoin", label: "Bitcoin (BTC)" },
  { value: "ethereum", label: "Ethereum (ETH)" },
  { value: "litecoin", label: "Litecoin (LTC)" },
  { value: "bitcoincash", label: "Bitcoin Cash (BCH)" },
  { value: "dash", label: "Dash (DASH)" },
];
const cryptoFields: FieldDef[] = [
  { name: "coin", label: "Currency", kind: "select", options: COINS },
  { name: "address", label: "Wallet address", kind: "text", required: true, autoComplete: "off", help: "The checksum is verified so typos are caught before printing." },
  { name: "amount", label: "Amount", kind: "number", placeholder: "Optional", inputMode: "decimal", width: half },
  { name: "label", label: "Recipient name", kind: "text", maxLength: 60, placeholder: "Optional", width: half, visible: (v) => v.coin !== "ethereum" },
  { name: "message", label: "Message", kind: "text", maxLength: 120, placeholder: "Optional", visible: (v) => v.coin !== "ethereum" },
];
export const cryptoType: ContentTypeDef = {
  id: "crypto",
  label: "Bitcoin & crypto",
  description: "Request a payment to a wallet address.",
  tier: "static",
  fields: cryptoFields,
  defaults: { coin: "bitcoin", address: "", amount: "", label: "", message: "" },
  validate(values) {
    const e = baseValidate(cryptoFields, values);
    const coin = (str(values, "coin") || "bitcoin") as Coin;
    const address = str(values, "address");
    if (!e.address && address && !isValidAddress(coin, address)) {
      e.address = `This is not a valid ${COINS.find((c) => c.value === coin)?.label ?? coin} address (checksum or format mismatch).`;
    }
    const amount = str(values, "amount");
    const decimals = coin === "ethereum" ? 18 : 8;
    if (amount && (!new RegExp(`^\\d{1,12}(\\.\\d{1,${decimals}})?$`).test(amount) || Number(amount) <= 0)) {
      e.amount = `Use a positive amount with up to ${decimals} decimals.`;
    }
    return e;
  },
  encode(v) {
    const coin = (str(v, "coin") || "bitcoin") as Coin;
    let address = str(v, "address");
    const amount = str(v, "amount");
    if (coin === "ethereum") return `ethereum:${address}${amount ? `?value=${ethToWei(amount)}` : ""}`;
    if (coin === "bitcoincash") address = address.replace(/^bitcoincash:/i, "");
    const q = [
      amount && `amount=${amount}`,
      str(v, "label") && `label=${encodeURIComponent(str(v, "label"))}`,
      str(v, "message") && `message=${encodeURIComponent(str(v, "message"))}`,
    ].filter(Boolean);
    return `${coin}:${address}${q.length ? `?${q.join("&")}` : ""}`;
  },
  hint: (v) => str(v, "coin") || "crypto",
  sample: { coin: "bitcoin", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", amount: "0.0015", label: "QR Studio", message: "Invoice 42" },
};

export const STATIC_TYPES: ContentTypeDef[] = [
  urlType,
  textType,
  emailType,
  phoneType,
  smsType,
  vcardType,
  mecardType,
  locationType,
  facebookType,
  twitterType,
  youtubeType,
  wifiType,
  eventType,
  cryptoType,
];

