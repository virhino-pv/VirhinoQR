# 08 — Architecture as built (M0–M8)

This documents what was actually implemented. Differences from the plan in doc 04/05 are listed in §7.

## 1. Pipeline

```
 form values ─▶ payloads/ (validate + encode, pure) ─▶ payload string
                                                         │
 design + logo ─────────────────────────────────────────▶ qr/engine buildScene()
                                                         │   matrix (qrcode lib, ISO step only)
                                                         │   → module classes → shapes → paints → logo layout
                                                         ▼
                                                       Scene (vector, module units)
                     ┌──────────────┬────────────────┬───┴────────────┬───────────────┐
                     ▼              ▼                ▼                ▼               ▼
                sceneToSvg     canvas → PNG     sceneToPdf       sceneToEps     scan check
                (preview,      (+pHYs DPI,      (own writer,     (own PS L3     (render → ZXing
                 SVG export)    IHDR check)      shadings,SMask)  writer)         → == payload)
```

Everything above runs in the browser. The engine, payload encoders and writers are pure TypeScript
with no DOM access, so the same code runs in Node (tests) and could run on a server later.

## 2. Modules

| Module | Responsibility | Notes |
|---|---|---|
| `lib/payloads` | 22 `ContentTypeDef`s: field list, defaults, `validate`, `encode`, sample | `buildPayload()` returns `empty` / `invalid{errors}` / `ok{payload}`. Escaping helpers, BTC/LTC/DASH/BCH/ETH checksum validation, Intl-based time-zone conversion |
| `lib/qr/engine/matrix` | Wraps `qrcode` (`QRCode.create`) for segmenting, Reed–Solomon and masking | UTF-8 byte mode; maps library errors to `too-long` / `version-too-small` |
| `lib/qr/engine/shapes` | Original geometry: 10 body, 7 eye-frame, 7 eye-ball shapes | Body shapes never overlap neighbours → one nonzero-filled path |
| `lib/qr/engine/scene` | Builds the scene: body path (square runs merged), 3 eyes mirrored per corner, paints, logo placement, obscured-module statistics | Logo clamped away from finder patterns; clear region square/rounded/circle |
| `lib/qr/engine/design` | `Design` type, Zod schema, defaults, auto EC (H with logo, else M), logo budgets | Budgets calibrated by decode tests (L 3 %, M 7 %, Q 11 %, H 15 % of symbol area) |
| `lib/qr/export/svg` | SVG 1.1, `viewBox` in modules, `width/height` in px, gradients `userSpaceOnUse`, logo as data-URI `<image>` | Layers with identical paint merged |
| `lib/qr/export/pdf` | PDF 1.4 writer: Flate content stream, axial/radial shadings clipped to paths, logo image + SMask | Page = print size in mm |
| `lib/qr/export/eps` | EPSF-3.0 / LanguageLevel 3: paths, `shfill` gradients, Flate+ASCII85 image (ImageType 1, or ImageType 3 mask) | |
| `lib/qr/export/browser` | SVG → `<img>` → canvas → PNG; pHYs DPI; output validation (dimensions, signatures, XML parse) | |
| `lib/qr/verify` | ZXing-C++ wasm (`zxing-wasm/reader`, self-hosted at `/wasm/zxing_reader.wasm`); contrast/eye/margin/logo heuristics | |
| `lib/image` | Magic-byte validation, DOMPurify SVG sanitising + external-reference stripping, border flood-fill background removal, area-average resampling, original icon gallery | Uploaded SVGs are rasterised after sanitising — user markup never reaches an export |
| `lib/templates` | Built-in templates (single source for the homepage showcase), user-template model, Zod-validated JSON import/export, IndexedDB storage | M7 |
| `lib/bulk` | `parse` (PapaParse / read-excel-file → string table, limits), `mapping` (auto-map, type column, option matching, row validation, unique file names), `generate` (renderer-injected loop with progress/abort, CSV reports with formula-injection guard, fflate ZIP) | M8; the same loop runs in Node tests with resvg |
| `lib/store/studio` | Zustand: type, per-type drafts, touched fields, design, logo, export settings | Seeded from `?type=&url=` per request |

## 3. UI composition

- `/` — server-rendered marketing page with client islands (hero quick generator, style showcase).
- `/templates` — static gallery of built-in templates; `/create?template=<id>` applies one.
- `/bulk` — client workflow: upload → map → design (shared studio panes and store) → preview → generate/download.
- `/create` — server page reads `searchParams`, renders `<Studio>` (client). `useQrPipeline()` derives
  payload → scene → preview data URI → heuristics, and runs a debounced, latest-wins ZXing decode.
- Forms are generated from field definitions (`ContentForm`), so every type uses the same accessible
  label/help/error wiring; errors appear after blur or when Download is pressed.

## 4. Static vs dynamic

All 22 types produce static codes. The 8 hosted-content types (MP3, Video, PDF, Social, App Store,
Gallery, Rating, Feedback) encode a link to content the user already hosts and show a notice in the
form explaining that hosting/landing pages/smart redirects need the dynamic tier (M10–M11, not built).

## 5. Security & privacy

- No network calls with user data; ZXing wasm served from our origin (no CDN).
- Security headers: `nosniff`, `DENY` framing, strict referrer policy, permissions policy (geolocation self only).
- URL validation blocks `javascript:`, `data:`, `file:` etc. in every link field.
- SVG uploads: DOMPurify SVG profile, scripts/handlers/foreignObject/animation removed, external
  `href`/`url()` removed, then rasterised. E2E verifies no dialog fires and no external request is made.

## 6. Testing strategy

| Layer | Tool | What is proven |
|---|---|---|
| Payloads | Vitest golden vectors | exact strings for every type, escaping, validation messages |
| Engine & scannability | Vitest + resvg + ZXing | every shape × 4 payloads, EC L/M/Q/H × v1/5/10/25/40, Unicode (Tamil, Hindi, Japanese, emoji), gradients, per-eye colours, margins 0/2/10, logos within budget for every EC, all 22 samples |
| Export | Vitest + pdf.js + @napi-rs/canvas | PDFs rendered by pdf.js decode (solid, gradient, radial+logo, transparent); SVG decodes via resvg; EPS structure + embedded data round-trip; PNG pHYs |
| Logo | Vitest (jsdom) | type sniffing, invalid files, background removal, malicious SVG sanitising |
| UI | Playwright (Chrome) | all 22 types through the real form → exact payload → scan pass; customisation, logo, downloads (decoded again in Node), 6 viewports, mobile menu/bar, keyboard, axe |

## 7. Deviations from the plan (doc 04/05) and why

| Plan | Built | Reason |
|---|---|---|
| pnpm monorepo (`packages/*`) | Single Next.js app; modules under `src/lib/*` with no UI imports | Brief asked for `npm run build`; same separation without workspace overhead. Packages can be extracted later. |
| `jspdf` + `svg2pdf.js` | Own PDF writer | Needs no DOM, so it is testable in Node; full control of shadings/SMask; verified with pdf.js |
| Radix UI | Native elements + small own components | Native `<details>`, `<dialog>`, `<select>`, range inputs and WAI-ARIA radio groups were sufficient and passed axe |
| Web Worker pipeline | Main thread, memoised, scan check debounced 220 ms | Render times are small for typical codes; a worker can be added if profiling shows need |
| Leaflet map for Location | Latitude/longitude fields + "Use my current location" | Avoids a third-party tile/geocoding dependency in M2 |
| `next/font` | `@fontsource-variable` packages | No build-time network fetch |
| ≥ 12 body / 10 frame / 10 ball shapes | 10 / 7 / 7 | Only shapes that pass the decode matrix ship; "sparkle" ball was removed after failing |
