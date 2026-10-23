-- Verse mastery path: where each learner is on a verse (phase, step inside the phase, retest time, mastered date),
-- so they can leave mid-verse and resume on any device. One small jsonb per srs_cards row; shape in
-- lib/scripture/mastery.ts (type Progress), e.g.
--   {"v":1,"phase":2,"step":3,"sig":"6-6-5-3-6","updatedAt":"2026-10-23T18:04:00.000Z"}
-- Safe to run more than once. Row security is unchanged: the existing "cards own" policy (own rows only) and the
-- restrictive "approved only" policy from 0008 already cover every column of srs_cards, and no new grants are needed.
-- The app works before this runs (progress is then kept on the device only).

alter table public.srs_cards add column if not exists progress jsonb;

-- Keep it a small object: it is written by the client, so cap the size (a real record is about 200 bytes).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'srs_cards_progress_small' and conrelid = 'public.srs_cards'::regclass) then
    alter table public.srs_cards add constraint srs_cards_progress_small
      check (progress is null or (jsonb_typeof(progress) = 'object' and pg_column_size(progress) <= 2048));
  end if;
end $$;

comment on column public.srs_cards.progress is 'Verse mastery path position (lib/scripture/mastery.ts Progress). Null until the learner starts the path.';

-- Make PostgREST see the new column right away (otherwise the API can answer "column not found" for a minute).
notify pgrst, 'reload schema';
