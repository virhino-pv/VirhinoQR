# 07 — Testing Checklist

Every item is automated unless marked (manual). A feature is "complete" only when its rows pass.

## 1. Payload correctness (Vitest, `packages/payloads`)
For **each type**: golden vectors (≥ 5 incl. empty optional fields, unicode, reserved characters) → exact string; decoder round-trip; schema rejects invalid input with the right message.

| Type | Must-cover cases |
|---|---|
| URL | missing scheme → https added; IDN host; query/fragment kept; `javascript:` rejected |
| Text | 400+ chars with capacity counter; emoji (UTF-8) |
| Email | subject/body with `& ? = # space` → percent-encoded; only-body; only-subject |
| Phone / SMS | `+`, spaces, brackets stripped; SMSTO format; empty message |
| vCard 2.1 / 3.0 / 4.0 | escaping of `, ; \ newline`; ADR order; FN present; CRLF |
| MeCard | URL emitted (reference bug fixed); birthday YYYYMMDD; notes `;` escaped |
| Location | geo: vs maps URL; bounds ±90/±180; 6-decimal rounding |
| Facebook | page vs share (encoded `u=`) |
| X/Twitter | profile URL / @handle / intent with encoded text, 280 limit |
| YouTube | full URL, youtu.be, bare ID |
| WiFi | `\ ; , : "` escaped in SSID & password; nopass omits P; hidden flag; SAE |
| Event | VCALENDAR wrapper; UTC `Z`; TZID; end < start rejected; all-day |
| Crypto | BTC/BCH/LTC/DASH BIP-21 amount; ETH EIP-681 wei conversion; invalid address rejected |

## 2. Scannability matrix (Vitest + zxing-wasm, CI)
Render → rasterise → decode → **byte-identical** to payload, for:
- [ ] every body shape × every eye frame × every eye ball (default colours, EC M)
- [ ] EC L/M/Q/H × versions 1, 5, 10, 25, 40
- [ ] logo at 10/20/max % × EC auto, clear-behind on/off
- [ ] gradients linear/radial, light-to-dark ranges
- [ ] transparent background composited on white and on light grey
- [ ] every built-in template
- [ ] negative tests: low-contrast and inverted designs are **flagged** by heuristics
- [ ] (manual, per release) scan printed + on-screen codes with iOS Camera, Google Lens, one Android stock scanner

## 3. Colours & contrast
- [ ] Contrast ratio calculation matches WCAG reference values
- [ ] Warning appears below 3:1 and for light-on-dark; disappears when fixed
- [ ] Per-eye colour overrides render in SVG/PNG/PDF/EPS identically (pixel diff ≤ 1 %)

## 4. Logos
- [ ] Upload png/jpg/webp/svg; reject other types and > 5 MB with message
- [ ] Malicious SVG (script, external href, foreignObject) sanitised
- [ ] Size/position controls change scene; offset blocked over finders
- [ ] Background removal: white-bg logo → transparent corners; tolerance slider works
- [ ] Logo budget enforced; auto-EC raises to H; decode passes

## 5. Export
- [ ] SVG: valid XML, `viewBox` correct, opens in browser/Inkscape (CI: resvg render) and decodes
- [ ] PNG: exact pixel size for 200, 1000, 4000; transparent alpha when chosen; DPI chunk present
- [ ] PDF: Ghostscript renders → decodes; gradients present (vector, not raster — check for shading objects)
- [ ] EPS: Ghostscript `-dEPSCrop` renders → decodes; BoundingBox correct; L2-compat flattening warning
- [ ] Clipboard copy (Playwright, Chromium permission granted)
- [ ] Downloads start immediately; filenames follow pattern

## 6. Bulk
- [ ] CSV & XLSX with 1, 100, 1,000 rows; column mapping; invalid rows reported, valid rows still generated
- [ ] ZIP contains N files × formats + manifest; every file decodes (sampled 10 % + first/last)
- [ ] Cancel mid-run stops workers; memory stays bounded

## 7. Validation & UX
- [ ] Every required field: empty → message on submit/blur; fixed → message clears
- [ ] Error summary links focus the field
- [ ] Switching types keeps drafts; deep link opens correct type

## 8. Responsive & accessibility
- [ ] Playwright visual snapshots at 360, 390, 768, 1024, 1280, 1440 px (light + dark)
- [ ] Mobile: preview reachable without scrolling the form (sticky bar); bottom sheet download works
- [ ] axe-core: 0 serious/critical violations on all pages
- [ ] Full keyboard path: choose type → fill → customise → download
- [ ] Screen-reader labels for shape tiles, colour fields, ScanBadge live region
- [ ] `prefers-reduced-motion` honoured

## 9. "No dead buttons / no placeholders" audit
- [ ] Playwright crawler clicks every enabled button/link on each page; each must change state, navigate, or download — none may no-op or 404
- [ ] Grep CI check: no `TODO`/`lorem`/`placeholder.png`/`coming soon` in shipped UI strings
- [ ] Feature flags: disabled features are hidden, not shown as inert controls

## 10. Dynamic tier (when built)
- [ ] RLS: user A cannot read/update user B's QR, scans, files (SQL tests)
- [ ] Redirect: 302 to current destination; edit destination → next scan goes to new URL; paused shows notice
- [ ] Scan recorded with country/device; unique counting via daily-salted hash; no IP stored
- [ ] Hosted pages: upload limits, virus-scan gate, landing pages render on mobile
- [ ] Rating/feedback: submit, spam limits, owner sees responses
- [ ] API: key auth, scopes, rate limit (429), OpenAPI contract tests
- [ ] Load: redirect p95 < 100 ms at 200 rps (k6)

## 11. Performance
- [ ] Live render < 16 ms (v ≤ 10) / < 60 ms (v40) in worker on mid-range laptop
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility 100, SEO ≥ 95 on home
- [ ] Initial JS ≤ 200 KB gz for generator route (engine & zxing lazy-loaded)
