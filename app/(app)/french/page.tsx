import Link from "next/link";
import { Check, ChevronRight, Flame, Landmark, Lock, Mic, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UNITS } from "@/lib/french/content";
import LandmarkArt from "@/components/art/LandmarkArt";
import OdileSays, { StreakCount } from "@/components/art/OdileSays";
import GentleToggle from "@/components/french/GentleToggle";

export default async function French() {
  const supabase = await createClient();
  const [{ data: done }, { data: streak }, { data: xp }, dueQ, learnedQ] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id"),
    supabase.from("streaks").select("current, last_day").maybeSingle(),
    supabase.from("xp_events").select("amount"),
    supabase.from("vocab_cards").select("key", { count: "exact", head: true }).lte("due", new Date().toISOString()),
    supabase.from("vocab_cards").select("key", { count: "exact", head: true }),
  ]);
  const finished = new Set(done?.map((d) => d.lesson_id));
  // Practice needs migration 0009; if vocab_cards can't be read, the button is hidden.
  const practiceOk = !dueQ.error && !learnedQ.error && learnedQ.count !== null;
  const dueCount = dueQ.count ?? 0;
  const learned = learnedQ.count ?? 0;
  const total = xp?.reduce((n, e) => n + e.amount, 0) ?? 0;

  // A lesson is open up to one past the furthest finished lesson. For a learner going in order this is "once the one
  // before it is finished"; lessons added earlier in the course later on (the u0 sounds unit) never lock anyone out
  // of where they had already reached.
  const order = UNITS.flatMap((u) => u.lessons.map((l) => l.id));
  const frontier = order.reduce((m, id, k) => (finished.has(id) ? k : m), -1);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">French</h1>
        <p className="text-sm font-bold text-primary"><Flame size={18} className="mr-1 inline -mt-0.5 text-accent" aria-hidden="true" /><StreakCount current={streak?.current} lastDay={streak?.last_day} /> · {total} XP</p>
      </div>
      <OdileSays topic={streak?.last_day ? "missed" : "welcome"} mood="happy" lastDay={streak?.last_day ?? null} />
      <Link href="/culture" className="card flex min-h-12 items-center gap-3 !py-3 font-bold"><Landmark size={20} className="shrink-0 text-accent" aria-hidden="true" /><span className="flex-1">À savoir: culture and etiquette</span><ChevronRight size={20} className="text-muted" aria-hidden="true" /></Link>
      {practiceOk && (learned > 0 ? (
        <Link href="/french/practice" className="btn w-full">{dueCount > 0 ? `Practice · ${dueCount} due` : "Practice"}</Link>
      ) : (
        <p className="card text-sm text-muted">Practice unlocks after your first lesson. Phrases you learn come back here for review.</p>
      ))}
      <Link href="/french/practice/sounds" className="card flex min-h-12 items-center gap-3 !py-3 font-bold"><Mic size={20} className="shrink-0 text-accent" aria-hidden="true" /><span className="flex-1">Pronunciation practice</span><ChevronRight size={20} className="text-muted" aria-hidden="true" /></Link>
      {UNITS.map((u) => (
        <section key={u.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <LandmarkArt unit={u.id} progress={u.lessons.filter((l) => finished.has(l.id)).length / u.lessons.length} />
            <div>
              <h2 className="font-extrabold text-primary">{u.title}</h2>
              <p className="text-sm text-muted">{u.blurb}</p>
            </div>
          </div>
          {u.lessons.map((l) => {
            const isDone = finished.has(l.id);
            const open = order.indexOf(l.id) <= frontier + 1;
            const body = (
              <>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full border-2 font-extrabold ${isDone ? "border-good bg-good text-surface" : open ? "border-accent text-accent" : "border-border text-muted"}`}>
                  {isDone ? <Check size={20} strokeWidth={3} aria-hidden="true" /> : open ? <Play size={18} fill="currentColor" aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
                </span>
                <span className="font-bold">{l.title}</span>
              </>
            );
            return open ? (
              <Link key={l.id} href={`/french/${l.id}`} className="card flex items-center gap-3">{body}</Link>
            ) : (
              <div key={l.id} className="card flex items-center gap-3 opacity-60">{body}</div>
            );
          })}
        </section>
      ))}
      <GentleToggle />
    </div>
  );
}
