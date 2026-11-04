/**
 * Validates post-login/post-verification redirect targets. Only same-site relative paths are
 * allowed (prevents open redirects such as ?next=https://evil.example or //evil.example).
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  const value = next.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value) || /^\/[^/]*:/.test(value)) return fallback;
  try {
    const u = new URL(value, "http://local.invalid");
    if (u.origin !== "http://local.invalid") return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

/** Routes that require a signed-in, verified user. */
export const PROTECTED_PREFIXES = ["/dashboard"] as const;
/** Auth pages a signed-in user doesn't need (redirected to the dashboard). */
export const GUEST_ONLY = ["/login", "/register", "/forgot-password"] as const;

export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
