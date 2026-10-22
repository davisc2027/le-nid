-- M2: to-dos with deadlines, per-person assignments, uploads, and reminder log.

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  due_date date not null,
  requires_upload boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.todo_assignments (
  todo_id uuid not null references public.todos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz,
  upload_path text,
  primary key (todo_id, user_id)
);

-- One row per reminder sent, so the daily job never double-sends.
create table public.reminder_log (
  todo_id uuid not null,
  user_id uuid not null,
  days_before int not null,
  sent_at timestamptz not null default now(),
  primary key (todo_id, user_id, days_before)
);

alter table public.todos enable row level security;
alter table public.todo_assignments enable row level security;
alter table public.reminder_log enable row level security; -- no policies: service role only

create policy "todos read assigned" on public.todos for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.todo_assignments a where a.todo_id = id and a.user_id = auth.uid()));
create policy "todos admin write" on public.todos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "assignments read own" on public.todo_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "assignments update own" on public.todo_assignments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "assignments admin write" on public.todo_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Private bucket for things like passport copies. Each person writes only under their own folder.
insert into storage.buckets (id, name, public) values ('todo-uploads', 'todo-uploads', false)
  on conflict (id) do nothing;
create policy "todo uploads own" on storage.objects for all to authenticated
  using (bucket_id = 'todo-uploads' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text))
  with check (bucket_id = 'todo-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
