# Development progress — M0–M7

Milestone numbering follows the approved execution brief (M0 foundation … M6 export), which differs
from the order in doc 06. A box is ticked only after its check actually ran.

**M6 verification (2026-11-04):** typecheck ✔ · lint ✔ · build ✔ · unit 198/198 ✔ · E2E 51/51 ✔ (Chrome 156)

**M7 verification (2026-11-04):** typecheck ✔ · lint ✔ · build ✔ · unit 221/221 ✔ (3 consecutive runs) · E2E 59/59 ✔

Note: one unit run reported 6 files / 205 tests (the jsdom-based `logo.test.ts` not collected, no error shown). Not reproducible in 4 subsequent runs; watch for it in CI.

## Recovery audit (after "API Error: The response stopped arriving")
- [x] Git intact (only `cc66bcf`); all new work untracked and complete — nothing lost or reset
- [x] 30 source/test files complete, `tsc` clean, dependencies intact
- [x] Defect found & fixed: an untouched Feedback form was "invalid" (prefilled default counted as input)
- [x] Resumed at the exact stop point: golden-vector payload tests

## M0 — Foundation
- [x] Next 16 / React 19 / TS 5.9 strict / Tailwind 4 / ESLint 9; scripts; `.env.example`; security headers
- [x] App shell, error / global-error / 404, reusable UI components
- [x] Build + lint + typecheck pass — commit `20312b2`

## M1 — Homepage & navigation
- [x] Header + mobile menu, hero quick generator, type cards, live style showcase, features, how it works, use cases, FAQ, footer
- [x] E2E: sections, links resolve, 6 viewports, mobile menu, axe

## M2 — Content types & forms
- [x] 22 types (14 static, 8 linked-to-hosted with honest notices), validation, encoders
- [x] Golden-vector tests (30) + registry tests (46)
- [x] Form renderer, error states, drafts, deep links; E2E for all 22 types in the UI

## M3 — QR engine
- [x] Matrix, EC L/M/Q/H/auto, version, margin, scene graph, UTF-8/Tamil
- [x] Decode matrix tests; live preview + in-browser ZXing scan badge

## M4 — Customisation
- [x] Solid/linear/radial, eye colours (global + per eye), background/transparent, 10/7/7 shapes, EC, margin, reset
- [x] Shape robustness: "dots" ball redesigned, diamond/leaf/circle tuned, "sparkle" removed (failed decode)
- [x] Unit decode tests + E2E

## M5 — Logo
- [x] Upload PNG/JPG/WebP/SVG, magic-byte validation, 5 MB limit, SVG sanitising, background removal, gallery, size/position/opacity/cut-out, replace/remove, budget + auto EC
- [x] Unit tests (16) + E2E (upload, gallery, invalid, malicious SVG)

## M6 — Export
- [x] PNG (DPI, transparent, exact size), SVG, PDF (own writer), EPS (own PS L3 writer), filenames, validation, risky-design confirmation
- [x] PDF render-verified with pdf.js; PNG/SVG decoded in Node after download
- [ ] EPS render verification — Ghostscript not installed (documented in doc 10)

## Documentation
- [x] README, doc 08 architecture as built, doc 09 completion report, doc 10 known limitations

## M7 — Templates (approved 2026-11-04)
- [x] 14 original built-in templates in 4 categories; homepage showcase now derives from them (single source)
- [x] Every built-in decode-tested with a short URL and a dense vCard
- [x] Studio Templates pane: engine-rendered thumbnails of the current content, category filter, apply (keeps the user's logo)
- [x] My templates: save current design (optionally with logo), rename, delete with confirmation — IndexedDB, survives reload
- [x] Export to JSON / import with per-entry validation (same design schema, PNG-only logos, size/count limits, fresh ids)
- [x] `/templates` gallery page + `/create?template=<id>` deep link; header/footer links
- [x] Unit tests (23) + E2E (7) + responsive/axe coverage of `/templates`
- [x] Accessibility fix: "Use template" links' accessible name now contains the visible label (WCAG 2.5.3)
- [ ] Local history of generated codes — listed under M7 in doc 06 but not requested; awaiting decision

## Not started (by instruction)
M8 bulk · M9 auth · M10 dynamic QR · M11 analytics · M12 API
