import { createClient, getProfile } from "@/lib/supabase/server";
import TodoItem from "@/components/TodoItem";

export default async function Todos() {
  const supabase = await createClient();
  const user = await getProfile();
  type Row = { completed_at: string | null; upload_path: string | null; todos: unknown };
  // retired_at exists after migration 0018; before it, fall back to the old query so the page keeps working.
  let { data: rows } = (await supabase
    .from("todo_assignments")
    .select("completed_at, upload_path, todos(id, title, description, due_date, requires_upload, retired_at)")
    .eq("user_id", user!.id)) as { data: Row[] | null; error: unknown };
  if (!rows) {
    rows = (await supabase
      .from("todo_assignments")
      .select("completed_at, upload_path, todos(id, title, description, due_date, requires_upload)")
      .eq("user_id", user!.id)).data as Row[] | null;
  }
  const items = (rows ?? [])
    .map((r) => ({ ...r, todo: r.todos as unknown as { id: string; title: string; description: string; due_date: string; requires_upload: boolean } }))
    .filter((r) => r.todo && !(r.todo as { retired_at?: string | null }).retired_at)
    .sort((a, b) => Number(!!a.completed_at) - Number(!!b.completed_at) || a.todo.due_date.localeCompare(b.todo.due_date));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">To-dos</h1>
      {items.length === 0 && <p className="text-muted">Nothing assigned to you.</p>}
      {items.map((r) => (
        <TodoItem key={r.todo.id} todoId={r.todo.id} userId={user!.id} title={r.todo.title}
          description={r.todo.description} dueDate={r.todo.due_date} requiresUpload={r.todo.requires_upload}
          completed={!!r.completed_at} hasUpload={!!r.upload_path} />
      ))}
    </div>
  );
}
