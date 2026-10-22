import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

const OFFSETS = [0, 1, 5]; // reminder slots, in days before the due date; -1 = overdue

const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); // YYYY-MM-DD

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// Called daily by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });

  const db = createServiceClient();
  const today = parisToday();
  const { data: rows, error } = await db
    .from("todo_assignments")
    .select("todo_id, user_id, todos(title, due_date), profiles!inner(email, status)")
    .eq("profiles.status", "approved")
    .is("completed_at", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let count = 0;
  await Promise.all((rows ?? []).map(async (r) => {
    const todo = r.todos as unknown as { title: string; due_date: string } | null;
    if (!todo) return;
    const left = daysBetween(today, todo.due_date);
    // Catch-up: the tightest slot we're inside of (so a missed day still gets its reminder).
    const slot = left < 0 ? -1 : OFFSETS.find((o) => o >= left);
    if (slot === undefined) return;
    // Claim the slot first; only the run that inserts the row sends.
    const { data: claimed } = await db
      .from("reminder_log")
      .upsert({ todo_id: r.todo_id, user_id: r.user_id, days_before: slot }, { onConflict: "todo_id,user_id,days_before", ignoreDuplicates: true })
      .select("todo_id");
    if (!claimed?.length) return;
    const when = left < 0 ? "overdue" : left === 0 ? "due today" : left === 1 ? "due tomorrow" : `due in ${left} days`;
    await sendPushToAll({ title: `Reminder: ${todo.title}`, body: `This is ${when}.`, url: "/todos" }, [r.user_id]);
    const email = (r.profiles as unknown as { email: string | null } | null)?.email;
    if (email) await sendEmail(email, `Reminder: ${todo.title}`, `${todo.title} is ${when}. Open Le Nid to finish it.`).catch(() => {});
    count++;
  }));
  return Response.json({ today, sent: count });
}
