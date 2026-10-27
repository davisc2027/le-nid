-- 0014 polls. Safe to re-run. Run after 0001-0013.
-- An admin sends a poll (like a to-do, but with feedback) and sees the percentage of answers.
--  * polls: the question and its 2-8 options. Approved people can read; only admins write.
--  * poll_votes: one row per chosen option per person. People can read ONLY their own rows and can never write
--    directly; every vote goes through cast_vote(), every tally through poll_results() / admin_poll_voters().
--  * Deleting a person cascades to their votes (poll_votes.user_id -> profiles on delete cascade) and leaves the
--    polls they created in place with no author (polls.created_by on delete set null).

-- 1. Tables ----------------------------------------------------------------------------------------
-- CHECK constraints cannot contain sub-selects, so the per-option length rule lives in an immutable helper.
create or replace function public.poll_options_ok(p_options text[]) returns boolean
language sql immutable as $$
  select p_options is not null
    and array_ndims(p_options) = 1
    and array_length(p_options, 1) between 2 and 8
    and not exists (select 1 from unnest(p_options) o where o is null or length(btrim(o)) not between 1 and 100);
$$;

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(btrim(question)) between 1 and 300),
  options text[] not null check (public.poll_options_ok(options)),
  multiple boolean not null default false,       -- allow more than one answer
  anonymous boolean not null default false,      -- admins never see who picked what
  show_results boolean not null default false,   -- members see percentages after they vote
  closes_at timestamptz,                         -- null = stays open until an admin closes it
  closed boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_idx int not null check (option_idx >= 0 and option_idx < 8),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id, option_idx)
);
create index if not exists poll_votes_user_idx on public.poll_votes (user_id);

-- 2. Row level security ------------------------------------------------------------------------------
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

-- Pending / rejected accounts see nothing (same restrictive policy as every other table, see 0008).
drop policy if exists "approved only" on public.polls;
create policy "approved only" on public.polls as restrictive for all to authenticated
  using (public.is_approved()) with check (public.is_approved());
drop policy if exists "approved only" on public.poll_votes;
create policy "approved only" on public.poll_votes as restrictive for all to authenticated
  using (public.is_approved()) with check (public.is_approved());

drop policy if exists "polls read" on public.polls;
create policy "polls read" on public.polls for select to authenticated using (true);
drop policy if exists "polls admin insert" on public.polls;
create policy "polls admin insert" on public.polls for insert to authenticated with check (public.is_admin());
drop policy if exists "polls admin update" on public.polls;
create policy "polls admin update" on public.polls for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "polls admin delete" on public.polls;
create policy "polls admin delete" on public.polls for delete to authenticated using (public.is_admin());

-- Votes: a person can read only their own rows. There is deliberately NO insert/update/delete policy.
drop policy if exists "votes read own" on public.poll_votes;
create policy "votes read own" on public.poll_votes for select to authenticated using (user_id = auth.uid());

revoke all on public.polls, public.poll_votes from anon;
revoke insert, update, delete, truncate on public.poll_votes from authenticated;  -- belt and braces: RPCs only

-- 3. cast_vote: replaces the caller's previous vote atomically ------------------------------------------
create or replace function public.cast_vote(p_poll uuid, p_options int[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.polls%rowtype;
  n int;
begin
  if uid is null or not public.is_approved() then raise exception 'not approved'; end if;
  select * into p from polls where id = p_poll;
  if not found then raise exception 'poll not found'; end if;
  if p.closed or (p.closes_at is not null and p.closes_at <= now()) then raise exception 'poll is closed'; end if;

  n := coalesce(array_length(p_options, 1), 0);
  if n = 0 then raise exception 'choose an answer'; end if;
  if not p.multiple and n <> 1 then raise exception 'choose exactly one answer'; end if;
  if n > array_length(p.options, 1) then raise exception 'too many answers'; end if;
  if exists (select 1 from unnest(p_options) o where o is null or o < 0 or o >= array_length(p.options, 1)) then
    raise exception 'invalid option';
  end if;
  if (select count(distinct o) from unnest(p_options) o) <> n then raise exception 'duplicate options'; end if;

  -- One transaction: serialise this person's votes on this poll, drop the old answer, store the new one.
  perform pg_advisory_xact_lock(hashtextextended(p_poll::text || uid::text, 0));
  delete from poll_votes where poll_id = p_poll and user_id = uid;
  insert into poll_votes (poll_id, user_id, option_idx)
    select p_poll, uid, o from unnest(p_options) o;
end;
$$;

-- 4. poll_results: one row per option (option_idx, votes, voters = number of people who answered) -------
-- Admins always; members only when the poll shows results AND they have voted.
create or replace function public.poll_results(p_poll uuid)
returns table (option_idx int, votes bigint, voters bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.polls%rowtype;
begin
  if uid is null or not public.is_approved() then raise exception 'not approved'; end if;
  select * into p from polls where id = p_poll;
  if not found then raise exception 'poll not found'; end if;
  if not public.is_admin() then
    if not p.show_results or not exists (select 1 from poll_votes v where v.poll_id = p_poll and v.user_id = uid) then
      raise exception 'results are not available';
    end if;
  end if;
  return query
    select i - 1,
           (select count(*) from poll_votes v where v.poll_id = p_poll and v.option_idx = i - 1),
           (select count(distinct v.user_id) from poll_votes v where v.poll_id = p_poll)
    from generate_series(1, array_length(p.options, 1)) i
    order by 1;
end;
$$;

-- 5. admin_poll_voters (admins only): voted = true rows say who picked what, voted = false rows are approved people
-- who have not answered. For anonymous polls the voted = true rows are NOT returned (no names, no picks); the
-- non-voters list is still returned. Multi-choice voters appear once per option picked.
create or replace function public.admin_poll_voters(p_poll uuid)
returns table (user_id uuid, name text, option_idx int, voted boolean)
language plpgsql stable security definer set search_path = public as $$
declare p public.polls%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into p from polls where id = p_poll;
  if not found then raise exception 'poll not found'; end if;
  if not p.anonymous then
    return query
      select v.user_id, coalesce(nullif(pr.name, ''), pr.email, '(no name)')::text, v.option_idx, true
      from poll_votes v join profiles pr on pr.id = v.user_id
      where v.poll_id = p_poll
      order by 2, 3;
  end if;
  return query
    select pr.id, coalesce(nullif(pr.name, ''), pr.email, '(no name)')::text, null::int, false
    from profiles pr
    where pr.status = 'approved'
      and not exists (select 1 from poll_votes v where v.poll_id = p_poll and v.user_id = pr.id)
    order by 2;
end;
$$;

revoke execute on function public.cast_vote(uuid, int[]), public.poll_results(uuid), public.admin_poll_voters(uuid)
  from public, anon;
grant execute on function public.cast_vote(uuid, int[]), public.poll_results(uuid), public.admin_poll_voters(uuid)
  to authenticated;
