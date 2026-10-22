-- Makes profile creation resilient: a failure here must never block sign-up, and the app can self-heal a missing profile.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user failed: %', sqlerrm;
  return new;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members may create their own profile row (safety net), but only as a member.
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'member');

-- Backfill anyone who signed up while profile creation was failing.
insert into public.profiles (id, email)
select id, email from auth.users on conflict (id) do nothing;
