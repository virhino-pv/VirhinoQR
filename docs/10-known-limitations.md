# 10 — Known limitations (M0–M9)

## Verification gaps
- **EPS is not render-verified.** Ghostscript is not installed here, so EPS files are checked structurally
  (DSC header, bounding box, balanced graphics state, embedded image data round-trip) and share their
  geometry code with the PDF writer, which *is* render-verified. Before relying on EPS in production, run
  `gs -dEPSCrop -sDEVICE=png16m -r300 -o out.png file.eps` and scan the result, or open it in Illustrator.
  The masked-logo path (`ImageType 3`, used only when the logo is not on a cleared area) is the least exercised.
- **Scan check ≠ every phone.** The ZXing check is a strong signal, not a guarantee for every camera,
  print process or lighting. Real-device scanning (iOS Camera, Google Lens, an Android stock scanner) is a
  manual step not yet performed.
- E2E runs in Chrome only (desktop + emulated mobile widths); Firefox/Safari were not tested.

## Format limitations
- **EPS has no soft transparency**: logo alpha is flattened onto the background on a cleared area, or
  reduced to a hard 1-bit mask otherwise. Logo opacity < 100 % is flattened likewise.
- PDF/EPS colours are RGB (no CMYK/spot colours).
- PNG maximum 4096 px; very large sizes take a moment to encode.
- Logos are embedded as raster images in every format (≤ 1024 px; ≤ 768 px in PDF, ≤ 512 px in EPS),
  including SVG uploads (sanitised and rasterised by design, for safety).

## Content types
- The 8 hosted-content types do **not** upload or host anything; they encode a link the user already
  has. Uploading, landing pages, multi-link pages, device-aware app redirects, hosted rating/feedback
  forms and scan statistics need the dynamic tier (M10–M11).
- Location has no map picker or address search (coordinates or "Use my current location").
- No ECI header is written; UTF-8 relies on scanners auto-detecting it (ZXing does; most phones do).
- Events: no recurrence, alarms or attendees; times are converted to UTC.
- Crypto: BTC, ETH, LTC, BCH, DASH only; BCH CashAddr and segwit checksums verified, Ethereum EIP-55.

## Design / UX
- Shape set is smaller than planned (10 body, 7 frame, 7 ball); only decode-verified shapes ship.
- No frames/captions ("Scan me") and no history of generated codes.
- **Templates are stored per browser** (IndexedDB). Clearing site data deletes them; use Export to back
  up. Sync across devices needs accounts (M9).
- Templates store the *design* (and optionally the logo), never the content — applying one keeps what you typed.
- Imported template logos must be embedded PNG data (no URLs) and ≤ 3 MB each; files ≤ 10 MB, ≤ 200 templates.
- Logo budgets are conservative estimates; the live scan check is the final word.
- Rendering runs on the main thread (memoised); version-40 codes with complex shapes may feel slower on low-end devices.
- No dark mode, no localisation (English only).

## Bulk (M8)
- Browser limits: 1,000 rows, 5 MB and 100 columns per file. Larger jobs need server-side bulk (M12).
- Generation runs on the main thread, yielding after each code. A 500-row run with scan checks takes about
  a minute at 256 px, longer at large sizes. A Web Worker can't be used with the current SVG→canvas
  path because workers cannot decode SVG images.
- All files are held in memory until the ZIP is built (fine for 1,000 PNGs at typical sizes).
- Bulk exports PNG and SVG only; per-code PDF/EPS remain available in the studio.
- Excel cells formatted as numbers lose leading zeros and “+” (e.g. phone numbers) — format such columns as text.
- The first non-empty sheet is chosen automatically; others via the sheet picker. Formulas are read as their cached values.
- `.xls` (Excel 97–2003) and `.ods` are not supported.
- One design applies to every row; per-row designs are not supported.

## Accounts (M9)
- **Not live-verified:** no Supabase credentials were available. RLS was verified on PostgreSQL (PGlite) with a
  Supabase-compatible shim, and auth/data flows end-to-end against a local emulator of the Supabase APIs.
  Differences between the emulator and real GoTrue/PostgREST/Storage are possible — run the go-live checklist (doc 11 §11).
- Email + password only (no OAuth, magic links or MFA yet). Changing the account email is not exposed in the UI.
- Account deletion is not self-service yet (deleting the auth user in Supabase cascades all rows; logo files must be removed from storage separately).
- History stores type, label, format and a design snapshot — not the content — so “Reuse design” reopens the look but the form must be filled again.
- Logos in saved projects/templates are stored as processed PNGs (not the original upload).
- The proxy treats an unreachable Auth server as “signed out” (dashboard redirects to login).
- Under parallel E2E load the first server actions on a cold `next start` can take several seconds; tests allow for this.
- Branding: dashboard and auth screens use the VirhinoQR violet/blue accents; the public site still shows the “QR Studio” name — a full rename was not done to avoid redesigning the public pages.

## Out of scope (not started, by instruction)
M10 dynamic QR · M10 dynamic QR · M11 analytics · M12 API.
