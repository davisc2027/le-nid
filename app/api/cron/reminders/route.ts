import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

const OFFSETS = [0, 1, 5]; // reminder slots, in days before the due date; -1 = overdue

const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); // YYYY-MM-DD

const weekdayParis = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date()); // Mon, Tue, ...

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
    // Per-to-do reminders are push notifications only. Email is limited to one weekly summary (below), so the
    // free email quota is never the bottleneck however many to-dos fall on the same day.
    await sendPushToAll({ title: `Reminder: ${todo.title}`, body: `This is ${when}.`, url: "/todos" }, [r.user_id]);
    count++;
  }));

  // Weekly summary email: Mondays (Paris time), one per person, only when they have something open that is
  // overdue or due within 7 days. usage_daily (migration 0010) records the send so a retry never duplicates it.
  let digests = 0;
  if (weekdayParis() === "Mon" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const byUser = new Map<string, { email: string; items: { title: string; due: string; left: number }[] }>();
    for (const r of rows ?? []) {
      const todo = r.todos as unknown as { title: string; due_date: string } | null;
      const email = (r.profiles as unknown as { email: string | null } | null)?.email;
      if (!todo || !email) continue;
      const left = daysBetween(today, todo.due_date);
      if (left > 7) continue;
      const u = byUser.get(r.user_id) ?? { email, items: [] };
      u.items.push({ title: todo.title, due: todo.due_date, left });
      byUser.set(r.user_id, u);
    }
    const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/todos` : "";
    for (const [userId, u] of byUser) {
      const { data: claimed, error: claimError } = await db
        .from("usage_daily")
        .upsert({ user_id: userId, day: today, kind: "digest", amount: 1 }, { onConflict: "user_id,day,kind", ignoreDuplicates: true })
        .select("user_id");
      if (claimError || !claimed?.length) continue; // already sent this week, or the table is missing: do not risk duplicates
      const lines = u.items.sort((a, b) => a.due.localeCompare(b.due)).map((i) => {
        const day = new Date(`${i.due}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
        return `- ${i.title}: ${i.left < 0 ? `overdue (was due ${day})` : i.left === 0 ? "due today" : `due ${day}`}`;
      });
      await sendEmail(u.email, `Your Le Nid week: ${u.items.length} to-do${u.items.length === 1 ? "" : "s"} open`,
        `Here is what is open for you:\n\n${lines.join("\n")}\n\n${site ? `Finish them in Le Nid: ${site}\n\n` : ""}Reminders for each one also arrive as notifications in the app.`);
      digests++;
    }
  }
  return Response.json({ today, sent: count, digests });
}
