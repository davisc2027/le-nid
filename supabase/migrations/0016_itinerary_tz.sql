-- 0016: itinerary time zones and "Updated" tags. Safe to re-run.
--  * tz: the zone the item's times are written in ('Europe/Paris' = Strasbourg, the default; 'America/Chicago' = Texas).
--  * updated_at: set by a trigger only when a visible field really changes. Existing rows start at created_at, so nothing shows "Updated" on day one.
-- The app keeps working before this is run (everything reads as Strasbourg time with no Updated tags).

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'itinerary_items' and column_name = 'updated_at') then
    alter table public.itinerary_items add column updated_at timestamptz not null default now();
    update public.itinerary_items set updated_at = created_at;
  end if;
end $$;

alter table public.itinerary_items add column if not exists tz text not null default 'Europe/Paris';

alter table public.itinerary_items drop constraint if exists itinerary_items_tz_check;
alter table public.itinerary_items add constraint itinerary_items_tz_check check (tz in ('Europe/Paris', 'America/Chicago'));

create or replace function public.itinerary_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.title, new.day, new.start_time, new.end_time, new.location, new.map_url, new.notes, new.tz)
     is distinct from (old.title, old.day, old.start_time, old.end_time, old.location, old.map_url, old.notes, old.tz) then
    new.updated_at = now();
  end if;
  return new;
end $$;

revoke execute on function public.itinerary_touch() from public, anon, authenticated;

drop trigger if exists itinerary_touch on public.itinerary_items;
create trigger itinerary_touch before update on public.itinerary_items
  for each row execute function public.itinerary_touch();
