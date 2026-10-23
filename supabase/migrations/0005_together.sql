-- M6: teams, opt-in leaderboard, and the trip-wide goal.

alter table public.profiles
  add column team text,
  add column leaderboard_opt_in boolean not null default false;

-- Members may edit their own profile but not their role or team (only admins assign those).
drop policy "profiles update own name" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and team is not distinct from (select p.team from public.profiles p where p.id = auth.uid())
  );

create table public.trip_goal (
  id int primary key default 1 check (id = 1),
  title text not null default 'Raise the spire',
  target_xp int not null default 15000 check (target_xp > 0)
);
insert into public.trip_goal default values;
alter table public.trip_goal enable row level security;
create policy "goal read" on public.trip_goal for select to authenticated using (true);
create policy "goal admin" on public.trip_goal for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Aggregates are exposed through functions so individual XP stays private unless someone opts in.
create function public.group_xp() returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from xp_events;
$$;

create function public.team_totals() returns table (team text, xp bigint, members bigint)
language sql stable security definer set search_path = public as $$
  select p.team, coalesce(sum(x.amount), 0)::bigint, count(distinct p.id)
  from profiles p left join xp_events x on x.user_id = p.id
  where p.team is not null and p.team <> ''
  group by p.team order by 2 desc;
$$;

create function public.leaderboard(p_all_time boolean default false) returns table (name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.name, ''), 'Traveler'), coalesce(sum(x.amount), 0)::bigint, p.id = auth.uid()
  from profiles p left join xp_events x on x.user_id = p.id
    and (p_all_time or x.created_at >= date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
  where p.leaderboard_opt_in
  group by p.id, p.name order by 2 desc, 1 limit 50;
$$;
grant execute on function public.group_xp(), public.team_totals(), public.leaderboard(boolean) to authenticated;
