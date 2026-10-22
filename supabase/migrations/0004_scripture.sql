-- M4: scripture track. Verse text is static JSON in public/bible; the database holds only references and review state.

create table public.verse_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
create table public.verse_set_items (
  set_id uuid not null references public.verse_sets(id) on delete cascade,
  ref text not null,         -- e.g. 'JHN 3:16' or 'ROM 8:38-39'
  position int not null default 0,
  primary key (set_id, ref)
);
create table public.srs_cards (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  ref text not null,
  state jsonb,                -- ts-fsrs card; null until first learned
  due timestamptz,
  learned_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, ref)
);

alter table public.verse_sets enable row level security;
alter table public.verse_set_items enable row level security;
alter table public.srs_cards enable row level security;

create policy "sets read" on public.verse_sets for select to authenticated using (true);
create policy "sets admin" on public.verse_sets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "set items read" on public.verse_set_items for select to authenticated using (true);
create policy "set items admin" on public.verse_set_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cards own" on public.srs_cards for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Shared XP + streak writer for both French tracks.
create function public.award_xp(p_source text, p_amount int, p_tz text default 'UTC')
returns table (xp int, streak int)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date;
  s public.streaks%rowtype;
  gained int := least(greatest(p_amount, 0), 30);
begin
  if uid is null then raise exception 'not signed in'; end if;
  begin today := (now() at time zone p_tz)::date; exception when others then today := (now() at time zone 'UTC')::date; end;
  insert into xp_events (user_id, amount, source) values (uid, gained, p_source);
  select * into s from streaks where user_id = uid;
  if not found then
    insert into streaks (user_id, current, longest, last_day) values (uid, 1, 1, today);
    s.current := 1;
  elsif s.last_day = today then null;
  elsif s.last_day = today - 1 then
    update streaks set current = s.current + 1, longest = greatest(s.longest, s.current + 1), last_day = today where user_id = uid;
    s.current := s.current + 1;
  else
    update streaks set current = 1, last_day = today where user_id = uid;
    s.current := 1;
  end if;
  return query select gained, s.current;
end;
$$;
grant execute on function public.award_xp(text, int, text) to authenticated;
