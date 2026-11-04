/** Public identity of the site. Single source for the brand name and canonical URL. */

export const SITE_NAME = "VirhinoQR";
export const PRODUCTION_URL = "https://virhinoqr.virhino.com";

/**
 * Canonical origin used for metadata, sitemap and auth email links.
 * NEXT_PUBLIC_SITE_URL wins (set in .env.production and/or the Vercel project); otherwise Vercel
 * production builds use the production domain, and anything else falls back to localhost.
 */
export function siteOrigin(): string {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_ENV === "production" ? PRODUCTION_URL : undefined];
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    try {
      const u = new URL(raw.trim());
      if (u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1") return u.origin;
    } catch {
      /* try the next candidate */
    }
  }
  return "http://localhost:3000";
}
