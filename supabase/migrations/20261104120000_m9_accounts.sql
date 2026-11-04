-- M9 — accounts: profiles, saved QR projects, QR history, cloud templates, private logo storage.
--
-- Security model
--  * Every user-owned table has RLS enabled and policies keyed on auth.uid().
--  * anon gets no table privileges at all; authenticated gets only what the app needs.
--  * Ownership columns default to auth.uid() and are re-checked by WITH CHECK, so a client can
--    never write rows for another user, and can never move a row to another user.
--  * Profiles are created by a SECURITY DEFINER trigger on auth.users; users may update only
--    full_name / avatar_url / company_name (column-level grant), never id or email.
--  * History rows may reference only the caller's own projects (composite foreign key).
--  * Logos live in the private bucket "user-logos" under "<auth.uid()>/…".
--
-- Compatible with PostgreSQL 15+ (Supabase).

-- ---------------------------------------------------------------------------------------------
-- Helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Optimistic concurrency: every update bumps revision; clients update "where revision = <seen>",
-- so a stale device can never silently overwrite newer data. Clients cannot set it themselves.
create or replace function public.bump_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

-- The 22 content types supported by the QR engine (src/lib/payloads/types.ts).
create or replace function public.is_qr_content_type(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t in (
    'url', 'text', 'email', 'phone', 'sms', 'vcard', 'mecard', 'location', 'facebook', 'twitter',
    'youtube', 'wifi', 'event', 'crypto', 'mp3', 'video', 'pdf', 'social', 'appstore', 'gallery',
    'rating', 'feedback'
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  -- Copy for display only; the authoritative email stays in auth.users (kept in sync by trigger).
  email text check (email is null or char_length(email) <= 320),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  company_name text check (company_name is null or char_length(company_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Accounts created before this migration get a profile now.
insert into public.profiles (id, full_name, email)
select u.id, left(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), 100), u.email
from auth.users u
on conflict (id) do nothing;

-- Safe self-repair if a profile row is ever missing: creates one for the caller only.
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.profiles (id, full_name, email)
  select u.id, left(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), 100), u.email
  from auth.users u where u.id = uid
  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Saved QR projects

create table public.qr_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  content_type text not null check (public.is_qr_content_type(content_type)),
  -- Form values of the content type (FormValues). Validated by the app with the same schema.
  form_values jsonb not null default '{}'::jsonb
    check (jsonb_typeof(form_values) = 'object' and pg_column_size(form_values) <= 65536),
  -- Design (src/lib/qr/engine/design.ts designSchema).
  design jsonb not null check (jsonb_typeof(design) = 'object' and pg_column_size(design) <= 16384),
  -- Logo image in the private bucket; the path must live in the owner's folder.
  logo_path text check (logo_path is null or (char_length(logo_path) <= 200 and split_part(logo_path, '/', 1) = user_id::text)),
  logo_name text check (logo_name is null or char_length(logo_name) <= 120),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index qr_projects_user_updated_idx on public.qr_projects (user_id, updated_at desc);

create trigger qr_projects_revision before update on public.qr_projects
  for each row execute function public.bump_revision();

-- ---------------------------------------------------------------------------------------------
-- QR history (explicit actions only: download / save / bulk). Never stores form content.

create table public.qr_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  content_type text not null check (public.is_qr_content_type(content_type)),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  action text not null check (action in ('download', 'save', 'bulk')),
  format text check (format is null or format in ('png', 'svg', 'pdf', 'eps', 'zip')),
  -- Design snapshot so the look can be reopened; no payload or form values (may contain secrets).
  design jsonb check (design is null or (jsonb_typeof(design) = 'object' and pg_column_size(design) <= 16384)),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now(),
  -- A history row can only point at a project of the same user; deleting the project keeps history.
  foreign key (project_id, user_id) references public.qr_projects (id, user_id) on delete set null (project_id)
);

create index qr_history_user_created_idx on public.qr_history (user_id, created_at desc);
create index qr_history_project_idx on public.qr_history (project_id) where project_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Cloud templates (M7 user templates)

create table public.user_templates (
  -- Same id as the browser-local template when uploaded, so re-uploading is idempotent.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  design jsonb not null check (jsonb_typeof(design) = 'object' and pg_column_size(design) <= 16384),
  logo_path text check (logo_path is null or (char_length(logo_path) <= 200 and split_part(logo_path, '/', 1) = user_id::text)),
  logo_name text check (logo_name is null or char_length(logo_name) <= 120),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_templates_user_updated_idx on public.user_templates (user_id, updated_at desc);

create trigger user_templates_revision before update on public.user_templates
  for each row execute function public.bump_revision();

-- ---------------------------------------------------------------------------------------------
-- Privileges: nothing for anon; only what the app uses for authenticated.

revoke all on public.profiles, public.qr_projects, public.qr_history, public.user_templates from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, company_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.qr_projects to authenticated;
grant select, insert, delete on public.qr_history to authenticated;
grant select, insert, update, delete on public.user_templates to authenticated;

revoke all on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security

alter table public.profiles enable row level security;
alter table public.qr_projects enable row level security;
alter table public.qr_history enable row level security;
alter table public.user_templates enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "projects: read own" on public.qr_projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "projects: insert own" on public.qr_projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projects: update own" on public.qr_projects
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects: delete own" on public.qr_projects
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "history: read own" on public.qr_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "history: insert own" on public.qr_history
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "history: delete own" on public.qr_history
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "templates: read own" on public.user_templates
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "templates: insert own" on public.user_templates
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "templates: update own" on public.user_templates
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "templates: delete own" on public.user_templates
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------
-- Private logo storage: user-logos/<user id>/<projects|templates>/<id>.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-logos', 'user-logos', false, 3145728, array['image/png'])
on conflict (id) do nothing;

create policy "user-logos: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user-logos: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user-logos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-logos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user-logos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
