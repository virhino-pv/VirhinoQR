# 12 — Deploying VirhinoQR to Vercel (Guest Mode)

Production URL: **https://virhinoqr.virhino.com**. Status: prepared, **not deployed** (awaiting approval).

## 1. What runs in production
- Guest Mode: every QR feature works without login or backend (generation, 22 types, customisation, logos,
  PNG/SVG/PDF/EPS, templates in the browser, CSV/XLSX bulk + ZIP).
- No Supabase variables are set, so accounts are hidden; `/dashboard/*` redirects to a page explaining
  that accounts aren't set up. Authentication code (M9) stays in place for later activation.

## 2. Configuration in the repository
| File | Purpose |
|---|---|
| `.env.production` (committed) | `NEXT_PUBLIC_SITE_URL=https://virhinoqr.virhino.com` — public value only; a unit test fails if anything else is added |
| `src/lib/site.ts` | Brand name and canonical origin: `NEXT_PUBLIC_SITE_URL` → Vercel production fallback → localhost |
| `src/app/robots.ts`, `src/app/sitemap.ts` | `/robots.txt` (account pages disallowed) and `/sitemap.xml` (/, /create, /templates, /bulk) |
| `next.config.ts` | Security headers (nosniff, frame DENY, referrer policy, permissions policy) |
| `package.json` `prebuild` | Copies the ZXing scanner wasm to `public/wasm/` (served from our own domain) |

## 3. Vercel project settings
| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root directory | repository root (`qr-studio`) |
| Install command | default (Vercel detects `package-lock.json` and installs with npm) |
| Build command | `npm run build` (default — runs `prebuild` first) |
| Output | default (`.next`) — do **not** set `NEXT_DIST_DIR` |
| Node.js | 20.x or newer (developed on 24) |
| Environment variables | `NEXT_PUBLIC_SITE_URL=https://virhinoqr.virhino.com` (Production) — optional, `.env.production` already sets it. **Do not** add Supabase variables for Guest Mode. |

The repository has no Git remote yet. Either push it to GitHub/GitLab and import it in Vercel, or deploy
from this folder with the Vercel CLI (`npx vercel` for a preview, `npx vercel --prod` for production).

## 4. Domain (later — not done yet)
1. Vercel → Project → Settings → Domains → add `virhinoqr.virhino.com`.
2. At the DNS provider for `virhino.com`, add the record Vercel shows (normally `CNAME virhinoqr → cname.vercel-dns.com`).
3. Wait for Vercel to issue the TLS certificate; the site then serves on HTTPS.

## 5. Smoke test after deployment
1. `https://virhinoqr.virhino.com/` loads; the header shows **VirhinoQR**.
2. `/robots.txt` lists `Sitemap: https://virhinoqr.virhino.com/sitemap.xml`; `/sitemap.xml` lists four pages.
3. `/create`: type a URL → “Scans correctly” → download PNG, SVG, PDF, EPS.
4. `/bulk`: upload a small CSV → generate → download ZIP.
5. `/templates` → “Use template” opens the studio with the design.
6. `/dashboard` → redirects to the “accounts aren't set up” page (expected in Guest Mode).
7. Scan a printed code with an iPhone and an Android phone.

## 6. Enabling accounts later
Follow doc 11: apply the migration, configure Supabase Auth (Site URL = the production URL, redirect URL
`https://virhinoqr.virhino.com/**`), then add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel and redeploy.
