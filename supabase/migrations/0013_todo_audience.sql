-- To-dos can be for specific people. everyone = true (default) keeps today's behaviour: every approved person, including later joiners.
alter table public.todos add column if not exists everyone boolean not null default true;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  ok := exists (select 1 from public.allowed_emails where email = lower(coalesce(new.email, '')))
        or not exists (select 1 from public.profiles where role = 'admin');
  insert into public.profiles (id, email, name, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), case when ok then 'approved' else 'pending' end)
  on conflict (id) do nothing;
  if ok then
    begin
      insert into public.todo_assignments (todo_id, user_id) select t.id, new.id from public.todos t where t.everyone on conflict do nothing;
    exception when others then
      raise warning 'handle_new_user assignments failed: %', sqlerrm;
    end;
  end if;
  return new;
exception when others then
  raise warning 'handle_new_user failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function public.admin_set_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('pending', 'approved', 'rejected') then raise exception 'bad status'; end if;
  update profiles set status = p_status where id = p_id and (role <> 'admin' or p_status = 'approved');
  if not found then return; end if;
  if p_status = 'approved' then
    insert into todo_assignments (todo_id, user_id) select t.id, p_id from todos t where t.everyone on conflict do nothing;
  else
    delete from push_subscriptions where user_id = p_id;
  end if;
end;
$$;
revoke execute on function public.admin_set_status(uuid, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text) to authenticated;
