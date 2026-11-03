# 02 — Complete Feature Inventory

Tags as in doc 01: **[O]** observed via REA capture, **[S]** read from captured bundle, **[I]** inferred,
**[N] New** = not present on the reference; our own design.

Legend for "Tier": **Static** = runs 100 % in the browser, no account, no backend.
**Dynamic** = needs our backend (hosting, redirect, storage, analytics).

---

## 1. Content types present on the reference (14 working types)

Payload column = exact reference encoder [S] → our encoder (fixes noted). `⟨x⟩` = field value.

### 1.1 URL — Static
| Field | Type | Rules (reference) | Ours |
|---|---|---|---|
| Your URL | url | required, HTML `type=url` | required; auto-prefix `https://` if scheme missing; max 2,000 chars |

- Reference payload: `⟨url⟩` (verbatim).
- Ours: normalized URL (`new URL()`), IDN → punycode host, verbatim otherwise.

### 1.2 Text — Static
| Field | Type | Rules |
|---|---|---|
| Your Text | textarea | required, maxlength 400 |

- Payload: `⟨text⟩`. Ours: same; raise limit to capacity-aware counter (shows bytes vs. version/EC capacity).

### 1.3 Email — Static
| Field | Rules |
|---|---|
| Your Email | required, `type=email` |
| Subject | optional |
| Message | optional, maxlength 400 |

- Reference: `mailto:⟨email⟩[?subject=⟨subject⟩][&body=⟨message⟩]` — **not URL-encoded** [S].
- Ours (RFC 6068): `mailto:⟨email⟩?subject=⟨enc(subject)⟩&body=⟨enc(message)⟩` with `encodeURIComponent`, params omitted when empty. Optional "MATMSG" format toggle: `MATMSG:TO:⟨email⟩;SUB:⟨s⟩;BODY:⟨b⟩;;` (escaped).

### 1.4 Phone — Static
| Field | Rules |
|---|---|
| Your Phone Number | required, `type=tel` (no pattern) |

- Payload: `tel:⟨phone⟩`. Ours: strip spaces/brackets, allow leading `+`, validate E.164-ish with libphonenumber-js (warn, don't block).

### 1.5 SMS — Static
| Field | Rules |
|---|---|
| Your Phone Number | required, tel |
| Your Message | optional, maxlength 400 |

- Payload: `SMSTO:⟨phone⟩:⟨message⟩`. Ours: same (widest scanner support); option for `sms:⟨phone⟩?body=⟨enc⟩`.

### 1.6 vCard — Static
Fields [O]: Version (radio **2.1** / **3**, default 3), Firstname, Lastname, Organization, Position (Work), Phone (Work), Phone (Private), Phone (Mobile), Fax (Work), Fax (Private), Email, Website, Street, Zipcode, City, State, Country. **No required fields.**

Reference v3 payload [S]:
```
BEGIN:VCARD
VERSION:3.0
N:⟨last⟩;⟨first⟩
FN:⟨first⟩ ⟨last⟩
TITLE:⟨title⟩
ORG:⟨org⟩
URL:⟨url⟩
EMAIL;TYPE=INTERNET:⟨email⟩
TEL;TYPE=voice,work,pref:⟨phoneWork⟩
TEL;TYPE=voice,home,pref:⟨phonePrivate⟩
TEL;TYPE=voice,cell,pref:⟨mobile⟩
TEL;TYPE=fax,work,pref:⟨faxWork⟩
TEL;TYPE=fax,home,pref:⟨faxPrivate⟩
ADR:;;⟨street⟩;⟨city⟩;⟨state⟩;⟨zip⟩;⟨country⟩
END:VCARD
```
(lines emitted only when non-empty; N/FN only if a name exists). v2.1 differs: no `FN`, `TEL;CELL:`, `TEL;WORK;VOICE:`, `TEL;HOME;VOICE:`, `TEL;WORK;FAX:`, `TEL;HOME;FAX:`.

Ours: same field set + escaping of `\ , ; newline` per RFC 6350, CRLF line endings, `FN` always present in 3.0, optional 4.0, optional note/birthday. Require at least one of name/org/phone/email (soft rule).

### 1.7 MeCard — Static
Fields [O]: Firstname, Lastname, Nickname, Phone 1, Phone 2, Phone 3, Email, Website, Birthday (YYYY-MM-DD), Street, Zipcode, City, State, Country, Notes.

Reference [S]: `MECARD:N:⟨last⟩,⟨first⟩;NICKNAME:…;TEL:…;TEL:…;TEL:…;URL:…;EMAIL:…;BDAY:YYYYMMDD;NOTE:…;ADR:,,⟨street⟩,⟨city⟩,⟨state⟩,⟨zip⟩,⟨country⟩;;`
— notes have `;` replaced by `,`; **Website is never emitted (model-name bug `mecadUrl`)**.
Ours: fix URL, escape `\ ; : ,` per MeCard spec, validate birthday date.

### 1.8 Location — Static
Fields [O]: Search Your Address (autocomplete), Latitude (−90…90), Longitude (−180…180), map with draggable marker.
- Reference: `https://maps.google.com/local?q=⟨lat⟩,⟨lng⟩`.
- Ours: selectable output — `geo:⟨lat⟩,⟨lng⟩` (standard, opens native maps) or `https://www.google.com/maps/search/?api=1&query=⟨lat⟩,⟨lng⟩` or `https://maps.apple.com/?ll=⟨lat⟩,⟨lng⟩`; 6-decimal rounding.

### 1.9 Facebook — Static
Fields [O]: radio **Facebook URL** / **Share your URL on Facebook**; Your Facebook URL (url, required when type=url); Share URL (url, required when type=share).
- Reference: url mode → `⟨url⟩`; share mode → `https://www.facebook.com/sharer/sharer.php?u=⟨enc(url)⟩`.
- Ours: same; validate host for page mode (warn if not facebook.com / fb.com).

### 1.10 Twitter / X — Static
Fields [O]: radio **Twitter URL** / **Tweet**; Your Twitter URL (url, required in url mode); Your Tweet (textarea, maxlength 280).
- Reference: url → `⟨url⟩`; tweet → `https://twitter.com/intent/tweet?text=⟨enc(tweet)⟩`.
- Ours: rename "X (Twitter)"; `https://x.com/intent/post?text=⟨enc⟩` (twitter.com intent kept as fallback option); profile mode accepts `@handle` → `https://x.com/⟨handle⟩`.

### 1.11 YouTube — Static
Field [O]: Your Youtube URL (url, required). Payload `⟨url⟩`. Ours: also accept video ID / `youtu.be` and normalise.

### 1.12 WiFi — Static
Fields [O]: Wireless SSID, Password, Encryption select (`nopass` "no encryption", `WEP`, `WPA` "WPA/WPA2"). No required fields [S].
- Reference: `WIFI:S:⟨ssid⟩;T:⟨enc⟩;P:⟨password⟩;;` (unescaped).
- Ours: `WIFI:T:⟨WPA|WEP|nopass⟩;S:⟨esc(ssid)⟩;P:⟨esc(pw)⟩;H:⟨true⟩;;` — escape `\ ; , : "`, omit `P` for nopass, **Hidden network** checkbox [N], add WPA3/SAE option `T:SAE` [N], SSID required.

### 1.13 Event — Static
Fields [O]: Event Title, Event Location, Starttime, Endtime (date-time pickers, default now).
- Reference: `BEGIN:VEVENT\nSUMMARY:…\nLOCATION:…\nDTSTART:yyyyMMddTHHmm00\nDTEND:…\nEND:VEVENT\n` (local time, no TZ, no VCALENDAR).
- Ours: wrap in `BEGIN:VCALENDAR/VERSION:2.0/…/END:VCALENDAR`, UTC (`…Z`) or `TZID`, escape text, add Description + all-day option [N], validate end ≥ start.

### 1.14 Bitcoin / Crypto — Static
Fields [O]: Select Cryptocurrency (radio: Bitcoin `bitcoin`, Bitcoin Cash `bitcoincash`, Ethereum `ethereum`, Litecoin `litecoin`, Dash `dash`), Address (required), Amount (number).
- Reference: `⟨scheme⟩:⟨address⟩[?amount=⟨amount⟩]`.
- Ours: same BIP-21 style for BTC/BCH/LTC/DASH (+ optional `label`, `message`); Ethereum per EIP-681 (`ethereum:⟨address⟩?value=⟨wei⟩`) — flag the reference's `amount` as non-standard; address format validation per coin.

---

## 2. Reference-only "Banking" type
`case "banking": n=""` exists in the encoder [S] but no tab/UI is exposed [O]. Ours [N, optional]: **EPC/SEPA Girocode** (`BCD\n002\n1\nSCT\n⟨BIC⟩\n⟨Name⟩\n⟨IBAN⟩\nEUR⟨amount⟩\n…`), plus generic UPI/PayNow later.

---

## 3. Types requested in the brief that the reference does NOT implement

On the reference these open advert modals for an external paid product [O]. In our product they are **real** features; each needs hosting, so they belong to the **Dynamic tier** (account required, short-link `https://⟨our-domain⟩/r/⟨slug⟩` encoded in the QR).

| Type | Inputs (ours) | QR payload | Backend needs |
|---|---|---|---|
| **MP3** | audio upload (≤ 20 MB, mp3/m4a/ogg), title, artist/cover image, download toggle | short link → hosted audio landing page | object storage, landing page renderer |
| **Video** | upload (≤ 100 MB) **or** YouTube/Vimeo URL, title, description | short link → video page | storage/transcode (or embed only in v1) |
| **PDF** | PDF upload (≤ 20 MB), title, description, "direct open" toggle | short link → viewer or direct file | storage |
| **Image Gallery** | 1–20 images (jpg/png/webp, ≤ 10 MB each), title, captions, layout | short link → gallery page | storage, thumbnails |
| **Social Media** | page title, avatar, list of {network, URL} (15 networks) | short link → link-in-bio page | landing page |
| **App Store** | iOS URL, Android URL, fallback URL, app name/icon | short link → device-detecting redirect | UA-based redirect |
| **Rating** | question, scale (stars 1–5 / thumbs / emoji), thank-you message, optional email | short link → rating form | responses table, spam protection |
| **Feedback** | form title, categories, fields (rating + comment + optional contact), notify email | short link → feedback form | responses table, email notifications |
| **Generic file** ("Upload MP3, PDF or any file") | any file (allow-list, ≤ 50 MB) | short link → download page | storage, virus scanning (ClamAV) |

Static fallback for MP3/Video/PDF without an account: user supplies an **existing public URL**; we encode that URL directly (no hosting) — clearly labelled.

---

## 4. Customisation inventory

| Feature | Reference | Ours |
|---|---|---|
| Foreground single colour | ✔ [O] | ✔ |
| Linear gradient | ✔ (2 stops, fixed 90° rotation in SVG) [O] | ✔ 2–3 stops, angle 0–360° |
| Radial gradient | ✔ (select) [O] | ✔ centre + radius |
| Gradient on eyes | ✔ (`gradientOnEyes`) [S] | ✔ |
| Custom eye colours | ✔ one frame colour + one ball colour (applied to all 3 eyes in UI; config supports per-eye) [O][S] | ✔ global + per-eye override |
| Background colour | ✔ [O] | ✔ + **transparent** + background gradient [N] |
| Body shapes | 22 [S] | ≥ 12 original shapes at launch, extensible |
| Eye frame shapes | 15 [S] | ≥ 10 original |
| Eye ball shapes | 18 [S] | ≥ 10 original |
| Per-eye mirroring | ✔ flip flags [S] | ✔ rotation-aware renderer |
| Logo upload | ✔ server-side, 2 MB, png/jpg/gif/svg [O][S] | ✔ client-side only, 5 MB, png/jpg/webp/svg (SVG sanitised) |
| Logo gallery | 24 icons [O] | ✔ original icon set (Simple-Icons-style licensing checked) |
| Clear modules behind logo | ✔ checkbox [O] | ✔ (+ margin, round/square cut-out) |
| Logo size / position | ✘ [O] | ✔ size 10–30 % of width (capped by EC), centre/offset [N] |
| Logo background removal (image itself) | ✘ | ✔ remove near-white/solid background (client-side colour-key) [N] |
| Templates | 13 hard-coded [O] | ✔ original presets + user-saved |
| Resolution | 200–2000 px slider, step 25 [S] | 200–4000 px + DPI field for print |
| Quiet zone | fixed (added outside) [I] | 0–10 modules, default 4 |
| Error correction | not exposed [O] | L/M/Q/H + Auto (H when logo) |
| Frames/captions ("Scan me") | ✘ | ✔ optional frame with text [N] |
| Contrast check | computed, not surfaced [S] | ✔ visible warning + decode test |
| Scan validation | ✘ | ✔ automatic decode of the rendered output [N] |

## 5. Generation, preview & export

| Feature | Reference | Ours |
|---|---|---|
| Preview | after clicking Create; server SVG [O] | live, client-side SVG, debounced |
| PNG | ✔ server, size from slider [O] | ✔ canvas, any size ≤ 4000 px, optional transparent bg |
| SVG | ✔ full design [O] | ✔ full design, logo embedded (data URI) |
| PDF | ✔ no gradients/logo/design [O] | ✔ vector, full design incl. gradients & logo |
| EPS | ✔ no gradients/logo/design [O] | ✔ vector; solid colours + shapes; gradients rasterised or flattened to solid with warning; logo embedded as raster |
| Download delay | 9.5 s + advert [O] | instant |
| Copy to clipboard | ✘ | ✔ PNG/SVG [N] |

## 6. Advanced (Dynamic tier) — none exist on the reference [O]
Bulk generation (CSV/XLSX → ZIP), batch download, design templates (saved), saved projects, history, dynamic QR with editable destination, scan analytics, campaign folders, authentication, REST API, dashboard. Full design in doc 04 §6–8 and doc 06.

## 7. Site chrome
| Feature | Reference | Ours |
|---|---|---|
| Header nav | About, Chrome App, API, Language [O] | Product, Templates, Bulk, API docs, Pricing/Free, Sign in |
| Tab bar of types | 14 + More [O] | 14 static types + "More" (dynamic types) — all functional |
| Mobile | horizontal tab scroll, hamburger [O] | same + **sticky mini-preview / bottom action bar** |
| Language switcher | 11 locales [O] | i18n-ready (en first) |
| FAQ / how-to / about | ✔ [O] | ✔ original copy |
| Cookie consent | OneTrust [O] | only if analytics/ads are added; privacy-first default |
