# 05 — Technology Stack

## 1. Existing workspace inspection (2026-11-04)

| Item | Finding |
|---|---|
| `C:\virhino-product\REA` | Clone of `morluto/rea` (REA 6.8.0 source, `main` @ `c3647ade1`). A reverse-engineering tool, **not** a base for this product — left untouched. |
| `C:\virhino-product\qr-studio` | New, empty project created for this work (docs + research only so far). |
| Node / npm | Node **24.22.1**, npm **11.19.1** |
| pnpm | installed (`%APPDATA%\npm\pnpm`) |
| git | installed |
| Docker, Supabase CLI, psql, Ghostscript | **not installed** — needed later: Supabase CLI (local DB) or a hosted Supabase project; Ghostscript for EPS/PDF CI validation (can run in CI only) |

No existing application code, so there is no stack to preserve.

## 2. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15+ (App Router) + React 19 + TypeScript (strict)** | SSR/SEO for landing pages per QR type, edge route for redirects, API routes, one deployable |
| Styling | **Tailwind CSS v4** + CSS variables for tokens (doc 03) | fast, consistent design tokens, dark mode |
| UI primitives | **Radix UI** (Dialog, Tabs, Slider, Select, Popover, RadioGroup) | accessible behaviours without imposing look |
| State | **Zustand** (editor), **TanStack Query** (server data) | simple, worker-friendly |
| Forms/validation | **Zod** + React Hook Form | single schema shared by UI, encoders, API |
| QR matrix | **`qrcode`** (MIT) — encoding only; Nayuki `qrcodegen` as drop-in fallback | ISO-correct encoding is not where we add value; everything visual is ours |
| Rendering | **own engine** (`packages/engine`) → SVG scene | full design control, isomorphic |
| PNG | Canvas/OffscreenCanvas (browser), `@resvg/resvg-wasm` (server) | high-res, no native deps |
| PDF | `jspdf` + `svg2pdf.js` | vector incl. gradients |
| EPS | own PostScript L3 writer | no maintained JS lib; format is simple |
| Scan check | **`zxing-wasm`** (ZXing-C++ reader) in a Web Worker | most robust open decoder; same in Node CI |
| Image processing | Canvas 2D (logo resize, colour-key bg removal); DOMPurify for SVG | client-only, private |
| Workers | Comlink + Web Workers | keep UI at 60 fps |
| Bulk | PapaParse, SheetJS (`xlsx` community build), `client-zip` | streaming, client-side |
| Maps | Leaflet + OpenStreetMap tiles, Nominatim (or MapTiler geocoding) | no Google Maps billing; attribution respected |
| Auth / DB / Storage | **Supabase** (Postgres + RLS, Auth, Storage, Edge Functions) | only for Dynamic tier |
| ORM / queries | Drizzle ORM (typed SQL, migrations) | works with Supabase Postgres |
| Rate limiting / cache | Upstash Redis (or Postgres table in v1) | API keys + redirect cache |
| Analytics charts | Recharts | dashboard |
| Testing | Vitest (unit), Playwright (E2E + visual), `zxing-wasm` decode matrix, Ghostscript validation for EPS/PDF in CI | doc 07 |
| Lint/format | ESLint (typescript-eslint), Prettier, `knip` | hygiene |
| CI | GitHub Actions | lint, typecheck, test, build, e2e |
| Hosting | Vercel (web + edge redirect) + Supabase cloud | low ops; alternatives: Fly.io/Render + self-hosted Supabase |

## 3. Browser-only vs backend

| Feature | Runs where | Backend? |
|---|---|---|
| All 14 static content types, validation, encoding | browser | **No** |
| Rendering, live preview, shapes, colours, gradients, logo, bg removal | browser (worker) | **No** |
| PNG/SVG/PDF/EPS export, clipboard | browser | **No** |
| Scan validation | browser (worker) | **No** |
| Built-in templates; save design / history / drafts locally | browser (IndexedDB) | **No** |
| Static bulk generation (≤ 1,000 rows) + ZIP | browser | **No** |
| Accounts, cloud-synced projects/templates/history | server | Yes |
| Dynamic QR, editable destinations, redirect, scan analytics | server (edge) | Yes |
| Hosted types (MP3, Video, PDF, Gallery, Social, App, Rating, Feedback, file) | server + storage | Yes |
| Campaign folders, dashboard | server | Yes |
| Public REST API, server bulk | server | Yes |

## 4. Legal / IP guardrails
- No reuse of QRCode Monkey code, CSS, sprites, icons, templates, mascot, copy, or API. Shape geometry, templates and icons are drawn from scratch.
- "QR Code" is a registered trademark of DENSO WAVE INCORPORATED — include the standard notice in the footer.
- Third-party brand icons in the logo gallery only where the brand's guidelines allow use in QR codes; ship as user-selectable, not as our branding.
- Licences of dependencies (MIT/ISC/Apache-2.0/BSD) tracked with `license-checker` in CI.
