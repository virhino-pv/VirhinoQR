# 03 — UI/UX Analysis & Original Design System

Part A records what REA observed on the reference (measurements from 1440 px screenshots and the captured
stylesheet `website.dist.css`). Part B defines **our original design system** — it reproduces the *experience*
(an editor with an always-visible preview) without reusing the reference's branding, colours, illustrations,
icons, mascot, copy, or shape artwork.

---

## Part A — Reference observations

### A1. Layout [O]
| Element | Measurement / behaviour |
|---|---|
| Page | Full-bleed brand-colour band (≈ `#247F4F` green) behind header, tabs and generator card; light grey (`#E8EEF2`-ish) marketing sections below |
| Container | Bootstrap container; generator card ≈ 1132 px wide at 1440 px viewport (x 154 → 1286), white, subtle shadow, radius ≈ 4 px |
| Header | ≈ 120 px tall: logo left, 4 uppercase nav links right (bold, white, ~14 px) |
| Tab bar | 56 px tall items, uppercase, `.9rem`, white at ~70 % opacity, active = bold 100 % + 4 px underline bar |
| Card split | Left editor ≈ 756 px (light grey `#E8EEF2` fill, 32 px padding); right output ≈ 376 px (white) |
| Accordion pane header | 48 px tall, white, left 48 px icon block (active = sky-blue `#03A9F4` fill, white icon), uppercase 1.1 rem title, `+`/`−` at right |
| Pane content | animated max-height/opacity transition (0.5 s) |
| Inputs | Bootstrap `.form-control`: ≈ 38 px high, no visible border on grey bg, white fill, 16 px text, label above in bold ~13 px grey |
| Shape tiles | 60 × 60 px, white, radius 4 px, 3 px transparent border → `#03A9F4` when active, 8 px gaps, 10 per row |
| Colour input | 38 px swatch square + hex text field, ≈ 210 px wide |
| Primary buttons | ≈ 42 px high, radius 2–4 px: *Create* green (`#8BC34A`), *Download PNG* sky blue (`#03A9F4`), format buttons outline sky blue |
| Slider | thin track, 32 px circular blue thumb with white dot; caption "1000 x 1000 Px" |
| Preview | square, fills right column width (≈ 300 px), above slider |
| Modals | centred 684 px white dialog, large illustration top, CTA pill button; dark scrim |
| Templates overlay | full-viewport dark scrim, "PICK A TEMPLATE" title, 6-column grid of 153 × 185 px white cards (QR + label) |

### A2. Typography [O]
Open Sans 400/700 for UI; system stack for Bootstrap defaults. Sizes: body 16 px, labels ~13 px bold, pane titles ~17.6 px uppercase, tab labels ~14.4 px uppercase, h2 marketing ~28–32 px.

### A3. Interaction patterns [O][S]
- Accordion: exactly one pane open; opening a pane collapses the others.
- Validation messages appear only after the first submit attempt.
- Create button is disabled (pale) after generation until something changes.
- Download buttons disabled until a code has been created.
- Colour pickers: swatch click opens picker; hex text editable.
- Shape pickers: single-select tiles with blue outline.
- Tabs: anchor-based (`#type`), state shared across tabs.

### A4. Responsive [O]
Bootstrap breakpoints 576/768/992/1200. At 390 px: hamburger header, horizontally scrolling tabs (partial last item visible as affordance), single column, 3-col grids collapse to 1, preview below the form.

### A5. UX issues to avoid
Upsell modals disguised as features; ad-gated 9.5 s downloads; preview not live; preview off-screen on mobile; cookie banner covering 40 % of mobile viewport; no transparency; low affordance of "Create" vs "Download" order.

---

## Part B — Our design system ("QR Studio" working name — final brand TBD)

### B1. Principles
1. **Preview always visible** — sticky right column on desktop; sticky mini-preview + bottom sheet on mobile.
2. **Live, not gated** — every change re-renders in < 100 ms; downloads are immediate.
3. **Honest UI** — no fake features; dynamic features clearly marked "requires free account".
4. **Accessible** — WCAG 2.2 AA, full keyboard support, visible focus, labelled controls, reduced motion.

### B2. Colour tokens (original palette — deliberately not green/sky-blue)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand-900` | `#1E1B4B` | — | hero band, header |
| `--brand-600` | `#4F46E5` | `#818CF8` | primary actions, active states |
| `--brand-100` | `#E0E7FF` | `#312E81` | selected tile bg, focus ring tint |
| `--accent-500` | `#F59E0B` | `#FBBF24` | highlights, "new" badges |
| `--success-600` | `#059669` | `#34D399` | scan-check passed |
| `--warning-600` | `#D97706` | `#FBBF24` | contrast warnings |
| `--danger-600` | `#DC2626` | `#F87171` | errors |
| `--surface-0` | `#FFFFFF` | `#0B1020` | cards |
| `--surface-1` | `#F5F7FB` | `#111827` | editor background |
| `--surface-2` | `#EEF1F7` | `#1F2937` | inputs on surface-1 |
| `--border` | `#D8DEE9` | `#374151` | dividers |
| `--text-1` | `#0F172A` | `#F8FAFC` | primary text |
| `--text-2` | `#475569` | `#CBD5E1` | labels, help |

All text/background pairs verified ≥ 4.5:1 (body) / 3:1 (large, UI components) before implementation.

### B3. Typography
- **Inter** (variable, self-hosted via `next/font`) for UI; **JetBrains Mono** for payload preview / API docs.
- Scale (rem): 0.75 caption · 0.875 label · 1 body · 1.125 pane title · 1.25 h4 · 1.5 h3 · 2 h2 · 2.75 hero.
- Labels sentence case (not uppercase) for readability; tabs title case.

### B4. Spacing, radius, elevation
- 4 px base grid: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 6 (inputs, tiles), 10 (cards, buttons), 16 (modals), full (pills, slider thumb).
- Elevation: `e1` 0 1px 2px rgb(15 23 42 / .06); `e2` 0 4px 12px rgb(15 23 42 / .08); `e3` 0 12px 32px rgb(15 23 42 / .16).

### B5. Layout
- Max content width 1200 px; generator card `grid-template-columns: minmax(0,1fr) 400px`, gap 0, preview column `position: sticky; top: 24px`.
- Breakpoints (Tailwind): `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Below `lg`: single column; preview becomes a sticky 96 px thumbnail in a bottom action bar that expands into a full bottom sheet (Preview + Download).

### B6. Components (all original, built with Radix UI primitives + Tailwind)
| Component | Spec |
|---|---|
| **TypeTabs** | Horizontally scrollable `role="tablist"`, icon + label, 48 px tall, active = brand-600 text + 3 px bottom indicator; overflow fades on edges; "More" opens a popover grouping Dynamic types with a "Account" badge |
| **Accordion pane** | 56 px header (icon tile 40 px, title, chevron rotating 180°), multiple panes may be open on desktop (user preference), single on mobile |
| **TextField / TextArea** | 44 px min height, 1 px border `--border`, radius 6, focus ring 3 px brand-100 + border brand-600, label above, help/error below, char counter right |
| **Select / Combobox** | Radix Select; typeahead for country/currency |
| **SegmentedControl** | for Single/Gradient, Linear/Radial, URL/Share modes |
| **ColorField** | 44 px swatch + hex input + popover picker (HSV square, hue slider, alpha slider, eyedropper where supported, recent colours, 8 preset swatches) |
| **GradientEditor** | live gradient bar with draggable stops, angle dial, type toggle, swap |
| **ShapePicker** | grid of 64 px tiles rendering the actual shape via our engine (no bitmap sprites), `role="radiogroup"`, arrow-key navigation |
| **LogoDropzone** | drag-and-drop + click, shows thumbnail, size slider, position (centre / 9-point), padding, cut-out shape, "remove logo background" toggle with tolerance slider |
| **Slider** | Radix Slider with numeric input pair (px / DPI) |
| **Button** | sizes 36/44/52; variants primary (brand-600), secondary (surface-2), outline, ghost, danger; loading state with spinner |
| **SplitDownloadButton** | primary "Download PNG" + menu (SVG, PDF, EPS, Copy image) |
| **Modal / Sheet** | Radix Dialog; sheet on mobile |
| **Toast** | success/error notices (e.g. "Scan check failed — increase contrast") |
| **ScanBadge** | `Scannable ✓` / `Check failed ✕` / `Checking…` beside preview with details popover |
| **PayloadInspector** | collapsible mono block showing the exact encoded string, byte count, QR version, EC level |
| **TemplateGallery** | responsive grid of cards, filter chips, "Save current as template" |

### B7. Iconography & imagery
Lucide icons (ISC licence) for UI; brand icons for the logo gallery from Simple Icons (CC0) where trademark use is permitted, otherwise generic glyphs. Our own illustrations; no mascot copies.

### B8. Motion
150–250 ms ease-out for UI; preview cross-fade 120 ms; `prefers-reduced-motion` disables transitions.

### B9. Key screens
1. **Generator (home)** — hero strip (H1 + short value prop) → TypeTabs → card (Content / Colours / Logo / Design / Frame panes | sticky Preview, ScanBadge, size, Download split button, Payload inspector) → templates strip → how-it-works → FAQ → footer.
2. **Templates** — gallery page.
3. **Bulk** — upload CSV → map columns → choose design → preview grid → generate ZIP.
4. **Dashboard** (auth) — QR list (table/cards), folders sidebar, search/filter, analytics summary.
5. **QR detail** — destination editor, design, analytics charts, scan log, download.
6. **API keys & docs**.
7. **Hosted landing pages** for dynamic types (MP3, PDF, gallery, links, app, rating, feedback).
