/** Escaping and normalisation helpers shared by the payload encoders. Pure functions. */

/** MeCard / MATMSG fields: backslash-escape `\ ; , : "`. */
export function escapeMeCard(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

/** Wi-Fi network config (ZXing "WIFI:" format): backslash-escape `\ ; , : "`. */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

/** vCard 3.0/4.0 text values (RFC 2426 / RFC 6350): `\ , ;` and newlines. */
export function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** vCard 2.1 has no newline escape in plain values; semicolons are escaped, newlines become spaces. */
export function escapeVCard21(value: string): string {
  return value.replace(/;/g, "\\;").replace(/\r\n|\r|\n/g, " ");
}

/** iCalendar TEXT (RFC 5545 §3.3.11). */
export function escapeICal(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Percent-encoding for mailto/sms query values (RFC 6068): spaces as %20, newlines as %0D%0A. */
export function encodeQueryValue(value: string): string {
  return encodeURIComponent(value.replace(/\r\n|\r|\n/g, "\r\n"));
}

export function isAscii(value: string): boolean {
  return /^[\x00-\x7f]*$/.test(value);
}

/** Strips formatting characters from a phone number, keeping a leading +. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/[^0-9]/g, "");
}

export function isValidPhone(value: string): boolean {
  return /^\+?[0-9]{3,15}$/.test(normalizePhone(value)) && !/[a-z]/i.test(value);
}

const BLOCKED_SCHEMES = /^(javascript|data|vbscript|file|blob|about):/i;

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validates a web link and normalises it for encoding: adds https:// when no scheme is given,
 * allows only http(s), requires a real-looking host, and percent-encodes non-ASCII parts.
 */
export function normalizeWebUrl(input: string): UrlCheck {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a link." };
  if (/\s/.test(raw)) return { ok: false, error: "Links cannot contain spaces." };
  if (BLOCKED_SCHEMES.test(raw)) return { ok: false, error: "Only web links (http or https) are allowed." };
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (!hasScheme && /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^:]+:\d/.test(raw)) {
    return { ok: false, error: "Only web links (http or https) are allowed." };
  }
  const candidate = hasScheme ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "This doesn't look like a valid link." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only web links (http or https) are allowed." };
  }
  const host = url.hostname;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  if (!isIp && host !== "localhost" && !/\.[a-z0-9-]{2,}$/i.test(host)) {
    return { ok: false, error: "Add a complete domain, e.g. example.com." };
  }
  if (candidate.length > 2000) return { ok: false, error: "Links longer than 2,000 characters are not supported." };
  // Keep exactly what the user typed when it is plain ASCII; otherwise use the encoded form.
  return { ok: true, url: /^[\x21-\x7e]+$/.test(candidate) ? candidate : url.href };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function hostMatches(url: string, hosts: readonly string[]): boolean {
  const h = hostOf(url);
  return hosts.some((d) => h === d || h.endsWith(`.${d}`));
}
