/** Time-zone helpers without external libraries (uses Intl). */

/** Offset (ms) of `timeZone` from UTC at the instant `utcMs`. */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Parses "YYYY-MM-DDTHH:mm" (wall-clock time in `timeZone`) to a UTC timestamp. */
export function zonedWallTimeToUtc(local: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0));
  if (Number.isNaN(guess)) return null;
  let utc = guess - zoneOffsetMs(guess, timeZone);
  // Second pass handles instants next to a DST change.
  utc = guess - zoneOffsetMs(utc, timeZone);
  return utc;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** iCalendar UTC DATE-TIME: 20261104T093000Z */
export function icalUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}

/** iCalendar DATE from "YYYY-MM-DD…" (+ optional day offset): 20261104 */
export function icalDate(local: string, addDays = 0): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(local);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]! + addDays));
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}`;
}

export function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
