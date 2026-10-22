-- Access requests: anyone can sign in with an email code, but an account stays 'pending' (no data access)
-- until an admin approves it. Replaces the hard block from 0007; the allowed_emails table becomes an
-- optional "pre-approved" list. Existing accounts are approved automatically the first time this runs.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'status') then
    alter table public.profiles add column status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'));
    update public.profiles set status = 'approved';
  end if;
end $$;

-- Sign-up is no longer blocked at the door.
drop trigger if exists enforce_allowed_email on auth.users;

grant select (id, name, role, team, leaderboard_opt_in, created_at, status) on public.profiles to authenticated;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;
revoke execute on function public.is_approved() from public, anon;
grant execute on function public.is_approved() to authenticated;

-- RESTRICTIVE policies are ANDed with every existing policy, so a pending or rejected user can read and write nothing
-- (except their own profile row, so the app can show the waiting screen and collect their name).
do $$
declare t text;
begin
  foreach t in array array['announcements','push_subscriptions','itinerary_items','meetings','files','todos','todo_assignments',
                           'lesson_progress','xp_events','streaks','verse_sets','verse_set_items','srs_cards','trip_goal','allowed_emails']
  loop
    execute format('drop policy if exists "approved only" on public.%I', t);
    execute format('create policy "approved only" on public.%I as restrictive for all to authenticated using (public.is_approved()) with check (public.is_approved())', t);
  end loop;
end $$;

drop policy if exists "approved only" on public.profiles;
create policy "approved only" on public.profiles as restrictive for all to authenticated
  using (public.is_approved() or id = auth.uid()) with check (public.is_approved() or id = auth.uid());

drop policy if exists "approved only" on storage.objects;
create policy "approved only" on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('files', 'todo-uploads') or public.is_approved())
  with check (bucket_id not in ('files', 'todo-uploads') or public.is_approved());

-- New sign-ups: pre-approved emails (or the very first person, before any admin exists) are approved; everyone else waits.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  ok := exists (select 1 from public.allowed_emails where email = lower(coalesce(new.email, '')))
        or not exists (select 1 from public.profiles where role = 'admin');
  insert into public.profiles (id, email, name, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), case when ok then 'approved' else 'pending' end)
  on conflict (id) do nothing;
  begin
    insert into public.todo_assignments (todo_id, user_id) select t.id, new.id from public.todos t on conflict do nothing;
  exception when others then
    raise warning 'handle_new_user assignments failed: %', sqlerrm;
  end;
  return new;
exception when others then
  raise warning 'handle_new_user failed: %', sqlerrm;
  return new;
end;
$$;

-- Admin tools
drop function if exists public.admin_list_people();
create function public.admin_list_people()
returns table (id uuid, name text, email text, team text, role text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email, p.team, p.role, p.status, p.created_at from profiles p where public.is_admin() order by p.name, p.email;
$$;
revoke execute on function public.admin_list_people() from public, anon;
grant execute on function public.admin_list_people() to authenticated;

create or replace function public.admin_set_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('pending', 'approved', 'rejected') then raise exception 'bad status'; end if;
  update profiles set status = p_status where id = p_id and role <> 'admin';
end;
$$;
revoke execute on function public.admin_set_status(uuid, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text) to authenticated;

-- Pending people must not count toward group totals, leaderboards, or receive push.
create or replace function public.group_xp() returns bigint
language sql stable security definer set search_path = public as $$
  select case when not public.is_approved() then 0 else coalesce(sum(x.amount), 0) end
  from xp_events x join profiles p on p.id = x.user_id and p.status = 'approved';
$$;
create or replace function public.team_totals() returns table (team text, xp bigint, members bigint)
language sql stable security definer set search_path = public as $$
  select p.team, coalesce(sum(x.amount), 0)::bigint, count(distinct p.id)
  from profiles p left join xp_events x on x.user_id = p.id
  where public.is_approved() and p.status = 'approved' and p.team is not null and p.team <> ''
  group by p.team order by 2 desc;
$$;
create or replace function public.leaderboard(p_all_time boolean default false) returns table (name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.name, ''), 'Traveler'), coalesce(sum(x.amount), 0)::bigint, p.id = auth.uid()
  from profiles p left join xp_events x on x.user_id = p.id
    and (p_all_time or x.created_at >= date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
  where public.is_approved() and p.status = 'approved' and p.leaderboard_opt_in
  group by p.id, p.name order by 2 desc, 1 limit 50;
$$;
create or replace function public.claim_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_approved() then return; end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
