# 11 — Accounts, Supabase setup and security (M9)

## 1. Architecture assessment (before M9)
| Area | Finding |
|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind 4. Only server code: `/create` reading `searchParams`. |
| Data | All in the browser: Zustand studio store; M7 user templates in IndexedDB (`UserTemplate {id, name, design, logo{dataUrl,name}, createdAt, updatedAt}`). |
| Persisted shapes | `Design` (Zod `designSchema`), `FormValues` per `ContentTypeId` (22 ids), `LogoAsset` (PNG data URL + RGBA). |
| Backend / auth | None. No Supabase dependency, migrations or env vars. |
| Must not change | QR engine, payload encoders, exporters, bulk module, anonymous generation/download. |
| Decision | Accounts are optional: with no Supabase env the app behaves exactly as in M8. |

## 2. What M9 adds
- Email + password accounts (Supabase Auth via `@supabase/ssr`), email verification required for the dashboard, resend, password reset.
- `src/proxy.ts` (Next 16 “proxy”, formerly middleware) refreshes session cookies and does optimistic redirects. Real authorization: `getUser()` in the dashboard layout/actions and **RLS in Postgres**.
- Profiles, saved QR projects (content + design + private logo), QR history, cloud templates with cross-device sync.
- Dashboard: `/dashboard` (overview), `/projects`, `/history`, `/templates`, `/settings`.

## 3. Environment variables
| Variable | Where | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | for accounts | `https://gcexwwtvnevrtoltfhoa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | for accounts | Publishable key (`sb_publishable_…`) or legacy anon key. The app **refuses** secret/service-role keys here. |
| `NEXT_PUBLIC_SITE_URL` | server | yes in production | Origin used in auth email links, e.g. `https://qr.example.com`. |
| `SUPABASE_SERVICE_ROLE_KEY` | — | **not used** | The app never needs it. Don't set it in the web app environment. |
| `DATABASE_URL` | tooling only | optional | Only for migration tools; never `NEXT_PUBLIC_`. |

`NEXT_PUBLIC_*` values are inlined at **build time** — rebuild after changing them. Put local values in
`.env.local` (git-ignored). `.env.example` contains placeholders only.

## 4. Apply the database migration
File: `supabase/migrations/20261104120000_m9_accounts.sql` (tables, triggers, grants, RLS, storage bucket + policies).

**Option A — Supabase CLI** (recommended; needs a Supabase access token and the database password):
```bash
npx supabase login
npx supabase init            # creates supabase/config.toml; keeps the existing migrations folder
npx supabase link --project-ref gcexwwtvnevrtoltfhoa
npx supabase db push         # applies pending migrations
```
**Option B — SQL editor:** Dashboard → SQL Editor → paste the migration file → Run (once).

Verify: Table Editor shows `profiles`, `qr_projects`, `qr_history`, `user_templates` with “RLS enabled”;
Storage shows a **private** bucket `user-logos`.

## 5. Auth configuration (Supabase dashboard)
1. **Authentication → Providers → Email:** enabled; **Confirm email: ON** (required — the dashboard is for verified users only).
2. **Authentication → URL Configuration:**
   - Site URL: your production origin (same as `NEXT_PUBLIC_SITE_URL`).
   - Redirect URLs: `http://localhost:3000/**` and `https://<your-domain>/**`.
3. **Password policy:** minimum length **10** (the app enforces 10–72 with a letter and a number); enable leaked-password protection if available on your plan.
4. **Email templates** (recommended for SSR — works even when the link is opened on another device):
   - *Confirm signup*: `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/dashboard">Confirm your email</a>`
   - *Reset password*: `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset your password</a>`
   - The default `{{ .ConfirmationURL }}` templates also work (PKCE `?code=` is handled by `/auth/callback`), but only in the same browser that started the flow.
5. **SMTP:** the built-in Supabase mailer is rate-limited and meant for testing; configure custom SMTP for production.

## 6. Routes
| Route | Purpose |
|---|---|
| `/register`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email` | Auth pages (server actions in `src/app/(auth)/actions.ts`) |
| `/auth/callback` | Lands email links: `token_hash`+`type` (verifyOtp) or `code` (PKCE) |
| `/dashboard/**` | Private; proxy redirects anonymous users, layout re-checks with `getUser()` and email verification |
| `/create?project=<id>` / `?history=<id>` / `?usertemplate=<id>` | Open a saved project, reuse a history design, apply a cloud template |

Redirect targets (`?next=`) pass through `safeNext()` — only same-site relative paths (no open redirects).

## 7. Data model
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` → auth.users, `full_name`, `email` (copy), `avatar_url` (https only), `company_name` | Created by trigger on signup; email synced by trigger; users may update only name/company/avatar (column grant) |
| `qr_projects` | `user_id`, `name`, `content_type` (22 ids), `form_values` jsonb, `design` jsonb, `logo_path`, `revision` | Logo path must be inside the owner's folder (CHECK) |
| `qr_history` | `user_id`, `project_id` (same owner via composite FK, SET NULL on project delete), `content_type`, `label`, `action`, `format`, `design`, `metadata` | Never stores form content or payload; label never contains personal hints |
| `user_templates` | `id` (same id as the local template when uploaded), `user_id`, `name`, `design`, `logo_path`, `revision` | |
| storage `user-logos` | `<user id>/<projects|templates>/<id>.png` | Private bucket, PNG only, 3 MB |

**Optimistic concurrency:** a trigger bumps `revision` on every update; the app updates `… where id = ? and revision = ?`.
A stale device matches no rows and gets “changed on another device” — newer server data is never overwritten.

## 8. RLS and privilege design
- RLS enabled on all four tables; policies use `(select auth.uid()) = user_id` (or `= id` for profiles) for select/insert/update/delete, `TO authenticated` only.
- `anon` has **no** table privileges (explicit `REVOKE ALL`), so even a missing policy cannot expose data to anonymous callers.
- `WITH CHECK` on insert/update prevents writing rows for, or moving rows to, another user.
- History has no UPDATE grant at all; profiles have no INSERT/DELETE grant (rows come from the trigger; deletion cascades from auth.users).
- `ensure_profile()` (SECURITY DEFINER, `search_path=''`) can only create the **caller's** missing profile.
- Storage policies restrict every operation to `bucket_id = 'user-logos'` and first folder = `auth.uid()`.
- The service-role key is never used by the app; all user operations run with the publishable key + user JWT.

## 9. Template sync rules (M7 → M9)
- Built-in templates: always available, no login.
- Signed out: templates are saved in IndexedDB (“This device”), exactly as in M7.
- Signed in: new templates go to the account (“Synced”). If the account can't be reached, the template is saved on the device and the user is told.
- Existing device templates are offered for upload (“Upload to my account”); upload copies them with the same id (idempotent) and **never deletes** local copies. Local copies that also exist in the account are labelled.
- Rename uses the revision check; delete of a synced template removes it on all devices.
- JSON export includes account + device templates; import goes to the account when signed in (falls back to the device).

## 10. Testing approach and what was verified
| Layer | How | Verifies |
|---|---|---|
| Migration + RLS | `tests/unit/rls.test.ts`: real migration on **PGlite (PostgreSQL 18)** + `tests/db/supabase-shim.sql` (auth.users, `auth.uid()` from JWT claims, Supabase default grants, storage schema) | User A/B isolation for every table and storage, anon denial, column grants, constraints, triggers, cascade, revision |
| App logic | `tests/unit/auth.test.ts`, `secrets.test.ts` | validation, error mapping, redirect safety, config refusing secret keys, history privacy, no secret env usage |
| End-to-end | Playwright project `accounts` against `tests/mock-supabase/server.mjs` — an **emulator** of the GoTrue/PostgREST/Storage endpoints the app uses, backed by PGlite running the real migration (requests run as `authenticated`/`anon` with JWT claims, so RLS decides) | registration → email link → dashboard, duplicates, unverified login, resend, login/logout, `?next` + open-redirect, password reset, projects/history/templates/profile flows, cross-device sync and conflicts, User A/B isolation via UI and direct API, canary secrets absent from client bundles |

**Not verified:** behaviour against the live Supabase project (no credentials were provided), real email delivery,
Supabase's own rate limits, and the exact production GoTrue/PostgREST responses beyond what the emulator models.
Before going live, run the checklist in §11.

## 11. Go-live checklist (manual)
1. Set env vars (§3) in the hosting platform and rebuild.
2. Apply the migration (§4); confirm RLS badges and the private bucket.
3. Configure auth (§5): confirm email ON, redirect URLs, email templates, SMTP.
4. Smoke test: register → verify → save a project with a logo → log in on a second browser → open it → log out.
5. Isolation spot-check with two real accounts: user B opening `/create?project=<A's id>` must show “doesn't exist or isn't yours”.

## 12. Local development
- Without Supabase env: `npm run dev` — accounts hidden, everything else works.
- With your project: create `.env.local` from `.env.example`, then `npm run dev`.
- E2E: `npm run build && npm run test:e2e` runs the regression project and the accounts project (the latter builds into `.next-e2e` with the emulator configuration automatically).
