-- Hardening: sign-up allowlist, private emails, column-level write grants, XP caps, push claim, auto-assigned to-dos.
-- Safe to re-run.

-- 1. Sign-up allowlist -------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;
drop policy if exists "allowed admin" on public.allowed_emails;
create policy "allowed admin" on public.allowed_emails for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.allowed_emails from anon;

-- Existing users are untouched (only INSERTs are checked). Until an admin exists, sign-up stays open so the
-- first leader can get in and be promoted; after that only listed emails can create an account.
create or replace function public.enforce_allowed_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.allowed_emails where email = lower(coalesce(new.email, ''))) then
    return new;
  end if;
  if not exists (select 1 from public.profiles where role = 'admin') then
    return new;
  end if;
  raise exception 'This email is not on the trip list. Ask a leader to add it.';
end;
$$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.enforce_allowed_email() to supabase_auth_admin;
revoke execute on function public.enforce_allowed_email() from public, anon, authenticated;

drop trigger if exists enforce_allowed_email on auth.users;
create trigger enforce_allowed_email before insert on auth.users
  for each row execute function public.enforce_allowed_email();

-- 2. Private emails + column-level writes ------------------------------------------------------
revoke select on public.profiles from authenticated, anon;
grant select (id, name, role, team, leaderboard_opt_in, created_at) on public.profiles to authenticated;
revoke update on public.profiles from authenticated, anon;
grant update (name, leaderboard_opt_in) on public.profiles to authenticated;

-- Admins read emails and set teams through these (column grants above block direct access).
create or replace function public.admin_list_people()
returns table (id uuid, name text, email text, team text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email, p.team, p.role from profiles p where public.is_admin() order by p.name, p.email;
$$;
create or replace function public.admin_set_team(p_id uuid, p_team text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update profiles set team = nullif(trim(p_team), '') where id = p_id;
end;
$$;

revoke update on public.todo_assignments from authenticated, anon;
grant update (completed_at, upload_path) on public.todo_assignments to authenticated;
drop policy if exists "assignments update own" on public.todo_assignments;
create policy "assignments update own" on public.todo_assignments for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (upload_path is null or upload_path like auth.uid()::text || '/%'));

-- 3. Push subscriptions: take over an endpoint registered by someone else on the same device ---
create or replace function public.claim_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_endpoint !~ '^https://' then raise exception 'bad endpoint'; end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
revoke execute on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;

-- 4. XP: validated sources, daily cap, clamped timezone ----------------------------------------
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
  if p_lesson !~ '^u[0-9]+-l[0-9]+$' then raise exception 'bad lesson'; end if;

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

-- Aggregates: signed-in callers only.
create or replace function public.group_xp() returns bigint
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then 0 else coalesce(sum(amount), 0) end from xp_events;
$$;

create or replace function public.team_totals() returns table (team text, xp bigint, members bigint)
language sql stable security definer set search_path = public as $$
  select p.team, coalesce(sum(x.amount), 0)::bigint, count(distinct p.id)
  from profiles p left join xp_events x on x.user_id = p.id
  where auth.uid() is not null and p.team is not null and p.team <> ''
  group by p.team order by 2 desc;
$$;

create or replace function public.leaderboard(p_all_time boolean default false) returns table (name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.name, ''), 'Traveler'), coalesce(sum(x.amount), 0)::bigint, p.id = auth.uid()
  from profiles p left join xp_events x on x.user_id = p.id
    and (p_all_time or x.created_at >= date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
  where auth.uid() is not null and p.leaderboard_opt_in
  group by p.id, p.name order by 2 desc, 1 limit 50;
$$;

revoke execute on function public.award_xp(text, int, text), public.complete_lesson(text, text),
  public.group_xp(), public.team_totals(), public.leaderboard(boolean) from public, anon;
grant execute on function public.award_xp(text, int, text), public.complete_lesson(text, text),
  public.group_xp(), public.team_totals(), public.leaderboard(boolean) to authenticated;

-- 5. New members get every existing to-do (admins too) ------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  begin
    insert into public.todo_assignments (todo_id, user_id)
    select t.id, new.id from public.todos t
    on conflict do nothing;
  exception when others then
    raise warning 'handle_new_user assignments failed: %', sqlerrm;
  end;
  return new;
exception when others then
  raise warning 'handle_new_user failed: %', sqlerrm;
  return new;
end;
$$;

-- Backfill: everyone (admins included) gets every to-do they are missing.
insert into public.todo_assignments (todo_id, user_id)
select t.id, p.id from public.todos t cross join public.profiles p
on conflict do nothing;
