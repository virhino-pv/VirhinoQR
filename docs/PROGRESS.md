# Development progress — M0–M6

Milestone numbering follows the approved execution brief (M0 foundation … M6 export), which differs
from the order in doc 06. A box is ticked only after its check has actually run.

Legend: `[x]` done and verified · `[~]` implemented, verification pending · `[ ]` not started

## Recovery audit (2026-11-04, after "API Error: The response stopped arriving")
- [x] Git intact: only commit `cc66bcf` (docs); all new work untracked, nothing lost
- [x] All 30 source/test files complete (end with newline, no truncation), `tsc --noEmit` clean
- [x] Dependencies installed, `npm ls` reports no missing/invalid packages
- [x] Registry test: 22 types, every sample encodes, defaults are "empty" — 46/46 after one fix
      (Feedback's prefilled subject made an untouched form "invalid"; blank detection now ignores defaults)
- [x] Decode smoke test passes (resvg rasterise → ZXing decode)
- [x] Stray calibration outputs moved out of `C:\virhino-product` into the session scratchpad

## M0 — Foundation
- [x] package.json scripts, Next 16 / React 19 / TS 5.9 strict / Tailwind 4 / ESLint 9 flat config
- [x] Vitest config + decode harness (resvg + zxing-wasm, offline)
- [x] `.env.example`, security headers, wasm self-hosting script
- [ ] App shell (layout, globals.css tokens, error/not-found pages), UI components
- [ ] `npm run build` + `npm run lint` pass

## M1 — Homepage & navigation
- [ ] Header (responsive, mobile menu), hero + quick generator, type cards, customisation showcase,
      features, how it works, use cases, FAQ, footer

## M2 — Content types & forms
- [x] 22 type definitions (14 static + 8 linked-to-hosted-content), validation, payload encoders
- [x] Registry test
- [ ] Golden-vector payload tests per type
- [ ] Form renderer + studio integration, error states

## M3 — QR engine
- [x] Matrix (qrcode lib, UTF-8 byte mode), EC L/M/Q/H/auto, version, margin, scene graph
- [x] Calibration: all 10 body × 7 frame shapes decode; eye balls "dots" fixed, "sparkle" removed
- [ ] Engine tests (EC × versions, Unicode/Tamil decode, margins, errors)
- [ ] Live preview + in-browser scan check

## M4 — Customisation
- [x] Engine support: solid/linear/radial, eye colours (global + per eye), shapes, background/transparent
- [ ] Controls UI + reset; scannability matrix tests; contrast heuristics tests

## M5 — Logo
- [x] Engine: size, offset (finder-safe), clear-behind shapes, padding, opacity, budget per EC
- [ ] Browser processing: validation (type/magic bytes/size), SVG sanitising, background removal, gallery
- [ ] Tests: bg removal, invalid uploads, logo decode across EC

## M6 — Export
- [x] Writers: SVG, PDF (own, vector + shadings + SMask), EPS (own, PS L3), PNG pHYs/IHDR helpers
- [ ] Browser PNG export, download flow + validation, filenames
- [ ] Tests: SVG/PNG/PDF decode, EPS structure; E2E downloads
