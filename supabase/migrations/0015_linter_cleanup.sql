-- 0015: tidy-ups from the Supabase linter. Safe to re-run. No behaviour change for signed-in people.
--  * poll_options_ok gets a fixed search_path.
--  * Trigger/helper functions that should never be called from the API are closed to anon (and handle_new_user to everyone).
--  * Indexes on foreign keys that had none (they speed up deleting a person and the joins the app does).

alter function public.poll_options_ok(text[]) set search_path = public;

-- handle_new_user only ever runs as the sign-up trigger.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Both check is_admin() themselves; signed-out callers have no business reaching them. (Signed-in people keep access: RLS policies call is_admin().)
revoke execute on function public.admin_set_team(uuid, text) from public, anon;
revoke execute on function public.is_admin() from public, anon;

create index if not exists announcements_author_idx on public.announcements (author);
create index if not exists files_meeting_idx on public.files (meeting_id);
create index if not exists polls_created_by_idx on public.polls (created_by);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists todo_assignments_user_idx on public.todo_assignments (user_id);
create index if not exists xp_events_user_idx on public.xp_events (user_id);
