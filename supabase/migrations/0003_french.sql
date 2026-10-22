-- M3: conversational French progress, XP and streaks. Lesson content lives in the repo (content/french).

create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  lesson_id text not null,
  times_completed int not null default 1,
  first_completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  source text not null,
  created_at timestamptz not null default now()
);

create table public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current int not null default 0,
  longest int not null default 0,
  last_day date
);

alter table public.lesson_progress enable row level security;
alter table public.xp_events enable row level security;
alter table public.streaks enable row level security;

-- Read-only from the client. Writes happen only through complete_lesson() below.
create policy "progress own" on public.lesson_progress for select to authenticated using (user_id = auth.uid());
create policy "xp own" on public.xp_events for select to authenticated using (user_id = auth.uid());
create policy "streak own" on public.streaks for select to authenticated using (user_id = auth.uid());

create function public.complete_lesson(p_lesson text, p_tz text default 'UTC')
returns table (xp int, streak int)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date;
  s public.streaks%rowtype;
  already boolean;
  gained int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  begin
    today := (now() at time zone p_tz)::date;
  exception when others then
    today := (now() at time zone 'UTC')::date;
  end;

  select exists (select 1 from lesson_progress where user_id = uid and lesson_id = p_lesson) into already;
  gained := case when already then 5 else 10 end;

  insert into lesson_progress (user_id, lesson_id) values (uid, p_lesson)
    on conflict (user_id, lesson_id) do update set times_completed = lesson_progress.times_completed + 1;
  insert into xp_events (user_id, amount, source) values (uid, gained, 'lesson:' || p_lesson);

  select * into s from streaks where user_id = uid;
  if not found then
    insert into streaks (user_id, current, longest, last_day) values (uid, 1, 1, today);
    s.current := 1;
  elsif s.last_day = today then
    null;
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
grant execute on function public.complete_lesson(text, text) to authenticated;
