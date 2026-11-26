-- 0020 security hardening (audit docs/audit-security.md: M2, M4, M6). Safe to re-run. Run after 0001-0019.
--
-- BACKWARD COMPATIBLE: the app works before AND after this is run. Nothing here is required by the code that ships
-- with it:
--   * admin_audit: the admin actions write to it when it exists and skip the log (with a console warning) when it
--     does not, so sign-in codes, person deletion and upload deletion keep working before this migration.
--   * Bucket limits: the browser forms already check size and type first; the bucket limits are the real enforcement.
--     Files already in the buckets are not touched.
--   * Push: the app has always subscribed through claim_push_subscription (lib/push-client.ts) and unsubscribes with
--     a delete on its own row, both of which keep working. Only direct INSERT/UPDATE from the browser is closed.
--
-- 1. admin_audit: who did what to whom. Admins can read it; nobody can write from a browser (the server inserts with the
--    service role, which bypasses RLS).
-- 2. Storage buckets: size and MIME limits (todo-uploads 10 MB passports/photos/PDF; files 50 MB documents).
-- 3. Push subscriptions: members can only add one through the RPC, which now allows only the known push services and
--    keeps at most 5 devices per person (the oldest are dropped).

-- 1. admin_audit --------------------------------------------------------------------------------
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references public.profiles(id) on delete set null,
  action text not null,
  target_email text,
  detail jsonb
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;
drop policy if exists "audit admin read" on public.admin_audit;
create policy "audit admin read" on public.admin_audit for select to authenticated
  using (public.is_admin() and public.is_approved());
-- No insert/update/delete policies exist, and the grants are removed as a second lock.
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;
grant all on public.admin_audit to service_role;
do $$ begin
  execute 'grant usage, select on sequence ' || pg_get_serial_sequence('public.admin_audit', 'id') || ' to service_role';
end $$;

-- 2. Storage bucket limits ------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
 where id = 'todo-uploads';

update storage.buckets
   set file_size_limit = 50 * 1024 * 1024,
       allowed_mime_types = array[
         'application/pdf',
         'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
         'application/vnd.oasis.opendocument.presentation', 'application/rtf',
         'text/plain', 'text/csv', 'text/markdown'
       ]
 where id = 'files';

-- 3. Push subscriptions ----------------------------------------------------------------------------
-- Members may read and delete their own rows (unsubscribe), but not insert or update them directly.
drop policy if exists "push own" on public.push_subscriptions;
drop policy if exists "push own read" on public.push_subscriptions;
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push own delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.push_subscriptions from authenticated, anon;

-- Only real push services. Rows pointing anywhere else are removed first so the constraint can be validated.
delete from public.push_subscriptions
 where endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/.+';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_endpoint_known_host' and conrelid = 'public.push_subscriptions'::regclass) then
    alter table public.push_subscriptions add constraint push_endpoint_known_host
      check (endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/.+');
  end if;
end $$;

create or replace function public.claim_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_approved() then return; end if;
  if p_endpoint !~ '^https://[^/[:space:]]+/.+' or length(p_endpoint) > 1000 then raise exception 'bad endpoint'; end if;
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/.+' then
    raise exception 'unsupported push service';
  end if;
  if length(coalesce(p_p256dh, '')) not between 1 and 200 or length(coalesce(p_auth, '')) not between 1 and 100 then
    raise exception 'bad keys';
  end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth, created_at) values (p_endpoint, auth.uid(), p_p256dh, p_auth, now())
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  -- At most 5 devices per person: keep the 5 newest (this one is the newest), drop the rest.
  delete from push_subscriptions
   where user_id = auth.uid()
     and endpoint not in (select endpoint from push_subscriptions where user_id = auth.uid() order by created_at desc limit 5);
end;
$$;
revoke execute on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;
