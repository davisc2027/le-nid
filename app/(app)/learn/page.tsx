import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ALL_LESSONS } from "@/lib/french/content";
import LandmarkArt from "@/components/art/LandmarkArt";
import Rosace from "@/components/art/Rosace";
import { StreakCount } from "@/components/art/OdileSays";
import Backdrop from "@/components/art/Backdrop";

export default async function Learn() {
  const supabase = await createClient();
  const [{ data: lessons }, { data: cards }, { data: streak }, { data: xp }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id"),
    supabase.from("srs_cards").select("learned_at, due"),
    supabase.from("streaks").select("current, last_day").maybeSingle(),
    supabase.from("xp_events").select("amount"),
  ]);
  const learned = cards?.filter((c) => c.learned_at).length ?? 0;
  const due = cards?.filter((c) => c.learned_at && c.due && new Date(c.due) <= new Date()).length ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <Backdrop />
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-extrabold">Learn</h1>
        <p className="font-bold text-primary">🔥 <StreakCount current={streak?.current} lastDay={streak?.last_day} /> · {xp?.reduce((n, e) => n + e.amount, 0) ?? 0} XP</p>
      </div>
      <Link href="/french" className="card flex min-h-28 flex-row items-center gap-4">
        <LandmarkArt unit="u4" progress={(lessons?.length ?? 0) / ALL_LESSONS.length} size={72} />
        <div><h2 className="text-lg font-extrabold">French</h2><p className="text-sm text-muted">Everyday phrases · {lessons?.length ?? 0} of {ALL_LESSONS.length} lessons</p></div>
      </Link>
      <Link href="/scripture" className="card flex min-h-28 flex-row items-center gap-4">
        <Rosace filled={learned} total={Math.max(learned, 6)} size={72} />
        <div><h2 className="text-lg font-extrabold">Verses</h2><p className="text-sm text-muted">{learned} learned{due > 0 ? ` · ${due} due for review` : ""}</p></div>
      </Link>
    </div>
  );
}
