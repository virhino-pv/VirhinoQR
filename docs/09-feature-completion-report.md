# 09 — Feature completion report (M0–M9)

M0–M6 verified on 2026-11-04 with: `npm run typecheck` (clean), `npm run lint` (clean), `npm run build`
(success), `npm test` — **198/198 passed** (6 files), `npm run test:e2e` — **51/51 passed** in Google Chrome 156.
"Evidence" names the test that proves each item.

## M0 — Foundation ✅
| Item | Evidence |
|---|---|
| Next.js 16 / React 19 / TypeScript 5.9 strict / Tailwind 4 / ESLint 9 | build + lint + typecheck |
| Modular architecture (`lib/*` without UI imports) | doc 08 |
| Env handling (`.env.example`, validated public config, no secrets) | `src/lib/env.ts` |
| Reusable UI components, error / global-error / 404 pages | `site.spec.ts` › 404 |
| Scripts, README | README |

## M1 — Homepage & navigation ✅
Responsive header with mobile menu, original brand mark, hero with live quick generator, 22 type cards,
live style showcase, features, how it works, use cases, FAQ (with FAQPage JSON-LD), CTA, footer with trademark notice.
Evidence: `site.spec.ts` (sections, hero → studio hand-off, showcase, FAQ, every internal link resolves,
no overflow at 360/390/768/1024/1280/1440, mobile menu + Escape, axe without serious violations).

## M2 — Content types & forms ✅ (22/22)
| Type | Tier | Payload |
|---|---|---|
| URL, Text, Email, Phone, SMS, vCard (2.1/3.0/4.0), MeCard, Location, Facebook, X, YouTube, Wi-Fi, Event, Bitcoin & crypto | static | encoded directly |
| MP3, Video, PDF, Social media, App Store, Image gallery, Rating, Feedback | linked | link to user-hosted content; form states that hosting needs the dynamic tier |

Validation, empty/invalid states, field-level messages after blur, error reveal on Download, per-type drafts,
deep links. Evidence: `payloads.test.ts` (golden vectors), `registry.test.ts`, `content-types.spec.ts`
(each type filled in the real UI → exact payload → scan pass; validation; drafts; Tamil).

## M3 — QR engine ✅
Static codes, live preview, EC L/M/Q/H + Auto, version Auto/1–40, quiet zone 0–10, UTF-8 (Tamil etc.),
capacity and version errors, in-browser ZXing scan validation. Evidence: `engine.test.ts`,
`scannability.test.ts` (EC × versions, Unicode), `content-types.spec.ts` (version too small).

## M4 — Customisation ✅
Foreground solid/linear (angle)/radial, separate eye colours (global and per eye), background colour or
transparent, 10 body / 7 frame / 7 ball shapes (engine-drawn tiles, keyboard navigable), EC, margins,
reset. Contrast/inversion/eye-contrast/margin warnings; failing designs need confirmation before download.
Evidence: `scannability.test.ts` (every shape × 4 payloads, gradients, eyes, margins), `studio-design.spec.ts`.

## M5 — Logo ✅
PNG/JPG/JPEG/WebP/SVG upload (drag-and-drop or picker), 5 MB limit, content sniffing, sanitised SVG,
preview thumbnail, size 5–30 %, X/Y position (finder-safe clamp), opacity, clear-behind with
square/rounded/circle cut-out and padding, background removal with tolerance, original 12-icon gallery,
replace, remove, auto EC → H, budget meter with one-click fixes. Evidence: `logo.test.ts`,
`scannability.test.ts` (logos within budget at every EC), `studio-design.spec.ts` (upload, gallery,
invalid files, malicious SVG).

## M6 — Download & export ✅
| Format | Implementation | Verified by |
|---|---|---|
| PNG | canvas, 128–4096 px, DPI (pHYs), transparent alpha | dimensions from IHDR; decode of the exact pixels in the browser and again in Node |
| SVG | vector, full design, embedded logo, `<title>` | XML parse; resvg render → decode |
| PDF | own writer, vector shapes, gradient shadings, logo with soft mask, size in mm | pdf.js render → decode (4 designs) |
| EPS | own PostScript L3 writer, gradients via `shfill`, logo image | structure, bounding box, balanced gsave/grestore, embedded data round-trip — **not rendered** (see doc 10) |

Filenames `qr-<type>-<hint>-<size>-<yyyymmdd-hhmm>.<ext>`; errors surfaced; Download disabled paths
explain what is missing.

## M7 — Templates ✅ (verified 2026-11-04: unit 221/221, E2E 59/59)
| Item | Evidence |
|---|---|
| 14 built-in templates (Classic, Brand, Playful, Print) — original designs, schema-valid | `templates.test.ts` |
| Each built-in scans with a short URL and a full vCard | `templates.test.ts` (ZXing decode) |
| Apply from the studio (thumbnails render the user's current content), category filter, active state, reset | `templates.spec.ts` › every built-in applies and scans |
| Save current design as template (name validation, optional logo), rename, delete with confirmation | `templates.spec.ts` › save/persist/apply/rename/delete |
| Persistence in IndexedDB across reloads | same test (reload) |
| Export JSON / import into another browser profile, logo restored, scans | `templates.spec.ts` › export → fresh context import |
| Invalid imports rejected or partially skipped with reasons | `templates.test.ts`, `templates.spec.ts` |
| `/templates` page and `?template=` deep link; homepage “Use this template” | `templates.spec.ts`, `site.spec.ts` (overflow + axe) |

## M8 — Bulk QR generation ✅ (verified 2026-11-04: unit 242/242, E2E 68/68)
| Requirement | Implementation | Evidence |
|---|---|---|
| 1. CSV upload & parsing | PapaParse, delimiter detection, BOM, quoted commas/newlines, duplicate headers | `bulk.test.ts` › parsing |
| 2. Excel XLSX upload | read-excel-file; dates as ISO wall time, numbers, booleans; sheet picker | `bulk.test.ts` (real .xlsx via write-excel-file), `bulk.spec.ts` › XLSX |
| 3. Column mapping | auto by name/label/synonyms; manual column; constant value; file-name column | `bulk.test.ts` › auto-maps, `bulk.spec.ts` › manual mapping |
| 4. Multiple content types | type column (ids, labels, aliases); all 22 types | `bulk.test.ts` › mixed sample covers all 22 |
| 5. Row-level validation | studio encoders + option/required/unknown-type checks | `bulk.test.ts`, `bulk.spec.ts` |
| 6. Preview before generation | filterable, paged table with live thumbnails + row-problems CSV | `bulk.spec.ts` › XLSX |
| 7. Bulk generation | engine per row on the main thread, yielding after each code | 10/100/500 tests |
| 8–10. Design, templates, logo | shared studio design/logo; Templates/Colours/Shapes/Logo/EC panes on /bulk | `bulk.spec.ts` › XLSX (template “Ocean” + logo, EC H) |
| 11. Individual PNG/SVG downloads | per-row buttons in the results table | `bulk.spec.ts` › XLSX |
| 12. ZIP of all codes | fflate; png/ (stored), svg/, report.csv, errors.csv | unit + E2E unzip |
| 13. Progress & cancellation | progress bar; Cancel keeps finished items | `bulk.test.ts` › cancellation, `bulk.spec.ts` › cancel at 500 |
| 14. Error report | errors.csv (invalid, empty, failed and scan-failed rows) | unit + E2E |
| 15. CSV generation report | one line per input row: status, files, version, EC, scan check, payload, errors | unit + E2E |
| Scale 10 / 100 / 500 | Node: every code decoded. Chrome: 500 rows generated and scan-checked in about 70 s at 256 px, then every PNG re-decoded in Node | `bulk.test.ts`, `bulk.spec.ts` |

## M9 — Authentication & user dashboard (verified 2026-11-04: unit 309/309, E2E 82/82)

### Fully implemented and tested (locally: PGlite + Supabase emulator)
| Feature | Evidence |
|---|---|
| Registration with validation, duplicate email, verification required, resend | `auth.test.ts`, `accounts-auth.spec.ts` |
| Login (invalid credentials, unverified), remembered SSR session, `?next` with open-redirect protection, logout | `auth.test.ts`, `accounts-auth.spec.ts` |
| Password reset (request, generic answer, link, new password, old rejected, link single-use, invalid link page) | `accounts-auth.spec.ts` |
| Protected routes for anonymous users; public QR features unchanged | `accounts-auth.spec.ts`, `no-accounts.spec.ts`, full M0–M8 suite |
| Profiles (trigger-created, own updates only, email/id immutable, https avatar) | `rls.test.ts`, `accounts-data.spec.ts` |
| Saved projects incl. private logo, update with conflict detection, duplicate, search/filter, delete | `rls.test.ts`, `accounts-data.spec.ts` |
| History (no content/secrets stored, filters, reopen, delete, clear, bulk entry) | `auth.test.ts`, `accounts-data.spec.ts` |
| Template sync (upload local, cross-device, stale rename rejected, delete everywhere, local kept) | `rls.test.ts`, `accounts-data.spec.ts` |
| User A/B isolation: tables + storage, UI and direct API with B's own valid token, anon denied | `rls.test.ts` (21 SQL tests), `accounts-data.spec.ts` › user isolation |
| Secrets: canary service-role key and DB URL absent from client bundles; app never reads/logs them | `accounts-security.spec.ts`, `secrets.test.ts` |

### Implemented but not live-tested
Everything above against the real Supabase project `gcexwwtvnevrtoltfhoa` (no credentials were provided); real email delivery; Supabase rate limits.

### Requires manual configuration
Env vars, migration push, auth settings (confirm email, redirect URLs, templates, SMTP) — doc 11 §3–§5.
