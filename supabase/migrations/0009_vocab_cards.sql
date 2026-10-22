-- Spaced repetition for French phrases (one FSRS card per phrase per user). Safe to re-run.
-- `key` is the normalized French phrase (see phraseKey in lib/french/exercises.ts).

create table if not exists public.vocab_cards (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  key text not null,
  state jsonb not null,
  due timestamptz not null,
  last_review timestamptz,
  primary key (user_id, key)
);

create index if not exists vocab_cards_user_due_idx on public.vocab_cards (user_id, due);

alter table public.vocab_cards enable row level security;

drop policy if exists "own vocab cards" on public.vocab_cards;
create policy "own vocab cards" on public.vocab_cards for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Same restrictive gate as 0008: pending or rejected accounts can read and write nothing.
drop policy if exists "approved only" on public.vocab_cards;
create policy "approved only" on public.vocab_cards as restrictive for all to authenticated
  using (public.is_approved()) with check (public.is_approved());

grant select, insert, update, delete on public.vocab_cards to authenticated;
