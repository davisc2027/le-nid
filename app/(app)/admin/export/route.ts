import { createClient, getProfile } from "@/lib/supabase/server";
import { audit } from "@/lib/admin-audit";
import { BOM, csvLine, rosterRows, todoRows, type AssignmentLite, type RosterPerson, type TodoLite } from "@/lib/csv";

// GET /admin/export?type=roster (default) or ?type=todos. Admins only. Each download is written to admin_audit.
// Never cached: it holds personal data (emergency contacts, medical notes).

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const deny = (status: number, text: string) => new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE } });

export async function GET(request: Request) {
  // Same check as every admin action (requireAdmin in actions.ts): the signed-in profile must be an admin.
  const me = await getProfile();
  if (!me) return deny(401, "Sign in first");
  if (me.role !== "admin") return deny(403, "Admins only");
  const type = new URL(request.url).searchParams.get("type") ?? "roster";
  if (type !== "roster" && type !== "todos") return deny(400, "Unknown export");

  const supabase = await createClient();
  const [roster, push, todosRaw, asg] = await Promise.all([
    supabase.rpc("admin_roster"),
    supabase.rpc("admin_push_status"),
    (async () => {
      const full = await supabase.from("todos").select("id, title, due_date, requires_upload, retired_at").order("due_date");
      if (!full.error) return full.data;
      const old = await supabase.from("todos").select("id, title, due_date, requires_upload").order("due_date"); // before migration 0018
      return old.error ? null : old.data;
    })() as Promise<(TodoLite & { retired_at?: string | null })[] | null>,
    supabase.from("todo_assignments").select("todo_id, user_id, completed_at, upload_path"),
  ]);
  if (roster.error) return deny(409, "Run migration 0021 first (the roster function is missing).");
  if (!todosRaw || asg.error) return deny(500, "Could not read the to-dos. Try again.");

  const people = (roster.data ?? []) as RosterPerson[];
  const todos = todosRaw.filter((t) => !t.retired_at);
  const assignments = (asg.data ?? []) as AssignmentLite[];
  const approved = new Set(people.map((p) => p.id));
  const pushOn = push.error ? null : new Set(((push.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const rows = type === "roster"
    ? rosterRows(people, todos, assignments.filter((a) => approved.has(a.user_id)), pushOn)
    : todoRows(people, todos, assignments);

  // Logged before sending. A missing audit table (migration 0020) must not block a leader from getting the list.
  await audit(me.id, type === "roster" ? "export_roster" : "export_todos", null, { rows: rows.length - 1 });

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(BOM)); // so Excel reads accents (é, ï) as UTF-8
      for (const row of rows) controller.enqueue(enc.encode(csvLine(row) + "\r\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="le-nid-${type}-${day}.csv"`,
      ...NO_STORE,
    },
  });
}
