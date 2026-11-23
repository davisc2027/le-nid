-- 0019: lets an admin see WHO has notifications on (never the push endpoints or keys). Safe to re-run.
create or replace function public.admin_push_status()
returns table (user_id uuid, devices int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select s.user_id, count(*)::int from push_subscriptions s group by s.user_id;
end;
$$;
revoke execute on function public.admin_push_status() from public, anon;
grant execute on function public.admin_push_status() to authenticated;
