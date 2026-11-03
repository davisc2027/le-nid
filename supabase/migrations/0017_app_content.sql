-- 0017 app_content: admin-editable wording for built-in resources (first user: Three Circles). Safe to re-run. Run after 0001-0016.
--  * One row per resource (slug). `data` holds ONLY the admin's changes (partial JSON); the app lays it over the wording
--    that ships in the code, so an empty or missing row simply shows the defaults.
--  * `reviewed` = a native speaker has checked the French; until true, learners see a small "Draft French" note.
--  * Approved people can read; only admins can insert, update or delete. Pending/rejected accounts see nothing.
--  * The app keeps working before this is run (defaults show; the admin editor says "Run migration 0017 first").

create table if not exists public.app_content (
  slug text primary key check (length(slug) between 1 and 60),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  reviewed boolean not null default false,
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.app_content enable row level security;

-- Pending / rejected accounts see nothing (same restrictive policy as every other table, see 0008).
drop policy if exists "approved only" on public.app_content;
create policy "approved only" on public.app_content as restrictive for all to authenticated
  using (public.is_approved()) with check (public.is_approved());

drop policy if exists "app_content read" on public.app_content;
create policy "app_content read" on public.app_content for select to authenticated using (true);
drop policy if exists "app_content admin insert" on public.app_content;
create policy "app_content admin insert" on public.app_content for insert to authenticated with check (public.is_admin());
drop policy if exists "app_content admin update" on public.app_content;
create policy "app_content admin update" on public.app_content for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "app_content admin delete" on public.app_content;
create policy "app_content admin delete" on public.app_content for delete to authenticated using (public.is_admin());

revoke all on public.app_content from anon;
