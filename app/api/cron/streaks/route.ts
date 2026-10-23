import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";

export const maxDuration = 60;

const paris = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d); // YYYY-MM-DD

// Called daily in the evening by Vercel Cron (see vercel.json). Reminds people whose streak (2+ days) will break
// if they do not earn XP today. One push per person per day, claimed in usage_daily.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });

  const db = createServiceClient();
  const today = paris(new Date());
  const yesterday = paris(new Date(Date.now() - 86_400_000));
  const { data: rows, error } = await db
    .from("streaks")
    .select("user_id, current, profiles!inner(status)")
    .eq("last_day", yesterday)
    .gte("current", 2)
    .eq("profiles.status", "approved");
  if (error) return new Response(error.message, { status: 500 });

  let count = 0;
  await Promise.all((rows ?? []).map(async (r) => {
    const { data: claimed } = await db
      .from("usage_daily")
      .upsert({ user_id: r.user_id, day: today, kind: "streak_nudge", amount: 1 }, { onConflict: "user_id,day,kind", ignoreDuplicates: true })
      .select("user_id");
    if (!claimed?.length) return;
    await sendPushToAll({
      title: `Odile is watching your ${r.current}-day streak`,
      body: "One short lesson or review keeps it alive. She won't say anything. Loudly.",
      url: "/learn",
    }, [r.user_id]);
    count++;
  }));
  return Response.json({ ok: true, reminded: count });
}
