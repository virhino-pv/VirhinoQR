/**
 * Public Supabase configuration. Only the project URL and the *publishable* (anon) key may reach the
 * browser. Accounts are optional: when unconfigured the app keeps working without sign-in.
 * Error messages never include key values.
 */

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export type ConfigResult = { ok: true; config: SupabasePublicConfig } | { ok: false; reason: "missing" | "invalid"; message: string };

function decodeJwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = typeof atob === "function" ? atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")) : Buffer.from(parts[1]!, "base64url").toString("utf8");
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

/** True for keys that must never be public: new-style secret keys and legacy service_role JWTs. */
export function isSecretKey(key: string): boolean {
  if (/^sb_secret_/i.test(key)) return true;
  return decodeJwtRole(key) === "service_role";
}

export function parseSupabaseConfig(env: { url?: string; publishableKey?: string; anonKey?: string }): ConfigResult {
  const url = env.url?.trim();
  const key = (env.publishableKey || env.anonKey)?.trim();
  if (!url && !key) return { ok: false, reason: "missing", message: "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set)." };
  if (!url) return { ok: false, reason: "invalid", message: "NEXT_PUBLIC_SUPABASE_URL is missing." };
  if (!key) return { ok: false, reason: "invalid", message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing." };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid", message: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL." };
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    return { ok: false, reason: "invalid", message: "NEXT_PUBLIC_SUPABASE_URL must use https (http is allowed only for localhost)." };
  }
  if (/^postgres(ql)?:/i.test(key) || /^postgres(ql)?:/i.test(url)) {
    return { ok: false, reason: "invalid", message: "A database connection string must never be used as public Supabase configuration." };
  }
  if (isSecretKey(key)) {
    return { ok: false, reason: "invalid", message: "The public Supabase key is a secret/service-role key. Use the publishable (anon) key; keep secret keys server-side only." };
  }
  if (key.length < 20) return { ok: false, reason: "invalid", message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks truncated." };
  return { ok: true, config: { url: parsed.origin, publishableKey: key } };
}

// Accessed as literal process.env.NEXT_PUBLIC_* so Next.js inlines them at build time.
export const supabaseConfig: ConfigResult = parseSupabaseConfig({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const accountsEnabled = supabaseConfig.ok;

let warned = false;
/** Logs a single, secret-free configuration warning (server side). */
export function warnIfMisconfigured() {
  if (warned || supabaseConfig.ok || supabaseConfig.reason === "missing") return;
  warned = true;
  console.warn(`[supabase] ${supabaseConfig.message} Accounts are disabled.`);
}

/** Public site origin used in auth email links. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}
