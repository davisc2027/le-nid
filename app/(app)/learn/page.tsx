import Link from "next/link";
import { Flame, Landmark } from "lucide-react";
import { CARDS } from "@/components/culture/data";
import LoadError from "@/components/LoadError";
import { createClient } from "@/lib/supabase/server";
import { ALL_LESSONS } from "@/lib/french/content";
import LandmarkArt from "@/components/art/LandmarkArt";
import Rosace from "@/components/art/Rosace";
import { StreakCount } from "@/components/art/OdileSays";
import OdileActor from "@/components/art/OdileActor";
import CirclesDiagram from "@/components/gospel/CirclesDiagram";

export default async function Learn() {
  const supabase = await createClient();
  // my_stats() (migration 0010) returns the XP total, lesson count and streak in one small row, so the page no
  // longer downloads every xp_events and lesson_progress row. Before 0010 (or if the RPC fails) fall back to the old queries.
  const [stats, learnedRes, dueRes] = await Promise.all([
    supabase.rpc("my_stats").maybeSingle(),
    supabase.from("srs_cards").select("*", { count: "exact", head: true }).not("learned_at", "is", null),
    supabase.from("srs_cards").select("*", { count: "exact", head: true }).not("learned_at", "is", null).lte("due", new Date().toISOString()),
  ]);
  let lessonCount = 0, xpTotal = 0, streak: { current: number; last_day: string | null } | null = null;
  let failed = !!(learnedRes.error || dueRes.error);
  const row = stats.data as { xp_total: number | string; lessons_done: number; streak: number; last_day: string | null } | null;
  if (!stats.error && row) {
    lessonCount = row.lessons_done; xpTotal = Number(row.xp_total); streak = { current: row.streak, last_day: row.last_day };
  } else {
    const [{ data: lessons, error: e1 }, { data: st, error: e2 }, { data: xp, error: e3 }] = await Promise.all([
      supabase.from("lesson_progress").select("lesson_id"),
      supabase.from("streaks").select("current, last_day").maybeSingle(),
      supabase.from("xp_events").select("amount"),
    ]);
    if (e1 || e2 || e3) failed = true;
    lessonCount = lessons?.length ?? 0; streak = st ?? null; xpTotal = xp?.reduce((n, e) => n + e.amount, 0) ?? 0;
  }
  const learned = learnedRes.count ?? 0;
  const due = dueRes.count ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-end gap-1.5"><OdileActor size={40} /><h1 className="text-2xl font-extrabold">Learn</h1></div>
        <p className="font-bold text-primary"><Flame size={18} className="mr-1 inline -mt-0.5 text-accent" aria-hidden="true" /><StreakCount current={streak?.current} lastDay={streak?.last_day} /> · {xpTotal} XP</p>
      </div>
      {failed && <LoadError what="your progress" />}
      <Link href="/learn/three-circles" className="card flex min-h-28 flex-row items-center gap-4 !border-primary bg-tint">
        <span className="w-[72px] shrink-0"><CirclesDiagram step={5} lang="en" compact labels={{ design: "Three Circles", brokenness: "", gospel: "", believe: "", recover: "" }} /></span>
        <div>
          <h2 className="text-lg font-extrabold">Share the gospel: Three Circles <span className="ml-1 inline-block rounded-full bg-accent px-2 py-0.5 align-middle text-[11px] font-black text-[#2b2118]">NEW</span></h2>
          <p className="text-sm text-muted">Learn the words, then show it on your phone. English or French.</p>
          <p className="mt-1 text-xs font-bold text-primary">Watch · Words · Practice</p>
        </div>
      </Link>
      <Link href="/french" className="card flex min-h-28 flex-row items-center gap-4">
        <LandmarkArt unit="u4" progress={lessonCount / ALL_LESSONS.length} size={72} />
        <div><h2 className="text-lg font-extrabold">French</h2><p className="text-sm text-muted">Everyday phrases · {lessonCount} of {ALL_LESSONS.length} lessons</p></div>
      </Link>
      <Link href="/scripture" className="card flex min-h-28 flex-row items-center gap-4">
        <Rosace filled={learned} total={Math.max(learned, 6)} size={72} />
        <div><h2 className="text-lg font-extrabold">Verses</h2><p className="text-sm text-muted">{learned} learned{due > 0 ? ` · ${due} due for review` : ""}</p></div>
      </Link>
      <Link href="/culture" className="card flex min-h-28 flex-row items-center gap-4">
        <span className="grid size-[72px] shrink-0 place-items-center rounded-full bg-tint text-primary"><Landmark size={36} aria-hidden="true" /></span>
        <div><h2 className="text-lg font-extrabold">Culture</h2><p className="text-sm text-muted">À savoir · etiquette, faith context and Strasbourg · {CARDS.length} cards and a quiz</p></div>
      </Link>
    </div>
  );
}
