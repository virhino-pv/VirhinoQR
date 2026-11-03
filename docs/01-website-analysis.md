# 01 — Website Analysis (reference: qrcode-monkey.com)

> Investigation date: 2026-11-03/04. Tooling: **REA 6.8.0** (`rea-agents`) — browser scenario capture
> (Playwright, Chrome 156.0.8078.79, launch mode, temporary profile), captured-script export, and static
> JavaScript application analysis. Every statement below is tagged:
>
> - **[O] Observed** — seen in a REA capture (screenshot, DOM, accessibility tree, or network event).
> - **[S] Static** — read from the captured first-party bundle `website.dist.js`
>   (sha256 `bf207ebf…6ac17b`); code was read, not executed by us beyond normal page load.
> - **[I] Inferred** — a reasonable conclusion that REA evidence does not prove directly.
> - **[U] Unknown** — not established.
>
> Purpose: document the reference *behaviour and feature set* so we can build an **original** product.
> No proprietary code, branding, images, or API is to be reused (see `05-technology-stack.md`).

---

## 1. REA evidence index

| Capture | REA Evidence ID | What it covers | Result |
|---|---|---|---|
| `01-home` | `ev_15dcfe13…0df80` | Homepage load, DOM, a11y tree, screenshot, all network + response bodies | 2/2 steps OK; events section incomplete (some third-party bodies unreadable) |
| `02-panels` | `ev_c178c1ea…6d5fa` | Cookie accept, Statistics modal, Upload-file modal, "More" modal, Set Colors / Add Logo / Customize Design panels, Templates overlay | 19/19 steps OK, complete |
| `03-generate` | `ev_7e2e3558…e13f1` | Invalid URL → validation; valid URL; gradient + custom eye colour; body/frame/ball shape pick; **Create QR Code** (request + response bodies); **Download PNG** modal | 19/19 steps OK |
| `04-mobile` | `ev_7585f606…16455` | 390×844 @2x viewport, vCard tab, preview area, create on mobile | 4/6 OK — hamburger menu click timed out |
| `05-types` | `ev_52d8ba0b…74211` | vCard, Location (map), Event, WiFi, Bitcoin, Facebook tabs | 12/12 OK, complete |
| `06-api-page` | `ev_72d642f3…3274d` | `/qr-code-api-with-logo` page text | 2/2 OK |
| bundle analysis | `ev_5243cdca…325fb` | `analyze_javascript_application` over `website.dist.js` (125,821 AST nodes, 0 parse failures) | Route inventory: 0 patterns (single AngularJS bundle, no module routes) |
| script export | `ev_d051eeff…43938` | `export_web_scripts` from `01-home` (9 scripts exported) | OK |

Scenario inputs are versioned in `research/rea-scenarios/`. Reference screenshots (third-party branded —
**internal reference only, never ship**) are in `research/reference-screenshots/` (git-ignored).

---

## 2. Technology of the reference (for context only)

| Aspect | Finding | Tag |
|---|---|---|
| Front-end framework | AngularJS 1.x (`ng-app="app"`, controllers `GeneratorCtrl`-style, `TransparentGeneratorCtrl`, `PresetService`, `TemplateService`) | [S][O] |
| CSS | Bootstrap 4 base + custom theme (`/dist/website.dist.css`, 262 KB) | [O] |
| Libraries | jQuery 1.9.1, `ng-file-upload`, angularjs-color-picker, `rzslider`, `tinycolor`, Font Awesome 4.7, icomoon icon font | [O][S] |
| QR rendering | **Server-side.** Browser POSTs config JSON to `api.qrcode-monkey.com/qr/custom`, receives `{imageUrl}`, displays a server-generated SVG | [O] |
| Fonts | Open Sans 400/700 (Google Fonts) | [O] |
| Third parties | OneTrust cookie consent, Google Tag Manager / GA4, Google Ads, Snowplow tracker, VG Wort pixel, Google Maps JS API (Places) | [O] |
| i18n | 11 locales via path prefix: en, de, es, fr, it, pt, id, ru, th, ar (+ imprint) | [O] |

Consequence for us: the reference has **no client-side QR engine and no live preview** — the "preview" only
updates after clicking *Create QR Code* (server round-trip). Our product will render client-side and live.

---

## 3. Page structure

### 3.1 Header & navigation [O]
- Logo + tagline ("The 100% Free QR Code Generator", `h1`).
- Top nav: **About** (`/#about`), **Chrome App** (Chrome Web Store link), **QR Code API** (`/qr-code-api-with-logo`), **Language** dropdown.
- Below: **content-type tab bar** — URL, Text, Email, Phone, SMS, vCard, MeCard, Location, Facebook, Twitter, YouTube, WiFi, Event, Bitcoin, **More ▾**. Each tab is an anchor `#<type>`; the hash selects the type on load (`#vcard` opens vCard) [S].
- Mobile (390 px): logo + hamburger icon; tab bar becomes a horizontally scrolling strip [O]. Hamburger menu contents **not captured** (click timed out; see §9).

### 3.2 Generator card [O]
Two-column card on desktop (≈ 1132 px wide, left ≈ 60 %, right ≈ 40 %):

**Left — accordion of four panes** (only one open at a time; `setEditView('content'|'colors'|'logo'|'shape')`):
1. **Enter Content** (icon changes per type) — type-specific form + "Statistics and Editability" toggle (upsell).
2. **Set Colors**
3. **Add Logo Image**
4. **Customize Design**
- Footer link: "**Upload MP3, PDF or any file** you wish to your QR Code." (upsell modal).

**Right — output column:**
- QR preview image (default static placeholder `/img/default-preview-qr.svg`).
- Resolution slider "Low Quality — 1000 x 1000 Px — High Quality" (200–2000 px, step 25, default 1000) [S][O].
- Buttons: **Create QR Code** (green), **Download PNG** (blue), **.SVG**, **.PDF\***, **.EPS\*** (outline). Footnote "* no support for color gradients".
- After creation: an upsell note ("The created static QR code is 100% free but if you need scan statistics, flexible editability…").

Below the card: **QR Code Templates** button (opens full-screen "Pick a template" overlay).

### 3.3 Marketing sections [O]
"Get More" (upsell: Dynamic QR Codes, Scan Statistics, Bulk Creation and Editing, Campaign Folders, More Design Options → external sign-up), "Get Started" 4-step how-to, "About" long-form SEO text, FAQ (7 Q&As), footer (API link, 11 language links, imprint, Facebook/Twitter icons, DENSO WAVE trademark notice), cookie banner (Cookie Settings / Accept All Cookies).

---

## 4. Feature-by-feature record

Format: **UI structure · Interaction · Inputs · Validation · Output · Dependencies · Implementation options (ours)**

### F1 — Content-type selection
- **UI**: tab bar (14 functional types + More). Active tab bold + underline. [O]
- **Interaction**: click tab → `setTab(type)` swaps the form inside *Enter Content*, updates URL hash. Data for each type is kept in one shared model, so switching tabs does not lose typed values [S].
- **Output**: determines payload encoder (see doc 02).
- **Ours**: route-free tab state + `?type=` / hash deep links; keep per-type drafts.

### F2 — Content forms & validation
- **UI**: labelled inputs; vCard/Event use a 3-column grid on desktop, 1 column on mobile. [O]
- **Validation** (AngularJS form validation, shown only after a submit attempt): [S][O]
  - URL/Facebook/Twitter/YouTube: `type=url` + required → "Enter a valid URL".
  - Email: `type=email` + required → "Enter a valid Email".
  - Phone, SMS phone: `type=tel` + required → "Enter a valid Phone Number" (no format check beyond required).
  - Text: required, `maxlength=400` → "This field is required".
  - Bitcoin address: required → "This field is required".
  - Lat/Lng: `type=number`, min/max ±90 / ±180.
  - Email message & SMS text: `maxlength=400`; Tweet: `maxlength=280`.
  - On submit with errors: inline field message **and** an alert in the output column: "There are errors you have to fix before generating." [O]
  - vCard, MeCard, WiFi, Event: **no required fields** [S].
- **Ours**: Zod schemas per type, inline + summary errors, live (debounced) validation, character counters.

### F3 — "Statistics and Editability" toggle
- Opens an **advert modal** (“Find out which QR Code receives more scans… FREE SIGN UP”) for a separate paid product. Not a working feature. [O]
- **Ours**: real dynamic-QR toggle (Phase 5).

### F4 — Set Colors [O][S]
- Foreground: radio **Single Color** / **Color Gradient**; checkbox **Custom Eye Color**.
- Single: one colour picker (default `#000000`).
- Gradient: colour 1 + colour 2 (defaults `#000000` → `#0277BD` once switched), swap button, **Linear Gradient / Radial Gradient** select.
- Custom eye colour: Eye frame colour + eye ball colour (applies to all three eyes), swap button, **Copy Foreground**.
- Background colour (default `#FFFFFF`). No transparency option on this page (transparent QR is a separate controller/API) [S].
- Colour pickers: swatch + hex text input (angularjs-color-picker with clear/reset/close).
- **Contrast rule in code** [S]: considered OK only if background brightness ≥ 210, eye/ball brightness < 160, body (or both gradient stops) brightness < 180 (tinycolor brightness 0–255). Whether/where the UI surfaces this was **not observed** [U].
- **Ours**: WCAG-style contrast ratio + luminance-difference check with a visible warning, plus actual decode test.

### F5 — Add Logo Image [O][S]
- Preview tile ("NO LOGO"), **Upload Image** button, ad tile ("Spotlight your logo!").
- Checkbox **Remove Background Behind Logo** → `logoMode: "clean"` (QR modules behind the logo are cleared) vs `"default"`.
- **Gallery**: 24 preset icons (brand-style social icons, app stores, mail, calendar, document, phone, share, WiFi, Bitcoin, own mascot).
- Help text: `.png`, `.jpg`, `.gif`, `.svg`, **max 2 MB**. Code rejects files > 2,145,800 bytes (`fileSizeError`) and non-`image/*` types.
- Upload goes to the server (`POST /qr/uploadimage`, multipart, progress %) which returns a file id used in config `logo`.
- **No logo size or position controls** exist [O]. Logo is always centred [I].
- **Ours**: client-side only (no upload), size slider, centre/offset positioning, padding/shape, "clear modules behind logo", optional background-colour removal of the logo image itself, our own icon gallery.

### F6 — Customize Design [O][S]
- **Body Shape**: 22 options (`square, mosaic, dot, circle, circle-zebra, circle-zebra-vertical, circular, edge-cut, edge-cut-smooth, japnese, leaf, pointed, pointed-edge-cut, pointed-in, pointed-in-smooth, pointed-smooth, round, rounded-in, rounded-in-smooth, rounded-pointed, star, diamond`).
- **Eye Frame Shape**: 15 options (`frame0–8, 10–14, 16`).
- **Eye Ball Shape**: 18 options (`ball0–3, 5–8, 10–19`).
- Asymmetric shapes are auto-mirrored per eye via flip flags (`erf1..3`, `brf1..3` ∈ {`fh`,`fv`}) so each corner faces outward [S].
- **Ours**: our own original shape set (not copies of their artwork), same concept: body / frame / ball pickers + per-eye mirroring.

### F7 — Templates [O][S]
- Overlay "Pick a template": 13 presets (Classic, Easy, Facebook, Twitter, Youtube, Monkey, Rain, Jungle, Mosaic, Dot, Coffee, Ninja, Bitcoin). Selecting copies a full `config` (shapes, colours, gradient, logo). Templates are hard-coded in the bundle (`TemplateService`). No user-saved templates.
- **Ours**: original preset library + save-my-design (local, then account).

### F8 — Generation & preview [O]
- Click **Create QR Code** → validates current form → `POST https://api.qrcode-monkey.com/qr/custom` with JSON
  `{data, config, size, download:"imageUrl", file:"svg"}` → response `{"imageUrl":"//api.qrcode-monkey.com/tmp/<md5>.svg"}` → preview `<img>` loads that SVG (cache-busted with timestamp).
- Captured example: config sent (gradient + custom eye colours + `circular`/`frame14`/`ball16`) — 553 B request, 83 B response, 65,922 B SVG.
- Returned SVG: `1155×1155` canvas for size 1000 with a `translate(70,70)` group → quiet-zone margin is added outside the requested size [O][I]; ~752 `<g>`, 188 `<path>`, 153 `<rect>`, one `<linearGradient>` (rotated 90°) [O].
- While loading: `isLoading` disables buttons [S]. After success the Create button greys out until any config/data changes (`$watch` → `generateActive`) [S][O].
- Download buttons are **disabled until the first successful Create** [O].
- **Error correction level is not user-selectable**; not sent in config [O]. Server choice **[U]**.
- **Ours**: instant client-side live preview (debounced ~100 ms), no "Create" gate; explicit EC selector with auto mode.

### F9 — Download [O][S]
- Click **Download PNG/SVG/PDF/EPS** → modal "Your QR Code is being Generated. Please do not refresh or close the window." over a full-size **advert**; after a **fixed 9.5 s timer** the browser navigates to
  `GET /qr/custom?download=true&file=<fmt>&data=…&size=…&config=<urlencoded JSON>` (server returns attachment).
- PDF and EPS: "no support for color gradients"; FAQ: logo and design settings only for PNG and SVG.
- **Ours**: immediate, client-side export; PNG at chosen px, SVG, vector PDF (with gradients), EPS (solid colours), no artificial delay.

### F10 — "More" types & upload-file link [O]
- **More ▾** tab, and links `openModal('types', 'mp3'|'pdf'|'video'|'image'|'social'|'app'|'rating'|'feedback')`, and "Upload MP3, PDF or any file" all open **advert modals** for an external paid product. **None of MP3, Video, PDF, Image Gallery, Social Media, App Store, Rating or Feedback exists as a working feature on the reference.**
- **Ours**: implement as genuine features (they require hosting → dynamic/back-end tier). See doc 02 §3.

### F11 — Location helper [O][S]
- Address search box (Google Places autocomplete), Latitude/Longitude numeric inputs (default 51.049259, 13.73836), embedded Google Map with draggable marker ("You can manually drag the marker on the map").
- **Ours**: OpenStreetMap/Leaflet + a geocoder (e.g. Nominatim with attribution & rate limits, or a paid provider) — avoids Google Maps billing; manual lat/lng always available.

### F12 — Event helper [O]
- Title, Location, Start/End date-time pickers (custom calendar widget; default = now).
- **Ours**: native `datetime-local` + timezone selector.

### F13 — Public API page [O]
- `/qr-code-api-with-logo`: documents a paid API sold via RapidAPI — *Create Custom QR Code* (POST/GET + config JSON), *Create Transparent QR Code*, *Upload Image* (multipart field `file`).
- **We will not call or emulate their API.** We design our own (doc 04 §8).

### F14 — Chrome App link, language switcher, FAQ, cookie consent [O]
- Present; out of MVP scope except i18n-ready architecture and a GDPR-compliant consent banner if we add analytics.

---

## 5. Publicly observable network behaviour (first-party only) [O]

| Method | Endpoint | When | Request | Response |
|---|---|---|---|---|
| POST | `api.qrcode-monkey.com/qr/custom` | Create QR Code | JSON (`data`, `config`, `size`, `download:"imageUrl"`, `file:"svg"`) | `{"imageUrl":"//…/tmp/<hash>.svg"}` |
| GET | `api.qrcode-monkey.com/tmp/<hash>.svg` | preview | — | `image/svg+xml` |
| GET | `api.qrcode-monkey.com/qr/custom?download=true&file=…` | Download (after 9.5 s) | query params | file attachment (navigation; Playwright saw `ERR_ABORTED` as the navigation became a download) |
| POST | `api.qrcode-monkey.com/qr/uploadimage` | logo upload | multipart | `{file: …}` [S] — not exercised |
| POST | `api.qrcode-monkey.com/qr/transparent` | transparent generator | JSON [S] — not exercised |

Everything else on load is assets (CSS/JS/sprites/fonts), consent, analytics and ads (≈45 requests on load).

---

## 6. Error & loading states

| State | Behaviour | Tag |
|---|---|---|
| Invalid form on Create | Field-level red message + output-column alert "There are errors you have to fix before generating." Pane switches to *Enter Content* | [O][S] |
| Create in progress | `isLoading` → buttons disabled | [S] |
| Create API failure | Only an analytics event + `isLoading=false`; **no user-facing error found in code** | [S] |
| Logo too large | `fileSizeError` flag (message markup not captured) | [S] |
| Logo upload failure | analytics event only | [S] |
| Download | 9.5 s blocking modal with spinner text + advert | [O] |
| Third-party failures | Maps deprecation warnings in console; `ERR_NETWORK_CHANGED` once | [O] |

---

## 7. Responsive behaviour [O]
- Bootstrap breakpoints 576 / 768 / 992 / 1200 px.
- ≥ 992 px: two-column card; vCard grid 3 columns.
- 390 px: single column; header collapses to logo + hamburger; tab strip scrolls horizontally; inputs full-width; preview, slider and buttons stack **below** the form (user must scroll past the whole form to reach the preview); cookie banner covers ~40 % of viewport.

---

## 8. Reference defects / UX gaps worth fixing in our product

1. **MeCard website field is never encoded** — input bound to `mecadUrl`, encoder reads `mecardUrl` [S].
2. Email subject/body are concatenated **without URL encoding** (breaks on `&`, `?`, spaces in some scanners) [S].
3. vCard/MeCard/WiFi values are **not escaped** (`;`, `,`, `:`, `\`, `"`) [S].
4. WiFi has no "hidden network" flag [S][O].
5. Event payload is a bare `VEVENT` (no `VCALENDAR` wrapper) and local time without timezone [S].
6. No live preview; mandatory "Create" round-trip [O].
7. Downloads delayed 9.5 s behind ads [O].
8. PDF/EPS lose gradients, logo and design [O].
9. No EC level control; no scan verification [O].
10. No logo size/position control [O].
11. Contrast check computed but not visibly surfaced (not observed) [S][U].
12. Mobile: preview far below the form [O].

---

## 9. What could not be inspected

| Item | Why | Impact |
|---|---|---|
| Mobile hamburger menu | REA click on the toggle timed out twice (selector matched an off-screen element / cookie banner overlay) | Low — nav items are the same 4 links seen in DOM |
| Server-side rendering internals (shape geometry, EC level, quiet-zone rule, PDF/EPS generator) | Server code is not public | None — we build our own engine |
| Logo upload & transparent endpoints | Not exercised (would upload data to a third-party server) | None |
| Actual downloaded files (PNG/PDF/EPS bytes) | Download navigations are reported as aborted by Playwright; we did not fetch them separately | Low — format behaviour known from UI text |
| Colour-picker popup internals, date-picker UI | Not opened | Low |
| Language variants, Chrome App | Out of scope | None |
| Logged-in / dynamic features | Do not exist on the reference (external paid product) | Our Phase 5 is original design |
