import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { sendEmail } from "@/lib/email";

const OFFSETS = [5, 1, 0]; // days before the due date

const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); // YYYY-MM-DD

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// Called daily by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const db = createServiceClient();
  const today = parisToday();
  const { data: rows } = await db
    .from("todo_assignments")
    .select("todo_id, user_id, todos(title, due_date), profiles(email)")
    .is("completed_at", null);

  const sent = await db.from("reminder_log").select("todo_id, user_id, days_before");
  const done = new Set(sent.data?.map((r) => `${r.todo_id}:${r.user_id}:${r.days_before}`));

  let count = 0;
  for (const r of rows ?? []) {
    const todo = r.todos as unknown as { title: string; due_date: string } | null;
    if (!todo) continue;
    const left = daysBetween(today, todo.due_date);
    if (!OFFSETS.includes(left) || done.has(`${r.todo_id}:${r.user_id}:${left}`)) continue;
    const when = left === 0 ? "due today" : left === 1 ? "due tomorrow" : `due in ${left} days`;
    await sendPushToAll({ title: `Reminder: ${todo.title}`, body: `This is ${when}.`, url: "/todos" }, [r.user_id]);
    const email = (r.profiles as unknown as { email: string | null } | null)?.email;
    if (email) await sendEmail(email, `Reminder: ${todo.title}`, `${todo.title} is ${when}. Open Le Nid to finish it.`);
    await db.from("reminder_log").insert({ todo_id: r.todo_id, user_id: r.user_id, days_before: left });
    count++;
  }
  return Response.json({ today, sent: count });
}
