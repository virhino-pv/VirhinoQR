# QR Studio

An original QR code generator: 22 content types, live preview with a real in-browser scan check,
colours, gradients, shapes, logo processing, templates, bulk generation from CSV/XLSX and PNG / SVG / PDF / EPS export. Everything runs in the
browser — no backend, no uploads, no third-party QR APIs.

**Status:** milestones M0–M8 implemented and tested (see [docs/PROGRESS.md](docs/PROGRESS.md)).
M9+ (accounts, dynamic QR, analytics, API) are not started.

## Quick start

Requirements: Node.js ≥ 20.9 (developed on 24.22), npm. E2E tests use the locally installed Google Chrome.

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server (copies the ZXing wasm into `public/wasm` first) |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest unit + decode tests incl. 10/100/500-row bulk runs (≈ 40 s) |
| `npm run test:e2e` | Playwright E2E against the production build — run `npm run build` first (≈ 5 min) |
| `npm run check` | typecheck + lint + unit tests |

Environment: copy `.env.example` to `.env.local` if you need to change `NEXT_PUBLIC_SITE_URL`.
No secrets are used or required.

## Project structure

```
src/
  app/                    Next.js routes: / (home), /create (studio), /templates, /bulk, error + 404 pages
  components/
    ui/                   Reusable accessible primitives (Button, Field, Segmented, Slider, ColorField, Notice)
    site/                 Header (responsive + mobile menu), Footer, brand mark
    home/                 Homepage sections, hero quick generator, live style showcase
    studio/               Studio: type picker, generated forms, design/logo/export/template panels, preview pipeline
    bulk/                 Bulk workflow: mapping editor, rows/results table
    qr/                   QrImage (engine-rendered), type icons
  lib/
    payloads/             22 content types: fields, validation, exact payload encoders (pure)
    qr/engine/            QR engine (no DOM): matrix, shapes, paints, logo layout, scene graph
    qr/export/            SVG, PDF (own writer), EPS (own PostScript L3 writer), PNG metadata, browser export
    qr/verify/            ZXing decode (browser + Node), readability heuristics
    image/                Logo validation, SVG sanitising, background removal, resampling, gallery
    templates/            Built-in templates, user-template model, JSON import/export, IndexedDB storage
    bulk/                 CSV/XLSX parsing, column mapping + row validation, generation loop, reports, ZIP
    store/                Zustand studio state
tests/
  unit/                   Vitest: payload golden vectors, engine, real decode matrix, logo, export
  e2e/                    Playwright: all 22 types in the UI, customisation, logo, downloads, responsive, a11y
docs/                     Research (01–07), architecture as built (08), completion report (09), limitations (10)
```

## Documents
1. [Website analysis (REA evidence)](docs/01-website-analysis.md)
2. [Feature inventory & payload formats](docs/02-complete-feature-inventory.md)
3. [UI/UX analysis & design system](docs/03-ui-ux-analysis.md)
4. [QR generation architecture (plan)](docs/04-qr-generation-architecture.md)
5. [Technology stack](docs/05-technology-stack.md)
6. [Development roadmap](docs/06-development-roadmap.md)
7. [Testing checklist](docs/07-testing-checklist.md)
8. [Architecture as built](docs/08-architecture.md)
9. [Feature completion report M0–M8](docs/09-feature-completion-report.md)
10. [Known limitations](docs/10-known-limitations.md)
- [Progress checklist](docs/PROGRESS.md)

## Research
- `research/rea-scenarios/` — REA `capture-browser-scenario` inputs used for the investigation.
- `research/reference-screenshots/` — screenshots of the reference site. Third-party branded material:
  internal reference only, git-ignored, never shipped.

## Legal
Original code, design and icons. No code, assets, branding or APIs from the reference site are used.
QR Code is a registered trademark of DENSO WAVE INCORPORATED.
