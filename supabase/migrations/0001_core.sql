-- Le Nid core schema (M1): profiles, announcements, push, itinerary, meetings, files.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  author uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  start_time time,
  end_time time,
  title text not null,
  location text,
  map_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date not null,
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete set null,
  title text not null,
  kind text not null default 'other' check (kind in ('recap', 'homework', 'slides', 'other')),
  storage_path text not null,
  release_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Row level security
alter table public.profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.meetings enable row level security;
alter table public.files enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own name" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles admin all" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "announcements read" on public.announcements for select to authenticated using (true);
create policy "announcements admin write" on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "push own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "itinerary read" on public.itinerary_items for select to authenticated using (true);
create policy "itinerary admin write" on public.itinerary_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "meetings read" on public.meetings for select to authenticated using (true);
create policy "meetings admin write" on public.meetings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Members only see files whose release time has passed; admins see everything.
create policy "files read released" on public.files for select to authenticated
  using (release_at <= now() or public.is_admin());
create policy "files admin write" on public.files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Storage: private bucket; files are served through signed URLs.
insert into storage.buckets (id, name, public) values ('files', 'files', false)
  on conflict (id) do nothing;

create policy "storage admin upload" on storage.objects for all to authenticated
  using (bucket_id = 'files' and public.is_admin())
  with check (bucket_id = 'files' and public.is_admin());
-- Members read a storage object only if a released file row points at it.
create policy "storage member read" on storage.objects for select to authenticated
  using (bucket_id = 'files' and exists (
    select 1 from public.files f where f.storage_path = name and f.release_at <= now()));
