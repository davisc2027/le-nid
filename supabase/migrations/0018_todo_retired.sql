-- 0018: an admin can retire a to-do (hide it for everyone without deleting anyone's progress). Safe to re-run.
-- retired_at is null for live to-dos. The app keeps working before this is run (the Retire button says "Run migration 0018 first").
alter table public.todos add column if not exists retired_at timestamptz;
