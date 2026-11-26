-- 0021 roster: emergency contact + medical notes + privacy consent on each profile, and the leaders' roster. Safe to re-run. Run after 0001-0020.
--
-- BACKWARD COMPATIBLE: the app works before this is run. Until then the "My emergency info" card, the consent screen,
-- the Roster and the Needs attention checks for emergency contacts and privacy simply stay hidden (Admin says
-- "Run migration 0021 first").
--
--  * profiles gets: emergency_name, emergency_phone, emergency_relation, medical_notes, privacy_ack_at.
--  * Members can NOT read or write these columns directly (the column grants from 0007/0010 do not include them, and
--    they are revoked again below to be explicit). They go through the functions here, which pin search_path and check
--    auth.uid() / is_approved() / is_admin() themselves:
--      save_my_emergency(name, phone, relation, notes)   the caller's own row, approved people only, with length limits
--      accept_privacy()                                  stamps privacy_ack_at once (never overwritten)
--      my_profile_extras()                               the caller's own values
--      admin_roster()                                    admins only: every approved person with these fields
--  * Nobody but an admin can see another person's emergency contact or medical notes.

alter table public.profiles
  add column if not exists emergency_name text,
  add column if not exists emergency_phone text,
  add column if not exists emergency_relation text,
  add column if not exists medical_notes text,
  add column if not exists privacy_ack_at timestamptz;

-- Second line of defence behind the function checks.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_emergency_len' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_emergency_len check (
      length(emergency_name) <= 80 and length(emergency_phone) <= 30 and length(emergency_relation) <= 40 and length(medical_notes) <= 1000
    );
  end if;
end $$;

-- Explicit: no direct column access for members or anon (a no-op when never granted).
revoke select (emergency_name, emergency_phone, emergency_relation, medical_notes, privacy_ack_at) on public.profiles from authenticated, anon;
revoke update (emergency_name, emergency_phone, emergency_relation, medical_notes, privacy_ack_at) on public.profiles from authenticated, anon;
revoke insert (emergency_name, emergency_phone, emergency_relation, medical_notes, privacy_ack_at) on public.profiles from authenticated, anon;

-- 1. A member saves their own emergency info ------------------------------------------------------
create or replace function public.save_my_emergency(p_name text, p_phone text, p_relation text, p_notes text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n text := nullif(trim(coalesce(p_name, '')), '');
  ph text := nullif(trim(coalesce(p_phone, '')), '');
  rel text := nullif(trim(coalesce(p_relation, '')), '');
  nt text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if uid is null or not public.is_approved() then raise exception 'not approved'; end if;
  if length(n) > 80 then raise exception 'The name is too long (80 characters at most)'; end if;
  if length(rel) > 40 then raise exception 'The relationship is too long (40 characters at most)'; end if;
  if length(nt) > 1000 then raise exception 'The notes are too long (1000 characters at most)'; end if;
  if ph is not null and (ph !~ '^[0-9+()./ -]{5,30}$' or ph !~ '[0-9].*[0-9].*[0-9].*[0-9]') then
    raise exception 'The phone number does not look right. Use digits, spaces and + ( ) - only.';
  end if;
  update profiles set emergency_name = n, emergency_phone = ph, emergency_relation = rel, medical_notes = nt where id = uid;
end;
$$;

-- 2. A member accepts the privacy notice (first time only) ---------------------------------------------
create or replace function public.accept_privacy()
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  at_ timestamptz;
begin
  if uid is null or not public.is_approved() then raise exception 'not approved'; end if;
  update profiles set privacy_ack_at = coalesce(privacy_ack_at, now()) where id = uid returning privacy_ack_at into at_;
  return at_;
end;
$$;

-- 3. A member reads their own values ---------------------------------------------------------------
create or replace function public.my_profile_extras()
returns table (emergency_name text, emergency_phone text, emergency_relation text, medical_notes text, privacy_ack_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.emergency_name, p.emergency_phone, p.emergency_relation, p.medical_notes, p.privacy_ack_at
  from profiles p where p.id = auth.uid() and public.is_approved();
$$;

-- 4. The leaders' roster (approved people only) ----------------------------------------------------
create or replace function public.admin_roster()
returns table (
  id uuid, name text, email text, team text, role text, status text, created_at timestamptz,
  emergency_name text, emergency_phone text, emergency_relation text, medical_notes text, privacy_ack_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() and public.is_approved()) then raise exception 'Admins only'; end if;
  return query
    select p.id, p.name, p.email, p.team, p.role, p.status, p.created_at,
           p.emergency_name, p.emergency_phone, p.emergency_relation, p.medical_notes, p.privacy_ack_at
    from profiles p where p.status = 'approved' order by p.name, p.email;
end;
$$;

revoke execute on function public.save_my_emergency(text, text, text, text), public.accept_privacy(),
  public.my_profile_extras(), public.admin_roster() from public, anon;
grant execute on function public.save_my_emergency(text, text, text, text), public.accept_privacy(),
  public.my_profile_extras(), public.admin_roster() to authenticated;
