# 04 — QR Generation Architecture

Goal: a **real, original, isomorphic QR engine** (same TypeScript code in browser, Node and edge) that turns
`(payload, design)` into a vector scene, serialises it to SVG / PNG / PDF / EPS, and verifies the result scans.
The reference renders on its server (doc 01 F8); we render client-side for static codes and reuse the identical
engine server-side for the API and bulk jobs.

```
 ┌──────────────┐   ┌────────────────┐   ┌─────────────┐   ┌──────────────┐   ┌─────────────┐
 │ Type form     │──▶│ Payload encoder │──▶│ Matrix       │──▶│ Scene builder │──▶│ Serialisers  │
 │ (Zod-validated│   │ (per type, pure)│   │ (QR encode,  │   │ (shapes, eyes,│   │ SVG/PNG/PDF/ │
 │  form state)  │   │  → string/bytes │   │  EC, version)│   │ paints, logo) │   │ EPS/canvas   │
 └──────────────┘   └────────────────┘   └─────────────┘   └──────────────┘   └─────┬───────┘
                                                                                     │
                                                                          ┌──────────▼─────────┐
                                                                          │ Scan validator       │
                                                                          │ (ZXing WASM decode   │
                                                                          │  == payload ?)       │
                                                                          └──────────────────────┘
```

## 1. Package layout (monorepo, pnpm workspaces)

| Package | Responsibility | Runtime |
|---|---|---|
| `packages/payloads` | One encoder per content type + escaping helpers + Zod schemas | any |
| `packages/engine` | Matrix, scene graph, shapes, eyes, paints, logo layout, capacity maths | any (no DOM) |
| `packages/export` | SVG (string), PNG (canvas in browser / `@resvg/resvg-wasm` on server), PDF (`jspdf` + `svg2pdf.js`), EPS (own writer) | browser + node |
| `packages/verify` | Decode with `zxing-wasm` (reader build) + heuristics | worker + node |
| `apps/web` | Next.js app (UI, dashboard, API routes, redirect route) | Vercel/Node + edge |

## 2. Payload encoders (`packages/payloads`)
- Signature: `encode<T extends QrType>(type: T, data: FormData<T>, opts?) => { text: string; warnings: string[] }`.
- Each type has: Zod schema (validation + defaults), encoder, decoder (for round-trip tests), golden test vectors.
- Escaping helpers: `escapeVCard` (RFC 6350: `\\ , ; \n`), `escapeMeCard` / `escapeWifi` (`\\ ; , : "`), `escapeICal` (RFC 5545), `mailtoEncode` (RFC 6068).
- Fixes vs reference are listed in doc 02 (MeCard URL, mailto encoding, escaping, WiFi hidden, VCALENDAR wrapper, EIP-681).
- Text is encoded as UTF-8; ECI header added only for non-ASCII when it improves scanner compatibility (configurable, default off — most scanners assume UTF-8).

## 3. Matrix (`packages/engine/matrix`)
- Use **`qrcode`** (MIT, mature) *only* for the standard ISO/IEC 18004 encoding step (`QRCode.create(text, { errorCorrectionLevel, version?, maskPattern? })` → `modules` bit matrix + version).
  Alternative behind the same interface: vendored Nayuki `qrcodegen` (MIT). Our code never depends on a library's renderer.
- Module classification map computed by us: `finder(0..2)`, `separator`, `timing`, `alignment`, `format`, `version`, `data`. Needed so eyes are drawn by the eye renderer and body shapes skip finder areas.
- **Error correction**: `L/M/Q/H` + `auto` (H if logo, otherwise M). UI shows version (1–40), module count, and capacity used %.
- **Capacity guard**: if payload exceeds the chosen EC capacity → error "Too much data for EC level X — shorten text or lower EC".

## 4. Scene graph (`packages/engine/scene`)
```ts
type Paint =
  | { kind: 'solid'; color: RGBA }
  | { kind: 'linear'; stops: Stop[]; angleDeg: number }
  | { kind: 'radial'; stops: Stop[]; cx: number; cy: number; r: number };
type Node =
  | { kind: 'path'; d: string; paint: Paint; role: 'body' | 'eyeFrame' | 'eyeBall' | 'frame' | 'text' }
  | { kind: 'image'; href: string /* data URI */; x: number; y: number; w: number; h: number; clip?: 'rect' | 'circle' | 'rounded' };
interface Scene { width: number; height: number; background: Paint | null; nodes: Node[]; meta: { version: number; ec: Ec; modules: number } }
```
Coordinates are in **module units** with the quiet zone included; serialisers scale to pixels/points. All body modules of one paint are merged into **one path** (`d` concatenation) → small SVGs (reference SVG had ~750 `<g>` elements; ours targets 3–6 nodes).

### 4.1 Body shapes
- A shape = `(ctx: ModuleCtx) => PathSegment`, where `ctx` contains `x, y` and neighbour flags `n,e,s,w,ne,nw,se,sw`. Connected styles (rounded joins, "liquid", lines) use neighbour flags; isolated styles (dot, diamond, star) ignore them.
- Launch set (original designs): `square`, `rounded`, `dots`, `diamond`, `classy` (one rounded corner), `liquid` (connected blobs), `vertical-bars`, `horizontal-bars`, `star`, `cross`, `mosaic` (random-size squares, seeded), `heart`. Each defines a **min scan safety factor** used by the verifier.

### 4.2 Eyes (finder patterns)
- Frame (7×7 ring) and ball (3×3) shapes are unit-space path functions; renderer places them at the three finder positions applying per-eye transforms (rotate/mirror so asymmetric shapes point outward — equivalent concept to the reference's `erf/brf` flip flags, our own geometry).
- Launch set: frames `square, rounded, extra-rounded, circle, leaf, dotted, cut-corner, thick`; balls `square, rounded, circle, leaf, diamond, star, dots-3x3, cut-corner`.
- Colours: global eye frame/ball paints + optional per-eye override; "gradient on eyes" option.

### 4.3 Paints
- Gradients are defined once over the **whole symbol bounding box** (`gradientUnits="userSpaceOnUse"`) so modules share one continuous gradient. Linear: angle 0–360°; radial: centre + radius.
- Background: solid, gradient, or transparent (PNG alpha, SVG no rect).

### 4.4 Logo
- Input: File → validated (type allow-list, ≤ 5 MB, SVG sanitised with DOMPurify SVG profile) → normalised to data URI (raster logos downscaled to ≤ 1024 px).
- **Logo background removal** (optional): client-side canvas colour-key — sample the corner pixels, flood-fill/alpha-out pixels within tolerance Δ E; preview before/after; output PNG data URI.
- Placement: size as % of symbol width (10–30 %), centre or 9-point grid offset (offset not allowed over finder areas), padding (modules), cut-out shape (rect/rounded/circle).
- **Clear modules behind logo** (reference "Remove Background Behind Logo") — on by default when a logo is used.
- **Safety limit**: covered *data* modules must be ≤ budget: `L 4 %`, `M 9 %`, `Q 14 %`, `H 19 %` of codewords-area (conservative vs. the 7/15/25/30 % theoretical recovery). If exceeded → auto-raise EC → if still exceeded, cap size and warn.

### 4.5 Optional frame / caption [N]
Outer frame templates ("Scan me" label, rounded border, bottom banner) with editable text, font, colours — rendered as `frame`/`text` nodes (text converted to paths via `opentype.js` for PDF/EPS fidelity).

## 5. Serialisers (`packages/export`)

| Format | Method | Gradients | Logo | Notes |
|---|---|---|---|---|
| **SVG** | string builder from scene | ✔ native | ✔ `<image href="data:…">` (SVG logos inlined as nested `<svg>`) | source of truth; `viewBox` in modules, `width/height` in px |
| **PNG** | browser: `OffscreenCanvas`/`<canvas>` draw SVG blob → `toBlob`; server: `@resvg/resvg-wasm` | ✔ | ✔ | 200–4000 px, transparent option, embed `pHYs` DPI chunk for print |
| **PDF** | `jspdf` + `svg2pdf.js` (vector) | ✔ (axial/radial shading) | ✔ | page = code size + optional bleed; CMYK option later |
| **EPS** | own PostScript Level 3 writer from scene: `moveto/lineto/curveto` paths, `setrgbcolor`, gradients via `shfill` (ShadingType 2 axial / 3 radial) clipped to body path, logo via `image` dict (ASCII85) | ✔ (Level 3) — fallback: flatten to first stop with warning if user selects "Level 2 compatible" | ✔ raster | `%%BoundingBox` header; validated with Ghostscript in CI |
| **Clipboard** | `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` | ✔ | ✔ | feature-detected |

All exports are produced client-side for static QR (no upload). Filenames: `qr-<type>-<yyyymmdd-hhmm>.<ext>`.

## 6. Scan validation (`packages/verify`)
1. **Heuristics (sync, instant)**: contrast ratio fg vs bg (WCAG relative luminance) ≥ 3:1 and fg darker than bg (inverted codes flagged — many scanners fail); quiet zone ≥ 2 modules (warn < 4); logo coverage within budget; module pixel size ≥ 2 px for PNG exports.
2. **Decode test (async, Web Worker)**: rasterise the scene at 300 px and 600 px (and with simulated slight blur at 300 px), decode with `zxing-wasm` (`readBarcodes`, formats `QRCode`, `tryHarder`). Pass ⇔ every run decodes **byte-identical** text to the payload.
3. Result surfaced in `ScanBadge`; downloads remain allowed on failure but show a confirm dialog ("This design may not scan reliably").
4. Same verifier runs in CI over the shape × eye × EC × logo matrix (doc 07).

## 7. Live preview pipeline
- Form/design state in a Zustand store; changes debounced 60 ms → engine call in a **Web Worker** (Comlink) → SVG string → rendered via `<img src="blob:">` (or inline SVG sanitised) → verifier queued (latest-wins cancellation).
- Matrix memoised by `(payload, ec, version)`; scene memoised by design hash. Target: < 16 ms for version ≤ 10, < 60 ms for version 40.

## 8. Static vs Dynamic separation

```
                    STATIC (no account, no backend)              DYNAMIC (account + backend)
 Payload            real content (URL, vCard, WiFi…)            short link https://qrs.example/r/<slug>
 Render/export      browser only                                 browser (same engine) + API server
 Storage            local (IndexedDB): history, drafts,         Postgres: qr_codes, versions, folders,
                    saved designs                                templates, scans, api_keys, files
 Editable later     no (content is in the code)                  yes (destination stored server-side)
 Analytics          none                                         scan events via redirect service
```

### 8.1 Backend components (Dynamic tier)
- **Auth**: Supabase Auth (email magic link + OAuth Google/GitHub).
- **DB** (Supabase Postgres, Row Level Security):
  - `profiles(id, display_name, plan, created_at)`
  - `folders(id, owner_id, name, parent_id, created_at)` — campaign folders
  - `qr_codes(id, owner_id, folder_id, kind 'static'|'dynamic', type, name, slug unique, destination jsonb, design jsonb, status 'active'|'paused'|'archived', created_at, updated_at)`
  - `qr_destinations_history(id, qr_id, destination jsonb, changed_by, changed_at)`
  - `scans(id bigserial, qr_id, scanned_at, country, region, city, device_type, os, browser, referrer, ip_hash, is_unique)` — partitioned by month
  - `templates(id, owner_id null=system, name, design jsonb, thumbnail_svg, created_at)`
  - `files(id, owner_id, qr_id, bucket_path, mime, bytes, sha256, scan_status)`
  - `responses(id, qr_id, kind 'rating'|'feedback', payload jsonb, created_at)`
  - `api_keys(id, owner_id, name, prefix, hash, scopes, last_used_at, revoked_at)`
  - `bulk_jobs(id, owner_id, status, total, done, error_report jsonb, result_path)`
- **Redirect service** `GET /r/[slug]` (Next.js edge route): cache lookup (KV / in-memory LRU + Postgres) → if `paused` show notice → record scan asynchronously (`waitUntil`) → `302` to destination, or render hosted landing page for MP3/PDF/gallery/links/app/rating/feedback. App-store type redirects by User-Agent.
- **Privacy**: no cookies on redirect; IP → country via provider header (e.g. `x-vercel-ip-country`) then discarded; `ip_hash = sha256(ip + daily salt)` for unique counts only.
- **Storage**: Supabase Storage buckets per type, signed upload URLs, size/type limits, ClamAV scan job before publishing.

### 8.2 Public REST API (`/api/v1`, our own)
| Method | Path | Purpose |
|---|---|---|
| POST | `/render` | Static render: `{type, data, design, format, size}` → file (SVG/PNG/PDF/EPS). Stateless. |
| POST | `/qr` | Create dynamic QR → `{id, slug, shortUrl}` |
| GET/PATCH/DELETE | `/qr/:id` | Read / edit destination+design / archive |
| GET | `/qr/:id/scans?from&to&groupBy` | Analytics |
| POST | `/bulk` | Create bulk job (CSV upload) → job id; `GET /bulk/:id` status + ZIP URL |
Auth: `Authorization: Bearer qrs_live_…` (hashed at rest); rate limits per key (token bucket in Postgres/Upstash); OpenAPI 3.1 spec generated from Zod (`zod-openapi`).

### 8.3 Bulk generation
- **Static bulk (client)**: CSV/XLSX (PapaParse / SheetJS) → column mapping UI → per-row validation report → render in a worker pool → streamed ZIP (`client-zip`) with chosen formats + `manifest.csv`. Limit 1,000 rows client-side.
- **Dynamic bulk (server)**: creates rows + slugs in a transaction, generates files in a background job (Supabase Edge Function / queue), ZIP to storage, notify when done.

## 9. Security
- All user strings rendered as text (React escapes); uploaded SVG sanitised; CSP with `img-src 'self' blob: data:`; SSRF-safe (server never fetches user URLs except optional link preview, which is off).
- Destination URL validation for dynamic codes (block `javascript:`/`data:`; Google Safe Browsing check optional) to prevent the redirect service being abused for phishing.
- RLS on every table; API keys scoped; audit log of destination changes.
