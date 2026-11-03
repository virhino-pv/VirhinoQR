# 06 — Development Roadmap & Checklist

Order follows the brief (Phase 7). Each milestone ends with: tests green, a demo, and a commit/PR
(`feat(scope): …`). Complexity: **S** ≤ 2 dev-days, **M** 3–5, **L** 6–10, **XL** > 10 (one experienced full-stack dev).

## Milestone 0 — Foundations (M)
- [ ] pnpm monorepo: `apps/web`, `packages/{payloads,engine,export,verify}`
- [ ] Next.js + TS strict + Tailwind v4 tokens (doc 03 B2–B4) + Radix
- [ ] ESLint/Prettier, Vitest, Playwright, GitHub Actions CI
- [ ] Base layout, header/footer, dark mode, i18n scaffolding (en)

## Milestone 1 — Homepage & navigation (S)
- [ ] Hero, TypeTabs (scrollable, keyboard), More popover (dynamic types marked)
- [ ] Generator card shell: accordion panes + sticky preview column; mobile bottom action bar
- [ ] How-it-works, FAQ (original copy), footer with DENSO WAVE notice

## Milestone 2 — Content type selection (S)
- [ ] Type registry (id, label, icon, schema, encoder, form component)
- [ ] Deep links `?type=` / `#type`; per-type draft persistence

## Milestone 3 — Content forms & validation (L)
- [ ] 14 static forms (URL, Text, Email, Phone, SMS, vCard 2.1/3/4, MeCard, Location (Leaflet + geocoder), Facebook, X, YouTube, WiFi, Event, Crypto)
- [ ] Zod schemas, inline + summary errors, char/byte counters
- [ ] Payload encoders with escaping + golden vectors; PayloadInspector

## Milestone 4 — QR generation engine (XL)
- [ ] Matrix wrapper + module classification + EC/auto + capacity guard
- [ ] Scene graph; merged paths; quiet zone
- [ ] Body shapes (12), eye frames (8), eye balls (8), per-eye transforms
- [ ] Solid/linear/radial paints; transparent background
- [ ] Logo layout, clear-behind, safety budget, auto-EC
- [ ] Web Worker pipeline + memoisation; perf budget tests
- [ ] Verifier: heuristics + zxing-wasm decode

## Milestone 5 — Customisation panel (L)
- [ ] ColorField (picker, hex, alpha, eyedropper), GradientEditor, eye colour overrides, swap/copy
- [ ] ShapePicker tiles rendered by engine
- [ ] LogoDropzone: upload, gallery (original icons), size, position, padding, cut-out, background removal
- [ ] Frame/caption (optional)

## Milestone 6 — Live preview (M)
- [ ] Debounced live render, ScanBadge, contrast warnings, version/EC readout
- [ ] Mobile sticky mini-preview + bottom sheet

## Milestone 7 — Export & downloads (L)
- [ ] SVG, PNG (size/DPI/transparent), PDF (vector), EPS (PS L3), clipboard
- [ ] Confirm-on-failed-scan dialog; filenames
- [ ] CI: Ghostscript renders PDF/EPS → decode test

## Milestone 8 — Templates (M)
- [ ] 12+ original presets with engine-rendered thumbnails
- [ ] Save/rename/delete my templates (IndexedDB); import/export JSON
- [ ] Local history of generated codes (IndexedDB), re-open into editor

## Milestone 9 — Bulk generation (L)
- [ ] CSV/XLSX upload, column mapping, validation report
- [ ] Worker-pool rendering, streamed ZIP + manifest; progress + cancel

## Milestone 10 — Authentication & dashboard (L)
- [ ] Supabase project, Drizzle schema + migrations + RLS (doc 04 §8.1)
- [ ] Sign-in (magic link + OAuth), profile
- [ ] Dashboard: list/grid, search, filters, folders (campaigns), move, archive
- [ ] Cloud sync of templates/history; import local data on first sign-in

## Milestone 11 — Dynamic QR management (XL)
- [ ] Slug generation, `/r/[slug]` edge redirect, pause/resume, destination history
- [ ] Editable destinations UI
- [ ] Hosted types: PDF, MP3, Video (embed/upload), Image Gallery, Social links page, App Store redirect, Rating, Feedback, generic file — storage, limits, virus scan, landing page templates
- [ ] Abuse protection (URL checks, reporting, rate limits)

## Milestone 12 — Analytics & API (L)
- [ ] Scan logging (privacy-preserving), aggregates (daily, country, device, OS, browser), unique vs total
- [ ] Analytics charts + CSV export
- [ ] API keys UI, `/api/v1` endpoints, OpenAPI docs page, rate limiting
- [ ] Server bulk jobs

## Complexity summary

| Area | Size | Est. effort |
|---|---|---|
| M0–M3 (foundation, nav, forms) | L | 2.5–3.5 weeks |
| M4 engine | XL | 2–3 weeks |
| M5–M7 (customisation, preview, export) | L | 3–4 weeks |
| M8–M9 (templates, bulk) | M–L | 1.5–2 weeks |
| **Static product complete (M0–M9)** | | **≈ 9–12 weeks** |
| M10 auth/dashboard | L | 1.5–2 weeks |
| M11 dynamic + hosted types | XL | 3–4 weeks |
| M12 analytics + API | L | 2 weeks |
| **Full scope** | | **≈ 16–20 weeks (1 dev)**, ≈ 9–11 weeks with 2 devs |

Highest-risk items: shape/eye geometry quality vs scannability (M4), EPS writer (M7), hosted-file abuse & moderation (M11).

## Working rules (from the brief)
1. No feature marked done without its tests in doc 07 passing.
2. No placeholder buttons — a control ships only when functional; unfinished items are hidden behind a feature flag.
3. Commit per logical step; never overwrite existing files without inspection; destructive operations require approval.
