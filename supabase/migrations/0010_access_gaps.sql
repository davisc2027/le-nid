-- 0010 access gaps. Safe to re-run. Run after 0001-0009. Fixes (review R4-R7, R12, R13, R17, R1/R8 support):
--  * award_xp / complete_lesson now require an approved user; complete_lesson only accepts real lesson ids.
--  * admin_set_status: an admin promoted while pending can be approved; un-approving deletes that user's push
--    subscriptions; approving assigns every existing to-do the user is missing.
--  * handle_new_user assigns to-dos only to auto-approved sign-ups (pending strangers get none).
--  * push_subscriptions.endpoint must be an https URL of bounded length (table constraint + claim RPC).
--  * profiles self-insert cannot choose status/email/role (policy + column grant).
--  * New RPCs: my_stats(), pending_count(), use_translate_chars(int), use_stt_clip() (+ usage_daily table).

-- 1. Push endpoint validation ------------------------------------------------------------------
delete from public.push_subscriptions where endpoint !~ '^https://[^/[:space:]]+/.+' or length(endpoint) > 1000;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_endpoint_https' and conrelid = 'public.push_subscriptions'::regclass) then
    alter table public.push_subscriptions add constraint push_endpoint_https
      check (endpoint ~ '^https://[^/[:space:]]+/.+' and length(endpoint) <= 1000);
  end if;
end $$;

create or replace function public.claim_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_approved() then return; end if;
  if p_endpoint !~ '^https://[^/[:space:]]+/.+' or length(p_endpoint) > 1000 then raise exception 'bad endpoint'; end if;
  if length(coalesce(p_p256dh, '')) not between 1 and 200 or length(coalesce(p_auth, '')) not between 1 and 100 then
    raise exception 'bad keys';
  end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
revoke execute on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;

-- 2. profiles self-insert: pending member with their own email only -----------------------------
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'member' and status = 'pending'
              and email is not distinct from (auth.jwt() ->> 'email'));
revoke insert on public.profiles from authenticated, anon;
grant insert (id, email, name) on public.profiles to authenticated;

-- 3. To-dos only for approved people --------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  ok := exists (select 1 from public.allowed_emails where email = lower(coalesce(new.email, '')))
        or not exists (select 1 from public.profiles where role = 'admin');
  insert into public.profiles (id, email, name, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), case when ok then 'approved' else 'pending' end)
  on conflict (id) do nothing;
  if ok then
    begin
      insert into public.todo_assignments (todo_id, user_id) select t.id, new.id from public.todos t on conflict do nothing;
    exception when others then
      raise warning 'handle_new_user assignments failed: %', sqlerrm;
    end;
  end if;
  return new;
exception when others then
  raise warning 'handle_new_user failed: %', sqlerrm;
  return new;
end;
$$;

-- Clean up untouched assignments given to people who are not approved (0007/0008 over-assigned).
delete from public.todo_assignments a
using public.profiles p
where p.id = a.user_id and p.status <> 'approved' and a.completed_at is null and a.upload_path is null;

create or replace function public.admin_set_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('pending', 'approved', 'rejected') then raise exception 'bad status'; end if;
  -- Admins can be approved (fixes a co-leader promoted while pending) but never un-approved.
  update profiles set status = p_status where id = p_id and (role <> 'admin' or p_status = 'approved');
  if not found then return; end if;
  if p_status = 'approved' then
    insert into todo_assignments (todo_id, user_id) select t.id, p_id from todos t on conflict do nothing;
  else
    delete from push_subscriptions where user_id = p_id;
  end if;
end;
$$;
revoke execute on function public.admin_set_status(uuid, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text) to authenticated;

-- 4. XP RPCs: approved users only; lesson ids must be real ---------------------------------------
-- Allow-list by pattern instead of a table so adding lessons needs no SQL: units u0..u30, lessons l0..l20
-- (the course has at most 4 lessons per unit today). That caps lesson_progress at 651 rows per user, so bogus rows
-- cannot bloat the database, while leaving headroom for content growth. Widen the regex if units are added.
create or replace function public.award_xp(p_source text, p_amount int, p_tz text default 'UTC')
returns table (xp int, streak int)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tz text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  today date := (now() at time zone tz)::date;
  s public.streaks%rowtype;
  gained int := least(greatest(p_amount, 0), 30);
  so_far int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.is_approved() then raise exception 'not approved'; end if;
  if p_source !~ '^(review|verse:[A-Za-z0-9 :,.-]{1,30})$' then raise exception 'bad source'; end if;
  select coalesce(sum(amount), 0) into so_far from xp_events
    where user_id = uid and created_at >= (today::timestamp at time zone tz);
  gained := least(gained, greatest(300 - so_far, 0));
  if gained > 0 then insert into xp_events (user_id, amount, source) values (uid, gained, p_source); end if;
  insert into streaks (user_id, current, longest, last_day) values (uid, 0, 0, null) on conflict (user_id) do nothing;
  select * into s from streaks where user_id = uid for update;
  if s.last_day = today then null;
  elsif s.last_day = today - 1 then
    update streaks set current = s.current + 1, longest = greatest(s.longest, s.current + 1), last_day = today where user_id = uid;
    s.current := s.current + 1;
  else
    update streaks set current = 1, longest = greatest(s.longest, 1), last_day = today where user_id = uid;
    s.current := 1;
  end if;
  return query select gained, s.current;
end;
$$;

create or replace function public.complete_lesson(p_lesson text, p_tz text default 'UTC')
returns table (xp int, streak int)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tz text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  today date := (now() at time zone tz)::date;
  s public.streaks%rowtype;
  already boolean;
  gained int;
  so_far int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.is_approved() then raise exception 'not approved'; end if;
  if p_lesson !~ '^u([0-9]|[12][0-9]|30)-l([0-9]|1[0-9]|20)$' then raise exception 'bad lesson'; end if;

  select exists (select 1 from lesson_progress where user_id = uid and lesson_id = p_lesson) into already;
  gained := case when already then 5 else 10 end;
  select coalesce(sum(amount), 0) into so_far from xp_events
    where user_id = uid and created_at >= (today::timestamp at time zone tz);
  gained := least(gained, greatest(300 - so_far, 0));

  insert into lesson_progress (user_id, lesson_id) values (uid, p_lesson)
    on conflict (user_id, lesson_id) do update set times_completed = lesson_progress.times_completed + 1;
  if gained > 0 then insert into xp_events (user_id, amount, source) values (uid, gained, 'lesson:' || p_lesson); end if;

  insert into streaks (user_id, current, longest, last_day) values (uid, 0, 0, null) on conflict (user_id) do nothing;
  select * into s from streaks where user_id = uid for update;
  if s.last_day = today then null;
  elsif s.last_day = today - 1 then
    update streaks set current = s.current + 1, longest = greatest(s.longest, s.current + 1), last_day = today where user_id = uid;
    s.current := s.current + 1;
  else
    update streaks set current = 1, longest = greatest(s.longest, 1), last_day = today where user_id = uid;
    s.current := 1;
  end if;
  return query select gained, s.current;
end;
$$;

revoke execute on function public.award_xp(text, int, text), public.complete_lesson(text, text) from public, anon;
grant execute on function public.award_xp(text, int, text), public.complete_lesson(text, text) to authenticated;

-- Remove bogus lesson rows left by the old unbounded regex.
delete from public.lesson_progress where lesson_id !~ '^u([0-9]|[12][0-9]|30)-l([0-9]|1[0-9]|20)$';

-- 5. my_stats / pending_count ----------------------------------------------------------------------
create or replace function public.my_stats()
returns table (xp_total bigint, lessons_done int, streak int, last_day date)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_approved() then
    return query select 0::bigint, 0, 0, null::date;
    return;
  end if;
  return query select
    coalesce((select sum(x.amount) from xp_events x where x.user_id = uid), 0)::bigint,
    (select count(*)::int from lesson_progress l where l.user_id = uid and l.lesson_id ~ '^u([0-9]|[12][0-9]|30)-l([0-9]|1[0-9]|20)$'),
    coalesce((select s.current from streaks s where s.user_id = uid), 0),
    (select s.last_day from streaks s where s.user_id = uid);
end;
$$;

create or replace function public.pending_count() returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select count(*)::int from profiles where status = 'pending') else 0 end;
$$;

-- 6. Daily usage budgets (translate characters, voice clips) ---------------------------------------
create table if not exists public.usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  kind text not null,
  amount int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.usage_daily enable row level security;  -- no policies: only the definer RPCs touch it
revoke all on public.usage_daily from anon, authenticated;

create or replace function public.use_translate_chars(p_chars int) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lim constant int := 15000;
  total int;
begin
  if uid is null or not public.is_approved() then raise exception 'not approved'; end if;
  if p_chars is null or p_chars <= 0 then return; end if;
  if p_chars > lim then raise exception 'daily translate limit reached'; end if;
  insert into usage_daily as u (user_id, day, kind, amount)
  values (uid, (now() at time zone 'UTC')::date, 'translate', p_chars)
  on conflict (user_id, day, kind) do update set amount = u.amount + excluded.amount
    where u.amount + excluded.amount <= lim
  returning u.amount into total;
  if total is null then raise exception 'daily translate limit reached'; end if;
end;
$$;

create or replace function public.use_stt_clip() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lim constant int := 120;
  total int;
begin
  if uid is null or not public.is_approved() then raise exception 'not approved'; end if;
  insert into usage_daily as u (user_id, day, kind, amount)
  values (uid, (now() at time zone 'UTC')::date, 'stt', 1)
  on conflict (user_id, day, kind) do update set amount = u.amount + 1
    where u.amount + 1 <= lim
  returning u.amount into total;
  if total is null then raise exception 'daily voice limit reached'; end if;
end;
$$;

revoke execute on function public.my_stats(), public.pending_count(), public.use_translate_chars(int), public.use_stt_clip()
  from public, anon;
grant execute on function public.my_stats(), public.pending_count(), public.use_translate_chars(int), public.use_stt_clip()
  to authenticated;
